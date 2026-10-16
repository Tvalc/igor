// Copies a built site into a self-contained folder whose links are all relative, so it can be
// clicked through on hosts that don't resolve root-relative or extensionless URLs (e.g. a private
// Claude artifact preview).
//
// Usage: node scripts/preview-bundle.mjs <dist> <out> [page.html ...]
//   With no pages listed, every HTML page is included. Links to pages left out become "#not-in-preview".
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, posix, relative } from 'node:path';

const [dist, out, ...only] = process.argv.slice(2);
if (!dist || !out) {
  console.error('Usage: node scripts/preview-bundle.mjs <dist> <out> [page.html ...]');
  process.exit(1);
}

const walk = (dir, root = dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, root) : [relative(root, p).split('\\').join('/')];
  });

const all = new Set(walk(dist));
const pages = only.length ? only : [...all].filter((f) => f.endsWith('.html'));
const included = new Set(pages);
const assets = new Set();
const misses = new Set();

/** Map a root-relative URL to a file in dist, or null. */
function resolve(url) {
  const clean = url.split(/[?#]/)[0];
  const p = clean.replace(/^\//, '');
  const candidates = p === '' ? ['index.html'] : clean.endsWith('/') ? [`${p}index.html`] : extname(p) ? [p] : [`${p}.html`, `${p}/index.html`];
  return candidates.find((c) => all.has(c)) ?? null;
}

function rewrite(text, fromFile, isHtml) {
  const fromDir = posix.dirname(fromFile);
  const fix = (url) => {
    if (!url.startsWith('/') || url.startsWith('//')) return url;
    const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
    const target = resolve(url);
    if (!target) {
      misses.add(`${fromFile} -> ${url}`);
      return url;
    }
    if (target.endsWith('.html') && !included.has(target)) return '#not-in-preview';
    if (!target.endsWith('.html')) assets.add(target);
    return (posix.relative(fromDir, target) || posix.basename(target)) + hash;
  };
  let res = text.replace(/url\((['"]?)(\/[^)'"]+)\1\)/g, (_, q, u) => `url(${q}${fix(u)}${q})`);
  if (isHtml) res = res.replace(/\b(href|src)="(\/[^"]*)"/g, (_, attr, u) => `${attr}="${fix(u)}"`);
  return res;
}

mkdirSync(out, { recursive: true });
for (const page of pages) {
  if (!all.has(page)) {
    console.error(`Not in dist: ${page}`);
    process.exit(1);
  }
  const dest = join(out, page);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, rewrite(readFileSync(join(dist, page), 'utf8'), page, true));
}
// CSS can pull in further assets (fonts), so process until no new ones appear.
const done = new Set();
while ([...assets].some((a) => !done.has(a))) {
  for (const a of [...assets]) {
    if (done.has(a)) continue;
    done.add(a);
    const dest = join(out, a);
    mkdirSync(dirname(dest), { recursive: true });
    if (a.endsWith('.css')) writeFileSync(dest, rewrite(readFileSync(join(dist, a), 'utf8'), a, false));
    else cpSync(join(dist, a), dest);
  }
}

const leftover = walk(out).filter((f) => /\.(html|css)$/.test(f)).filter((f) =>
  /\b(?:href|src)="\/(?!\/)|url\(['"]?\/(?!\/)/.test(readFileSync(join(out, f), 'utf8')),
);
console.log(`Preview: ${pages.length} pages, ${done.size} assets -> ${out}`);
if (misses.size) console.log(`Unresolved links (${misses.size}):\n  ${[...misses].slice(0, 20).join('\n  ')}`);
if (leftover.length) {
  console.error(`Root-relative URLs remain in: ${leftover.join(', ')}`);
  process.exit(1);
}
if (!existsSync(join(out, pages[0]))) process.exit(1);
