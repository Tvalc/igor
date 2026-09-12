// Economy math — the shared, theme-independent core.
// Formulas follow Pecorella ("The Math of Idle Games") and the spec in
// docs/IDLE_FORGE_ENGINE_SPEC.md Part C. All currency amounts are Dec.
import { Dec } from './bignum.js';

// cost(g, owned) = baseCost × costGrowth^owned
export function unitCost(baseCost, growth, owned) {
  return Dec.powOf(growth, owned).mulNum(baseCost);
}

// Closed-form bulk buy: base × growth^owned × (growth^n − 1) / (growth − 1)
export function bulkCost(baseCost, growth, owned, n) {
  if (n <= 0) return Dec.zero();
  const geo = Dec.powOf(growth, n).sub(Dec.from(1)).mulNum(1 / (growth - 1));
  return Dec.powOf(growth, owned).mulNum(baseCost).mul(geo);
}

// maxAffordable = floor( log( currency×(growth−1) / (base×growth^owned) + 1 ) / log(growth) )
export function maxAffordable(currency, baseCost, growth, owned) {
  currency = Dec.from(currency);
  if (currency.isZero()) return 0;
  const ratioLog = currency.log10() + Math.log10(growth - 1)
    - (Math.log10(baseCost) + owned * Math.log10(growth));
  // ratio + 1 without leaving log space when ratio is astronomically large
  let inner;
  if (ratioLog > 15) {
    inner = ratioLog;
  } else {
    inner = Math.log10(Math.pow(10, ratioLog) + 1);
  }
  const n = Math.floor(inner / Math.log10(growth));
  return Math.max(0, n);
}

// Milestone bonus: ×multiplier for each threshold reached (e.g. 25/50/100/200 owned)
export function milestoneMult(owned, counts, multiplier) {
  let m = 1;
  for (const c of counts) if (owned >= c) m *= multiplier;
  return m;
}

// production(g) = baseProd × owned × multipliers (multipliers stack multiplicatively)
export function generatorProduction(baseProd, owned, mult) {
  return Dec.from(baseProd).mulNum(owned).mulNum(mult);
}

// prestigeGain = floor((lifetime / divisor)^exp) − alreadyHeld
export function prestigeGain(lifetime, divisor, exponent, alreadyHeld) {
  const ratio = Dec.from(lifetime).div(Dec.from(divisor)).powNum(exponent).toNumber();
  // powNum works in log space; nudge past float error so exact roots floor cleanly
  const total = Math.floor(ratio * (1 + 1e-12) + 1e-9);
  return Math.max(0, total - alreadyHeld);
}

// offline = min(cap, elapsed) hours × production/hour × offlineRate
// Clock-tamper safe: negative elapsed (rollback) awards nothing.
export function offlineEarnings(elapsedMs, prodPerSec, offlineRate, capHours) {
  const seconds = Math.min(Math.max(0, elapsedMs / 1000), capHours * 3600);
  return { seconds, amount: Dec.from(prodPerSec).mulNum(seconds * offlineRate) };
}
