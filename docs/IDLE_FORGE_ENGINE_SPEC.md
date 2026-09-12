# IDLE FORGE ENGINE — Design & Production Bible

*A repeatable idle-roguelite template for CrazyGames: ship 12–15 theme-differentiated variants/year (scaling to 20–25 in year two) toward a $250k/year ad-revenue catalog.*

This is the canonical spec the engine in this repository implements. Sections marked **[implemented]** map to code; the rest is production/business doctrine that governs how variants get made, tuned, launched, and killed.

## TL;DR

- **Build ONE tuned idle-roguelite engine and ship it as 12–15 theme-differentiated variants/year.** The economics work only at portfolio scale: a genuinely novel solo incremental (Liquid Swarm) earns ~$12,900/year, so hitting $250k requires ~15–20 live titles averaging $14–17k plus one or two breakout/Originals titles. The single most important design objective per title is clearing the CrazyGames Basic Launch gate (≥10 min avg playtime, ≥80% conversion, <10s load, <20MB) — monetization does not turn on until it clears.
- **The winning shape is a 12–18 minute "active-idle" run with meta-prestige between runs.** This maximizes session length (the ranking driver) and rewarded-ad surface: offline-earnings doubling, 2× production boosts, revive/continue, and reroll placements push toward the genre's 5.5 impressions/play — with the offline-earnings doubler the single highest-converting ad in the genre.
- **Originality is a real gate but a beatable one:** at least one genuinely novel signature mechanic per title (not just a reskin) plus bespoke theme/resources/art. CrazyGames actively rejects "clones or asset flips," and reskins of your own prior games risk delisting — but zero-cost art (Makko.ai) plus one swappable "signature system" per variant keeps every title on the legitimate-studio side of that line.

## Part A — Portfolio math & path to $250k

**Anchor:** Liquid Swarm ≈ €31/day ≈ $12,900/yr on the standard (non-Originals) share, with weak art, low CTR, and rewarded ads bolted on post-launch (~22% opt-in vs. ~70% achievable). That is the floor for a competent, ad-native, well-themed title — not the ceiling.

**Model (extrapolation, flagged as such):** average mature title $15k/yr; ~3-month ramp; ~20% duds (<$5k); ~10% hits ($30–60k); one Originals title in year 2–3 at $60–100k on the higher share.

| | Titles shipped | Live catalog | Modeled annual run-rate exit |
|------|------|------|------|
| Year 1 | 12–15 | 12–15 | ~$120–160k |
| Year 2 | 20–25 | ~32–40 | ~$280–360k |
| Year 3 | 20–25 | ~50–60 | ~$400k+ |

$250k run-rate is reachable at the end of Year 2, driven by (a) idle titles decaying slowly so the catalog compounds, (b) a power-law where 3–5 titles carry ~50% of revenue, (c) at least one Originals deal (higher share, homepage placement, staff optimization help). **One Originals hit is worth more than three median titles** — aim one genuinely novel title per quarter at that bar.

**Kill/iterate discipline:** a title that misses the Basic Launch gate earns $0. Give each a fair tuning pass, then let the dashboard decide. Don't polish duds; ship the next theme.

## Part B — Core loop **[implemented]**

**Genre: "active-idle roguelite," not pure idle.** An active run of 12–18 minutes with constant small decisions (upgrade picks, spending, descent timing), building to a "the build plays itself" power fantasy, then a between-run meta-prestige layer converts run performance into permanent power. This maximizes average playtime AND creates natural ad break points (run end, wall, revive) pure background idle lacks.

**Three nested loops:**

1. **Second-to-second (first 60s):** tap/act to earn the primary resource; first upgrade affordable within ~10–15s; a 2-step, ≤15s tutorial, then straight into the game.
2. **Minute-to-minute (the 15-min session):** buy generators on the exponential cost curve; roguelite upgrade pick every 60–90s; "the next upgrade is always 30–90 seconds away."
3. **Run-to-run (day-2 return):** run ends (voluntary prestige or death) → root-formula meta-currency → permanent upgrades → offline earnings on return. Offline earnings is the day-2 retention engine AND the highest-converting rewarded hook.

