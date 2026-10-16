# AI Game Atlas

Independent, data-driven rankings of every AI game development tool: AI game makers, sprite and 3D
generators, coding assistants for Unity, Godot and Unreal, and voice, music and NPC AI. Built to rank in
Google and be cited by AI answer engines for searches like "make a game with AI", "make 2D games with AI"
and "make game art with AI".

"AI Game Atlas" is a working name. The domain isn't bought yet; see [docs/research.md](docs/research.md)
for the shortlist and how to verify availability. To rename, change `src/site.ts` and the brand text in
`src/layouts/Base.astro`, and build with `SITE_URL=https://yourdomain.com`.

## How it works

- **Data:** one YAML file per tool in `src/content/tools/`, validated by Zod (`src/content.config.ts`).
  Unknown facts stay `unknown` and are listed under `needs_verification`.
- **Scores:** `src/lib/score.ts` computes a 0–100 Atlas Score from the facts, using weights per category.
  `/methodology` renders the same weights, so the page can't drift from the code. Hands-on test scores
  are blended in only after a test is published in `src/content/tests/`.
- **Pages** (all generated from the data):
  - `/best/*`: 17 ranked lists, defined in `src/lib/lists.ts`.
  - `/tools/*`: one review page per tool.
  - `/compare/a-vs-b`: every pair among the top 5 of each list.
  - `/alternatives/*`: alternatives for each tool.
  - `/guides/*`: three pillar guides.
  - `/methodology`, `/disclosure`, `/about`.
- **Built for answer engines:**
  - Every page opens with a direct answer box.
  - JSON-LD structured data (SoftwareApplication + Review, ItemList, FAQPage, BreadcrumbList).
  - A `.md` copy of every tool and list page.
  - `/llms.txt`, `/llms-full.txt`, `/sitemap.xml`, and a `robots.txt` that allows all crawlers.
- **Disclosure:** the site is run by the Makko AI team. Makko is flagged everywhere it appears and scored
  by the same rules. Affiliate links use `rel="sponsored"`.

## Commands

```bash
npm install
npm run dev        # local dev server
npm run build      # static site in dist/
npm run check      # astro type check
npm run validate   # cross-file data checks
npm run stale      # verification queue (tools with old or pending facts)
```

## Automation

- `.github/workflows/ci.yml` runs data validation, the type check and the build on every PR.
- `.github/workflows/refresh-data.yml` runs a Claude agent weekly with `automation/refresh-prompt.md`.
  The agent re-verifies facts against primary sources, adds new tools, and opens a PR with a sourced
  change table. Add an `ANTHROPIC_API_KEY` repository secret to enable it.

## Deploying

The output in `dist/` is fully static. On Cloudflare Pages or Vercel, use `npm run build` as the build
command, `dist` as the output directory, and set `SITE_URL`.
