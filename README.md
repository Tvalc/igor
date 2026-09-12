# Idle Forge Engine

A repeatable **idle-roguelite template** for CrazyGames: one shared engine, many theme-differentiated variants. First variant: **Deepcore: Idle Dwarven Mine** (depth-band descent signature mechanic).

Full design & production doctrine: [`docs/IDLE_FORGE_ENGINE_SPEC.md`](docs/IDLE_FORGE_ENGINE_SPEC.md).

## Run it

No build step — plain ES modules, DOM/CSS UI + canvas-2D playfield (no WebGL, per spec Part L):

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

Without the CrazyGames SDK (local dev, adblock) every SDK call no-ops safely and rewarded ads are simulated so placements stay testable.

## Test it

```sh
node test/economy.test.mjs   # formula unit tests (cost/bulk/prestige/offline math)
node test/sim.test.mjs       # 20-minute headless full-loop simulation + save round-trip
```

## Architecture

```
index.html                      shell; <meta name="theme-pack"> selects the variant
themes/deepcore_mine.json       theme pack: all names, numbers, palette, ad toggles
css/style.css                   shared skin, driven by palette CSS variables
src/main.js                     boot: SDK → theme → save → offline claim → UI
src/engine/
  bignum.js                     break_infinity-style Decimal (safe past 1e308)
  economy.js                    cost/bulk-buy/production/prestige/offline formulas
  game.js                       state, tick, purchases, prestige, meta upgrades
  run.js                        roguelite layer: level-up picks, upgrade pool, wall detection
  save.js                       versioned saves + additive migrations
  sdk.js                        CrazyGames SDK v3 wrapper (graceful no-op fallback)
  ads.js                        rewarded/interstitial placement manager
  analytics.js                  event schema (ByteBrew when present)
  ui.js                         DOM UI + canvas playfield renderer
  signature/
    index.js                    signature-mechanic module registry
    depthBands.js               Deepcore's novel system: descend for richness vs. danger
```

## Creating a new variant

1. Copy `themes/deepcore_mine.json` → `themes/<themeId>.json`; replace every noun, the palette, generator table, and economy constants. Different theme, different resources, different tree — not find-and-replace.
2. Pick or build ONE signature mechanic in `src/engine/signature/` and register it in `signature/index.js`. **One genuinely new system per title is the minimum** (spec Part F, the originality rule).
3. Drop Makko.ai art into `art/` per the manifest in spec Part J; point the theme pack's icon/bg fields at it.
4. Point `index.html`'s `theme-pack` meta at the new JSON, retitle, and tune until the headless sim and a live playtest clear the Basic Launch gate: ≥10 min avg playtime, ≥80% conversion, <10s load, <20MB build.

## Non-negotiables baked into the engine

- Reward ONLY on `adFinished`, never on `adError`; revive capped once per run; every placement has a non-ad path.
- Interstitials only at run-end transitions; the SDK's ~3-min cooldown is respected.
- Offline earnings are clock-tamper-safe (rollback awards nothing, elapsed clamps to cap).
- Save migrations are additive only — template updates must never wipe player saves.
- No WebGL. Right-click disabled. Fully playable with adblock and offline from the SDK.
