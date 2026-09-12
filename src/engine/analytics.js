// Analytics event schema (spec Part L). Routes to ByteBrew when present,
// console.debug otherwise. Event names/payloads are the tuning contract:
// game_start, tutorial_complete, first_upgrade_purchased, generator_purchased,
// upgrade_purchased, level_up_choice, wall_hit, prestige, run_end,
// offline_claim, ad_offered, ad_watched, ad_completed, session_length,
// zone_unlocked, day2_return.
const sessionStart = Date.now();
let debug = false;

export function setDebug(v) { debug = v; }

export function track(event, params = {}) {
  try {
    if (window.ByteBrew?.NewCustomEvent) {
      const str = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(';');
      window.ByteBrew.NewCustomEvent(event, str);
    } else if (debug) {
      console.debug('[analytics]', event, params);
    }
  } catch (e) {}
}

export function trackSessionLength() {
  track('session_length', { seconds: Math.round((Date.now() - sessionStart) / 1000) });
}
