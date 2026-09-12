// Game orchestrator: state, tick loop, production, prestige, offline earnings,
// and the meta (permanent) upgrade tree. Theme-agnostic — everything named or
// numeric comes from the theme pack.
import { Dec } from './bignum.js';
import * as eco from './economy.js';
import * as save from './save.js';
import * as sdk from './sdk.js';
import { AdManager } from './ads.js';
import { RunManager } from './run.js';
import { createSignature } from './signature/index.js';
import { track } from './analytics.js';

// Permanent meta upgrades bought with prestige currency. Generic engine-side
// tree; display names take the theme's prestige-resource noun.
const META_UPGRADES = [
  { id: 'baseProd1', name: 'Veteran Crew', desc: 'All production ×1.5 (permanent)', cost: 3, effect: { type: 'prodAll', v: 1.5 } },
  { id: 'baseProd2', name: 'Legendary Crew', desc: 'All production ×2 (permanent)', cost: 12, effect: { type: 'prodAll', v: 2 } },
  { id: 'offlineCap1', name: 'Night Shift', desc: '+2h offline earnings cap', cost: 5, effect: { type: 'offlineCap', v: 2 } },
  { id: 'offlineCap2', name: 'Automated Watch', desc: '+4h offline earnings cap', cost: 20, effect: { type: 'offlineCap', v: 4 } },
  { id: 'startBoost', name: 'Head Start', desc: 'Begin each run with 60s of production banked', cost: 8, effect: { type: 'startBank', v: 60 } },
  { id: 'tapMeta', name: 'Power Tools', desc: 'Tap power ×3 (permanent)', cost: 4, effect: { type: 'tapPower', v: 3 } },
  { id: 'regenMeta', name: 'Standing Repairs', desc: '+0.2/s stability regen (permanent)', cost: 6, effect: { type: 'stabilityRegen', v: 0.2 } },
];

export class Game {
  constructor(theme) {
    this.theme = theme;
    this.metaUpgradeDefs = META_UPGRADES;
    this.state = {
      primary: Dec.zero(),
      gens: Object.fromEntries(theme.generators.map(g => [g.id, 0])),
      runUpgrades: [],
      metaUpgrades: {},
      prestige: { held: 0, lifetime: Dec.zero() },
      run: { seconds: 0, level: 0, active: true },
      meta: { offlineCapHours: theme.economy.offlineCapHoursBase, unlocks: [theme.zones?.[0]?.id].filter(Boolean) },
      boostUntil: 0,
      stats: { firstUpgradeTracked: false, runs: 0, lastPlayedDay: null },
      settings: { muted: false },
    };
    this.paused = false;
    this.signature = createSignature(this);
    this.run = new RunManager(this);
    this.ads = new AdManager(this, {
      onPause: () => { this.paused = true; },
      onResume: () => { this.paused = false; },
    });
    this.ui = null; // attached by ui.js
    this._mults = null;
    this.recomputeMults();
  }

  // ---------- multipliers ----------

  recomputeMults() {
    const m = { prodAll: 1, prodGen: {}, tapPower: 1, dangerReduce: 1, stabilityRegen: 0, costReduce: 1 };
    const apply = (effect) => {
      switch (effect.type) {
        case 'prodAll': m.prodAll *= effect.v; break;
        case 'prodGen': m.prodGen[effect.gen] = (m.prodGen[effect.gen] ?? 1) * effect.v; break;
        case 'tapPower': m.tapPower *= effect.v; break;
        case 'dangerReduce': m.dangerReduce *= effect.v; break;
        case 'stabilityRegen': m.stabilityRegen += effect.v; break;
        case 'costReduce': m.costReduce *= effect.v; break;
        default: break;
      }
    };
    for (const id of this.state.runUpgrades) {
      const u = this.run?.upgradeById(id);
      if (u) apply(u.effect);
    }
    for (const id of Object.keys(this.state.metaUpgrades)) {
      const def = META_UPGRADES.find(d => d.id === id);
      if (def && def.effect.type !== 'offlineCap' && def.effect.type !== 'startBank') apply(def.effect);
    }
    this._mults = m;
  }

  prestigeMult() {
    const pct = this.theme.economy.prestigePerLevelBonusPct ?? 1;
    return 1 + (this.state.prestige.held * pct) / 100;
  }

