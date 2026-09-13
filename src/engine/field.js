// Active-run entity simulation (spec Part B: the "active" half of active-idle).
//
// The economy stays authoritative for passive income — crew units are the
// visible body of whatever generators the player owns, and their ore/sec is
// game.prodPerSec(), not something this file invents. What the field adds on
// top is the ACTIVE income: ore the player mines by hand and ore that drops
// from kills. That split produces the spec's run arc on its own — hand-mining
// dominates the first minutes, the crew dwarfs it by the end, and the build
// visibly starts playing itself.
import { Dec } from './bignum.js';

const TAU = Math.PI * 2;
const MAX_ENEMIES = 90;
const MAX_PARTICLES = 160;
const MAX_PICKUPS = 60;
const MAX_CREW_DRAWN = 14; // visual cap; the economy still counts every generator

function rand(a, b) { return a + Math.random() * (b - a); }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

export function createField(game, config = {}) {
  const cfg = {
    playerHp: 100,
    playerSpeed: 155,
    attackRange: 96,
    attackRate: 2.0,      // swings/sec
    attackDamage: 10,
    magnetRadius: 70,
    baseRegenPerSec: 0.4,
    enemyHpGrowth: 1.32,
    spawnGrowthPerBand: 0.5,
    nodeCount: 6,
    nodeHp: 26,
    enemyBaseHp: 18,
    enemyBaseSpeed: 42,
    enemyContactDamage: 7,
    spawnRatePerSec: 0.55, // at band 1; scales with band
    ...config,
  };

  let w = 360, h = 420;

  const st = {
    player: { x: 180, y: 210, hp: cfg.playerHp, maxHp: cfg.playerHp, r: 13, iframe: 0, swing: 0, facing: 1 },
    target: null,          // pointer destination while held
    keys: new Set(),
    crew: [],
    nodes: [],
    enemies: [],
    pickups: [],
    particles: [],
    shake: 0,
    flash: 0,
    time: 0,
    spawnAcc: 0,
    attackCd: 0,
    kills: 0,
  };

  // ---- derived stats (level-up upgrades feed in through game multipliers) ----
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
    for (const e of [st.player, ...st.crew, ...st.nodes, ...st.enemies, ...st.pickups]) {
      e.x *= sx; e.y *= sy;
    }
    w = nw; h = nh;
  }

  function spawnNode() {
    if (st.nodes.length >= cfg.nodeCount) return;
    // keep veins off the player's current position so they never spawn on top
    let x, y, tries = 0;
    do {
      x = rand(30, w - 30); y = rand(40, h - 30); tries++;
    } while (tries < 12 && dist2(x, y, st.player.x, st.player.y) < 80 * 80);
    st.nodes.push({ x, y, hp: cfg.nodeHp, maxHp: cfg.nodeHp, r: 13, flash: 0, seed: Math.random() * TAU });
  }

  function bandScale() { return game.signature?.band ?? 0; }

  function spawnEnemy() {
    if (st.enemies.length >= MAX_ENEMIES) return;
    const band = bandScale();
    // enter from a random edge so threat reads as coming out of the dark
    const edge = Math.floor(Math.random() * 4);
    const x = edge === 0 ? -16 : edge === 1 ? w + 16 : rand(0, w);
    const y = edge === 2 ? -16 : edge === 3 ? h + 16 : rand(0, h);
    const hpScale = Math.pow(cfg.enemyHpGrowth ?? 1.32, band);
    st.enemies.push({
      x, y,
      hp: cfg.enemyBaseHp * hpScale,
      maxHp: cfg.enemyBaseHp * hpScale,
      speed: cfg.enemyBaseSpeed * (1 + band * 0.04) * rand(0.85, 1.15),
      r: 10 + Math.min(5, band * 0.7),
      flash: 0,
      wob: Math.random() * TAU,
    });
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
      text: opts.text ?? null,
    });
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) particle(x, y, color);
  }

  function dropOre(x, y, amount) {
    if (st.pickups.length >= MAX_PICKUPS) {
      // absorb the oldest rather than dropping income on the floor
      const old = st.pickups.shift();
      game.earnActive(old.amount);
    }
    st.pickups.push({ x, y, amount, vx: rand(-45, 45), vy: rand(-60, -15), age: 0 });
  }

  // ---- crew: one drawn unit per owned generator, richest tiers first ----
  function syncCrew() {
    const want = [];
    const gens = game.theme.generators;
    for (let i = gens.length - 1; i >= 0 && want.length < MAX_CREW_DRAWN; i--) {
      const owned = game.state.gens[gens[i].id];
      // diminishing visual weight: show a unit per tier, more for bigger stacks
      const n = owned > 0 ? Math.min(4, 1 + Math.floor(Math.log10(owned + 1) * 2)) : 0;
      for (let k = 0; k < n && want.length < MAX_CREW_DRAWN; k++) want.push(i);
    }
    while (st.crew.length > want.length) st.crew.pop();
    while (st.crew.length < want.length) {
      st.crew.push({ x: rand(40, w - 40), y: rand(60, h - 40), tier: 0, cd: rand(0, 1), t: Math.random() * TAU });
    }
    st.crew.forEach((c, i) => { c.tier = want[i]; });
  }

  return {
    id: 'field',
    st,
    resize,

    reset() {
      st.player.x = w / 2; st.player.y = h / 2;
      st.player.hp = maxHp(); st.player.maxHp = maxHp();
      st.player.iframe = 0;
      st.enemies.length = 0;
      st.pickups.length = 0;
      st.particles.length = 0;
      st.nodes.length = 0;
      st.crew.length = 0;
      st.kills = 0;
      st.spawnAcc = 0;
      st.shake = 0;
      for (let i = 0; i < cfg.nodeCount; i++) spawnNode();
    },

    healFull() { st.player.maxHp = maxHp(); st.player.hp = st.player.maxHp; st.player.iframe = 2; },
    hp() { return st.player.hp; },
    maxHpValue() { return st.player.maxHp; },
    isDead() { return st.player.hp <= 0; },
    kills() { return st.kills; },

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
        // stop just inside reach so it mines rather than standing on the vein
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
        const R = range(), R2 = R * R;
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
          const dmg = damage();
          best.hp -= dmg;
          best.flash = 1;
          const col = isEnemy ? '#ff6b5a' : game.theme.palette.accent;
          burst(best.x, best.y, col, isEnemy ? 4 : 3);
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
            // chip income on every swing so mining feels continuous
            dropOre(best.x + rand(-6, 6), best.y + rand(-6, 6), game.activeYield().mulNum(0.35));
          }
        }
      }

      // ---- crew: drift to veins and chip at them (visual for passive income) ----
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
          if (node) particle(node.x + rand(-8, 8), node.y + rand(-8, 8), game.theme.palette.primary, { life: 0.25, r: 1.6 });
        }
      }

      // ---- enemy spawning + steering ----
      const band = bandScale();
      if (band > 0) {
        st.spawnAcc += dt * cfg.spawnRatePerSec * (1 + band * (cfg.spawnGrowthPerBand ?? 0.5));
        while (st.spawnAcc >= 1) { st.spawnAcc -= 1; spawnEnemy(); }
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

      // ---- pickups: magnet to the player, then bank as ACTIVE income ----
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
          st.pickups.splice(i, 1);
          particle(p.x, p.y - 8, game.theme.palette.accent, { life: 0.5, vy: -70, vx: rand(-12, 12), r: 2 });
        }
      }

      // ---- particles ----
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const q = st.particles[i];
        q.age += dt;
        if (q.age >= q.life) { st.particles.splice(i, 1); continue; }
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.vy += 190 * dt;
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
      if (st.shake > 0.01) {
        ctx.translate(rand(-1, 1) * st.shake * 5, rand(-1, 1) * st.shake * 5);
      }

      // cavern ground: darkens and warms with depth
      const g = ctx.createRadialGradient(cw / 2, ch / 2, 20, cw / 2, ch / 2, Math.max(cw, ch) * 0.78);
      g.addColorStop(0, mix('#3a2c1e', '#4a1508', depth));
      g.addColorStop(1, mix('#120d08', '#1c0402', depth));
      ctx.fillStyle = g;
      ctx.fillRect(-8, -8, cw + 16, ch + 16);

      // rubble texture, deterministic so it doesn't crawl between frames
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      for (let i = 0; i < 46; i++) {
        const rx = ((i * 9301 + 49297) % 233280) / 233280 * cw;
        const ry = ((i * 4517 + 12345) % 233280) / 233280 * ch;
        ctx.fillRect(rx, ry, 2, 2);
      }

      // ore veins
      for (const n of st.nodes) {
        const pct = n.hp / n.maxHp;
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(n.seed);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          const rr = n.r * (0.55 + 0.45 * pct);
          ctx.fillStyle = n.flash > 0 ? '#ffffff' : pal.accent;
          ctx.globalAlpha = 0.55 + 0.45 * pct;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          ctx.lineTo(Math.cos(a + 0.9) * rr * 0.5, Math.sin(a + 0.9) * rr * 0.5);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // crew
      for (const c of st.crew) {
        const bob = Math.sin(c.t * 6) * 1.6;
        ctx.fillStyle = pal.primary;
        ctx.beginPath();
        ctx.arc(c.x, c.y + bob, 6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(c.x - 5, c.y - 6 + bob, 10, 3);
      }

      // pickups
      for (const u of st.pickups) {
        const pulse = 2.6 + Math.sin(t * 9 + u.x) * 0.5;
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        ctx.arc(u.x, u.y, pulse, 0, TAU);
        ctx.fill();
      }

      // enemies
      for (const e of st.enemies) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#8e2f3f';
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU;
          const spike = i % 2 ? e.r : e.r * 0.62;
          const px = Math.cos(a + e.wob * 0.25) * spike;
          const py = Math.sin(a + e.wob * 0.25) * spike;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd7a0';
        ctx.fillRect(-3.5, -2, 2.5, 2.5);
        ctx.fillRect(1, -2, 2.5, 2.5);
        ctx.restore();
      }

      // player: attack arc, body, helmet lamp
      const p = st.player;
      if (p.swing > 0) {
        ctx.strokeStyle = `rgba(255,210,74,${(p.swing * 0.6).toFixed(2)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, range() * 0.42, -0.8 + (p.facing < 0 ? Math.PI : 0), 0.8 + (p.facing < 0 ? Math.PI : 0));
        ctx.stroke();
      }
      ctx.fillStyle = p.iframe > 0 && Math.floor(t * 20) % 2 ? '#ffffff' : '#e8d8b8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = pal.primary;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 3, p.r * 0.92, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.arc(p.x + p.facing * 4, p.y - 7, 2.4, 0, TAU);
      ctx.fill();

      // range ring, faint, so positioning reads
      ctx.strokeStyle = 'rgba(255,210,74,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, range(), 0, TAU);
      ctx.stroke();

      // particles
      for (const q of st.particles) {
        const a = 1 - q.age / q.life;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      // damage flash sits outside the shake transform
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
