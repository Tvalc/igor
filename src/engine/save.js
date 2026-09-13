// Save system with versioned, additive migrations (spec Part L).
// Rules: migrations only ADD fields with defaults — never rename or renumber
// existing generator/upgrade ids — so template updates never wipe saves.
import { Dec } from './bignum.js';
import * as sdk from './sdk.js';

export const SAVE_VERSION = 1;

// applyMigration[v] upgrades a save from version v to v+1.
const applyMigration = {
  // Example shape for the future:
  // 1: (s) => { s.meta.newField = defaultValue; s.v = 2; },
};

export function saveKey(themeId) { return `idleforge_${themeId}_v1`; }

export function serialize(game) {
  const s = game.state;
  return JSON.stringify({
    v: SAVE_VERSION,
    themeId: game.theme.themeId,
    t: Date.now(),
    res: { primary: s.primary.serialize(), premium: s.premium },
    gens: { ...s.gens },
    runUpgrades: [...s.runUpgrades],
    metaUpgrades: { ...s.metaUpgrades },
    prestige: { held: s.prestige.held, lifetime: s.prestige.lifetime.serialize() },
    run: { seconds: s.run.seconds, level: s.run.level, active: s.run.active },
    signature: game.signature?.serialize() ?? null,
    field: game.field?.serialize() ?? null,
    meta: { offlineCapHours: s.meta.offlineCapHours, unlocks: [...s.meta.unlocks] },
    stats: { ...s.stats },
    settings: { ...s.settings },
  });
}

export function persist(game) {
  sdk.dataSet(saveKey(game.theme.themeId), serialize(game));
}

export function load(themeId) {
  const key = saveKey(themeId);
  sdk.migrateLegacyKey(key);
  const raw = sdk.dataGet(key);
  if (!raw) return null;
  let save;
  try { save = JSON.parse(raw); } catch (e) { return null; }
  if (!save || typeof save.v !== 'number') return null;
  while (save.v < SAVE_VERSION) {
    const step = applyMigration[save.v];
    if (!step) break;
    step(save);
  }
  return save;
}

// Restore a parsed save into game state. Tolerates missing fields (defaults win).
export function hydrate(game, save) {
  const s = game.state;
  if (save.res?.primary) s.primary = Dec.parse(save.res.primary);
  if (typeof save.res?.premium === 'number') s.premium = save.res.premium;
  if (save.gens) for (const id of Object.keys(s.gens)) {
    if (typeof save.gens[id] === 'number') s.gens[id] = save.gens[id];
  }
  if (Array.isArray(save.runUpgrades)) s.runUpgrades = save.runUpgrades;
  if (save.metaUpgrades) s.metaUpgrades = { ...s.metaUpgrades, ...save.metaUpgrades };
  if (save.prestige) {
    s.prestige.held = save.prestige.held ?? 0;
    if (save.prestige.lifetime) s.prestige.lifetime = Dec.parse(save.prestige.lifetime);
  }
  if (save.run) {
    s.run.seconds = save.run.seconds ?? 0;
    s.run.level = save.run.level ?? 0;
    s.run.active = save.run.active ?? true;
  }
  if (save.meta) {
    if (typeof save.meta.offlineCapHours === 'number') s.meta.offlineCapHours = save.meta.offlineCapHours;
    if (Array.isArray(save.meta.unlocks)) s.meta.unlocks = save.meta.unlocks;
  }
  if (save.stats) s.stats = { ...s.stats, ...save.stats };
  if (save.settings) s.settings = { ...s.settings, ...save.settings };
  if (save.signature && game.signature?.hydrate) game.signature.hydrate(save.signature);
  if (save.field && game.field?.hydrate) game.field.hydrate(save.field);
  return save.t ?? null;
}
