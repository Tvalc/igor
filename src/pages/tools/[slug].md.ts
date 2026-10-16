import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { scoreTool } from '../../lib/score';
import { toolMarkdown } from '../../lib/markdown';

export async function getStaticPaths() {
  return (await getCollection('tools')).map((tool) => ({ params: { slug: tool.id }, props: { tool } }));
}

export const GET: APIRoute = ({ props, site }) =>
  new Response(toolMarkdown(scoreTool(props.tool), site!.toString().replace(/\/$/, '')), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
