// Run with: node test/economy.test.mjs
// Verifies the economy math against the worked examples in the spec.
import assert from 'node:assert/strict';
import { Dec } from '../src/engine/bignum.js';
import * as eco from '../src/engine/economy.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}\n    ${e.message}`); process.exitCode = 1; }
}
function approx(actual, expected, tol = 1e-6) {
  const rel = Math.abs(actual - expected) / Math.max(1, Math.abs(expected));
  assert.ok(rel < tol, `expected ~${expected}, got ${actual}`);
}

console.log('Dec (big numbers)');
test('parse/serialize round-trip', () => {
  const d = Dec.parse('1.23e15');
  assert.equal(d.serialize(), '1.23e15');
});
test('add across magnitudes', () => {
  approx(Dec.from(1e10).add(5e9).toNumber(), 1.5e10);
  approx(Dec.parse('1e300').add(Dec.parse('1e300')).log10(), 300 + Math.log10(2));
});
test('numbers beyond 1e308 survive', () => {
  const huge = Dec.parse('5e500').mul(Dec.parse('2e500'));
  assert.equal(huge.e, 1001);
  approx(huge.m, 1);
});
test('cmp orders correctly', () => {
  assert.ok(Dec.from(100).gt(99));
  assert.ok(Dec.parse('1e20').gt(Dec.parse('9.99e19')));
  assert.ok(Dec.zero().lt(1));
});

console.log('unit cost: cost = base × growth^owned');
test('spec example: base 10, growth 1.15, owned 20 → ≈163.7', () => {
  approx(eco.unitCost(10, 1.15, 20).toNumber(), 10 * Math.pow(1.15, 20), 1e-9);
  approx(eco.unitCost(10, 1.15, 20).toNumber(), 163.665, 1e-4);
});
test('AdVenture Capitalist lemonade: base 4, growth 1.07', () => {
  approx(eco.unitCost(4, 1.07, 10).toNumber(), 4 * Math.pow(1.07, 10), 1e-9);
});

console.log('bulk buy (closed form) matches naive loop');
test('bulkCost(n=10) equals summed unit costs', () => {
  let naive = 0;
  for (let i = 0; i < 10; i++) naive += 10 * Math.pow(1.15, 20 + i);
  approx(eco.bulkCost(10, 1.15, 20, 10).toNumber(), naive, 1e-9);
});
test('maxAffordable inverts bulkCost', () => {
  for (const currency of [0, 9, 10, 1000, 1e6, 1e12]) {
    const n = eco.maxAffordable(Dec.from(currency), 10, 1.15, 20);
    if (n > 0) assert.ok(eco.bulkCost(10, 1.15, 20, n).toNumber() <= currency + 1e-6, `n=${n} overshoots at ${currency}`);
    assert.ok(eco.bulkCost(10, 1.15, 20, n + 1).toNumber() > currency, `n+1=${n + 1} should be unaffordable at ${currency}`);
  }
});
test('maxAffordable handles astronomic currency without overflow', () => {
  const n = eco.maxAffordable(Dec.parse('1e300'), 10, 1.15, 0);
  assert.ok(n > 4000 && n < 5000, `got ${n}`);
});

console.log('production & milestones');
test('production = baseProd × owned × mult', () => {
  approx(eco.generatorProduction(1.67, 100, 2).toNumber(), 334);
});
test('milestone doubling at 25/50/100/200', () => {
  assert.equal(eco.milestoneMult(24, [25, 50, 100, 200], 2), 1);
  assert.equal(eco.milestoneMult(25, [25, 50, 100, 200], 2), 2);
  assert.equal(eco.milestoneMult(150, [25, 50, 100, 200], 2), 8);
  assert.equal(eco.milestoneMult(500, [25, 50, 100, 200], 2), 16);
});

console.log('prestige: gain = floor((lifetime/divisor)^exp) − held');
test('sqrt curve', () => {
  assert.equal(eco.prestigeGain(Dec.from(4e6), 1e6, 0.5, 0), 2);
  assert.equal(eco.prestigeGain(Dec.from(4e6), 1e6, 0.5, 1), 1);
  assert.equal(eco.prestigeGain(Dec.from(4e6), 1e6, 0.5, 5), 0, 'never negative');
});
test('Cookie Clicker cube root: 1T → 1, 8T → 2', () => {
  assert.equal(eco.prestigeGain(Dec.parse('1e12'), 1e12, 1 / 3, 0), 1);
  assert.equal(eco.prestigeGain(Dec.parse('8e12'), 1e12, 1 / 3, 0), 2);
});

console.log('offline earnings');
test('50% rate, respects cap', () => {
  const r = eco.offlineEarnings(2 * 3600 * 1000, Dec.from(100), 0.5, 3);
  approx(r.amount.toNumber(), 2 * 3600 * 100 * 0.5);
  const capped = eco.offlineEarnings(10 * 3600 * 1000, Dec.from(100), 0.5, 3);
  approx(capped.amount.toNumber(), 3 * 3600 * 100 * 0.5);
});
test('clock rollback (negative elapsed) awards nothing', () => {
  const r = eco.offlineEarnings(-5000, Dec.from(100), 0.5, 3);
  assert.equal(r.amount.toNumber(), 0);
});

console.log(`\n${passed} assertions passed${process.exitCode ? ' (with failures)' : ''}`);