  boostMult() { return Date.now() < this.state.boostUntil ? 2 : 1; }
  dangerMult() { return this._mults.dangerReduce; }
  stabilityRegen() { return this._mults.stabilityRegen; }
  tapPower() {
    const base = Math.max(1, this.prodPerSec(false).mulNum(0.05).toNumber());
    return Dec.from(base).mulNum(this._mults.tapPower);
  }

  // Production/sec. includeSignature=false gives the offline-safe base rate
  // (offline earnings ignore run-scoped richness so idling away can't exploit
  // a deep band indefinitely).
  prodPerSec(includeSignature = true) {
    const mb = this.theme.milestoneBonuses;
    let total = Dec.zero();
    for (const g of this.theme.generators) {
      const owned = this.state.gens[g.id];
      if (!owned) continue;
      const mult = eco.milestoneMult(owned, mb.counts, mb.multiplier) * (this._mults.prodGen[g.id] ?? 1);
      total = total.add(eco.generatorProduction(g.baseProd, owned, mult));
    }
    let global = this._mults.prodAll * this.prestigeMult() * this.boostMult();
    if (includeSignature && this.signature.productionMult) global *= this.signature.productionMult();
    return total.mulNum(global);
  }

  // ---------- purchases ----------

  genCost(g, n = 1) {
    return eco.bulkCost(g.baseCost, g.costGrowth, this.state.gens[g.id], n).mulNum(this._mults.costReduce);
  }

  genMaxAffordable(g) {
    // costReduce scales the whole bulk price linearly, so divide it out first
    const budget = this.state.primary.mulNum(1 / this._mults.costReduce);
    return eco.maxAffordable(budget, g.baseCost, g.costGrowth, this.state.gens[g.id]);
  }

  buyGenerator(g, n) {
    if (n === 'max') n = this.genMaxAffordable(g);
    if (n < 1) return false;
    const cost = this.genCost(g, n);
    if (!this.state.primary.gte(cost)) return false;
    this.spend(cost);
    this.state.gens[g.id] += n;
    if (!this.state.stats.firstUpgradeTracked) {
      this.state.stats.firstUpgradeTracked = true;
      track('first_upgrade_purchased', { seconds_since_start: Math.round(this.state.run.seconds) });
    }
    track('generator_purchased', { gen_id: g.id, owned: this.state.gens[g.id], run_time: Math.round(this.state.run.seconds) });
    return true;
  }

  buyMetaUpgrade(id) {
    const def = META_UPGRADES.find(d => d.id === id);
    if (!def || this.state.metaUpgrades[id]) return false;
    if (this.state.prestige.held < def.cost) return false;
    this.state.prestige.held -= def.cost;
    this.state.metaUpgrades[id] = true;
    if (def.effect.type === 'offlineCap') this.state.meta.offlineCapHours += def.effect.v;
    this.recomputeMults();
    track('upgrade_purchased', { upg_id: id });
    return true;
  }

  spend(amount) { this.state.primary = this.state.primary.sub(amount); }

  earn(amount) {
    this.state.primary = this.state.primary.add(amount);
    this.state.prestige.lifetime = this.state.prestige.lifetime.add(amount);
    this.signature.onEarn?.(amount);
  }

  tap() {
    if (!this.state.run.active || this.paused) return Dec.zero();
    const gain = this.tapPower();
    this.earn(gain);
    return gain;
  }

  // Pacing telemetry: seconds until the cheapest single-unit generator buy.
  cheapestPurchaseEta() {
    const income = this.prodPerSec();
    if (income.isZero()) return Infinity;
    let best = Infinity;
    for (const g of this.theme.generators) {
      const gap = this.genCost(g, 1).sub(this.state.primary);
      const eta = gap.m <= 0 ? 0 : gap.div(income).toNumber();
      best = Math.min(best, eta);
    }
    return best;
  }

  // ---------- prestige / run end ----------

  prestigeGainNow() {
    const e = this.theme.economy;
    return eco.prestigeGain(this.state.prestige.lifetime, e.prestigeDivisor, e.prestigeExponent, this.prestigeTotalEarned());
  }

  prestigeTotalEarned() { return this.state.stats.prestigeTotalEarned ?? 0; }

