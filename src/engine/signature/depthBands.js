// Signature mechanic: DEPTH BANDS (Deepcore Mine).
// The run is a descent. Each band multiplies richness (production) but also
// danger (stability drain). The player chooses when to descend — richer bands
// accelerate the run but shorten it. Stability hitting 0 is a cave-in (death);
// ore can be spent on shoring to buy time, and the rewarded revive restores it.
import { Dec } from '../bignum.js';
import { fmt } from '../format.js';

export function createDepthBands(game, config) {
  const bandCount = config.bandCount ?? 8;
  const richnessPerBand = config.richnessMultiplierPerBand ?? 3.5;
  const dangerPerBand = config.dangerMultiplierPerBand ?? 2.2;

  const st = {
    band: 0,
    stability: 100,
    minedThisBand: Dec.zero(),
    shoreCount: 0,
  };

  // Descend gate: mine enough in the current band first. Thresholds ride the
  // same exponential family as generator costs so the descent paces the run.
  function descendThreshold() {
    return Dec.powOf(28, st.band + 1).mulNum(50);
  }

  function baseDrainPerSec() {
    if (st.band === 0) return 0; // the surface is safe — no death before the loop hooks you
    // sqrt-compressed exponential: dangerPerBand^((band-1)/2) keeps each band
    // survivable for minutes (band 1 ≈ 14 min, band 7 ≈ 80 s to drain from
    // full) so the death arc lands inside the 12–18 min target run
    return 0.12 * Math.pow(dangerPerBand, (st.band - 1) / 2) * game.dangerMult();
  }

  function shoreCost() {
    return descendThreshold().mulNum(0.15 * Math.pow(1.5, st.shoreCount));
  }

  function canDescend() {
    return st.band < bandCount - 1 && st.minedThisBand.gte(descendThreshold());
  }

  function descend() {
    if (!canDescend()) return;
    st.band += 1;
    st.minedThisBand = Dec.zero();
    st.shoreCount = 0;
    st.stability = Math.min(100, st.stability + 25);
    game.onZoneMaybeUnlocked(st.band);
  }

  function shore() {
    const cost = shoreCost();
    if (!game.state.primary.gte(cost)) return;
    game.spend(cost);
    st.shoreCount += 1;
    st.stability = Math.min(100, st.stability + 35);
  }

  return {
    id: 'depthBands',
    get band() { return st.band; },
    get stability() { return st.stability; },

    tick(dt) {
      st.stability = Math.max(0, st.stability - baseDrainPerSec() * dt + game.stabilityRegen() * dt);
      st.stability = Math.min(100, st.stability);
    },

    onEarn(amount) { st.minedThisBand = st.minedThisBand.add(amount); },

    productionMult() { return Math.pow(richnessPerBand, st.band); },

    isDead() { return st.stability <= 0; },

    onRunStart() { st.band = 0; st.stability = 100; st.minedThisBand = Dec.zero(); st.shoreCount = 0; },
    onRunEnd() {},
    onRevive() { st.stability = 60; },

    panel() {
      const threshold = descendThreshold();
      const pct = Math.min(1, st.minedThisBand.div(threshold).toNumber());
      return {
        title: `Depth Band ${st.band + 1}/${bandCount} — richness ×${fmt(Math.pow(richnessPerBand, st.band))}`,
        stability: st.stability,
        descendProgress: pct,
        descendLabel: st.band >= bandCount - 1
          ? 'Bottom of the world'
          : `Descend (${fmt(st.minedThisBand)} / ${fmt(threshold)})`,
        actions: [
          {
            id: 'descend',
            label: st.band >= bandCount - 1 ? 'Max depth' : '⛏ Descend',
            enabled: canDescend(),
            onClick: descend,
          },
          {
            id: 'shore',
            label: `🪵 Shore up (+35) — ${fmt(shoreCost())}`,
            enabled: st.band > 0 && game.state.primary.gte(shoreCost()) && st.stability < 100,
            onClick: shore,
          },
        ],
      };
    },

    render(ctx, w, h, t) {
      const zone = game.zoneForBand(st.band);
      // Layered depth gradient — darker and warmer as the band index rises
      const g = ctx.createLinearGradient(0, 0, 0, h);
      const depth = st.band / Math.max(1, bandCount - 1);
      g.addColorStop(0, blend('#2a2018', '#3a0f08', depth));
      g.addColorStop(1, blend('#141009', '#1f0502', depth));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Shaft walls
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, w * 0.12, h);
      ctx.fillRect(w * 0.88, 0, w * 0.12, h);

      // Band strata lines scrolling slowly to sell descent
      ctx.strokeStyle = 'rgba(255, 210, 74, 0.12)';
      ctx.lineWidth = 2;
      const scroll = (t * 12) % 64;
      for (let y = -64 + scroll; y < h; y += 64) {
        ctx.beginPath();
        ctx.moveTo(w * 0.12, y);
        ctx.lineTo(w * 0.88, y + 6);
        ctx.stroke();
      }

      // Zone name watermark
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = `600 ${Math.round(h * 0.055)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(zone?.name ?? '', w / 2, h * 0.16);

      // The rig: a simple drill head bobbing at center
      const bob = Math.sin(t * 3) * 4;
      ctx.fillStyle = '#c8842a';
      ctx.fillRect(w / 2 - 10, h * 0.35 + bob, 20, h * 0.22);
      ctx.beginPath();
      ctx.moveTo(w / 2 - 16, h * 0.57 + bob);
      ctx.lineTo(w / 2 + 16, h * 0.57 + bob);
      ctx.lineTo(w / 2, h * 0.65 + bob);
      ctx.closePath();
      ctx.fillStyle = '#ffd24a';
      ctx.fill();

      // Instability warning vignette
      if (st.band > 0 && st.stability < 35) {
        const alpha = 0.25 * (1 - st.stability / 35) * (0.7 + 0.3 * Math.sin(t * 8));
        ctx.fillStyle = `rgba(200, 30, 20, ${alpha.toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
      }
    },

    serialize() { return { band: st.band, stability: st.stability, mined: st.minedThisBand.serialize(), shoreCount: st.shoreCount }; },
    hydrate(d) {
      st.band = d.band ?? 0;
      st.stability = d.stability ?? 100;
      st.minedThisBand = d.mined ? Dec.parse(d.mined) : Dec.zero();
      st.shoreCount = d.shoreCount ?? 0;
    },
  };
}

function blend(a, b, f) {
  const pa = hex(a), pb = hex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function hex(s) {
  return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
}
