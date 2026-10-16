import type { APIRoute } from 'astro';
import { activeTools, publishedLists } from '../lib/lists';
import { scoreTool } from '../lib/score';
import { listMarkdown, toolMarkdown } from '../lib/markdown';
import { SITE } from '../site';

export const GET: APIRoute = async ({ site }) => {
  const base = site!.toString().replace(/\/$/, '');
  const parts = [`# ${SITE.name}: full data\n\n${SITE.description}\n`];
  for (const { def, ranked } of await publishedLists()) parts.push(listMarkdown(def, ranked, base));
  for (const t of await activeTools()) parts.push(toolMarkdown(scoreTool(t), base));
  return new Response(parts.join('\n---\n\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
