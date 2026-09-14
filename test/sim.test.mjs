// Headless full-loop simulation. Boots the real Game against the real theme
// pack and plays bots through many runs, then asserts the loop invariants and
// the pacing the Basic Launch gate depends on.
//
// Two profiles, because a single bot only measures one play style:
//   greedy  — descends the instant the quota allows, never retreats (a floor)
//   careful — banks levels and health before descending (closer to a human)
// Run with: node test/sim.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Game } from '../src/engine/game.js';
import * as save from '../src/engine/save.js';

const theme = JSON.parse(await readFile(new URL('../themes/deepcore_mine.json', import.meta.url), 'utf8'));
const STEP = 0.05;

function playProfile(name, { descendPolicy, kite }) {
  const game = new Game(theme);
  game.startRun();
  const runs = [];
  let levelUps = 0;
  let ticks = 0;
  const MAX_TICKS = 30 * 60 / STEP; // 30 simulated minutes

  while (ticks < MAX_TICKS) {
    ticks++;
    const before = game.state.stats.runs;
    game.tick(STEP);

    // A run ended (death); the engine auto-restarts when no UI is attached.
    if (game.state.stats.runs > before) {
      runs.push(game.lastRunSeconds ?? 0);
      continue;
    }
    if (!game.state.run.active) continue;

    // resolve level-ups: prefer survivability when hurt, else damage/economy
    if (game.run.pendingChoices) {
      const picks = game.run.pendingChoices;
      const hurt = game.field.hp() / game.field.maxHpValue() < 0.5;
      const pick = (hurt && picks.find(p => ['maxHp', 'hpRegen', 'damageTaken'].includes(p.effect.type))) || picks[0];
      game.run.choose(pick, false);
      levelUps++;
    }

    // spend: richest generator we can afford
    for (let i = theme.generators.length - 1; i >= 0; i--) {
      if (game.buyGenerator(theme.generators[i], 'max')) break;
    }

    // Steering is the player's job now that auto-seek is an unlock, so both
    // profiles drive the miner: toward ore normally, away from the nearest
    // threat when hurt (careful only).
    const st = game.field.st;
    const hpPct = game.field.hp() / game.field.maxHpValue();
    if (kite && hpPct < 0.55 && st.enemies.length) {
      let near = st.enemies[0], nd = Infinity;
      for (const e of st.enemies) {
        const d = (e.x - st.player.x) ** 2 + (e.y - st.player.y) ** 2;
        if (d < nd) { nd = d; near = e; }
      }
      game.field.setTarget(st.player.x - (near.x - st.player.x), st.player.y - (near.y - st.player.y));
    } else {
      let near = null, nd = Infinity;
      for (const c of [...st.pickups, ...st.nodes]) {
        const d = (c.x - st.player.x) ** 2 + (c.y - st.player.y) ** 2;
        if (d < nd) { nd = d; near = c; }
      }
      if (near) game.field.setTarget(near.x, near.y);
      else game.field.clearTarget();
    }

    if (descendPolicy(game)) {
      const a = game.signature.panel().actions.find(x => x.id === 'descend');
      if (a?.enabled) a.onClick();
    }
  }

  return { name, game, runs, levelUps };
}

// The engine records run length on endRun; capture it for the sim.
const origEndRun = Game.prototype.endRun;
Game.prototype.endRun = function (reason) {
  const s = origEndRun.call(this, reason);
  if (s) this.lastRunSeconds = s.runSeconds;
  return s;
};

const greedy = playProfile('greedy', { descendPolicy: () => true, kite: false });
const careful = playProfile('careful', {
  // descend only with a few upgrades banked and most of the health bar intact
  descendPolicy: (g) => g.state.run.level >= g.signature.band + 1
    && g.field.hp() / g.field.maxHpValue() > 0.7,
  kite: true,
});

for (const p of [greedy, careful]) {
  const avg = p.runs.length ? p.runs.reduce((a, b) => a + b, 0) / p.runs.length : 0;
  const max = p.runs.length ? Math.max(...p.runs) : 0;
  console.log(`${p.name.padEnd(8)} runs=${String(p.runs.length).padStart(3)}  avg=${avg.toFixed(0)}s  longest=${max}s  ` +
    `deepest=${p.game.state.stats.bestDepth + 1}  levelUps=${p.levelUps}  gems=${p.game.state.prestige.held}  ` +
    `lifetime=${p.game.state.prestige.lifetime.serialize()}`);
}

const gAvg = greedy.runs.reduce((a, b) => a + b, 0) / Math.max(1, greedy.runs.length);
const cAvg = careful.runs.reduce((a, b) => a + b, 0) / Math.max(1, careful.runs.length);

