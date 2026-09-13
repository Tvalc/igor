// Game orchestrator: state, tick loop, economy, prestige, offline earnings,
// and the permanent meta tree. Theme-agnostic — every name and number comes
// from the theme pack.
//
// Income has two halves (spec Part B's "active-idle"):
//   passive — prodPerSec(), the classic generator economy, embodied on the
//             field as crew units that mine on their own
//   active  — activeYield(), banked whenever the player mines a vein or kills
//             something, so the first minutes are hands-on and the last ones
//             are the build running itself
import { Dec } from './bignum.js';
import * as eco from './economy.js';
import * as save from './save.js';
import * as sdk from './sdk.js';
import { AdManager } from './ads.js';
import { RunManager } from './run.js';
import { createSignature } from './signature/index.js';
import { createField } from './field.js';
import { sfx } from './audio.js';
import { track } from './analytics.js';

// Permanent upgrades bought with prestige currency. Deliberately spans both
// halves of the game so prestige improves the run, not just the spreadsheet.
const META_UPGRADES = [
  { id: 'baseProd1', name: 'Veteran Crew', desc: 'Crew output ×1.5, permanently', cost: 3, effect: { type: 'prodAll', v: 1.5 } },
  { id: 'sharpPicks', name: 'Sharpened Picks', desc: 'Mining damage ×1.5, permanently', cost: 3, effect: { type: 'damage', v: 1.5 } },
  { id: 'thickHide', name: 'Thick Hide', desc: '+50% max health', cost: 4, effect: { type: 'maxHp', v: 1.5 } },
  { id: 'lodestone', name: 'Lodestone', desc: '+60% ore pickup radius', cost: 4, effect: { type: 'magnet', v: 1.6 } },
  { id: 'baseProd2', name: 'Legendary Crew', desc: 'Crew output ×2, permanently', cost: 10, effect: { type: 'prodAll', v: 2 } },
  { id: 'quickHands', name: 'Quick Hands', desc: 'Swing speed ×1.4, permanently', cost: 8, effect: { type: 'attackRate', v: 1.4 } },
  { id: 'offlineCap1', name: 'Night Shift', desc: '+2h offline earnings cap', cost: 5, effect: { type: 'offlineCap', v: 2 } },
  { id: 'offlineCap2', name: 'Automated Watch', desc: '+4h offline earnings cap', cost: 18, effect: { type: 'offlineCap', v: 4 } },
  { id: 'startBoost', name: 'Head Start', desc: 'Begin every run with a crew already working', cost: 8, effect: { type: 'startBank', v: 60 } },
  { id: 'richSeams', name: 'Rich Seams', desc: 'Hand-mined ore ×2, permanently', cost: 12, effect: { type: 'activeYield', v: 2 } },
];

// Effects that belong to the field sim rather than the economy.
const FIELD_EFFECTS = new Set([
  'damage', 'attackRate', 'attackRange', 'moveSpeed', 'maxHp', 'hpRegen', 'magnet', 'damageTaken',
]);

// A fresh save, built in one place so hardReset() cannot drift from the
// constructor and leave stale fields behind.
function initialState(theme) {
  return {
    primary: Dec.zero(),
    premium: 0,
    gens: Object.fromEntries(theme.generators.map(g => [g.id, 0])),
    runUpgrades: [],
    metaUpgrades: {},
    prestige: { held: 0, lifetime: Dec.zero() },
    run: { seconds: 0, level: 0, active: true },
    meta: { offlineCapHours: theme.economy.offlineCapHoursBase, unlocks: [theme.zones?.[0]?.id].filter(Boolean) },
    boostUntil: 0,
    stats: { firstUpgradeTracked: false, runs: 0, lastPlayedDay: null, prestigeTotalEarned: 0, bestDepth: 0 },
    settings: { muted: false },
  };
}

