// CrazyGames SDK v3 wrapper. Every call degrades to a safe no-op when the SDK
// is absent (local dev, adblock, other portals) — the game must stay fully
// playable either way.
const state = {
  sdk: null,
  lastMidgameAt: 0,
  midgameCooldownMs: 3 * 60 * 1000,
};

export async function initSDK() {
  try {
    if (window.CrazyGames && window.CrazyGames.SDK) {
      state.sdk = window.CrazyGames.SDK;
      await state.sdk.init();
    }
  } catch (e) {
    state.sdk = null;
  }
  return state.sdk != null;
}

export function hasSDK() { return state.sdk != null; }

export function loadingStart() { try { state.sdk?.game.loadingStart(); } catch (e) {} }
export function loadingStop() { try { state.sdk?.game.loadingStop(); } catch (e) {} }
export function gameplayStart() { try { state.sdk?.game.gameplayStart(); } catch (e) {} }
export function gameplayStop() { try { state.sdk?.game.gameplayStop(); } catch (e) {} }

// Rewarded ad. onFinished fires ONLY on adFinished — never on adError.
// pause/resume hooks let the caller mute audio and halt the loop.
export function requestRewarded({ onStarted, onFinished, onError }) {
  if (!state.sdk) {
    // Dev fallback: simulate a short ad so placements are testable locally.
    onStarted?.();
    setTimeout(() => onFinished?.(), 1500);
    return;
  }
  state.sdk.ad.requestAd('rewarded', {
    adStarted: () => onStarted?.(),
    adFinished: () => onFinished?.(),
    adError: (err) => onError?.(err),
  });
}

// Midgame ad — request at run-end transitions only; the SDK enforces its own
// adCooldown but we also self-gate so we never spam requests.
export function requestMidgame({ onStarted, onFinished } = {}) {
  const now = Date.now();
  if (now - state.lastMidgameAt < state.midgameCooldownMs) { onFinished?.(); return; }
  state.lastMidgameAt = now;
  if (!state.sdk) { onFinished?.(); return; }
  state.sdk.ad.requestAd('midgame', {
    adStarted: () => onStarted?.(),
    adFinished: () => onFinished?.(),
    adError: () => onFinished?.(),
  });
}

// Data module: same API shape as localStorage, synced for logged-in users.
export function dataGet(key) {
  try {
    if (state.sdk?.data) return state.sdk.data.getItem(key);
    return localStorage.getItem(key);
  } catch (e) { return null; }
}

export function dataSet(key, value) {
  try {
    if (state.sdk?.data) { state.sdk.data.setItem(key, value); return; }
    localStorage.setItem(key, value);
  } catch (e) {}
}

// One-time copy of a legacy localStorage save into the Data Module.
export function migrateLegacyKey(key) {
  try {
    if (!state.sdk?.data) return;
    const local = localStorage.getItem(key);
    if (local && !state.sdk.data.getItem(key)) state.sdk.data.setItem(key, local);
  } catch (e) {}
}