## Part C — Economy formulas **[implemented in `src/engine/economy.js`]**

All currency math is BigNumber-safe (`src/engine/bignum.js`) past ~1e15.

- **Generator cost:** `cost(g, owned) = baseCost[g] × costGrowth[g]^owned` — growth 1.07–1.11 for fast-feeling early generators, up to 1.15 (Cookie Clicker standard) for staples.
- **Bulk buy (closed form, no loops):**
  `cost(n) = base × (growth^owned × (growth^n − 1)) / (growth − 1)`
  `maxAffordable = floor(log(currency×(growth−1)/(base×growth^owned) + 1) / log(growth))`
- **Production:** `baseProd × owned × multipliers`, multipliers stacking multiplicatively from milestone bonuses (×2 at 25/50/100/200 owned), purchased upgrades, prestige multiplier, temporary ad boosts.
- **Prestige:** `prestigeGain = floor((lifetimeEarnings / DIVISOR)^EXP) − alreadyHeld` — EXP 0.5 (sqrt) for frequent run-based resets, 1/3 (cube root, Cookie Clicker) reserved for the deep meta layer. Each point grants a permanent +X% production.
- **Pacing rule:** the cheapest meaningful upgrade should cost ≤ income/sec × 60 at any point; the widening affordability gap IS the wall that triggers prestige. First hard wall at ~8–10 min so the average session clears the 10-minute gate.
- **Offline:** `min(cap, elapsed) × prodPerHour × 0.5`, cap 2–4h base, extendable by meta-upgrade. Anti-cheat: clock rollback (now < lastSeen) awards nothing; elapsed clamps to cap; never trust the client clock for anything monetized.

## Part D — Run / meta structure **[implemented]**

Run length 12–18 min active, designed for ~15 so the average (dragged down by quitters) clears 10. Three tiers:

1. **In-run roguelite upgrades** — pick 1 of 3 every 60–90s, rerollable via rewarded ad, lost on run end.
2. **Prestige currency** — sqrt formula on run performance; permanent stat tree and unlocks. "A lost run still pays."
3. **Deep meta (ascension)** — a rarer cube-root reset for players 10+ hours in (future engine layer).

## Part E — Ad monetization **[implemented in `src/engine/ads.js`]**

Rewarded placements, ranked by expected value:

1. **Double offline earnings** — on return, claim screen with "Claim X" / "Watch to Claim 2X." Highest-converting placement in the genre.
2. **Revive/continue** — on death, once per run, 5-second countdown.
3. **2× production for 5 min** — always-visible HUD button.
4. **Reroll upgrade choice** — on the level-up overlay.
5. **Skip the wall** — when time-to-next-upgrade exceeds ~90s, offer instant currency.
6. **Daily free premium currency** — shop, once per session.

**Midgame interstitials:** run-end transitions only, never during active play; the SDK's ~3-min `adCooldown` gates frequency — request at every run end and let it gate. **Banners** on menu-heavy screens. Design for 5.5 impressions/play floor, 7–9 target. Always provide a non-ad alternative; **never reward on `adError`**.

## Part F — Template / reskin architecture **[implemented]**

| Layer | Shared engine | Bespoke per variant |
|---|---|---|
| Core loop / tick system | ✅ | |
| Economy math | ✅ | tuning constants in theme pack |
| Save + migration | ✅ | |
| CrazyGames SDK (ads/data/analytics) | ✅ | |
| Offline-earnings engine | ✅ | |
| UI framework | ✅ | palette/CSS variables |
| **Theme pack (JSON)** | | ✅ |
| **Signature mechanic** | library of pluggable modules | ✅ pick/vary 1 per title |
| Art (Makko.ai) | | ✅ |
| Audio | | ✅ |

**The originality rule (all four axes must differ from every prior title):**

1. Theme + fantasy
2. Named resources + upgrade tree (different nouns AND tree shape)
3. Bespoke art + thumbnail + name (not "easily confused" with anything)
4. **At least ONE genuinely different mechanical system** (the signature module)

Rule of thumb: *"If a player who played my last game would recognize this as 'the same game with a new coat of paint,' it's not shippable."* Enforcement is real but inconsistent — stay well clear of the line rather than testing it.

