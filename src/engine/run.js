// Roguelite run layer: level-up picks every N seconds, the upgrade pool, and
// wall detection ("next upgrade 30–90s away" pacing rule).
// In-run upgrades are LOST on run end — that's the roguelite reset; permanent
// power lives in the prestige layer (game.js).
import { track } from './analytics.js';

// Pool templates are theme-agnostic; names are pulled from the theme's
// generator/resource nouns so nothing reads as generic find-and-replace.
export function buildUpgradePool(theme) {
  const pool = [];
  const res = theme.resources.primary.name;
  for (const g of theme.generators) {
    pool.push({ id: `boost_${g.id}_2`, name: `Overclocked ${g.name}`, desc: `${g.name} production ×2`, effect: { type: 'prodGen', gen: g.id, v: 2 } });
    pool.push({ id: `boost_${g.id}_3`, name: `Master ${g.name}`, desc: `${g.name} production ×3`, effect: { type: 'prodGen', gen: g.id, v: 3 }, rare: true });
  }
  pool.push(
    { id: 'all_15', name: 'Rich Vein', desc: `All ${res} production ×1.5`, effect: { type: 'prodAll', v: 1.5 } },
    { id: 'all_20', name: 'Motherlode', desc: `All ${res} production ×2`, effect: { type: 'prodAll', v: 2 }, rare: true },
    { id: 'tap_3', name: 'Strong Arm', desc: 'Tap power ×3', effect: { type: 'tapPower', v: 3 } },
    { id: 'tap_5', name: 'Titan Grip', desc: 'Tap power ×5', effect: { type: 'tapPower', v: 5 }, rare: true },
    { id: 'danger_08', name: 'Careful Footing', desc: 'Hazard drain −20%', effect: { type: 'dangerReduce', v: 0.8 } },
    { id: 'danger_06', name: 'Iron Bracing', desc: 'Hazard drain −40%', effect: { type: 'dangerReduce', v: 0.6 }, rare: true },
    { id: 'regen_03', name: 'Patch Crew', desc: '+0.3/s stability regen', effect: { type: 'stabilityRegen', v: 0.3 } },
    { id: 'regen_06', name: 'Repair Golems', desc: '+0.6/s stability regen', effect: { type: 'stabilityRegen', v: 0.6 }, rare: true },
    { id: 'cost_09', name: 'Bulk Contracts', desc: 'Generator costs −10%', effect: { type: 'costReduce', v: 0.9 } },
    { id: 'cost_08', name: 'Guild Discount', desc: 'Generator costs −20%', effect: { type: 'costReduce', v: 0.8 }, rare: true },
  );
  return pool.slice(0, Math.max(theme.run?.upgradePoolSize ?? 24, 12));
}

export class RunManager {
  constructor(game) {
    this.game = game;
    this.pool = buildUpgradePool(game.theme);
    this.pendingChoices = null; // [upgrade, upgrade, upgrade] while the pick overlay is open
    this.nextLevelAt = game.theme.run?.levelUpEverySeconds ?? 75;
    this.wallReportedAt = -Infinity;
  }

  tick() {
    const s = this.game.state;
    if (!s.run.active || this.pendingChoices) return;
    if (s.run.seconds >= this.nextLevelAt) {
      this.openLevelUp();
    }
  }

  rollChoices() {
    const candidates = this.pool.filter(u => !u.rare || Math.random() < 0.35);
    const picks = [];
    const bag = [...candidates];
    while (picks.length < 3 && bag.length) {
      const i = Math.floor(Math.random() * bag.length);
      picks.push(bag.splice(i, 1)[0]);
    }
    return picks;
  }

  openLevelUp() {
    this.pendingChoices = this.rollChoices();
    this.game.ui?.showLevelUp(this.pendingChoices, /* wasReroll */ false);
  }

  reroll() {
    this.pendingChoices = this.rollChoices();
    this.game.ui?.showLevelUp(this.pendingChoices, true);
  }

  choose(upgrade, wasReroll) {
    if (!this.pendingChoices) return;
    this.pendingChoices = null;
    const s = this.game.state;
    s.run.level += 1;
    s.runUpgrades.push(upgrade.id);
    this.nextLevelAt = s.run.seconds + (this.game.theme.run?.levelUpEverySeconds ?? 75);
    track('level_up_choice', { upgrade_id: upgrade.id, was_reroll: wasReroll });
    this.game.recomputeMults();
  }

  upgradeById(id) { return this.pool.find(u => u.id === id); }

  // Wall detection: seconds until the cheapest next generator purchase is
  // affordable at current income. > wallSeconds means the player has hit the
  // exponential wall — surface the skip-wall rewarded offer and (via analytics)
  // let tuning see where walls actually land.
  secondsToNextPurchase() {
    return this.game.cheapestPurchaseEta();
  }

  checkWall(wallSeconds = 90) {
    const s = this.game.state;
    const eta = this.secondsToNextPurchase();
    if (eta > wallSeconds && s.run.seconds - this.wallReportedAt > 120) {
      this.wallReportedAt = s.run.seconds;
      track('wall_hit', { run_time: Math.round(s.run.seconds), eta_seconds: Math.round(eta) });
      return true;
    }
    return false;
  }
}
