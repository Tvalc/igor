// Signature-mechanic module registry. Each variant plugs exactly ONE module in
// via theme.signatureMechanic — this is the "one genuinely novel system per
// title" that keeps every variant on the original-game side of the reskin line.
//
// Module interface (all hooks optional except id/init):
//   create(game, config) -> {
//     id,
//     tick(dt),                    // called each logic tick while the run is live
//     productionMult(),            // Dec-safe number multiplier folded into prodPerSec
//     render(ctx, w, h, t),        // canvas-2D playfield draw
//     onRunStart(), onRunEnd(),
//     onRevive(),                  // rewarded revive accepted
//     isDead(),                    // true -> engine ends the run as a death
//     panel(),                     // { title, rows:[{label,value}], actions:[{id,label,enabled,onClick}] }
//     serialize(), hydrate(data),
//   }
import { createDepthBands } from './depthBands.js';

const registry = {
  depthBands: createDepthBands,
};

export function registerSignature(name, factory) {
  registry[name] = factory;
}

export function createSignature(game) {
  const name = game.theme.signatureMechanic;
  const factory = registry[name];
  if (!factory) throw new Error(`Unknown signature mechanic: ${name}`);
  return factory(game, game.theme.signatureConfig?.[name] ?? {});
}
