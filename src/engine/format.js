// Number display: shorthand suffixes to 1e33, then scientific ("1.23e45").
import { Dec } from './bignum.js';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(v) {
  const d = Dec.from(v);
  if (d.isZero()) return '0';
  if (d.e < 0) return d.toNumber().toFixed(2);
  if (d.e < 3) {
    const n = d.toNumber();
    return n === Math.floor(n) ? String(n) : n.toFixed(1);
  }
  const tier = Math.floor(d.e / 3);
  if (tier < SUFFIXES.length) {
    const scaled = d.m * Math.pow(10, d.e - tier * 3);
    return `${scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(2)}${SUFFIXES[tier]}`;
  }
  return `${d.m.toFixed(2)}e${d.e}`;
}

export function fmtTime(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60), s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
