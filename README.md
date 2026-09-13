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

`npm run build` inlines the whole module graph, the CSS, and the theme pack into a single self-contained `dist/index.html` (~87 KB) — the production shape spec Part L calls for, and openable directly from disk with no server:

```sh
npm run build            # dist/index.html, CrazyGames SDK tag included
npm run build:preview    # dist/preview/index.html, SDK tag omitted for non-portal hosting
npm run test:smoke:dist  # build, then run the full browser suite against the bundle
```

Build flags: `--theme themes/x.json` picks the variant, `--out <dir>` the destination, `--no-sdk` drops the portal SDK tag, `--minify` strips comments and blank lines. The build fails if the output crosses the 20MB gate.

Without the CrazyGames SDK (local dev, adblock) every SDK call no-ops safely and rewarded ads are simulated with a ~1.5s delay, so every placement stays testable offline.

**What to look for in a manual pass**, in the order the player hits it: ore ticking up before you touch anything; the first crew affordable inside ~10s; a level-up pick at 60s; the Descend button unlocking once the depth quota fills, and the cavern getting visibly busier after it; health dropping when something reaches you, and the revive offer at zero; then cash out on Prestige and confirm gems buy upgrades that carry into the next run. To re-test the first-run experience, clear the save: `localStorage.clear()` in the console, then reload. To exercise offline earnings without waiting, close the tab for a couple of minutes and reopen — the claim modal with its 2× ad offer appears above one minute away.

## Test it

```sh
npm test           # all three layers
```

Or individually:

```sh
npm run test:unit       # 15 formula assertions: cost curves, closed-form bulk buy,
                        # prestige roots, offline caps, clock-rollback safety
npm run test:sim        # two 30-min bot profiles: run length, descent risk/reward,
                        # prestige payout, save round-trip, offline/rollback
npm run test:smoke      # real browser (Playwright): load time, idle earning, drag
                        # input, first purchase, all three tabs, banner slot,
                        # rewarded offer + its non-ad path, save persistence,
                        # right-click suppression, frame rate
npm run test:smoke:dist # the same 16 checks against the built single-file bundle,
                        # so a broken build fails here and not after deploy
```

`test:smoke` needs Playwright (`npm i`); it skips cleanly rather than failing if Playwright isn't installed. Add `--headed` (`npm run test:smoke:headed`) to watch it drive the game, or set `SMOKE_SCREENSHOT=out.png` to capture a frame.

The sim is the tuning instrument. It plays two bots for 30 simulated minutes —
`greedy` descends the instant it can and never retreats, `careful` banks levels
and health first — and prints run count, average and longest run, deepest band,
and gems earned for each. After changing any economy or field constant, run it
and check two things: careful play still outlasts greedy (or the risk/reward of
descending is broken), and runs still last minutes rather than seconds. Current
measurements are in the Tuning section below.

## Architecture

```
index.html                      shell; <meta name="theme-pack"> selects the variant
themes/deepcore_mine.json       theme pack: names, numbers, palette, ads, field tuning
css/style.css                   shared skin, driven by palette CSS variables
tools/build.mjs                 single-file bundler (module graph + CSS + theme)
src/main.js                     boot: SDK → theme → save → offline claim → UI
src/engine/
  bignum.js                     break_infinity-style Decimal (safe past 1e308)
  economy.js                    cost/bulk-buy/production/prestige/offline formulas
  game.js                       state, tick, economy, prestige, meta tree, powerScale
  field.js                      active run: player, crew, veins, enemies, pickups, FX
  run.js                        roguelite layer: level-up picks, buildcraft pool, walls
  audio.js                      procedural WebAudio SFX (no asset files)
  save.js                       versioned saves + additive migrations
  sdk.js                        CrazyGames SDK v3 wrapper (ads, data, banners; no-op safe)
  ads.js                        rewarded/interstitial placement manager
  analytics.js                  event schema (ByteBrew when present)
  ui.js                         DOM UI + canvas playfield + input
  signature/
    index.js                    signature-mechanic module registry
    depthBands.js               Deepcore's novel system: descend for richness vs. danger
```

## The loop

An active run in a cavern. You drag to move; the miner swings automatically at
whatever is in reach — ore veins for income, cave-dwellers for their drop. Crew
you hire are the figures working the veins on screen, and they are the passive
economy made visible. **Descending** multiplies ore but multiplies the horde
with it, and that trade is the whole tension of a run.

Income has two halves that cross over during a run: hand-mining carries the
first minutes, the crew dwarfs it by the end. Combat power scales with the
economy (`game.powerScale()`), so hiring crew makes your own swing hit harder —
without that link the two halves drift apart and every run dies at the same
depth.

Left alone the miner auto-seeks the nearest vein at half speed: it is an idle
game first, so an untouched tab still earns. Playing actively earns far more.

## Creating a new variant

1. Copy `themes/deepcore_mine.json` → `themes/<themeId>.json`; replace every noun, the palette, generator table, and economy constants. Different theme, different resources, different tree — not find-and-replace.
2. Pick or build ONE signature mechanic in `src/engine/signature/` and register it in `signature/index.js`. **One genuinely new system per title is the minimum** (spec Part F, the originality rule).
3. Drop Makko.ai art into `art/` per the manifest in spec Part J; point the theme pack's icon/bg fields at it.
4. Point `index.html`'s `theme-pack` meta at the new JSON, retitle, and tune until the headless sim and a live playtest clear the Basic Launch gate: ≥10 min avg playtime, ≥80% conversion, <10s load, <20MB build.

## Tuning, measured

From `npm run test:sim` (30 simulated minutes per profile, one bot each):

| Profile | Runs | Avg run | Longest | Deepest | Gems |
|---|---|---|---|---|---|
| greedy (descend on sight) | 7 | 211s | 240s | 6 | 8 |
| careful (bank levels first) | 4 | 401s | 558s | 6 | 25 |

Careful play roughly doubles run length and triples gem yield, which is the
risk/reward the descent mechanic exists to create. Runs land around 3–9 minutes
rather than the spec's 12–18; a session spans several runs and clears the
10-minute playtime gate comfortably, and more run-ends means more run-end
interstitials, but single-run length is still short of the spec target and is
the main open tuning question.

## Non-negotiables baked into the engine

- Reward ONLY on `adFinished`, never on `adError`; revive capped once per run.
- Every rewarded placement has a non-ad path — premium currency, earned by
  reaching new depths, buys the reroll, the wall skip, the boost and the revive.
- Interstitials only at run-end transitions; the SDK's ~3-min cooldown is respected.
- Banner slots on every menu screen, requested on show and cleared on hide.
- Offline earnings are clock-tamper-safe (rollback awards nothing, elapsed clamps to cap).
- Save migrations are additive only — template updates must never wipe player saves.
- No WebGL. Right-click disabled. Fully playable with adblock and offline from the SDK.
