// Single-file build: inlines the ES module graph, CSS, and theme pack into one
// self-contained index.html. Spec Part L wants a minified single-file bundle
// that loads in <10s with no extra round-trips; this also makes the game
// runnable from a file:// URL or any static host with zero configuration.
//
// Usage: node tools/build.mjs [--theme themes/x.json] [--out dist] [--no-sdk] [--minify]
//
// The module graph here uses only two import forms (named and namespace) and
// no re-exports or dynamic imports, so a full bundler is unnecessary: each
// module becomes an IIFE returning its exports, emitted in dependency order.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const THEME = flag('--theme', 'themes/deepcore_mine.json');
const OUT_DIR = path.resolve(ROOT, flag('--out', 'dist'));
const WITH_SDK = !argv.includes('--no-sdk');
const MINIFY = argv.includes('--minify');

const IMPORT_NAMED = /^import\s*\{([^}]+)\}\s*from\s*['"](.+?)['"];?[ \t]*$/gm;
const IMPORT_NS = /^import\s*\*\s*as\s+(\w+)\s+from\s*['"](.+?)['"];?[ \t]*$/gm;
const EXPORT_DECL = /^export\s+(async\s+function|function|class|const|let|var)\s+(\w+)/gm;

const modules = new Map(); // id -> { code, deps, exports }

function resolveId(fromId, spec) {
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromId), spec));
}

async function collect(id) {
  if (modules.has(id)) return;
  modules.set(id, null); // cycle guard
  const source = await readFile(path.join(SRC, id), 'utf8');
  const deps = [];

  let code = source
    .replace(IMPORT_NAMED, (_, names, spec) => {
      const dep = resolveId(id, spec);
      deps.push(dep);
      // `import { a as b }` becomes `const { a: b }` — destructuring renames
      // with a colon, not `as`, and getting this wrong produces a bundle that
      // parses nowhere (caught by `npm run test:smoke:dist`).
      const bound = names.split(',').map(n => {
        const m = n.trim().match(/^(\w+)\s+as\s+(\w+)$/);
        return m ? `${m[1]}: ${m[2]}` : n.trim();
      }).filter(Boolean).join(', ');
      return `const {${bound}} = __m[${JSON.stringify(dep)}];`;
    })
    .replace(IMPORT_NS, (_, ns, spec) => {
      const dep = resolveId(id, spec);
      deps.push(dep);
      return `const ${ns} = __m[${JSON.stringify(dep)}];`;
    });

  const exports = [];
  code = code.replace(EXPORT_DECL, (_, kind, name) => {
    exports.push(name);
    return `${kind} ${name}`;
  });

  if (/^\s*export\s/m.test(code)) {
    throw new Error(`${id}: unsupported export form (only declaration exports are handled)`);
  }

  modules.set(id, { code, deps, exports });
  for (const dep of deps) await collect(dep);
}

// Post-order DFS so every module is emitted after its dependencies.
function order(id, seen = new Set(), out = []) {
  if (seen.has(id)) return out;
  seen.add(id);
  for (const dep of modules.get(id).deps) order(dep, seen, out);
  out.push(id);
  return out;
}

// Conservative size trim: strips full-line comments and blank lines only.
// Real minification would need a parser; this keeps the build dependency-free
// while still cutting the comment-heavy engine down meaningfully.
// Attribute-safe escaping for theme strings dropped into meta tags.
function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function trim(js) {
  return js
    .split('\n')
    .filter(line => !/^\s*\/\/ /.test(line) && line.trim() !== '')
    .join('\n');
}

await collect('main.js');
const emitted = order('main.js');

const bundle = [
  '(function(){"use strict";',
  'const __m = Object.create(null);',
  ...emitted.map(id => {
    const mod = modules.get(id);
    const body = MINIFY ? trim(mod.code) : mod.code;
    return `__m[${JSON.stringify(id)}] = (function(){\n${body}\nreturn {${mod.exports.join(',')}};\n})();`;
  }),
  '})();',
].join('\n');

const css = await readFile(path.join(ROOT, 'css/style.css'), 'utf8');
const theme = JSON.parse(await readFile(path.join(ROOT, THEME), 'utf8'));

// JSON is embedded as a JS value, so close out any </script> sequence and the
// U+2028/2029 line terminators that are legal in JSON but not in JS source.
const themeLiteral = JSON.stringify(theme)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

// A deployed page gets linked and shared, so it needs a name, a description,
// and an icon of its own. All of it comes from the theme pack, so every
// variant gets correct metadata without touching this file.
const desc = theme.fantasy ?? theme.displayName;
const icon = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>`
  + `<rect width='32' height='32' rx='7' fill='${theme.palette.bg.replace('#', '%23')}'/>`
  + `<path d='M16 4.5l7.5 9.5L16 28 8.5 14z' fill='${theme.palette.accent.replace('#', '%23')}'/>`
  + `<path d='M16 4.5L8.5 14H16z' fill='${theme.palette.primary.replace('#', '%23')}'/></svg>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="${theme.palette.bg}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(theme.displayName)}">
<meta property="og:description" content="${esc(desc)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${icon}">
<link rel="apple-touch-icon" href="${icon}">
<title>${esc(theme.displayName)}</title>
<style>
${MINIFY ? css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{2,}/g, '\n') : css}
</style>${WITH_SDK ? '\n<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>' : ''}
</head>
<body>
<div id="app"><div class="boot-error">Loading…</div></div>
<script>window.__THEME_PACK__ = ${themeLiteral};</script>
<script>
${bundle}
</script>
</body>
</html>
`;

await mkdir(OUT_DIR, { recursive: true });
const outFile = path.join(OUT_DIR, 'index.html');
await writeFile(outFile, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`built ${path.relative(ROOT, outFile)} — ${kb} KB, ${emitted.length} modules, theme "${theme.themeId}"${WITH_SDK ? '' : ', SDK omitted'}`);
if (Buffer.byteLength(html) > 20 * 1024 * 1024) {
  console.error('WARNING: build exceeds the 20MB CrazyGames gate');
  process.exit(1);
}
