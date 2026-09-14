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

**What to look for in a manual pass**, in the order the player hits it: nothing happening until you steer the miner (standing still is deliberately unproductive); the first crew affordable inside ~10s of actually playing; a level-up pick at 60s; the Descend button unlocking once the depth quota fills, and the cavern getting visibly busier after it; health dropping when something reaches you, and the revive offer at zero; then cash out on Prestige and confirm gems buy upgrades that carry into the next run. To re-test the first-run experience, clear the save: `localStorage.clear()` in the console, then reload. To exercise offline earnings without waiting, close the tab for a couple of minutes and reopen — the claim modal with its 2× ad offer appears above one minute away.

## Test it on a phone

The published preview opens on a phone like any other page — sign in to the
same account and open the artifact link. For a local build, serve the repo and
browse to your machine's LAN address from the phone (`http://<your-ip>:8080`),
both devices on the same network.

Layout is portrait-first and verified across five device profiles by
`npm run test:mobile`; rotating to landscape switches to a two-column layout
(playfield left, menus right) rather than squeezing five stacked bands into
360px of height.

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
npm run test:smoke      # real browser (Playwright): load time, that idling does
                        # NOT pay while steering does, first purchase, tabs, banner,
                        # rewarded offer + its non-ad path, save persistence,
                        # right-click suppression, frame rate
npm run test:smoke:dist # the same 31 checks against the built single-file bundle,
                        # so a broken build fails here and not after deploy
npm run test:mobile     # five device profiles, portrait and landscape: layout
                        # overflow, horizontal scroll, touch-target sizes, real
                        # touch input, and that the run actually simulates
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

## Screens and controls

The game opens on a **title screen** — nothing simulates behind it, so nobody
takes damage while reading. It offers **Continue** to anyone with banked
progress (including a reload mid-run) and **Start mining** to a genuinely new
player, plus a stat row once at least one run has finished.

**Pause** is the `⏸` button in the HUD or the `Escape` key, and backgrounding
the tab pauses too. Pausing freezes the simulation outright and discards the
time spent in the menu, so resuming never dumps a backlog of ticks into the
run. From pause you can resume, end the run and bank its gems, toggle sound, or
reset.

**Reset all progress** is reachable from both screens, always asks first, and
defaults to backing out. It erases gems, permanent upgrades, premium currency
and depth records, wipes the stored save, and returns to the title. Sound
preference deliberately survives.

Movement is drag-anywhere on the field, or WASD / arrow keys. Lifting your
finger keeps the destination rather than freezing him mid-stride, so tapping a
spot works as well as holding — which matters a lot on a phone. Swinging is
automatic; position is the input that matters.

## Reading the screen

Everything the player must understand is readable from the field alone:

- **Gold crystal clusters in a rock socket** are ore veins; the ring around one
  drains as it depletes.
- **Blue figures** are your hired crew, mining on their own. Blue never means
  ore and never means danger.
- **Red spiky shapes** are cave-dwellers. Contact costs health.
- **A pulsing red `!`** telegraphs a spawn about a second before it arrives, so
  nothing appears without warning.
- **Floating `+N`** prints every gain where it happened, batched so it stays
  readable instead of flooding.
- **One-time captions** name each thing the first time it appears.
- The **coach strip** teaches one lesson at a time and advances only once the
  player has actually done it.

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

**The opening requires you.** The crew are the idle half — their ore accrues
every tick wherever the miner stands — but steering the miner is the player's
job, and veins deliberately spawn outside his swing radius so reaching one
means walking. Ninety seconds of standing still earns 0–3 ore against a
10-ore first crew, so the game cannot bootstrap itself; playing earns ~290 over
the same span. Automating it is a late purchase (*Prospector's Instinct*, 15
gems), not the starting state.

Ore you swing at is credited straight to you — chasing your own output around
the floor is fiddly, not engaging. Loot from kills is the opposite: it drops
where the thing died, flung away from you, and has to be collected before it
expires after 11 seconds.

## Creating a new variant

1. Copy `themes/deepcore_mine.json` → `themes/<themeId>.json`; replace every noun, the palette, generator table, and economy constants. Different theme, different resources, different tree — not find-and-replace.
2. Pick or build ONE signature mechanic in `src/engine/signature/` and register it in `signature/index.js`. **One genuinely new system per title is the minimum** (spec Part F, the originality rule).
3. Drop Makko.ai art into `art/` per the manifest in spec Part J; point the theme pack's icon/bg fields at it.
4. Point `index.html`'s `theme-pack` meta at the new JSON, retitle, and tune until the headless sim and a live playtest clear the Basic Launch gate: ≥10 min avg playtime, ≥80% conversion, <10s load, <20MB build.

## Tuning, measured

From `npm run test:sim` (30 simulated minutes per profile, one bot each):

| Profile | Runs | Avg run | Longest | Deepest | Gems |
|---|---|---|---|---|---|
| greedy (descend on sight) | 17 | 102s | 261s | 7 | 7 |
| careful (bank levels first) | 5 | 339s | 439s | 7 | 18 |

Careful play triples run length and nearly doubles gem yield, which is the
risk/reward the descent mechanic exists to create — the suite fails if that
ordering ever inverts. Runs land around 2–6 minutes rather than the spec's
12–18; a session spans several runs and clears the 10-minute playtime gate
comfortably, and more run-ends means more run-end interstitials, but single-run
length is still short of the spec target and is the main open tuning question.

**First-minute pacing** (a player who hires crew when prompted but plays no
better than that): first threat on screen at ~21s, first descent at ~20s. Both
were minutes away before the legibility pass, which is what made the game
unreadable — the player never reached the mechanic the game is built around.

## Non-negotiables baked into the engine

- Reward ONLY on `adFinished`, never on `adError`; revive capped once per run.
- Every rewarded placement has a non-ad path — premium currency, earned by
  reaching new depths, buys the reroll, the wall skip, the boost and the revive.
- Interstitials only at run-end transitions; the SDK's ~3-min cooldown is respected.
- Banner slots on every menu screen, requested on show and cleared on hide.
- Offline earnings are clock-tamper-safe (rollback awards nothing, elapsed clamps to cap).
- Save migrations are additive only — template updates must never wipe player saves.
- No WebGL. Right-click disabled. Fully playable with adblock and offline from the SDK.
