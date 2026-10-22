import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { badgeFor, badgeSvg } from '../../lib/badge';
import type { Tool } from '../../lib/score';

export async function getStaticPaths() {
  return (await getCollection('tools'))
    .filter((t) => t.data.status !== 'discontinued')
    .map((tool) => ({ params: { slug: tool.id }, props: { tool } }));
}

export const GET: APIRoute = async ({ props }) => {
  const { label } = await badgeFor((props as { tool: Tool }).tool);
  return new Response(badgeSvg(label), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
};
