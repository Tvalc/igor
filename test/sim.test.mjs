// Headless full-loop simulation: boots the Game against the real theme pack,
// plays a simple bot for 20 simulated minutes, and asserts the pacing/loop
// invariants the Basic Launch gate depends on.
// Run with: node test/sim.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Game } from '../src/engine/game.js';
import * as save from '../src/engine/save.js';

const theme = JSON.parse(await readFile(new URL('../themes/deepcore_mine.json', import.meta.url), 'utf8'));

const game = new Game(theme);
game.startRun();

let deaths = 0;
let levelPicks = 0;
let firstPrestigeReadyAt = null;
let maxBand = 0;

for (let t = 0; t < 1200; t++) {
  game.tick(1);

  // bot: tap, resolve level-ups, buy the best affordable generator, descend
  game.tap();
  if (game.run.pendingChoices) {
    game.run.choose(game.run.pendingChoices[0], false);
    levelPicks++;
  }
  for (let i = theme.generators.length - 1; i >= 0; i--) {
    const g = theme.generators[i];
    if (game.buyGenerator(g, 'max')) break;
  }
  const panel = game.signature.panel();
  for (const a of panel.actions) if (a.enabled && a.id === 'descend') a.onClick();
  maxBand = Math.max(maxBand, game.signature.band);

  if (firstPrestigeReadyAt === null && game.prestigeGainNow() >= 1) firstPrestigeReadyAt = t;
  if (!game.state.run.active || game.state.stats.runs > deaths) deaths = game.state.stats.runs;
}

console.log(`sim: 20min → runs ended: ${deaths}, level picks: ${levelPicks}, max band: ${maxBand}, first prestige at: ${firstPrestigeReadyAt}s`);
console.log(`     lifetime: ${game.state.prestige.lifetime.serialize()}, gems held: ${game.state.prestige.held}`);

assert.ok(game.state.prestige.lifetime.gt(0), 'earned currency');
assert.ok(levelPicks >= 5, `roguelite level-ups fire (got ${levelPicks})`);
assert.ok(maxBand >= 2, `descent progresses (got band ${maxBand})`);
assert.ok(firstPrestigeReadyAt !== null && firstPrestigeReadyAt < 900,
  `first prestige reachable inside a 15-min run (got ${firstPrestigeReadyAt})`);
assert.ok(deaths >= 1, 'active bot at depth eventually dies and auto-restarts (danger is real)');
assert.ok(game.state.prestige.held > 0, 'death converted into prestige currency');

// Save round-trip: serialize → hydrate into a fresh Game → identical core state
const blob = save.serialize(game);
const game2 = new Game(theme);
save.hydrate(game2, JSON.parse(blob));
assert.equal(game2.state.prestige.held, game.state.prestige.held);
assert.equal(game2.state.prestige.lifetime.serialize(), game.state.prestige.lifetime.serialize());
assert.deepEqual(game2.state.gens, game.state.gens);
assert.equal(game2.signature.band, game.signature.band);

// Offline earnings: 2h away at current base rate, clock-tamper path returns null
const offer = game2.applyOffline(Date.now() - 2 * 3600 * 1000);
if (game2.prodPerSec(false).isZero()) {
  assert.equal(offer, null);
} else {
  assert.ok(offer && offer.seconds === 2 * 3600, 'offline offer for 2h');
}
assert.equal(game2.applyOffline(Date.now() + 60000), null, 'future lastSeen (rollback) awards nothing');

console.log('\nsim: all invariants hold');
