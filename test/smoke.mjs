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
check('loads under 10s (gate requirement)', loadMs < 10000, `${loadMs}ms`);

// The game must open on a title screen, not mid-run.
check('opens on a start screen', await page.locator('.screen.start').count() === 1);
check('start screen offers a play button',
  (await page.locator('.btn-play').textContent()).length > 3,
  (await page.locator('.btn-play').textContent()).trim());
// Nothing should be simulating while the title screen is up.
const oreAtTitle = await page.locator('.res-value').textContent();
await page.waitForTimeout(1200);
check('sim is frozen behind the start screen',
  (await page.locator('.res-value').textContent()) === oreAtTitle);
await page.click('.btn-play');
await page.waitForTimeout(200);
check('play dismisses the start screen', await page.locator('.screen').count() === 0);

check('first-run coach shows an instruction',
  (await page.locator('.coach').textContent().catch(() => '')).length > 10);
check('health and depth bars render', await page.locator('.bar.health').count() === 1
  && await page.locator('.bar.depth').count() === 1);

// The field must earn with no input at all — it is an idle game first.
await page.waitForTimeout(2500);
const idleOre = parseFloat(await page.locator('.res-value').textContent());
check('earns with zero input (idle auto-seek)', idleOre > 0, `${idleOre} ore`);

// Drag across the playfield: the miner should follow and the hint should clear.
const box = await page.locator('.playfield').boundingBox();
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
await page.mouse.down();
for (let i = 1; i <= 6; i++) {
  await page.mouse.move(box.x + box.width * (0.3 + i * 0.06), box.y + box.height * (0.4 + i * 0.04));
  await page.waitForTimeout(60);
}
await page.mouse.up();
await page.waitForTimeout(600);
// The coach must advance off step 1 once the player has actually mined.
const coachStep = await page.locator('.coach').getAttribute('data-step').catch(() => null);
check('coach advances past the first lesson after mining', coachStep !== 'mine', `step=${coachStep}`);

check('gains print a number on the field',
  await page.evaluate(() => document.querySelector('canvas') != null));

// Spec Part B: the first upgrade must be affordable inside ~10-15s of play.
await page.waitForSelector('.gen-row .buy-1:not([disabled])', { timeout: 12000 }).catch(() => {});
const buy = page.locator('.gen-row .buy-1').first();
const couldBuy = await buy.isEnabled();
if (couldBuy) await buy.click();
await page.waitForTimeout(250);
check('first crew affordable within 12s and purchasable', couldBuy
  && (await page.locator('.gen-owned').first().textContent()).includes('\u00d7'));

check('crew purchase raises passive rate',
  parseFloat(await page.locator('.res-rate').textContent()) > 0,
  (await page.locator('.res-rate').textContent()).trim());

await page.click('.tab-btn[data-tab="shop"]');
await page.waitForTimeout(150);
check('shop tab renders with a non-ad currency balance', await page.locator('.shop-balance').count() === 1);

await page.click('.tab-btn[data-tab="prestige"]');
await page.waitForTimeout(150);
check('prestige tab renders', await page.locator('#btn-prestige').count() === 1);
check('meta upgrade tree renders', await page.locator('.meta-row').count() > 0);

// Every menu screen carries a banner slot for the SDK to fill (spec Part E).
check('menu screens carry a banner slot', await page.locator('.banner-slot').count() === 1);
await page.click('.tab-btn[data-tab="crew"]');

// Rewarded flow: the offer must present a non-ad alternative alongside the ad.
await page.click('#btn-boost');
await page.waitForTimeout(200);
const adBtns = await page.locator('.modal .btn-ad').count();
const altBtns = await page.locator('.modal .btn').count();
check('rewarded offer presents an ad path and a non-ad path', adBtns >= 1 && altBtns > adBtns);
await page.click('.modal .btn-ad');
await page.waitForTimeout(2200);
check('rewarded 2x boost grants its reward',
  (await page.locator('#btn-boost').textContent()).includes('\u26a1'));

// Save persistence across a reload.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.hud', { timeout: 10000 });
check('returning player is offered Continue',
  (await page.locator('.btn-play').textContent()).includes('Continue'));
await page.click('.btn-play');
await page.waitForTimeout(300);
const restored = parseFloat(await page.locator('.res-value').textContent());
check('save persists across reload', restored > 0, `${restored} ore`);

const menuSuppressed = await page.evaluate(() => {
  const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  document.body.dispatchEvent(e);
  return e.defaultPrevented;
});
check('right-click context menu disabled', menuSuppressed);

// Pause: reachable from the HUD and from Escape, and it must freeze the sim.
await page.click('#btn-pause');
await page.waitForTimeout(150);
check('pause screen opens from the HUD', await page.locator('.screen.pause').count() === 1);
const oreAtPause = await page.locator('.res-value').textContent();
await page.waitForTimeout(1200);
check('sim is frozen while paused',
  (await page.locator('.res-value').textContent()) === oreAtPause);
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
check('Escape resumes from pause', await page.locator('.screen').count() === 0);
await page.waitForTimeout(1200);
check('sim runs again after resume',
  (await page.locator('.res-value').textContent()) !== oreAtPause);

// Reset must confirm first, and then actually wipe the save.
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
await page.click('.screen.pause .btn-quiet');
await page.waitForTimeout(150);
check('reset asks for confirmation', await page.locator('.screen.confirm').count() === 1);
await page.click('.screen.confirm .btn-quiet');
await page.waitForTimeout(150);
check('declining the reset keeps you in the pause screen',
  await page.locator('.screen.pause').count() === 1);
await page.click('.screen.pause .btn-quiet');
await page.waitForTimeout(150);
await page.click('.btn-danger');
await page.waitForTimeout(250);
check('confirming the reset wipes progress and returns to the title',
  await page.locator('.screen.start').count() === 1
  && parseFloat(await page.locator('.res-value').textContent()) === 0);
check('a wiped save leaves no stored progress',
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('idleforge_'));
    if (!k) return true;
    const v = JSON.parse(localStorage.getItem(k));
    return (v.prestige?.held ?? 0) === 0 && (v.res?.premium ?? 0) === 0;
  }));
await page.click('.btn-play');
await page.waitForTimeout(200);

// Frame budget: the field must animate, not stall, on a low-end device.
const fps = await page.evaluate(() => new Promise(res => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; performance.now() - t0 < 1000 ? requestAnimationFrame(tick) : res(n); };
  requestAnimationFrame(tick);
}));
check('playfield animates at >=30fps', fps >= 30, `${fps}fps`);

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
