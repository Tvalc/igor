// Rewarded-ad placement manager (spec Part E). Placements are declared here;
// the theme pack toggles them on/off via theme.ads. Rules enforced:
//  - reward ONLY on adFinished (sdk.js guarantees onFinished ≠ adError)
//  - revive capped at once per run/session
//  - every placement has a non-ad path (the player can always decline)
//  - game pauses + mutes during ads via the hooks passed at init
import * as sdk from './sdk.js';
import { track } from './analytics.js';

export class AdManager {
  constructor(game, { onPause, onResume }) {
    this.game = game;
    this.onPause = onPause;
    this.onResume = onResume;
    this.reviveUsedThisRun = false;
    this.dailyClaimUsedThisSession = false;
    this.busy = false;
  }

  enabled(placement) {
    return !!this.game.theme.ads?.[placement];
  }

  onRunStart() { this.reviveUsedThisRun = false; }

  canRevive() { return this.enabled('reviveOncePerRun') && !this.reviveUsedThisRun; }

  // Generic rewarded flow. reward() runs only when the ad actually finishes.
  show(placement, reward) {
    if (this.busy) return;
    this.busy = true;
    track('ad_offered', { placement });
    sdk.requestRewarded({
      onStarted: () => { this.onPause(); track('ad_watched', { placement }); },
      onFinished: () => {
        this.busy = false;
        this.onResume();
        track('ad_completed', { placement });
        reward();
      },
      onError: () => { this.busy = false; this.onResume(); },
    });
  }

  offlineDoubler(claimDoubled) {
    if (!this.enabled('offlineDoubler')) return false;
    this.show('offline_doubler', claimDoubled);
    return true;
  }

  revive(doRevive) {
    if (!this.canRevive()) return false;
    this.reviveUsedThisRun = true;
    this.show('revive', doRevive);
    return true;
  }

  boost2x(applyBoost) {
    if (!this.enabled('boost2xMinutes')) return false;
    this.show('boost_2x', applyBoost);
    return true;
  }

  rerollUpgrade(doReroll) {
    if (!this.enabled('rerollUpgrade')) return false;
    this.show('reroll_upgrade', doReroll);
    return true;
  }

  skipWall(grantCurrency) {
    if (!this.enabled('skipWall')) return false;
    this.show('skip_wall', grantCurrency);
    return true;
  }

  dailyFreeCurrency(grant) {
    if (!this.enabled('dailyFreeCurrency') || this.dailyClaimUsedThisSession) return false;
    this.show('daily_free_currency', () => { this.dailyClaimUsedThisSession = true; grant(); });
    return true;
  }

  // Interstitial at run-end transitions only. sdk.js self-gates on cooldown.
  runEndInterstitial(next) {
    sdk.requestMidgame({
      onStarted: () => this.onPause(),
      onFinished: () => { this.onResume(); next?.(); },
    });
  }
}
