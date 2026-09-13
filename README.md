# Idle Forge Engine

A repeatable **idle-roguelite template** for CrazyGames: one shared engine, many theme-differentiated variants. First variant: **Deepcore: Idle Dwarven Mine** (depth-band descent signature mechanic).

Full design & production doctrine: [`docs/IDLE_FORGE_ENGINE_SPEC.md`](docs/IDLE_FORGE_ENGINE_SPEC.md).

## Play it

The source tree runs unbuilt — plain ES modules, DOM/CSS UI + canvas-2D playfield (no WebGL, per spec Part L). It must be served over HTTP rather than opened as a file, since ES modules and the theme-pack fetch are both origin-scoped:

```sh
npm start          # or: python3 -m http.server 8080
# open http://localhost:8080
```

That serves from whichever machine runs the command — if you are driving a cloud/remote session, its localhost is not yours. To play on your own machine, clone first:

```sh
git clone https://github.com/Tvalc/igor.git && cd igor
git checkout claude/idle-forge-engine-spec-it1gip
npm start
```

## Build it

`npm run build` inlines the whole module graph, the CSS, and the theme pack into a single self-contained `dist/index.html` (~60 KB) — the production shape spec Part L calls for, and openable directly from disk with no server:

```sh
npm run build            # dist/index.html, CrazyGames SDK tag included
npm run build:preview    # dist/preview/index.html, SDK tag omitted for non-portal hosting
npm run test:smoke:dist  # build, then run the full browser suite against the bundle
```

Build flags: `--theme themes/x.json` picks the variant, `--out <dir>` the destination, `--no-sdk` drops the portal SDK tag, `--minify` strips comments and blank lines. The build fails if the output crosses the 20MB gate.

Without the CrazyGames SDK (local dev, adblock) every SDK call no-ops safely and rewarded ads are simulated with a ~1.5s delay, so every placement stays testable offline.

**What to look for in a manual pass**, in the order the player hits it: the tutorial prompt and first tap payout; the first generator affordable within ~15s; a level-up pick around 75s; the descend button unlocking once the band quota fills; stability draining once you're below the surface (shore up, or take the once-per-run revive); then cash out on the Prestige tab and confirm gems buy permanent upgrades that carry into the next run. To re-test the first-run experience, clear the save: `localStorage.clear()` in the console, then reload. To exercise offline earnings without waiting, close the tab for a couple of minutes and reopen — the claim modal with its 2× ad offer appears above one minute away.

## Test it

```sh
npm test           # all three layers
```

Or individually:

```sh
npm run test:unit       # 15 formula assertions: cost curves, closed-form bulk buy,
                        # prestige roots, offline caps, clock-rollback safety
npm run test:sim        # 20-minute headless bot run: loop invariants, death ->
                        # prestige conversion, save round-trip, offline/rollback
npm run test:smoke      # real browser (Playwright): load time, tutorial, tapping,
                        # purchase, tabs, rewarded-ad reward, idle accrual, save
                        # persistence across reload, right-click suppression
npm run test:smoke:dist # the same 11 checks against the built single-file bundle,
                        # so a broken build fails here and not after deploy
```

`test:smoke` needs Playwright (`npm i`); it skips cleanly rather than failing if Playwright isn't installed. Add `--headed` (`npm run test:smoke:headed`) to watch it drive the game, or set `SMOKE_SCREENSHOT=out.png` to capture a frame.

The sim is the tuning instrument: it prints runs ended, level-up picks, max depth band, and time-to-first-prestige for a 20-minute session. After changing any economy constant in a theme pack, run it and check those numbers still describe a 12–18 minute run — that is the Basic Launch playtime gate in miniature.

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
