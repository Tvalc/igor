import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { BADGE_STYLES, badgeFor, badgeSvg, type BadgeStyle } from '../../../lib/badge';
import type { Tool } from '../../../lib/score';

// Every badge design for every tool, so a vendor can pick the one that suits their page.
export async function getStaticPaths() {
  const tools = (await getCollection('tools')).filter((t) => t.data.status !== 'discontinued');
  return (Object.keys(BADGE_STYLES) as BadgeStyle[]).flatMap((style) =>
    tools.map((tool) => ({ params: { style, slug: tool.id }, props: { tool, style } })),
  );
}

export const GET: APIRoute = async ({ props }) => {
  const { tool, style } = props as { tool: Tool; style: BadgeStyle };
  return new Response(await badgeSvg(await badgeFor(tool), style), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
};
