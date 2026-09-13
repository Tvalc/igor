// Browser smoke test: serves the game, drives it in a real browser, and fails
// on any page error. Covers what the headless sim can't — module loading, DOM
// wiring, tap handling, canvas, and save persistence across a reload.
//
// Run with: node test/smoke.mjs [--headed] [--port 8123]
// Requires Playwright. If it isn't resolvable, the test skips rather than
// fails, so `npm test`-style runs stay green on machines without it.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const PORT = Number(args[args.indexOf('--port') + 1]) || 8123;
// --root lets the same checks run against the built single-file bundle
// (--root dist) as well as the unbundled source tree, so a build that breaks
// the module inlining fails here rather than after deploy.
const ROOT = path.resolve(REPO, args.includes('--root') ? args[args.indexOf('--root') + 1] : '.');

// Playwright may live in a global install; try the local resolution first.
function loadChromium() {
  const candidates = [import.meta.url, '/opt/node22/lib/node_modules/playwright/'];
  for (const base of candidates) {
    try { return createRequire(base)('playwright').chromium; } catch {}
  }
  return null;
}

const chromium = loadChromium();
if (!chromium) {
  console.log('skip - playwright not installed (npm i -D playwright)');
  process.exit(0);
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
};

const server = http.createServer(async (req, res) => {
  const rel = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise(r => server.listen(PORT, r));

const browser = await chromium.launch({
  headless: !HEADED,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 420, height: 800 } });

// The CrazyGames SDK is hosted off-origin and is expected to be unreachable in
// CI/sandboxes — that path is the adblock case the engine must survive, so
// those failures are ignored while everything else is a hard error.
const external = (u = '') => u.includes('crazygames') || u.includes('bytebrew');
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => {
  if (m.type() !== 'error') return;
  const txt = m.text();
  if (external(txt) || external(m.location()?.url)) return;
  errors.push(`console: ${txt}`);
});
page.on('requestfailed', r => { if (!external(r.url())) errors.push(`requestfailed: ${r.url()}`); });

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const t0 = Date.now();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.hud', { timeout: 10000 });
const loadMs = Date.now() - t0;
// The Basic Launch gate is <10s load; locally it should be well under 2s.
check('loads under 10s (gate requirement)', loadMs < 10000, `${loadMs}ms`);

check('tutorial shows on a fresh save', await page.locator('.tutorial').count() === 1);

// Tap to mine, which should also advance the tutorial past step 1.
for (let i = 0; i < 40; i++) await page.click('.playfield');
await page.waitForTimeout(300);
const ore = await page.locator('.res-value').textContent();
check('tapping earns currency', parseFloat(ore) > 0, `${ore.trim()} ore`);

const buy = page.locator('.gen-row .buy-1').first();
const couldBuy = await buy.isEnabled();
if (couldBuy) await buy.click();
await page.waitForTimeout(200);
check('first generator affordable and purchasable within ~40 taps',
  couldBuy && (await page.locator('.gen-owned').first().textContent()).includes('×'));

await page.click('.tab-btn[data-tab="prestige"]');
await page.waitForTimeout(150);
check('prestige tab renders', await page.locator('#btn-prestige').count() === 1);
check('meta upgrade tree renders', await page.locator('.meta-row').count() > 0);
await page.click('.tab-btn[data-tab="mine"]');

// Rewarded ad path: without the SDK, sdk.js simulates a ~1.5s ad, so the
// reward must land exactly as it would after a real adFinished.
await page.click('#btn-boost');
await page.waitForTimeout(2200);
check('rewarded 2x boost grants its reward',
  (await page.locator('#btn-boost').textContent()).includes('2×'));

// Idle production must accrue with no further input.
const before = await page.locator('.res-value').textContent();
await page.waitForTimeout(3000);
const after = await page.locator('.res-value').textContent();
check('idle production accrues without input', parseFloat(after) > parseFloat(before),
  `${before.trim()} -> ${after.trim()}`);

// Save persistence across a reload.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.hud', { timeout: 10000 });
const restored = await page.locator('.res-value').textContent();
check('save persists across reload', parseFloat(restored) > 0, `${restored.trim()} ore`);
check('tutorial does not replay for a returning player',
  await page.locator('.tutorial').count() === 0);

// Right-click must be suppressed (CrazyGames requirement).
const menuSuppressed = await page.evaluate(() => {
  const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  document.body.dispatchEvent(e);
  return e.defaultPrevented;
});
check('right-click context menu disabled', menuSuppressed);

if (process.env.SMOKE_SCREENSHOT) {
  await page.screenshot({ path: process.env.SMOKE_SCREENSHOT });
  console.log(`\nscreenshot -> ${process.env.SMOKE_SCREENSHOT}`);
}

await browser.close();
server.close();

const failed = checks.filter(c => !c.ok);
if (errors.length) console.error(`\nPAGE ERRORS:\n${errors.join('\n')}`);
if (failed.length || errors.length) {
  console.error(`\nsmoke: ${failed.length} check(s) failed, ${errors.length} page error(s)`);
  process.exit(1);
}
console.log(`\nsmoke: ${checks.length} checks passed, no page errors`);
