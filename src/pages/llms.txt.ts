import type { APIRoute } from 'astro';
import { activeTools, publishedLists } from '../lib/lists';
import { SITE } from '../site';

// https://llmstxt.org: a curated index for language models and agents.
export const GET: APIRoute = async ({ site }) => {
  const base = site!.toString().replace(/\/$/, '');
  const lists = await publishedLists();
  const tools = (await activeTools()).filter((t) => t.data.status !== 'discontinued');
  const body = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description} Every tool is scored 0–100 on a public rubric from verified facts (free tier, price, commercial rights, exports, engine support). Run by ${SITE.owner}; Makko is scored like every other tool.`,
    '',
    'Each page below has a plain-markdown version at the same URL with `.md` appended.',
    '',
    '## Guides',
    '',
    `- [How to make a game with AI](${base}/guides/how-to-make-a-game-with-ai): three routes (prompt-to-game, AI in an engine, coding agents), step by step`,
    `- [How to make 2D games with AI](${base}/guides/make-2d-games-with-ai): 2D game makers, consistent sprites, tilesets`,
    `- [How to make game art with AI](${base}/guides/make-game-art-with-ai): concept art, sprites, 3D, textures, rights`,
    '',
    '## Rankings',
    '',
    ...lists.map(({ def, ranked }) => `- [${def.title}](${base}/best/${def.slug}.md): ${ranked.length} tools; #1 ${ranked[0].tool.data.name}`),
    '',
    '## Tools',
    '',
    ...tools.map((t) => `- [${t.data.name}](${base}/tools/${t.id}.md): ${t.data.tagline}`),
    '',
    '## About',
    '',
    `- [Methodology](${base}/methodology): rubric, weights and data rules`,
    `- [Disclosure](${base}/disclosure): ownership and affiliate policy`,
    '',
    '## Optional',
    '',
    `- [Full dump](${base}/llms-full.txt): every tool and ranking in one file`,
  ];
  return new Response(body.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
