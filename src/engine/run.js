// Roguelite run layer: the level-up pick every N seconds, the upgrade pool,
// and wall detection. In-run upgrades are LOST on run end — that is the
// roguelite reset; permanent power lives in the prestige tree (game.js).
import { track } from './analytics.js';

// The pool spans both halves of the game so a build is a real choice: combat
// picks change how the run plays, economy picks change what it banks. Generator
// names come from the theme so nothing reads as a find-and-replace reskin.
export function buildUpgradePool(theme) {
  const res = theme.resources.primary.name;
  const pool = [
    { id: 'dmg_15', name: 'Honed Edge', desc: 'Mining damage ×1.5', effect: { type: 'damage', v: 1.5 } },
    { id: 'dmg_22', name: 'Breaker Maul', desc: 'Mining damage ×2.2', rare: true, effect: { type: 'damage', v: 2.2 } },
    { id: 'rate_13', name: 'Quick Swing', desc: 'Swing speed ×1.3', effect: { type: 'attackRate', v: 1.3 } },
    { id: 'rate_16', name: 'Blur of Steel', desc: 'Swing speed ×1.6', rare: true, effect: { type: 'attackRate', v: 1.6 } },
    { id: 'range_13', name: 'Long Haft', desc: 'Reach +30%', effect: { type: 'attackRange', v: 1.3 } },
    { id: 'speed_12', name: 'Sure Boots', desc: 'Move speed +20%', effect: { type: 'moveSpeed', v: 1.2 } },
    { id: 'speed_14', name: 'Windstep', desc: 'Move speed +40%', rare: true, effect: { type: 'moveSpeed', v: 1.4 } },
    { id: 'hp_14', name: 'Iron Constitution', desc: 'Max health +40%', effect: { type: 'maxHp', v: 1.4 } },
    { id: 'regen_1', name: 'Field Poultice', desc: '+1 health per second', effect: { type: 'hpRegen', v: 1 } },
    { id: 'regen_25', name: 'Runic Mending', desc: '+2.5 health per second', rare: true, effect: { type: 'hpRegen', v: 2.5 } },
    { id: 'armor_08', name: 'Plated Hide', desc: 'Damage taken −20%', effect: { type: 'damageTaken', v: 0.8 } },
    { id: 'armor_06', name: 'Dwarfsteel Plate', desc: 'Damage taken −40%', rare: true, effect: { type: 'damageTaken', v: 0.6 } },
    { id: 'magnet_15', name: 'Lodestone Charm', desc: 'Ore pickup radius +50%', effect: { type: 'magnet', v: 1.5 } },
    { id: 'active_18', name: 'Prospector’s Eye', desc: `Hand-mined ${res} ×1.8`, effect: { type: 'activeYield', v: 1.8 } },
    { id: 'active_26', name: 'Motherlode Sense', desc: `Hand-mined ${res} ×2.6`, rare: true, effect: { type: 'activeYield', v: 2.6 } },
    { id: 'all_15', name: 'Rich Vein', desc: 'Crew output ×1.5', effect: { type: 'prodAll', v: 1.5 } },
    { id: 'all_20', name: 'Motherlode', desc: 'Crew output ×2', rare: true, effect: { type: 'prodAll', v: 2 } },
    { id: 'cost_09', name: 'Bulk Contracts', desc: 'Crew costs −10%', effect: { type: 'costReduce', v: 0.9 } },
    { id: 'cost_08', name: 'Guild Discount', desc: 'Crew costs −20%', rare: true, effect: { type: 'costReduce', v: 0.8 } },
  ];
  for (const g of theme.generators) {
    pool.push({ id: `boost_${g.id}_2`, name: `Overclocked ${g.name}`, desc: `${g.name} output ×2`, effect: { type: 'prodGen', gen: g.id, v: 2 } });
  }
  const cap = theme.run?.upgradePoolSize ?? 24;
  return pool.slice(0, Math.max(cap, 12));
}

export class RunManager {
  constructor(game) {
    this.game = game;
    this.pool = buildUpgradePool(game.theme);
    this.interval = game.theme.run?.levelUpEverySeconds ?? 75;
    this.pendingChoices = null;
    this.nextLevelAt = this.interval;
    this.wallReportedAt = -Infinity;
  }

  reset() {
    this.pendingChoices = null;
    this.nextLevelAt = this.interval;
    this.wallReportedAt = -Infinity;
  }

  tick() {
    const s = this.game.state;
    if (!s.run.active || this.pendingChoices) return;
    if (s.run.seconds >= this.nextLevelAt) this.openLevelUp();
  }

  rollChoices() {
    const taken = new Set(this.game.state.runUpgrades);
    // Non-repeating picks keep each level-up a real decision; once the pool is
    // exhausted, repeats are allowed rather than showing an empty overlay.
    let bag = this.pool.filter(u => !taken.has(u.id) && (!u.rare || Math.random() < 0.4));
    if (bag.length < 3) bag = this.pool.filter(u => !taken.has(u.id));
    if (bag.length < 3) bag = [...this.pool];
    const picks = [];
    while (picks.length < 3 && bag.length) {
      picks.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
    }
    return picks;
  }

  openLevelUp() {
    this.pendingChoices = this.rollChoices();
    this.game.ui?.showLevelUp(this.pendingChoices, false);
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
    this.nextLevelAt = s.run.seconds + this.interval;
    track('level_up_choice', { upgrade_id: upgrade.id, was_reroll: wasReroll });
    this.game.recomputeMults();
  }

  upgradeById(id) { return this.pool.find(u => u.id === id); }

  // Wall detection (spec Part C): the pacing target is that the next purchase
  // is always 30–90s away. The theme's firstWallSeconds sets where the run's
  // first hard wall is meant to land, and the probe threshold derives from it
  // rather than being hardcoded.
  wallThreshold() {
    const first = this.game.theme.economy?.firstWallSeconds;
    return Math.max(45, Math.min(120, first ? first / 6 : 90));
  }

  checkWall() {
    const s = this.game.state;
    const eta = this.game.cheapestPurchaseEta();
    if (eta > this.wallThreshold() && s.run.seconds - this.wallReportedAt > 120) {
      this.wallReportedAt = s.run.seconds;
      track('wall_hit', { run_time: Math.round(s.run.seconds), eta_seconds: Math.round(Math.min(eta, 99999)) });
      return true;
    }
    return false;
  }
}