console.log('\n--- invariants ---');
assert.ok(greedy.runs.length >= 1, 'greedy bot dies at depth (danger is real)');
assert.ok(greedy.game.state.prestige.held > 0, 'deaths convert into prestige currency');
assert.ok(greedy.game.state.stats.bestDepth >= 2, `descent progresses (got depth ${greedy.game.state.stats.bestDepth + 1})`);
assert.ok(careful.levelUps >= 3, `roguelite level-ups fire (got ${careful.levelUps} across the session)`);
// Careful play must be rewarded: longer runs than reckless play, or the
// risk/reward of the descent mechanic is not actually working.
assert.ok(cAvg > gAvg, `careful play outlasts greedy (careful ${cAvg.toFixed(0)}s vs greedy ${gAvg.toFixed(0)}s)`);
// The gate is a >=10 min average session. A session spans several runs, but a
// careful run should still reach minutes, not seconds.
assert.ok(cAvg >= 60, `careful runs last at least a minute (got ${cAvg.toFixed(0)}s)`);
console.log(`  ok - careful play outlasts greedy (${cAvg.toFixed(0)}s vs ${gAvg.toFixed(0)}s)`);
console.log('  ok - deaths convert to prestige, descent progresses, level-ups fire');

// --- engagement: the opening must require the player, not play itself ---
// This assertion used to demand the opposite — that an untouched run still
// earns — which is what let the game auto-collect its own way to the first
// crew purchase. The crew provide the idle income; steering the miner is the
// part that has to stay the player's job.
function idleOre(seconds, { unlock = false, steer = false } = {}) {
  const g = new Game(theme);
  if (unlock) { g.state.metaUpgrades.autoSeek = true; g.recomputeMults(); }
  g.startRun();
  for (let i = 0; i < seconds / STEP; i++) {
    g.tick(STEP);
    if (steer) {
      const st = g.field.st;
      let near = null, nd = Infinity;
      for (const c of [...st.pickups, ...st.nodes]) {
        const d = (c.x - st.player.x) ** 2 + (c.y - st.player.y) ** 2;
        if (d < nd) { nd = d; near = c; }
      }
      if (near) g.field.setTarget(near.x, near.y);
    }
  }
  return g.state.primary.toNumber();
}

const firstCrew = theme.generators[0].baseCost;
const untouched = idleOre(90);
const played = idleOre(90, { steer: true });
const automated = idleOre(90, { unlock: true });

assert.ok(untouched < firstCrew,
  `90s untouched must not even reach the first crew (${untouched.toFixed(1)} vs ${firstCrew})`);
assert.ok(played > untouched * 5,
  `playing must dwarf idling (${played.toFixed(0)} vs ${untouched.toFixed(1)})`);
assert.ok(automated > untouched * 3 && automated < played,
  `the auto-seek unlock must be worth buying and still worse than playing (${automated.toFixed(0)})`);
console.log(`  ok - 90s untouched earns ${untouched.toFixed(1)} ore, under the ${firstCrew} first crew: the opening needs the player`);
console.log(`  ok - playing earns ${played.toFixed(0)}, auto-seek unlock ${automated.toFixed(0)} — in that order`);

// --- save round-trip ---
const blob = save.serialize(careful.game);
const restored = new Game(theme);
save.hydrate(restored, JSON.parse(blob));
assert.equal(restored.state.prestige.held, careful.game.state.prestige.held);
assert.equal(restored.state.prestige.lifetime.serialize(), careful.game.state.prestige.lifetime.serialize());
assert.equal(restored.state.premium, careful.game.state.premium);
assert.deepEqual(restored.state.gens, careful.game.state.gens);
assert.equal(restored.signature.band, careful.game.signature.band);
console.log('  ok - save round-trips (economy, prestige, premium, depth)');

// --- offline earnings + clock-tamper safety ---
const offer = restored.applyOffline(Date.now() - 2 * 3600 * 1000);
if (!restored.prodPerSec(false).isZero()) {
  assert.ok(offer && offer.seconds === 2 * 3600,
    `offline offer covers 2h — got ${offer ? offer.seconds + 's' : 'null'}, ` +
    `rate ${restored.prodPerSec(false).serialize()}, cap ${restored.state.meta.offlineCapHours}h, ` +
    `gens ${JSON.stringify(restored.state.gens)}`);
}
assert.equal(restored.applyOffline(Date.now() + 60000), null, 'clock rollback awards nothing');
console.log('  ok - offline earnings capped and rollback-safe');

console.log('\nsim: all invariants hold');
