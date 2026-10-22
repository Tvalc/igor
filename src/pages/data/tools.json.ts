import type { APIRoute } from 'astro';
import { datasetRows } from '../../lib/stats';
import { SITE } from '../../site';

export const GET: APIRoute = async ({ site }) => {
  const base = site!.toString().replace(/\/$/, '');
  const tools = await datasetRows(base);
  const body = {
    name: `${SITE.name} AI game dev tools dataset`,
    license: 'CC BY 4.0',
    attribution: `${SITE.name} (${base})`,
    methodology: `${base}/methodology`,
    tools,
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
