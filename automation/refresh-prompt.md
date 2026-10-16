# Weekly tool data refresh

You maintain the tool database for AI Game Atlas, an independent ranking site for AI game development tools.
The data lives in `src/content/tools/*.yaml`; the schema is in `src/content.config.ts`. Scores are computed
from this data by `src/lib/score.ts`. Never edit scores, weights or page templates in this job.

## Rules

- **Primary sources only.** Pricing comes from the vendor's pricing page, licensing from its terms or license
  file, and status from its site, changelog or announcement. Add every URL you relied on to `sources`.
- **Never guess.** If you can't confirm a fact, leave it as `unknown` or empty and keep it in
  `needs_verification`. Remove a field from `needs_verification` only after confirming it.
- **Set `last_verified` to today** on every tool you check, even if nothing changed.
- **Treat Makko like every other tool.** `makko-ai.yaml` gets exactly the same treatment, no more favorable.
- **Never set `hands_on`.** Only a published test in `src/content/tests/` can produce one.
- **Never set `sponsored: true` or affiliate URLs.** Those are business decisions for humans.
- Text fields (`tagline`, `description`, `best_for`) must be factual and plain, with no marketing superlatives.

## Steps

1. Run `npm ci`, then `node scripts/stale-report.mjs 7` to get this week's queue. Work through as much of it as
   you can, oldest first, then the tools with the most pending fields.
2. For each tool, check its site, pricing page and changelog. Update `pricing`, `license`, `exports`, `engines`,
   `status` and `description` where the facts changed.
3. If a tool shut down or was acquired, set `status: discontinued` and `successor` to the closest active tool
   already in the database.
4. Look for new AI game dev tools (Product Hunt, r/aigamedev, GitHub topics `ai-game-development` and
   `mcp-server` with Unity, Godot or Unreal, and vendor announcements). Add up to 5 new tools per run, each with
   sources and honest `needs_verification`.
5. Run `node scripts/validate-data.mjs` and `npm run build`. Both must pass.
6. Open a pull request titled `Data refresh YYYY-MM-DD`. Its body has a table of every changed field (tool,
   field, old value, new value, source URL) and a list of new tools.