## Part G — What makes an idle game feel distinct

Ranked by perceived-distinctiveness-per-dollar: (1) art + theme + fantasy; (2) the signature mechanic; (3) named resources + upgrade tree — resources must feel thematically integral, not "could have been called whatever"; (4) UI layout / signature visual moment; (5) audio; (6) numeric pacing (mostly invisible — keep shared).

**Minimum viable differentiation = art + theme + resources + tree + one signature mechanic.**

## Part H — Year-one slate

Proven-theme demand: tycoon/business, mining, farming, fantasy/dungeon, space, survival, creature-collection. Saturated: generic cookie/capybara/brainrot clickers, basic mining tycoons. The slate pairs proven themes with distinct signature systems:

1. **Deep-core dwarven mine** — depth-band descent *(this repo's first variant)*
2. Space station/colony — grid module-routing
3. Zombie survival rebuild — day/night wave defense
4. Fantasy dungeon delver — party auto-battler
5. Cozy farm/ranch — crop-rotation + merge
6. Pirate empire — fleet/territory expansion
7. Factory/automation — conveyor shape-processing
8. Creature/pet collection — gacha + fusion
9. Crime/mafia empire — heist push-your-luck
10. Coffee/food franchise — chain-expansion map
11. Wizard's tower — spell-synthesis crafting
12. Bio/evolution — era progression
13. Kaiju city-destroyer — swarm/absorb
14. Ant colony — unit-role allocation
15. Medieval kingdom — castle-siege management

Ship Mine, Space, Dungeon first to validate the engine.

## Part I — Theme-selection process

Before committing a build: (1) scan CrazyGames `/t/idle`, `/t/incremental`, `/c/clicker` for saturation; (2) check IdleDB rankings; (3) Google Trends on the theme; (4) r/incremental_games sentiment on the mechanic; (5) novelty check — can this theme pair with a mechanic no top-10 CrazyGames idle game has?; (6) thumbnail test — would a Makko.ai capsule out-CTR the category leaders?

## Part J — Per-game art manifest (Makko.ai)

All 2D, WebP, packed, total build <20MB: thumbnail + 2–3 A/B variants; logo; 1–3 parallax backgrounds per zone (2–5 zones); 8–12 generator icons; 30–50 upgrade icons; 3–5 currency icons; 3–6 character sprites (2–4 frame animations); 5–10 enemy sprites; UI 9-slice kit; FX sprites (coin burst, level-up flash, prestige explosion); signature-mechanic art; video-preview storyboard. Packaged as `art/` referenced by the theme pack.

## Part K — JSON theme-pack schema **[implemented: `themes/deepcore_mine.json`]**

See the live theme pack for the full worked example. Required fields: `themeId`, `displayName`, `signatureMechanic`, `palette`, `resources` (primary/prestige/premium), `generators[]` (id/name/baseCost/costGrowth/baseProd/icon), `milestoneBonuses`, `economy` (prestigeDivisor/prestigeExponent/prestigePerLevelBonusPct/offlineRate/offlineCapHoursBase/firstWallSeconds), `run` (targetRunSeconds/levelUpEverySeconds/upgradePoolSize), `signatureConfig`, `ads` toggles, `audio`, `zones[]`.

## Part L — Technical spec **[implemented]**

- **Rendering:** DOM/CSS for all UI (menus, trees, shops, tickers — fast to build, fast on old devices, outside the game loop); canvas-2D only for the animated playfield. **No WebGL anywhere** — WebGL2-only builds lose the low-end-device audience (a documented ~1/3 revenue loss when one dev shipped WebGL2), and DOM+canvas-2D runs everywhere.
- **Build:** <20MB, <10s load, first screen then lazy-load; WebP art; minified bundle for production.
- **Orientation:** portrait-first, letterboxed with side padding on desktop.
- **Big numbers:** break_infinity-style mantissa/exponent Decimal past ~1e15; shorthand display ("1T", "1e18").
- **Saves:** versioned schema with additive, non-destructive migrations (never renumber generator ids); CrazyGames Data Module with localStorage fallback and legacy-key copy; set the "saves progress" toggle at submission.
- **Offline anti-cheat:** `elapsed = clamp(now − save.t, 0, cap)`; rollback awards 0; re-stamp after awarding.
- **SDK:** v3 script in `<head>`; rewarded/midgame via `SDK.ad.requestAd` with pause+mute on `adStarted`, resume on finish/error, reward ONLY on `adFinished`; `SDK.data.*` saves; `gameplayStart/Stop`, `loadingStart/Stop`; respect `adCooldown`; must function under adblock; right-click disabled.
- **Analytics (ByteBrew + CrazyGames):** `game_start, tutorial_complete, first_upgrade_purchased{seconds_since_start}, generator_purchased{gen_id,owned,run_time}, upgrade_purchased{upg_id}, level_up_choice{upgrade_id,was_reroll}, wall_hit{run_time,eta}, prestige{gain,lifetime,run_seconds}, run_end{reason,run_seconds,level_reached}, offline_claim{hours,doubled}, ad_offered/ad_watched/ad_completed{placement}, session_length, zone_unlocked, day2_return`. A/B test cost constants per title.

## Part M — Production pipeline & cadence

**Per-title budget (mature pipeline): ~2 weeks solo.** Theme selection + JSON: 1 day. Art generation + integration: 1–2 days. Signature mechanic (library or new): 2–4 days. Economy tuning to clear the gate: 2–3 days (the critical investment). QA + submission + monitoring: ongoing.

**Claude Code workflow per variant:** feed the shared engine + new theme-pack JSON → "Generate variant `<themeId>`; wire the `<signatureMechanic>` module; produce the minified build" → integrate art paths → human tuning pass on economy constants (or A/B post-launch).

**QA checklist (per title):** loads <10s throttled; playable with adblock; no WebGL2; portrait + landscape; save persists + migrates; offline earnings correct + tamper-safe; rewarded rewards only on finish; midgame at run-end only; right-click disabled; tutorial ≤15s; first upgrade ≤15s; build <20MB.

**Submission checklist:** original name; unique thumbnail; distinct theme/resources/tree/signature vs. all prior titles; data-save toggle set; mobile toggle set; privacy notice if collecting beyond SDK events.

## Part N — Kill / iterate KPI thresholds

| Signal | Kill | Iterate | Scale |
|---|---|---|---|
| Avg playtime (Basic Launch) | <6 min after 2 tuning passes | 6–10 min | ≥10 min |
| Conversion | <70% after load/tutorial fixes | 70–80% | ≥80% |
| Full Launch revenue (mo. 2–3) | <$300/mo | $300–1,200/mo | >$1,200/mo |
| D1 retention | <5% | 5–7% | >7% |
| Rewarded opt-in | <15% | 15–40% | >40% |
| Thumbnail CTR | bottom quartile after 2 A/Bs | mid | top quartile |

**Kill:** fails the gate after 2 focused tuning passes, or <$300/mo three months post-Full-Launch. **Iterate:** middle bands — A/B costs, thumbnails, placements. **Scale:** push for Originals, consider a sequel, port non-exclusively to secondary portals.

## Roadmap

- **Stage 1 (Months 1–3):** engine + Mine/Space/Dungeon. Proceed if ≥2 of 3 clear the gate.
- **Stage 2 (Months 4–12):** ~1 title/3 weeks to 12–15; exit Year 1 at ~$120–160k run-rate.
- **Stage 3 (Year 2):** 20–25/year; one Originals-bar title per quarter; cross $250k run-rate.

## Caveats

Revenue figures are modeled from a single hard anchor (~$12.9k/yr) plus genre retention data — treat $250k-by-Year-2 as a stretch goal. CrazyGames publishes no eCPM; ranges are web-industry benchmarks. The 60%/70% share figure comes from jam terms, not main docs; Originals share is higher but undisclosed. Originality enforcement is inconsistent — the four-axis rule is risk-minimizing, not a guarantee. Idle demand has cooled at mobile mega-scale, but on an ad-share web portal with zero UA and zero marginal art cost the unit economics hold. Solo throughput of 1 title/2–3 weeks only arrives after the engine and module library mature.
