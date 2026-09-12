// Boot: load theme pack → init SDK → restore save → apply offline earnings →
// hand off to the UI. Loading is wrapped in the SDK's loading markers so
// conversion metrics attribute load time correctly.
import { Game } from './engine/game.js';
import { UI } from './engine/ui.js';
import * as save from './engine/save.js';
import * as sdk from './engine/sdk.js';
import { track, trackSessionLength, setDebug } from './engine/analytics.js';

const THEME_URL = document.currentScript?.dataset?.theme
  ?? document.querySelector('meta[name="theme-pack"]')?.content
  ?? 'themes/deepcore_mine.json';

async function loadTheme() {
  const res = await fetch(THEME_URL);
  if (!res.ok) throw new Error(`Theme pack failed to load: ${THEME_URL}`);
  return res.json();
}

function applyPalette(theme) {
  const r = document.documentElement.style;
  const p = theme.palette ?? {};
  if (p.primary) r.setProperty('--c-primary', p.primary);
  if (p.bg) r.setProperty('--c-bg', p.bg);
  if (p.accent) r.setProperty('--c-accent', p.accent);
}

async function boot() {
  setDebug(location.hostname === 'localhost' || location.protocol === 'file:');
  sdk.loadingStart();
  await sdk.initSDK();

  const theme = await loadTheme();
  applyPalette(theme);

  const game = new Game(theme);
  const saved = save.load(theme.themeId);
  let lastSeen = null;
  if (saved) lastSeen = save.hydrate(game, saved);
  game.recomputeMults();

  const ui = new UI(game, document.getElementById('app'));

  // Day-2 return: compare calendar day of last play
  const today = new Date().toDateString();
  if (game.state.stats.lastPlayedDay && game.state.stats.lastPlayedDay !== today) track('day2_return');
  game.state.stats.lastPlayedDay = today;

  // Offline earnings (clock-tamper-safe inside applyOffline)
  const offer = game.applyOffline(lastSeen);
  if (offer) ui.showOfflineClaim(offer);

  if (!saved) game.startRun();
  else if (!game.state.run.active) game.startRun();

  sdk.loadingStop();
  sdk.gameplayStart();
  track('game_start');

  // Autosave: 10s cadence + on hide/close (the Data Module debounces writes)
  setInterval(() => save.persist(game), 10000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save.persist(game); trackSessionLength(); }
  });
  window.addEventListener('beforeunload', () => save.persist(game));
}

boot().catch((err) => {
  console.error(err);
  const app = document.getElementById('app');
  app.innerHTML = `<div class="boot-error">Failed to load. Please refresh.<br><small>${err.message}</small></div>`;
});
