// Active-run entity simulation (spec Part B: the "active" half of active-idle).
//
// The economy stays authoritative for passive income — crew units are the
// visible body of whatever generators the player owns, and their ore/sec is
// game.prodPerSec(), not something this file invents. What the field adds on
// top is the ACTIVE income: ore the player mines by hand and ore that drops
// from kills. That split produces the spec's run arc on its own — hand-mining
// dominates the first minutes, the crew dwarfs it by the end.
//
// Legibility is a first-class concern here, not polish. Everything the player
// must understand has to be readable from the screen alone: veins look like
// veins, threats are red and telegraphed before they arrive, and every gain
// prints a number where it happened.
import { Dec } from './bignum.js';
import { fmt } from './format.js';

const TAU = Math.PI * 2;
const MAX_ENEMIES = 90;
const MAX_PARTICLES = 150;
const MAX_PICKUPS = 60;
const MAX_CREW_DRAWN = 14;
const FLOAT_FLUSH_SECONDS = 0.4; // batch ore gains into one readable number

function rand(a, b) { return a + Math.random() * (b - a); }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

export function createField(game, config = {}) {
  const cfg = {
    playerHp: 120,
    playerSpeed: 155,
    attackRange: 96,
    attackRate: 2.0,
    attackDamage: 10,
    magnetRadius: 70,
    nodeCount: 6,
    nodeHp: 26,
    enemyBaseHp: 18,
    enemyBaseSpeed: 42,
    enemyContactDamage: 6,
    spawnRatePerSec: 0.55,
    baseRegenPerSec: 0.4,
    enemyHpGrowth: 1.32,
    spawnGrowthPerBand: 0.38,
    // Depth 1 used to be completely empty, which read as "nothing is happening".
    // A trickle of weak stragglers teaches the threat while it is still cheap.
    surfaceSpawnDelay: 16,
    surfaceSpawnScale: 0.3,
    spawnTelegraphSeconds: 0.9,
    ...config,
  };

  let w = 360, h = 420;

  const st = {
    player: { x: 180, y: 210, hp: cfg.playerHp, maxHp: cfg.playerHp, r: 15, iframe: 0, swing: 0, facing: 1 },
    target: null,
    keys: new Set(),
    crew: [],
    nodes: [],
    enemies: [],
    warnings: [],   // spawn telegraphs, so nothing appears without notice
    pickups: [],
    particles: [],
    floats: [],     // rising "+N ore" numbers
    labels: [],     // one-time captions naming a thing the first time it appears
    seenLabels: new Set(),
    floatAcc: { amount: Dec.zero(), x: 0, y: 0, t: 0 },
    shake: 0,
    flash: 0,
    time: 0,
    spawnAcc: 0,
    attackCd: 0,
    kills: 0,
  };

  const mult = () => game.fieldMults?.() ?? {};
  const maxHp = () => cfg.playerHp * (mult().maxHp ?? 1);
  const speed = () => cfg.playerSpeed * (mult().moveSpeed ?? 1);
  const range = () => cfg.attackRange * (mult().attackRange ?? 1);
  const rate = () => cfg.attackRate * (mult().attackRate ?? 1);
  const damage = () => cfg.attackDamage * (mult().damage ?? 1) * game.powerScale();
  const magnet = () => cfg.magnetRadius * (mult().magnet ?? 1);
  const regen = () => (cfg.baseRegenPerSec ?? 0) + (mult().hpRegen ?? 0);

  function resize(nw, nh) {
    if (nw === w && nh === h) return;
    const sx = nw / w, sy = nh / h;
    for (const e of [st.player, ...st.crew, ...st.nodes, ...st.enemies, ...st.pickups, ...st.warnings]) {
      e.x *= sx; e.y *= sy;
    }
    w = nw; h = nh;
  }

  function label(x, y, text, key) {
    if (key) {
      if (st.seenLabels.has(key)) return;
      st.seenLabels.add(key);
    }
    st.labels.push({ x, y, text, age: 0, life: 3.4 });
  }

  function spawnNode() {
    if (st.nodes.length >= cfg.nodeCount) return;
    let x, y, tries = 0;
    do {
      x = rand(34, w - 34); y = rand(44, h - 34); tries++;
    } while (tries < 12 && dist2(x, y, st.player.x, st.player.y) < 70 * 70);
    const node = { x, y, hp: cfg.nodeHp, maxHp: cfg.nodeHp, r: 15, flash: 0, seed: Math.random() * TAU };
    st.nodes.push(node);
    return node;
  }

  function bandScale() { return game.signature?.band ?? 0; }

  function queueEnemy() {
    if (st.enemies.length + st.warnings.length >= MAX_ENEMIES) return;
    const edge = Math.floor(Math.random() * 4);
    const x = edge === 0 ? 14 : edge === 1 ? w - 14 : rand(20, w - 20);
    const y = edge === 2 ? 14 : edge === 3 ? h - 14 : rand(20, h - 20);
    st.warnings.push({ x, y, t: 0, life: cfg.spawnTelegraphSeconds });
  }

  function hatchEnemy(x, y) {
    const band = bandScale();
    const hpScale = Math.pow(cfg.enemyHpGrowth, band);
    st.enemies.push({
      x, y,
      hp: cfg.enemyBaseHp * hpScale,
      maxHp: cfg.enemyBaseHp * hpScale,
      speed: cfg.enemyBaseSpeed * (1 + band * 0.04) * rand(0.85, 1.15),
      r: 11 + Math.min(5, band * 0.7),
      flash: 0,
      wob: Math.random() * TAU,
    });
    label(x, y, 'Cave-dweller — keep away', 'enemy');
  }

  function particle(x, y, color, opts = {}) {
    if (st.particles.length >= MAX_PARTICLES) st.particles.shift();
    st.particles.push({
      x, y, color,
      vx: opts.vx ?? rand(-60, 60),
      vy: opts.vy ?? rand(-70, 20),
      life: opts.life ?? rand(0.3, 0.6),
      age: 0,
      r: opts.r ?? rand(1.5, 3.5),
    });
  }

  function burst(x, y, color, n) { for (let i = 0; i < n; i++) particle(x, y, color); }

  // Gains are batched: one readable "+N" beats a blizzard of tiny ones.
  function bankFloat(x, y, amount) {
    st.floatAcc.amount = st.floatAcc.amount.add(amount);
    st.floatAcc.x = x; st.floatAcc.y = y;
  }

  function flushFloat() {
    if (st.floatAcc.amount.isZero()) return;
    st.floats.push({
      x: st.floatAcc.x, y: st.floatAcc.y,
      text: `+${fmt(st.floatAcc.amount)}`,
      age: 0, life: 1.1,
    });
    if (st.floats.length > 12) st.floats.shift();
    st.floatAcc.amount = Dec.zero();
  }

  function dropOre(x, y, amount) {
    if (st.pickups.length >= MAX_PICKUPS) {
      const old = st.pickups.shift();
      game.earnActive(old.amount);
      bankFloat(old.x, old.y, old.amount);
    }
    st.pickups.push({ x, y, amount, vx: rand(-45, 45), vy: rand(-60, -15), age: 0 });
  }

  function syncCrew() {
    const want = [];
    const gens = game.theme.generators;
    for (let i = gens.length - 1; i >= 0 && want.length < MAX_CREW_DRAWN; i--) {
      const owned = game.state.gens[gens[i].id];
      const n = owned > 0 ? Math.min(4, 1 + Math.floor(Math.log10(owned + 1) * 2)) : 0;
      for (let k = 0; k < n && want.length < MAX_CREW_DRAWN; k++) want.push(i);
    }
    while (st.crew.length > want.length) st.crew.pop();
    while (st.crew.length < want.length) {
      const c = { x: rand(40, w - 40), y: rand(60, h - 40), tier: 0, cd: rand(0, 1), t: Math.random() * TAU };
      st.crew.push(c);
      label(c.x, c.y, 'Your crew — they mine on their own', 'crew');
    }
    st.crew.forEach((c, i) => { c.tier = want[i]; });
  }

  return {
    id: 'field',
    st,
    resize,

    reset() {
      st.player.x = w / 2; st.player.y = h / 2;
      st.player.maxHp = maxHp(); st.player.hp = st.player.maxHp;
      st.player.iframe = 0;
      st.enemies.length = 0;
      st.warnings.length = 0;
      st.pickups.length = 0;
      st.particles.length = 0;
      st.floats.length = 0;
      st.labels.length = 0;
      st.nodes.length = 0;
      st.crew.length = 0;
      st.kills = 0;
      st.spawnAcc = 0;
      st.shake = 0;
      st.time = 0;
      st.floatAcc.amount = Dec.zero();
      for (let i = 0; i < cfg.nodeCount; i++) spawnNode();
      st.seenLabels.delete('vein');
      const first = st.nodes[0];
      if (first) label(first.x, first.y, 'Ore vein — walk close to mine it', 'vein');
    },

    healFull() { st.player.maxHp = maxHp(); st.player.hp = st.player.maxHp; st.player.iframe = 2; },
    hp() { return st.player.hp; },
    maxHpValue() { return st.player.maxHp; },
    isDead() { return st.player.hp <= 0; },
    kills() { return st.kills; },
    enemyCount() { return st.enemies.length; },

    setTarget(x, y) { st.target = { x, y }; },
    clearTarget() { st.target = null; },
    keyDown(k) { st.keys.add(k); },
    keyUp(k) { st.keys.delete(k); },

    update(dt) {
      st.time += dt;
      st.shake = Math.max(0, st.shake - dt * 6);
      st.flash = Math.max(0, st.flash - dt * 4);
      const p = st.player;
      p.maxHp = maxHp();
      p.iframe = Math.max(0, p.iframe - dt);
      p.swing = Math.max(0, p.swing - dt * 6);
      if (regen()) p.hp = Math.min(p.maxHp, p.hp + regen() * dt);

      st.floatAcc.t += dt;
      if (st.floatAcc.t >= FLOAT_FLUSH_SECONDS) { st.floatAcc.t = 0; flushFloat(); }

      // ---- movement: WASD/arrows, pointer target, else idle auto-seek ----
      // The auto-seek matters: this is an idle game, so a player who puts the
      // phone down still earns. It walks at a fraction of full speed and only
      // toward ore, never toward danger, so playing actively is always better.
      let dx = 0, dy = 0, sp = speed();
      if (st.keys.size) {
        if (st.keys.has('a') || st.keys.has('arrowleft')) dx -= 1;
        if (st.keys.has('d') || st.keys.has('arrowright')) dx += 1;
        if (st.keys.has('w') || st.keys.has('arrowup')) dy -= 1;
        if (st.keys.has('s') || st.keys.has('arrowdown')) dy += 1;
      } else if (st.target) {
        const tx = st.target.x - p.x, ty = st.target.y - p.y;
        const d = Math.hypot(tx, ty);
        if (d > 4) { dx = tx / d; dy = ty / d; }
      } else {
        let near = null, nd = Infinity;
        for (const n of st.nodes) {
          const d = dist2(p.x, p.y, n.x, n.y);
          if (d < nd) { nd = d; near = n; }
        }
        if (near && nd > (range() * 0.7) ** 2) {
          const d = Math.sqrt(nd) || 1;
          dx = (near.x - p.x) / d; dy = (near.y - p.y) / d;
          sp *= 0.5;
        }
      }
      const dl = Math.hypot(dx, dy);
      if (dl > 0) {
        dx /= dl; dy /= dl;
        p.x = Math.max(p.r, Math.min(w - p.r, p.x + dx * sp * dt));
        p.y = Math.max(p.r, Math.min(h - p.r, p.y + dy * sp * dt));
        if (dx !== 0) p.facing = Math.sign(dx);
      }

      // ---- auto-attack: enemies first, else mine the nearest vein ----
      st.attackCd -= dt;
      if (st.attackCd <= 0) {
        const R2 = range() * range();
        let best = null, bestD = R2, isEnemy = false;
        for (const e of st.enemies) {
          const d = dist2(p.x, p.y, e.x, e.y);
          if (d < bestD) { bestD = d; best = e; isEnemy = true; }
        }
        if (!best) {
          for (const n of st.nodes) {
            const d = dist2(p.x, p.y, n.x, n.y);
            if (d < bestD) { bestD = d; best = n; isEnemy = false; }
          }
        }
        if (best) {
          st.attackCd = 1 / rate();
          p.swing = 1;
          best.hp -= damage();
          best.flash = 1;
          burst(best.x, best.y, isEnemy ? '#ff6b5a' : game.theme.palette.accent, isEnemy ? 4 : 3);
          if (best.hp <= 0) {
            if (isEnemy) {
              st.enemies.splice(st.enemies.indexOf(best), 1);
              st.kills++;
              st.shake = Math.min(1, st.shake + 0.22);
              burst(best.x, best.y, '#ff6b5a', 9);
              dropOre(best.x, best.y, game.activeYield().mulNum(1.6));
            } else {
              st.nodes.splice(st.nodes.indexOf(best), 1);
              burst(best.x, best.y, game.theme.palette.accent, 10);
              dropOre(best.x, best.y, game.activeYield().mulNum(2.2));
              spawnNode();
            }
          } else if (!isEnemy) {
            dropOre(best.x + rand(-6, 6), best.y + rand(-6, 6), game.activeYield().mulNum(0.35));
          }
        }
      }

      syncCrew();
      for (const c of st.crew) {
        c.t += dt;
        const node = st.nodes[0];
        if (node) {
          const tx = node.x - c.x, ty = node.y - c.y, d = Math.hypot(tx, ty) || 1;
          if (d > 26) { c.x += (tx / d) * 42 * dt; c.y += (ty / d) * 42 * dt; }
        }
        c.cd -= dt;
        if (c.cd <= 0) {
          c.cd = rand(0.5, 1.0);
          if (node) particle(node.x + rand(-8, 8), node.y + rand(-8, 8), '#9fd8ff', { life: 0.25, r: 1.6 });
        }
      }

      // ---- spawning: telegraph first, then hatch ----
      const band = bandScale();
      const surfaceReady = band > 0 || st.time > cfg.surfaceSpawnDelay;
      if (surfaceReady) {
        const bandRate = band > 0
          ? cfg.spawnRatePerSec * (1 + band * cfg.spawnGrowthPerBand)
          : cfg.spawnRatePerSec * cfg.surfaceSpawnScale;
        st.spawnAcc += dt * bandRate;
        while (st.spawnAcc >= 1) { st.spawnAcc -= 1; queueEnemy(); }
      }
      for (let i = st.warnings.length - 1; i >= 0; i--) {
        const wn = st.warnings[i];
        wn.t += dt;
        if (wn.t >= wn.life) { hatchEnemy(wn.x, wn.y); st.warnings.splice(i, 1); }
      }

      for (const e of st.enemies) {
        e.flash = Math.max(0, e.flash - dt * 5);
        e.wob += dt * 3;
        const tx = p.x - e.x, ty = p.y - e.y, d = Math.hypot(tx, ty) || 1;
        e.x += (tx / d) * e.speed * dt + Math.cos(e.wob) * 8 * dt;
        e.y += (ty / d) * e.speed * dt + Math.sin(e.wob) * 8 * dt;
        if (d < e.r + p.r && p.iframe <= 0) {
          p.hp -= cfg.enemyContactDamage * (mult().damageTaken ?? 1);
          p.iframe = 0.6;
          st.shake = 1;
          st.flash = 1;
          burst(p.x, p.y, '#ff3b2f', 8);
        }
      }

      // ---- pickups: magnet in, then bank as ACTIVE income ----
      const mag = magnet(), mag2 = mag * mag;
      for (let i = st.pickups.length - 1; i >= 0; i--) {
        const u = st.pickups[i];
        u.age += dt;
        const d2 = dist2(u.x, u.y, p.x, p.y);
        if (d2 < mag2) {
          const d = Math.sqrt(d2) || 1;
          const pull = 260 * (1 - d / mag) + 90;
          u.x += ((p.x - u.x) / d) * pull * dt;
          u.y += ((p.y - u.y) / d) * pull * dt;
        } else {
          u.x += u.vx * dt; u.y += u.vy * dt;
          u.vy += 120 * dt;
          u.vx *= 0.96; u.vy *= 0.96;
          u.x = Math.max(6, Math.min(w - 6, u.x));
          u.y = Math.max(6, Math.min(h - 6, u.y));
        }
        if (d2 < (p.r + 8) * (p.r + 8)) {
          game.earnActive(u.amount);
          bankFloat(p.x, p.y - 14, u.amount);
          st.pickups.splice(i, 1);
        }
      }

      for (let i = st.particles.length - 1; i >= 0; i--) {
        const q = st.particles[i];
        q.age += dt;
        if (q.age >= q.life) { st.particles.splice(i, 1); continue; }
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.vy += 190 * dt;
      }
      for (let i = st.floats.length - 1; i >= 0; i--) {
        const f = st.floats[i];
        f.age += dt;
        if (f.age >= f.life) st.floats.splice(i, 1);
      }
      for (let i = st.labels.length - 1; i >= 0; i--) {
        const l = st.labels[i];
        l.age += dt;
        if (l.age >= l.life) st.labels.splice(i, 1);
      }

      for (const n of st.nodes) n.flash = Math.max(0, n.flash - dt * 5);
      if (st.nodes.length < cfg.nodeCount) spawnNode();
    },

    render(ctx, cw, ch, t) {
      resize(cw, ch);
      const pal = game.theme.palette;
      const band = bandScale();
      const bands = game.signatureBandCount() || 8;
      const depth = Math.min(1, band / Math.max(1, bands - 1));

      ctx.save();
      if (st.shake > 0.01) ctx.translate(rand(-1, 1) * st.shake * 5, rand(-1, 1) * st.shake * 5);

      const g = ctx.createRadialGradient(cw / 2, ch / 2, 20, cw / 2, ch / 2, Math.max(cw, ch) * 0.78);
      g.addColorStop(0, mix('#3a2c1e', '#4a1508', depth));
      g.addColorStop(1, mix('#0f0b07', '#190301', depth));
      ctx.fillStyle = g;
      ctx.fillRect(-8, -8, cw + 16, ch + 16);

      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let i = 0; i < 46; i++) {
        const rx = ((i * 9301 + 49297) % 233280) / 233280 * cw;
        const ry = ((i * 4517 + 12345) % 233280) / 233280 * ch;
        ctx.fillRect(rx, ry, 2, 2);
      }

      // ---- ore veins: rock socket + crystal cluster, depleting visibly ----
      for (const n of st.nodes) {
        const pct = n.hp / n.maxHp;
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 3, n.r * 1.25, n.r * 0.95, 0, 0, TAU);
        ctx.fill();
        ctx.rotate(n.seed);
        const shards = 6;
        for (let i = 0; i < shards; i++) {
          const a = (i / shards) * TAU;
          const len = n.r * (0.5 + 0.6 * pct) * (0.72 + (i % 2) * 0.38);
          ctx.fillStyle = n.flash > 0 ? '#ffffff' : (i % 2 ? pal.accent : pal.primary);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * len, Math.sin(a) * len);
          ctx.lineTo(Math.cos(a + 0.42) * len * 0.34, Math.sin(a + 0.42) * len * 0.34);
          ctx.lineTo(Math.cos(a - 0.42) * len * 0.34, Math.sin(a - 0.42) * len * 0.34);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        // depletion ring reads as "this vein is running out"
        ctx.strokeStyle = 'rgba(255,210,74,0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 1.5, -Math.PI / 2, -Math.PI / 2 + TAU * pct);
        ctx.stroke();
      }

      // ---- crew: blue so they never read as ore or as threats ----
      for (const c of st.crew) {
        const bob = Math.sin(c.t * 6) * 1.6;
        ctx.fillStyle = '#6fb6e8';
        ctx.beginPath();
        ctx.arc(c.x, c.y + bob, 6.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#2c5f86';
        ctx.fillRect(c.x - 5.5, c.y - 7 + bob, 11, 3.5);
      }

      // ---- pickups ----
      for (const u of st.pickups) {
        const pulse = 3.2 + Math.sin(t * 9 + u.x) * 0.6;
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        ctx.arc(u.x, u.y, pulse, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.arc(u.x - 1, u.y - 1, pulse * 0.35, 0, TAU);
        ctx.fill();
      }

      // ---- spawn telegraphs: nothing arrives unannounced ----
      for (const wn of st.warnings) {
        const k = wn.t / wn.life;
        ctx.strokeStyle = `rgba(224,72,58,${(0.35 + 0.5 * Math.sin(k * 18)).toFixed(2)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wn.x, wn.y, 8 + k * 12, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = 'rgba(224,72,58,0.85)';
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', wn.x, wn.y + 4.5);
      }

      // ---- enemies: red, spiky, with a health pip once damaged ----
      for (const e of st.enemies) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#c2384a';
        ctx.beginPath();
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU;
          const spike = i % 2 ? e.r : e.r * 0.58;
          const px = Math.cos(a + e.wob * 0.25) * spike;
          const py = Math.sin(a + e.wob * 0.25) * spike;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffe08a';
        ctx.fillRect(-4, -2.5, 2.8, 2.8);
        ctx.fillRect(1.2, -2.5, 2.8, 2.8);
        ctx.restore();
        if (e.hp < e.maxHp) {
          const pct = Math.max(0, e.hp / e.maxHp);
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(e.x - 11, e.y - e.r - 8, 22, 3.5);
          ctx.fillStyle = '#e0483a';
          ctx.fillRect(e.x - 11, e.y - e.r - 8, 22 * pct, 3.5);
        }
      }

      // ---- player: swing arc, body, helmet, lamp cone ----
      const p = st.player;
      ctx.strokeStyle = 'rgba(255,210,74,0.13)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, range(), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      // lamp cone points where he faces, selling "miner" at a glance
      const lampGrad = ctx.createLinearGradient(p.x, p.y, p.x + p.facing * 62, p.y);
      lampGrad.addColorStop(0, 'rgba(255,240,190,0.20)');
      lampGrad.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = lampGrad;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 4);
      ctx.lineTo(p.x + p.facing * 64, p.y - 26);
      ctx.lineTo(p.x + p.facing * 64, p.y + 20);
      ctx.closePath();
      ctx.fill();

      if (p.swing > 0) {
        ctx.strokeStyle = `rgba(255,210,74,${(p.swing * 0.75).toFixed(2)})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, range() * 0.44, -0.9 + (p.facing < 0 ? Math.PI : 0), 0.9 + (p.facing < 0 ? Math.PI : 0));
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + p.r * 0.85, p.r * 0.9, p.r * 0.35, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = p.iframe > 0 && Math.floor(t * 20) % 2 ? '#ffffff' : '#f0dcb8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#3a2a16';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = pal.primary;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 2, p.r * 0.98, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.arc(p.x + p.facing * 5, p.y - 8, 3.1, 0, TAU);
      ctx.fill();

      for (const q of st.particles) {
        const a = 1 - q.age / q.life;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ---- floating gains: the clearest possible cause-and-effect ----
      ctx.textAlign = 'center';
      for (const f of st.floats) {
        const k = f.age / f.life;
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.font = '800 16px system-ui, sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(f.text, f.x, f.y - k * 34);
        ctx.fillStyle = pal.accent;
        ctx.fillText(f.text, f.x, f.y - k * 34);
      }
      ctx.globalAlpha = 1;

      // ---- one-time captions naming what the player is looking at ----
      for (const l of st.labels) {
        const k = l.age / l.life;
        ctx.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 2.2));
        ctx.font = '700 11px system-ui, sans-serif';
        const tw = ctx.measureText(l.text).width;
        const bx = Math.max(6, Math.min(cw - tw - 18, l.x - tw / 2 - 6));
        const by = Math.max(4, l.y - 34);
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.beginPath();
        ctx.roundRect(bx, by, tw + 12, 20, 6);
        ctx.fill();
        ctx.fillStyle = '#ffe9b8';
        ctx.fillText(l.text, bx + tw / 2 + 6, by + 14);
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      if (st.flash > 0.01) {
        ctx.fillStyle = `rgba(200,20,10,${(st.flash * 0.3).toFixed(3)})`;
        ctx.fillRect(0, 0, cw, ch);
      }
    },

    serialize() { return { hp: st.player.hp, kills: st.kills }; },
    hydrate(d) {
      if (typeof d?.hp === 'number') st.player.hp = d.hp;
      if (typeof d?.kills === 'number') st.kills = d.kills;
    },
  };
}

function mix(a, b, f) {
  const pa = hex(a), pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * f)).join(',')})`;
}
function hex(s) {
  return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
}
