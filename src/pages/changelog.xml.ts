import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../site';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ site }) => {
  const base = site!.toString().replace(/\/$/, '');
  const entries = (await getCollection('changelog')).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const items = entries.map((e) => `    <item>
      <title>${esc(e.data.title)}</title>
      <link>${base}/changelog#${e.id}</link>
      <guid isPermaLink="false">${e.id}</guid>
      <pubDate>${e.data.date.toUTCString()}</pubDate>
      <description>${esc(e.data.body)}</description>
    </item>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE.name)} changelog</title>
    <link>${base}/changelog</link>
    <atom:link href="${base}/changelog.xml" rel="self" type="application/rss+xml" />
    <description>Changes to AI game dev tool data, scores and rankings on ${esc(SITE.name)}.</description>
    <language>en</language>
${items.join('\n')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
