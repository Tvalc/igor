import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { comparisonPairs, listsContaining, publishedLists } from '../../lib/lists';
import { scoreTool } from '../../lib/score';
import { CATEGORY_LABELS } from '../../lib/format';
import { renderOg, type OgCard } from '../../lib/og';

// One social image per tool, list and versus page: /og/tools/<id>.png, /og/best/<slug>.png, /og/compare/<pair>.png.
// Base.astro points each page's og:image here; other pages keep /og.png.

export const getStaticPaths: GetStaticPaths = async () => {
  const paths: { params: { slug: string }; props: { card: OgCard } }[] = [];

  for (const tool of await getCollection('tools')) {
    const d = tool.data;
    const s = scoreTool(tool);
    const ranks = (await listsContaining(tool))
      .map(({ def, ranked }) => ({ title: def.title.replace(/^Best /, ''), rank: ranked.findIndex((r) => r.tool.id === tool.id) + 1 }))
      .sort((a, b) => a.rank - b.rank);
    const best = ranks[0];
    paths.push({
      params: { slug: `tools/${tool.id}` },
      props: {
        card: {
          eyebrow: d.status === 'discontinued' ? 'Discontinued' : CATEGORY_LABELS[d.categories[0]],
          title: d.name,
          subtitle: d.tagline,
          tools: [{ name: d.name }],
          highlight: d.status === 'discontinued' ? undefined : best ? `${s.score}/100 · #${best.rank} in ${best.title}` : `${s.score}/100`,
        },
      },
    });
  }

  for (const { def, ranked } of await publishedLists()) {
    const top = ranked[0];
    paths.push({
      params: { slug: `best/${def.slug}` },
      props: {
        card: {
          eyebrow: `${ranked.length} tools ranked`,
          title: def.title,
          subtitle: def.blurb,
          tools: ranked.slice(0, 3).map((r) => ({ name: r.tool.data.name })),
          highlight: `#1 ${top.tool.data.name} · ${top.score}/100`,
        },
      },
    });
  }

  for (const [slug, p] of await comparisonPairs()) {
    const a = scoreTool(p.a, p.group, p.list.features), b = scoreTool(p.b, p.group, p.list.features);
    const lead = a.score === b.score ? null : a.score > b.score ? p.a.data.name : p.b.data.name;
    paths.push({
      params: { slug: `compare/${slug}` },
      props: {
        card: {
          eyebrow: 'Head to head',
          title: `${p.a.data.name} vs ${p.b.data.name}`,
          subtitle: `Price, free plan, commercial rights, features and exports, side by side.`,
          tools: [{ name: p.a.data.name }, { name: p.b.data.name }],
          highlight: `${p.a.data.name} ${a.score} · ${p.b.data.name} ${b.score}${lead ? ` · ${lead} leads` : ' · tied'}`,
        },
      },
    });
  }
  return paths;
};

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await renderOg((props as { card: OgCard }).card)), { headers: { 'Content-Type': 'image/png' } });
