import type { APIRoute } from 'astro';
import { publishedLists } from '../../lib/lists';
import { listMarkdown } from '../../lib/markdown';

export async function getStaticPaths() {
  return (await publishedLists()).map(({ def, ranked }) => ({ params: { slug: def.slug }, props: { def, ranked } }));
}

export const GET: APIRoute = ({ props, site }) =>
  new Response(listMarkdown(props.def, props.ranked, site!.toString().replace(/\/$/, '')), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
