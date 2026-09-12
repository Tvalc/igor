// Minimal break_infinity-style decimal: value = m * 10^e, m in [1, 10) (or 0).
// Plain JS numbers lose integer precision past ~9e15 and overflow past ~1.8e308;
// all currency values route through Dec so the economy never hits either wall.

export class Dec {
  constructor(m = 0, e = 0) {
    this.m = m;
    this.e = e;
    this._norm();
  }

  _norm() {
    if (this.m === 0 || !isFinite(this.m)) { this.m = this.m === 0 ? 0 : this.m; this.e = 0; return this; }
    const sign = this.m < 0 ? -1 : 1;
    let abs = Math.abs(this.m);
    const shift = Math.floor(Math.log10(abs));
    if (shift !== 0) {
      abs /= Math.pow(10, shift);
      this.e += shift;
    }
    // log10 float edge cases (e.g. 9.9999...e-1)
    if (abs >= 10) { abs /= 10; this.e += 1; }
    if (abs < 1) { abs *= 10; this.e -= 1; }
    this.m = sign * abs;
    return this;
  }

  static from(v) {
    if (v instanceof Dec) return new Dec(v.m, v.e);
    if (typeof v === 'number') return new Dec(v, 0);
    if (typeof v === 'string') return Dec.parse(v);
    return new Dec(0, 0);
  }

  static zero() { return new Dec(0, 0); }

  static parse(s) {
    const i = s.indexOf('e');
    if (i === -1) return new Dec(parseFloat(s), 0);
    return new Dec(parseFloat(s.slice(0, i)), parseInt(s.slice(i + 1), 10));
  }

  static fromLog10(lg) {
    const e = Math.floor(lg);
    return new Dec(Math.pow(10, lg - e), e);
  }

  clone() { return new Dec(this.m, this.e); }
  isZero() { return this.m === 0; }

  log10() {
    if (this.m <= 0) return -Infinity;
    return Math.log10(this.m) + this.e;
  }

  add(o) {
    o = Dec.from(o);
    if (this.isZero()) return o.clone();
    if (o.isZero()) return this.clone();
    const [hi, lo] = this.e >= o.e ? [this, o] : [o, this];
    const diff = hi.e - lo.e;
    if (diff > 17) return hi.clone();
    return new Dec(hi.m + lo.m / Math.pow(10, diff), hi.e);
  }

  sub(o) {
    o = Dec.from(o);
    return this.add(new Dec(-o.m, o.e));
  }

  mul(o) {
    o = Dec.from(o);
    return new Dec(this.m * o.m, this.e + o.e);
  }

  div(o) {
    o = Dec.from(o);
    return new Dec(this.m / o.m, this.e - o.e);
  }

  mulNum(n) { return new Dec(this.m * n, this.e); }

  // this ^ n for real n (this must be positive)
  powNum(n) {
    if (this.isZero()) return Dec.zero();
    return Dec.fromLog10(this.log10() * n);
  }

  // b ^ n for plain-number base b > 0 and real n — safe for huge n
  static powOf(b, n) {
    return Dec.fromLog10(Math.log10(b) * n);
  }

  cmp(o) {
    o = Dec.from(o);
    if (this.m === 0 || o.m === 0) return Math.sign(this.m) - Math.sign(o.m) || 0;
    if (this.m > 0 && o.m > 0) {
      if (this.e !== o.e) return this.e > o.e ? 1 : -1;
      return this.m === o.m ? 0 : (this.m > o.m ? 1 : -1);
    }
    return this.log10() > o.log10() ? 1 : -1;
  }

  gte(o) { return this.cmp(o) >= 0; }
  gt(o) { return this.cmp(o) > 0; }
  lt(o) { return this.cmp(o) < 0; }

  toNumber() {
    if (this.e > 308) return Infinity;
    return this.m * Math.pow(10, this.e);
  }

  floor() {
    if (this.e >= 15) return this.clone();
    return Dec.from(Math.floor(this.toNumber()));
  }

  serialize() { return `${this.m}e${this.e}`; }
  toString() { return this.serialize(); }
}
