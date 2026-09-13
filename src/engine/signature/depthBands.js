// Signature mechanic: DEPTH BANDS (Deepcore Mine).
//
// The run is a descent. Each band multiplies ore richness but also multiplies
// what lives down there — spawn rate, enemy HP and speed all key off the band
// index (see field.js). The player chooses when to descend, trading a safer
// shallow grind for a richer, deadlier one, and that choice is the whole
// tension of a run: the quota gate means you cannot descend without committing
// time to the current band first.
import { Dec } from '../bignum.js';
import { fmt } from '../format.js';

export function createDepthBands(game, config) {
  const bandCount = config.bandCount ?? 8;
  const richnessPerBand = config.richnessMultiplierPerBand ?? 3.5;

  const st = { band: 0, minedThisBand: Dec.zero(), deepestReached: 0 };

  // Quota rides the same exponential family as generator costs, so descending
  // paces against the economy rather than against a wall-clock timer. The first
  // step is deliberately cheap: descending is the mechanic the whole game hangs
  // on, and a player who has not seen it in the first minute has not met the
  // game yet. Later steps widen fast (x26 per band against x2.2 income), and
  // that widening gap is the wall that eventually ends a run.
  function quota() {
    return Dec.powOf(26, st.band).mulNum(150);
  }

  function canDescend() {
    return st.band < bandCount - 1 && st.minedThisBand.gte(quota());
  }

  function descend() {
    if (!canDescend()) return false;
    st.band += 1;
    st.deepestReached = Math.max(st.deepestReached, st.band);
    st.minedThisBand = Dec.zero();
    game.onDescend(st.band);
    return true;
  }

  return {
    id: 'depthBands',
    get band() { return st.band; },
    get deepestReached() { return st.deepestReached; },

    onEarn(amount) { st.minedThisBand = st.minedThisBand.add(amount); },
    productionMult() { return Math.pow(richnessPerBand, st.band); },
    // Active yield scales more gently than passive so deep bands don't make
    // hand-mining the whole economy again.
    activeMult() { return Math.pow(richnessPerBand, st.band * 0.62); },

    onRunStart() { st.band = 0; st.minedThisBand = Dec.zero(); },
    onRunEnd() {},

    panel() {
      const q = quota();
      return {
        title: `Depth ${st.band + 1}/${bandCount}`,
        subtitle: `ore ×${fmt(Math.pow(richnessPerBand, st.band))}`,
        nextMultiplier: st.band < bandCount - 1 ? `×${richnessPerBand.toFixed(1)}` : null,
        progress: Math.min(1, st.minedThisBand.div(q).toNumber()),
        progressLabel: st.band >= bandCount - 1
          ? 'Bottom of the world'
          : `mine ${fmt(q.sub(st.minedThisBand))} more to descend`,
        actions: [{
          id: 'descend',
          label: st.band >= bandCount - 1 ? '⛏ Max depth' : '⬇ Descend',
          hint: `Ore ×${richnessPerBand.toFixed(1)} deeper down — and far more of them`,
          enabled: canDescend(),
          onClick: descend,
        }],
      };
    },

    serialize() { return { band: st.band, mined: st.minedThisBand.serialize(), deepest: st.deepestReached }; },
    hydrate(d) {
      st.band = d?.band ?? 0;
      st.minedThisBand = d?.mined ? Dec.parse(d.mined) : Dec.zero();
      st.deepestReached = d?.deepest ?? 0;
    },
  };
}
