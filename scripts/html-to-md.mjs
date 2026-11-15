// After `astro build`: writes a markdown copy next to each guide, comparison, alternatives
// and about-type page (dist/guides/x.html -> dist/guides/x.md). The text is the page's own
// <main> content, so people and AI crawlers get the same words in two formats.
// Pages are chosen by src/lib/html-markdown.ts; keep the two lists in sync.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import TurndownService from 'turndown';
import { gfm } from '@joplin/turndown-plugin-gfm';

const DIST = 'dist';
const SITE = (process.env.SITE_URL ?? 'https://makeaigames.com').replace(/\/$/, '');
const PREFIXES = ['guides/', 'compare/', 'alternatives/'];
const PAGES = ['methodology', 'disclosure', 'editorial-policy', 'stats', 'about'];
const DISCLOSURE = `Make AI Games is run by the Makko AI team. Makko AI is scored with the same public rubric as every other tool: ${SITE}/disclosure`;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const wanted = (rel) => {
  if (!rel.endsWith('.html') || rel.endsWith('index.html')) return false;
  const path = rel.replace(/\.html$/, '');
  return PAGES.includes(path) || PREFIXES.some((p) => path.startsWith(p));
};

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
td.use(gfm);
td.remove(['script', 'style', 'noscript', 'svg', 'button', 'form', 'input', 'select', 'template', 'iframe']);
// Breadcrumbs, badge embeds and other chrome marked aria-hidden add nothing to the text.
td.addRule('hidden', { filter: (n) => n.getAttribute?.('aria-hidden') === 'true' || n.hasAttribute?.('hidden'), replacement: () => '' });
td.addRule('breadcrumb', { filter: (n) => n.nodeName === 'NAV' && /breadcrumb/i.test(n.getAttribute('aria-label') ?? ''), replacement: () => '' });
// Images become their alt text only; site-relative links become absolute.
td.addRule('img', { filter: 'img', replacement: (_c, n) => (n.getAttribute('alt') ? n.getAttribute('alt') : '') });
td.addRule('links', {
  filter: (n) => n.nodeName === 'A' && n.getAttribute('href'),
  replacement: (content, n) => {
    const text = content.trim();
    if (!text) return '';
    let href = n.getAttribute('href');
    if (href.startsWith('#')) return text;
    if (href.startsWith('/')) href = SITE + href;
    return `[${text}](${href})`;
  },
});

// Added last so they win: star ratings read as their label ("Score 95 out of 100"), and
// small badges ("Our team") get set off from the name next to them.
td.addRule('badge', { filter: (n) => n.getAttribute?.('data-slot') === 'badge', replacement: (c) => (c.trim() ? ` (${c.trim()})` : '') });
td.addRule('labelled-img', {
  filter: (n) => n.getAttribute?.('role') === 'img' && n.getAttribute('aria-label'),
  replacement: (_c, n) => n.getAttribute('aria-label').replace(/^Score (\d+) out of 100$/, '$1'),
});

let count = 0;
for (const file of walk(DIST)) {
  const rel = relative(DIST, file).split('\\').join('/');
  if (!wanted(rel)) continue;
  const html = readFileSync(file, 'utf8');
  if (/<meta name="robots" content="noindex"/.test(html)) continue;
  const main = html.match(/<main\b[^>]*>([\s\S]*)<\/main>/)?.[1];
  if (!main) continue;
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? `${SITE}/${rel.replace(/\.html$/, '')}`;
  const body = td.turndown(main).replace(/\n{3,}/g, '\n\n').trim();
  const md = `${body}\n\n---\n\n${DISCLOSURE}\n\nCanonical: ${canonical}\n`;
  writeFileSync(file.replace(/\.html$/, '.md'), md);
  count++;
}
console.log(`html-to-md: wrote ${count} markdown pages`);
