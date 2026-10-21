// Copies a built site into a self-contained folder whose links are all relative, so it can be
// clicked through on hosts that don't resolve root-relative or extensionless URLs (e.g. a private
// Claude artifact preview).
//
// Usage: node scripts/preview-bundle.mjs <dist> <out> [page.html ...]
//   With no pages listed, every HTML page is included. Links to pages left out become "#not-in-preview".
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
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
    const hash = url.match(/[?#].*$/)?.[0] ?? '';
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
    // Script chunks import shared chunks by relative path; bring those along too.
    if (a.endsWith('.js')) {
      for (const [, rel] of readFileSync(join(dist, a), 'utf8').matchAll(/(?:from|import)\s*["']\.\/([^"']+)["']/g)) {
        assets.add(posix.join(posix.dirname(a), rel));
      }
    }
  }
}

// Preview hosts sandbox pages without a real origin, which blocks module scripts (they load in CORS mode).
// Rebundle each page entry script into a classic deferred script with its shared chunks inlined.
const entries = new Set();
for (const page of pages) {
  const html = readFileSync(join(out, page), 'utf8');
  for (const [, src] of html.matchAll(/<script type="module" src="([^"]+)"/g)) entries.add(posix.join(posix.dirname(page), src));
}
for (const e of entries) {
  buildSync({ entryPoints: [join(out, e)], bundle: true, format: 'iife', minify: true, target: 'es2020', outfile: join(out, e.replace(/\.js$/, '.classic.js')), allowOverwrite: true, logLevel: 'error' });
}
for (const page of pages) {
  const f = join(out, page);
  writeFileSync(f, readFileSync(f, 'utf8').replace(/<script type="module" src="([^"]+)\.js"/g, '<script defer src="$1.classic.js"'));
}
// Only the classic builds are referenced now.
for (const a of [...done].filter((a) => a.endsWith('.js'))) rmSync(join(out, a));
// Some hosts reserve top-level names starting with "_", so ship the asset folder as "assets".
if (existsSync(join(out, '_astro'))) {
  renameSync(join(out, '_astro'), join(out, 'assets'));
  for (const f of walk(out).filter((f) => /\.(html|css)$/.test(f))) {
    const p = join(out, f);
    writeFileSync(p, readFileSync(p, 'utf8').replaceAll('_astro/', 'assets/'));
  }
}

// The preview host's content policy blocks images from other sites, so drop vendor logo images there; the
// monogram underneath shows instead.
for (const page of pages) {
  const f = join(out, page);
  writeFileSync(f, readFileSync(f, 'utf8').replace(/<img\b[^>]*src="https:\/\/www\.google\.com\/s2\/favicons[^>]*>/g, ''));
}

// Fonts are CORS fetches too, so embed them in the stylesheet.
for (const f of walk(out).filter((f) => f.endsWith('.css'))) {
  const p = join(out, f);
  const css = readFileSync(p, 'utf8').replace(/url\(([^)'"]+\.woff2)\)/g, (_, rel) => {
    const font = join(dirname(p), rel);
    return existsSync(font) ? `url(data:font/woff2;base64,${readFileSync(font).toString('base64')})` : `url(${rel})`;
  });
  writeFileSync(p, css);
}
for (const f of walk(out).filter((f) => f.endsWith('.woff2'))) rmSync(join(out, f));

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
