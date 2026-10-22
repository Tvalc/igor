import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { activeTools, comparisonPairs, publishedLists, toolsWithAlternatives } from '../lib/lists';
import { isoDate } from '../lib/format';
import { GUIDES } from '../site';

export const GET: APIRoute = async ({ site }) => {
  const base = site!.toString().replace(/\/$/, '');
  const tools = await activeTools();
  const newest = isoDate(new Date(Math.max(...tools.map((t) => t.data.last_verified.valueOf()))));
  const urls: { loc: string; lastmod: string }[] = [];
  const add = (path: string, lastmod = newest) => urls.push({ loc: base + path, lastmod });

  for (const p of ['/', '/best/', '/tools/', '/compare/', '/methodology', '/disclosure', '/about', '/editorial-policy', '/stats', '/data', '/badges']) add(p);
  for (const g of GUIDES) add(`/guides/${g}`);
  const log = (await getCollection('changelog')).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  if (log.length) add('/changelog', isoDate(log[0].data.date));
  for (const { def } of await publishedLists()) add(`/best/${def.slug}`);
  const withAlts = await toolsWithAlternatives();
  for (const t of tools) {
    add(`/tools/${t.id}`, isoDate(t.data.last_verified));
    if (withAlts.has(t.id)) add(`/alternatives/${t.id}`, isoDate(t.data.last_verified));
  }
  for (const slug of (await comparisonPairs()).keys()) add(`/compare/${slug}`);
  const tests = (await getCollection('tests')).filter((t) => t.data.status === 'published');
  if (tests.length) add('/tests/');
  for (const t of tests) add(`/tests/${t.id}`, isoDate(t.data.date));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