  endRun(reason) {
    if (!this.state.run.active) return null;
    const gain = this.prestigeGainNow();
    const summary = {
      reason,
      gain,
      runSeconds: Math.round(this.state.run.seconds),
      level: this.state.run.level,
      lifetime: this.state.prestige.lifetime.clone(),
    };
    this.state.run.active = false;
    this.state.prestige.held += gain;
    this.state.stats.prestigeTotalEarned = this.prestigeTotalEarned() + gain;
    this.state.stats.runs += 1;
    this.signature.onRunEnd?.();
    track('run_end', { reason, run_seconds: summary.runSeconds, level_reached: summary.level });
    if (gain > 0) track('prestige', { prestige_gain: gain, lifetime: this.state.prestige.lifetime.serialize(), run_seconds: summary.runSeconds });
    save.persist(this);
    return summary;
  }

  startRun() {
    const s = this.state;
    s.primary = Dec.zero();
    for (const id of Object.keys(s.gens)) s.gens[id] = 0;
    s.runUpgrades = [];
    s.run = { seconds: 0, level: 0, active: true };
    this.run.nextLevelAt = this.theme.run?.levelUpEverySeconds ?? 75;
    this.signature.onRunStart?.();
    this.ads.onRunStart();
    this.recomputeMults();
    // Head Start meta upgrade: bank some production so re-entry skips the cold open
    if (s.metaUpgrades.startBoost) {
      const firstGen = this.theme.generators[0];
      s.gens[firstGen.id] = 1;
      this.earn(Dec.from(firstGen.baseProd).mulNum(60));
    }
    sdk.gameplayStart();
    save.persist(this);
  }

  revive() {
    // rewarded revive: the ad manager gates once-per-run; this just applies it
    this.state.run.active = true;
    this.signature.onRevive?.();
  }

  applyBoost2x() {
    const minutes = this.theme.ads?.boost2xMinutes ?? 5;
    this.state.boostUntil = Date.now() + minutes * 60 * 1000;
  }

  onZoneMaybeUnlocked(band) {
    const zones = this.theme.zones ?? [];
    if (!zones.length) return;
    const idx = Math.min(zones.length - 1, Math.floor(band / Math.ceil((this.signatureBandCount() || zones.length) / zones.length)));
    const zone = zones[idx];
    if (zone && !this.state.meta.unlocks.includes(zone.id)) {
      this.state.meta.unlocks.push(zone.id);
      track('zone_unlocked', { zone_id: zone.id });
      this.ui?.toast(`Unlocked: ${zone.name}`);
    }
  }

  signatureBandCount() {
    return this.theme.signatureConfig?.[this.theme.signatureMechanic]?.bandCount ?? 0;
  }

  zoneForBand(band) {
    const zones = this.theme.zones ?? [];
    if (!zones.length) return null;
    const per = Math.ceil((this.signatureBandCount() || zones.length) / zones.length);
    return zones[Math.min(zones.length - 1, Math.floor(band / per))];
  }

  // ---------- offline ----------

  applyOffline(lastSeenMs) {
    if (!lastSeenMs) return null;
    const now = Date.now();
    if (now < lastSeenMs) return null; // clock rollback → award nothing
    const rate = this.prodPerSec(false);
    if (rate.isZero()) return null;
    const e = this.theme.economy;
    const { seconds, amount } = eco.offlineEarnings(now - lastSeenMs, rate, e.offlineRate, this.state.meta.offlineCapHours);
    if (seconds < 60 || amount.isZero()) return null;
    return { seconds, amount };
  }

  claimOffline(offer, doubled) {
    const amount = doubled ? offer.amount.mulNum(2) : offer.amount;
    this.earn(amount);
    track('offline_claim', { hours: (offer.seconds / 3600).toFixed(2), doubled });
  }

  // ---------- tick ----------

  tick(dt) {
    if (this.paused || !this.state.run.active) return;
    const s = this.state;
    s.run.seconds += dt;
    this.earn(this.prodPerSec().mulNum(dt));
    this.signature.tick?.(dt);
    this.run.tick();
    if (this.signature.isDead?.()) {
      if (this.ui?.onDying) {
        this.paused = true; // freeze while the revive offer counts down
        this.ui.onDying();
      } else {
        this.endRun('death');
        this.startRun();
      }
    }
  }
}
