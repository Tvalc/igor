# Research: market gap and domain shortlist (2026-10-16)

## Does this site already exist?

Mostly no. We found no neutral, game-specific site with full coverage, hands-on testing and published
scores. The space isn't empty, though. **Vendor-run content hubs that rank their own product first hold
the target searches.**

| Who holds the target searches | Notes |
|---|---|
| Summer Engine blog | Largest programmatic SEO effort: multilingual pages plus `.md` copies for AI crawlers. Takes about 7 of 9 results for "make a game with AI" |
| Ludo.ai `/compare/` hub | Ranks for "best ai game makers", "best ai sprite generators" and "best ai 3d model generators" |
| blog.makko.ai | Ranks for "make 2d game with ai", "best ai game makers" and "text to game" |
| Unite.ai listicle | High domain authority; the most neutral-looking source that answer engines cite |
| Generic image-tool landing pages | Hold "ai sprite generator"; no game-aware reviews in the results |

Closest real competitors, all weak:
- [Yuan-ManX/ai-game-devtools](https://github.com/Yuan-ManX/ai-game-devtools): a GitHub list with 600+
  entries, no ranking, not a consumer site.
- "Game AI Tools" on hunted.space: almost no traction.
- RankMyAI: rankings by traffic metrics.
- Toolify and There's An AI For That game categories: AI games mixed in with dev tools.

Answer engines currently cite vendor listicles and flag them as biased ("vendor, weigh accordingly").
A credible, transparent source is the gap this site targets.

**Risks:**
- Summer Engine and Ludo are investing heavily in SEO.
- Google Playground (launched 2026-10-07) and Unity will pull head searches toward official pages.
- Ownership by a vendor (Makko) is credible only with prominent disclosure and identical scoring rules.
  The site implements both.

## Tool landscape

About 115 live tools were found. 86 are seeded here (83 active, 3 discontinued kept for
"alternatives" searches). QA, localization and design-doc tools (about 14) are deferred.

Confirmed affiliate programs:
- Meshy: 20% for 12 months.
- Tripo: up to 30% for 12 months.
- ElevenLabs: 22% for 12 months.
- Mubert: 30% recurring.
- Sloyd: 20% for 12 months.
- Soundraw.

Leonardo's program closed in April 2026. Game makers and coding tools mostly lack programs, so
sponsorships are the revenue lever there.

## Domain shortlist

**Availability was NOT verified.** The research environment's network policy blocked registry lookups
(rdap.verisign.com, pubapi.registry.google, rdap.nic.ai) and DNS. Names were ranked on quality and checked
by web search for brand collisions only.

Top picks:
1. **AIGameAtlas.com**: "atlas" means a comprehensive map and is also a sprite/texture-atlas term game devs
   know. No collision found.
2. **AIGameBench.com**: "bench" signals hands-on testing.
3. **GameDevRank.com**: short and direct, but likely taken. Fallback: **GameToolRank.com**.

Next tier: AIGameIndex, AIGameScout, GameDevAtlas, IndieAIStack, AIGameCompass, GameAIRadar, SpriteRank,
MakeGamesAI.

Non-.com options: aigameatlas.gg, gamedevrank.gg, gamedevatlas.dev, aigameindex.dev. Most registrars sell
.ai with a 2-year minimum.

Avoid:
- Anything with "gamemaker" (YoYo Games/Opera trademark).
- gameforge* (Gameforge AG), playstack* (a game publisher), playmaker* (a Unity asset), spritestack (an
  existing tool).

Verify before buying. Run this twice; a 404 means unregistered. Then confirm at a registrar that the name
isn't registry-premium priced:

```bash
for n in aigameatlas aigamebench gamedevrank gametoolrank aigameindex aigamescout gamedevatlas indieaistack aigamecompass gameairadar spriterank makegamesai; do
  echo "$n.com $(curl -s -o /dev/null -w '%{http_code}' https://rdap.verisign.com/com/v1/domain/$n.com)"; sleep 1; done
```
