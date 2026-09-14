// Mobile layout regression test. The genre is played on phones, so the layout
// has to survive small screens and rotation — and these are exactly the
// failures a desktop-sized browser test cannot see.
//
// Run with: node test/mobile.test.mjs [--root dist] [--port 8150]
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const PORT = Number(args[args.indexOf('--port') + 1]) || 8150;
const ROOT = path.resolve(REPO, args.includes('--root') ? args[args.indexOf('--root') + 1] : '.');

function loadChromium() {
  for (const base of [import.meta.url, '/opt/node22/lib/node_modules/playwright/']) {
    try { return createRequire(base)('playwright').chromium; } catch {}
  }
  return null;
}
const chromium = loadChromium();
if (!chromium) { console.log('skip - playwright not installed'); process.exit(0); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  const rel = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try {
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(PORT, r));

// Visible viewport heights, i.e. after the browser's own chrome is subtracted —
// that subtraction is what makes small phones overflow.
const PROFILES = [
  ['iPhone SE', 375, 560],
  ['iPhone 14', 390, 664],
  ['Pixel 7', 412, 730],
  ['phone landscape', 740, 360],
  ['tablet landscape', 844, 390],
];

// Below this a thumb misses as often as it hits.
const MIN_TOUCH_PX = 34;

const browser = await chromium.launch();
let failures = 0;

for (const [name, width, height] of PROFILES) {
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.screen.start', { timeout: 10000 });
  await page.tap('.btn-play');
  await page.waitForTimeout(1200);

  // Real touch must drive the miner. Tapping the centre proves nothing — that
  // is where he already stands — and idling no longer earns, so the taps have
  // to send him somewhere and he needs time to walk there and mine.
  const box = await page.locator('.playfield').boundingBox();
  for (const [fx, fy] of [[0.15, 0.22], [0.85, 0.28], [0.8, 0.82], [0.2, 0.78]]) {
    await page.touchscreen.tap(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(1100);
  }

  const r = await page.evaluate((minPx) => {
    const app = document.getElementById('app');
    const tiny = [...document.querySelectorAll('.panel .btn, .tab-btn, .btn-icon, .btn-descend, .btn-boost, .btn-play')]
      .map(e => ({ t: e.textContent.trim().slice(0, 12), h: Math.round(e.getBoundingClientRect().height) }))
      .filter(x => x.h > 0 && x.h < minPx);
    const pf = document.querySelector('.playfield').getBoundingClientRect();
    return {
      overflow: app.scrollHeight > app.clientHeight + 2,
      hScroll: document.documentElement.scrollWidth > window.innerWidth,
      field: `${Math.round(pf.width)}x${Math.round(pf.height)}`,
      fieldArea: Math.round(pf.width * pf.height),
      tiny,
      ore: parseFloat(document.querySelector('.res-value').textContent),
    };
  }, MIN_TOUCH_PX);

  const problems = [];
  if (r.overflow) problems.push('layout overflows the viewport');
  if (r.hScroll) problems.push('page scrolls horizontally');
  if (r.tiny.length) problems.push(`${r.tiny.length} touch targets under ${MIN_TOUCH_PX}px (${r.tiny.map(x => `${x.t}=${x.h}`).join(', ')})`);
  if (!(r.ore > 0)) problems.push('touch input did not drive the miner — no ore earned after tapping four corners');
  if (r.fieldArea < 40000) problems.push(`playfield too small (${r.field})`);
  if (errors.length) problems.push(`page errors: ${errors.join('; ')}`);

  console.log(`  ${problems.length ? 'FAIL' : 'ok  '} - ${name.padEnd(17)} ${width}x${height}  field ${r.field}`);
  for (const p of problems) console.log(`         ${p}`);
  failures += problems.length ? 1 : 0;
  await ctx.close();
}

await browser.close();
server.close();

assert.equal(failures, 0, `${failures} mobile profile(s) failed`);
console.log(`\nmobile: ${PROFILES.length} profiles pass (portrait + landscape)`);