export class Game {
  constructor(theme) {
    this.theme = theme;
    this.metaUpgradeDefs = META_UPGRADES;
    this.state = initialState(theme);
    this.paused = false;
    this.signature = createSignature(this);
    this.field = createField(this, theme.field ?? {});
    this.run = new RunManager(this);
    this.ads = new AdManager(this, {
      onPause: () => { this.paused = true; },
      onResume: () => { this.paused = false; },
    });
    this.ui = null;
    this._mults = null;
    this._field = null;
    this.recomputeMults();
  }

  // ---------- multipliers ----------

  recomputeMults() {
    const m = { prodAll: 1, prodGen: {}, costReduce: 1, activeYield: 1 };
    const f = {
      damage: 1, attackRate: 1, attackRange: 1, moveSpeed: 1,
      maxHp: 1, hpRegen: 0, magnet: 1, damageTaken: 1,
    };
    const apply = (e) => {
      if (FIELD_EFFECTS.has(e.type)) {
        if (e.type === 'hpRegen') f.hpRegen += e.v;
        else f[e.type] *= e.v;
        return;
      }
      switch (e.type) {
        case 'prodAll': m.prodAll *= e.v; break;
        case 'prodGen': m.prodGen[e.gen] = (m.prodGen[e.gen] ?? 1) * e.v; break;
        case 'costReduce': m.costReduce *= e.v; break;
        case 'activeYield': m.activeYield *= e.v; break;
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
    this._field = f;
  }

  fieldMults() { return this._field; }

  // Combat power rides the economy: every crew hire makes your own swing hit
  // harder. Without this the two halves drift apart — income compounds while
  // the player's damage stays flat, and every run dies at the same depth.
  // Log-scaled so it tracks orders of magnitude, not raw numbers.
  powerScale() {
    const prod = this.prodPerSec(false).toNumber();
    return 1 + 0.9 * Math.log10(1 + Math.max(0, prod));
  }

  prestigeMult() {
    const pct = this.theme.economy.prestigePerLevelBonusPct ?? 1;
    return 1 + (this.state.prestige.held * pct) / 100;
  }

  boostMult() { return Date.now() < this.state.boostUntil ? 2 : 1; }

  // Passive income. includeSignature=false is the offline-safe base rate, so
  // idling at depth can't farm a band multiplier the player isn't defending.
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
    if (includeSignature) global *= this.signature.productionMult?.() ?? 1;
    return total.mulNum(global);
  }

  // Ore banked per hand-mining hit / kill. Anchored to passive income so it
  // stays relevant early and is comfortably eclipsed late.
  activeYield() {
    const base = Math.max(2, this.prodPerSec(false).mulNum(0.55).toNumber());
    const sig = this.signature.activeMult?.() ?? 1;
    return Dec.from(base)
      .mulNum(this._mults.activeYield * this.prestigeMult() * this.boostMult() * sig);
  }

  // ---------- purchases ----------

  genCost(g, n = 1) {
    return eco.bulkCost(g.baseCost, g.costGrowth, this.state.gens[g.id], n).mulNum(this._mults.costReduce);
  }

  genMaxAffordable(g) {
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
    sfx.buy();
    if (!this.state.stats.firstUpgradeTracked) {
      this.state.stats.firstUpgradeTracked = true;
      track('first_upgrade_purchased', { seconds_since_start: Math.round(this.state.run.seconds) });
    }
    track('generator_purchased', { gen_id: g.id, owned: this.state.gens[g.id], run_time: Math.round(this.state.run.seconds) });
    this.recomputeMults();
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
    sfx.buy();
    track('upgrade_purchased', { upg_id: id });
    return true;
  }

  spend(amount) { this.state.primary = this.state.primary.sub(amount); }

  earn(amount) {
    this.state.primary = this.state.primary.add(amount);
    this.state.prestige.lifetime = this.state.prestige.lifetime.add(amount);
    this.signature.onEarn?.(amount);
  }

  // Field callback: ore banked from a swing or a kill.
  earnActive(amount) {
    this.earn(amount);
    sfx.pickup();
  }

  grantPremium(n) { this.state.premium += n; }

  onDescend(band) {
    this.state.stats.bestDepth = Math.max(this.state.stats.bestDepth, band);
    sfx.descend();
    const zones = this.theme.zones ?? [];
    if (zones.length) {
      const per = Math.ceil((this.signatureBandCount() || zones.length) / zones.length);
      const zone = zones[Math.min(zones.length - 1, Math.floor(band / per))];
      if (zone && !this.state.meta.unlocks.includes(zone.id)) {
        this.state.meta.unlocks.push(zone.id);
        track('zone_unlocked', { zone_id: zone.id });
        this.ui?.toast(`Entering ${zone.name}`);
      }
    }
  }

  signatureBandCount() {
    return this.theme.signatureConfig?.[this.theme.signatureMechanic]?.bandCount ?? 0;
  }

  // Pacing telemetry (spec Part C): seconds until the cheapest next purchase.
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

  // ---------- prestige / run lifecycle ----------

  prestigeGainNow() {
    const e = this.theme.economy;
    return eco.prestigeGain(this.state.prestige.lifetime, e.prestigeDivisor, e.prestigeExponent, this.state.stats.prestigeTotalEarned);
  }

  endRun(reason) {
    if (!this.state.run.active) return null;
    const gain = this.prestigeGainNow();
    const summary = {
      reason,
      gain,
      runSeconds: Math.round(this.state.run.seconds),
      level: this.state.run.level,
      depth: this.signature.band + 1,
      kills: this.field.kills(),
      lifetime: this.state.prestige.lifetime.clone(),
    };
    this.state.run.active = false;
    this.state.prestige.held += gain;
    this.state.stats.prestigeTotalEarned += gain;
    this.state.stats.runs += 1;
    this.signature.onRunEnd?.();
    sdk.gameplayStop();
    sfx[reason === 'death' ? 'death' : 'prestige']();
    track('run_end', { reason, run_seconds: summary.runSeconds, level_reached: summary.level, depth: summary.depth, kills: summary.kills });
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
    this.run.reset();
    this.signature.onRunStart?.();
    this.ads.onRunStart();
    this.recomputeMults();
    this.field.reset();
    if (s.metaUpgrades.startBoost) {
      const firstGen = this.theme.generators[0];
      s.gens[firstGen.id] = 3;
      this.recomputeMults();
      this.earn(Dec.from(firstGen.baseProd).mulNum(60));
    }
    this.paused = false;
    sdk.gameplayStart();
    save.persist(this);
  }

  // Wipe every scrap of progress and begin again. Destructive; the UI confirms
  // before calling this. Settings (like mute) deliberately survive.
  hardReset() {
    const keepMuted = this.state.settings.muted;
    save.clear(this.theme.themeId);
    this.state = initialState(this.theme);
    this.state.settings.muted = keepMuted;
    this.signature.hydrate?.({});
    this.run.reset();
    this.ads.reviveUsedThisRun = false;
    this.recomputeMults();
    this.startRun();
    track('progress_reset');
  }

  revive() {
    this.state.run.active = true;
    this.field.healFull();
    this.paused = false;
    sdk.gameplayStart();
  }

  applyBoost2x() {
    const minutes = this.theme.ads?.boost2xMinutes ?? 5;
    this.state.boostUntil = Date.now() + minutes * 60 * 1000;
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
    this.earn(doubled ? offer.amount.mulNum(2) : offer.amount);
    track('offline_claim', { hours: (offer.seconds / 3600).toFixed(2), doubled });
  }

  // ---------- tick ----------

  tick(dt) {
    if (this.paused || !this.state.run.active) return;
    const s = this.state;
    s.run.seconds += dt;
    this.earn(this.prodPerSec().mulNum(dt));
    this.field.update(dt);
    this.run.tick();
    if (this.field.isDead()) {
      if (this.ui?.onDying) {
        this.paused = true;
        this.ui.onDying();
      } else {
        this.endRun('death');
        this.startRun();
      }
    }
  }
}
