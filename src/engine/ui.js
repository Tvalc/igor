// DOM/CSS UI + canvas-2D playfield (spec Part L: no WebGL anywhere).
// Menus are DOM so they stay fast on low-end devices and outside the game
// loop; the canvas draws only the active field via field.js.
import { fmt, fmtTime } from './format.js';
import { track } from './analytics.js';
import * as sdk from './sdk.js';
import { sfx, unlock as unlockAudio, setMuted, isMuted } from './audio.js';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

const REROLL_CRYSTAL_COST = 1;
const SKIP_CRYSTAL_COST = 1;
const BOOST_CRYSTAL_COST = 2;
const REVIVE_CRYSTAL_COST = 3;

export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.tab = 'crew';
    this.modalOpen = false;
    this.screenOpen = false;
    this.started = false;
    this.pendingOffline = null;
    this.wallBanner = null;
    game.ui = this;
    this.build();
    this.startLoops();
  }

  build() {
    const t = this.game.theme;
    document.title = t.displayName;
    this.root.innerHTML = '';
    this.root.append(
      this.header = el('header', 'hud'),
      this.playfield = el('div', 'playfield'),
      this.sigBar = el('div', 'sig-bar'),
      this.tabs = el('nav', 'tabs'),
      this.panel = el('main', 'panel'),
      this.modalHost = el('div', 'modal-host'),
      this.screenHost = el('div', 'screen-host'),
      this.toastHost = el('div', 'toast-host'),
    );

    this.canvas = el('canvas', 'field-canvas');
    this.playfield.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.bindInput();

    for (const [id, label] of [['crew', '⛏ Crew'], ['shop', '💠 Shop'], ['prestige', '💎 Prestige']]) {
      const b = el('button', 'tab-btn', label);
      b.dataset.tab = id;
      b.addEventListener('click', () => { this.tab = id; this.renderPanel(); });
      this.tabs.append(b);
    }

    document.addEventListener('contextmenu', (e) => e.preventDefault()); // CrazyGames requirement
    this.buildHeader();
    this.buildSigBar();
    this.renderHeader();
    this.renderPanel();
    this.bindPauseKey();
  }

  // ---------- start / pause screens ----------

  bindPauseKey() {
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (this.screenOpen) { if (this.screenKind === 'pause') this.resume(); }
      else if (this.started) this.showPause();
    });
  }

  // One screen at a time, full-bleed over the game. Opening a screen freezes
  // the simulation outright rather than just hiding it, so nothing kills the
  // player while they are reading a menu.
  screen(kind) {
    this.screenHost.innerHTML = '';
    this.screenOpen = true;
    this.screenKind = kind;
    this.game.paused = true;
    sdk.gameplayStop();
    const box = el('div', `screen ${kind}`);
    const inner = el('div', 'screen-inner');
    box.append(inner);
    this.screenHost.append(box);
    return inner;
  }

  closeScreen() {
    this.screenHost.innerHTML = '';
    this.screenOpen = false;
    this.screenKind = null;
  }

  statRow(pairs) {
    const row = el('div', 'screen-stats');
    for (const [k, v] of pairs) {
      const cell = el('div', 'screen-stat');
      cell.append(el('div', 'screen-stat-v', v), el('div', 'screen-stat-k', k));
      row.append(cell);
    }
    return row;
  }

  showStart(offlineOffer) {
    const g = this.game, t = g.theme;
    this.pendingOffline = offlineOffer ?? null;
    // Two different questions. Any banked ore at all means there is something
    // to come back to, so the button must say Continue — offering "Start" to a
    // player mid-run reads as "your progress is gone". The stats row is a
    // separate matter: it only means anything once a run has finished.
    const hasProgress = g.state.stats.runs > 0 || g.state.prestige.held > 0
      || g.state.prestige.lifetime.gt(0);
    const hasHistory = g.state.stats.runs > 0;
    const returning = hasProgress;
    const m = this.screen('start');
    const [name, ...rest] = t.displayName.split(':');
    m.append(el('div', 'screen-title', name.trim()));
    if (rest.length) m.append(el('div', 'screen-sub', rest.join(':').trim()));
    m.append(el('p', 'screen-blurb', t.fantasy));

    if (hasHistory) {
      m.append(this.statRow([
        ['Expeditions', String(g.state.stats.runs)],
        [t.resources.prestige.name, String(g.state.prestige.held)],
        ['Best depth', String(g.state.stats.bestDepth + 1)],
      ]));
    }

    const play = el('button', 'btn btn-big btn-play', returning ? '⛏ Continue' : '⛏ Start mining');
    play.onclick = () => this.beginPlay();
    m.append(play);

    if (returning) {
      const fresh = el('button', 'btn btn-quiet', '↺ Reset all progress');
      fresh.onclick = () => this.confirmReset('start');
      m.append(fresh);
    }
    m.append(this.soundToggle());
  }

  showPause() {
    const g = this.game, t = g.theme;
    const m = this.screen('pause');
    m.append(el('div', 'screen-title', 'Paused'));
    m.append(this.statRow([
      ['This run', fmtTime(g.state.run.seconds)],
      ['Depth', String(g.signature.band + 1)],
      ['Cleared', String(g.field.kills())],
    ]));

    const resume = el('button', 'btn btn-big btn-play', '▶ Resume');
    resume.onclick = () => this.resume();
    m.append(resume);

    const gain = g.prestigeGainNow();
    const restart = el('button', 'btn', gain > 0
      ? `↻ End run — bank ${gain} 💎`
      : '↻ Restart run');
    restart.onclick = () => {
      const summary = g.endRun('voluntary');
      this.closeScreen();
      if (summary) this.showRunSummary(summary);
      else { g.startRun(); this.resume(); }
    };
    m.append(restart);

    const fresh = el('button', 'btn btn-quiet', '↺ Reset all progress');
    fresh.onclick = () => this.confirmReset('pause');
    m.append(fresh);
    m.append(this.soundToggle());
  }

  soundToggle() {
    const b = el('button', 'btn btn-quiet screen-sound', isMuted() ? '🔇 Sound off' : '🔊 Sound on');
    b.onclick = () => {
      setMuted(!isMuted());
      this.game.state.settings.muted = isMuted();
      b.textContent = isMuted() ? '🔇 Sound off' : '🔊 Sound on';
      this.hdr.mute.textContent = isMuted() ? '🔇' : '🔊';
    };
    return b;
  }

  // Reset is irreversible, so it asks plainly and defaults to backing out.
  confirmReset(from) {
    const g = this.game, t = g.theme;
    const m = this.screen('confirm');
    m.append(el('div', 'screen-title', 'Reset everything?'));
    m.append(el('p', 'screen-blurb',
      `This erases your ${t.resources.prestige.name}, permanent upgrades, ${t.resources.premium.name} and depth records. It cannot be undone.`));
    const yes = el('button', 'btn btn-big btn-danger', 'Erase and start over');
    yes.onclick = () => {
      g.hardReset();
      this.closeScreen();
      this.started = false;
      this.renderPanel();
      this.showStart(null);
      this.toast('Progress reset');
    };
    const no = el('button', 'btn btn-quiet', 'Keep my progress');
    no.onclick = () => {
      this.closeScreen();
      if (from === 'pause') this.showPause(); else this.showStart(this.pendingOffline);
    };
    m.append(yes, no);
  }

  beginPlay() {
    const g = this.game;
    this.closeScreen();
    const offer = this.pendingOffline;
    this.pendingOffline = null;
    const go = () => {
      if (!g.state.run.active) g.startRun();
      this.resume();
      if (!this.started) { this.started = true; this.startCoach(); }
    };
    if (offer) { this.showOfflineClaim(offer, go); } else go();
  }

  resume() {
    this.closeScreen();
    this.game.paused = false;
    sdk.gameplayStart();
  }

  // ---------- input: drag to move, WASD/arrows on desktop ----------

  bindInput() {
    const f = this.game.field;
    const toLocal = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e) => {
      unlockAudio();
      this.playfield.setPointerCapture?.(e.pointerId);
      const p = toLocal(e);
      f.setTarget(p.x, p.y);
      this.dragging = true;
    };
    const move = (e) => {
      if (!this.dragging) return;
      const p = toLocal(e);
      f.setTarget(p.x, p.y);
    };
    const up = (e) => {
      this.dragging = false;
      f.clearTarget();
      this.playfield.releasePointerCapture?.(e.pointerId);
    };
    this.playfield.addEventListener('pointerdown', down);
    this.playfield.addEventListener('pointermove', move);
    this.playfield.addEventListener('pointerup', up);
    this.playfield.addEventListener('pointercancel', up);

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
        unlockAudio();
        f.keyDown(k);
      }
    });
    window.addEventListener('keyup', (e) => f.keyUp(e.key.toLowerCase()));
    window.addEventListener('blur', () => { f.clearTarget(); this.dragging = false; });
  }

  // ---------- loops ----------

  startLoops() {
    // Fixed-step logic at 20Hz keeps the sim deterministic and cheap; the
    // canvas runs on rAF so motion stays smooth independent of that step.
    let last = performance.now();
    let acc = 0;
    const STEP = 0.05;
    setInterval(() => {
      const now = performance.now();
      const elapsed = (now - last) / 1000;
      last = now;
      // A screen freezes the sim and discards the time spent reading it, so a
      // long pause never dumps a backlog of ticks into the run on resume.
      acc = this.screenOpen ? 0 : acc + Math.min(0.5, elapsed);
      while (acc >= STEP) { this.game.tick(STEP); acc -= STEP; }
      this.renderHeader();
      this.renderSigBar();
      this.refreshPanel();
      this.tickCoach(0.05);
      this.maybeOfferWall();
    }, 50);

    const draw = (tms) => {
      this.resizeCanvas();
      this.game.field.render(this.ctx, this.canvas.width, this.canvas.height, tms / 1000);
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  resizeCanvas() {
    const r = this.playfield.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  // ---------- header ----------

  buildHeader() {
    const g = this.game, t = g.theme;
    this.header.innerHTML = `
      <div class="hud-left">
        <div class="res-row">
          <span class="res-value"></span>
          <span class="res-name">${t.resources.primary.name}</span>
        </div>
        <span class="res-rate"></span>
      </div>
      <div class="hud-right">
        <div class="hud-currencies">
          <span class="res-prestige"></span>
          <span class="res-premium"></span>
        </div>
        <div class="hud-buttons">
          <button class="btn-icon" id="btn-pause" title="Pause (Esc)">⏸</button>
          <button class="btn-icon" id="btn-mute" title="Mute"></button>
          <button class="btn-boost" id="btn-boost"></button>
        </div>
      </div>`;
    this.hdr = {
      value: this.header.querySelector('.res-value'),
      rate: this.header.querySelector('.res-rate'),
      prestige: this.header.querySelector('.res-prestige'),
      premium: this.header.querySelector('.res-premium'),
      boost: this.header.querySelector('#btn-boost'),
      mute: this.header.querySelector('#btn-mute'),
      pause: this.header.querySelector('#btn-pause'),
    };
    this.hdr.pause.onclick = () => { if (this.started && !this.screenOpen) this.showPause(); };
    this.hdr.boost.onclick = () => this.offerBoost();
    this.hdr.mute.onclick = () => {
      setMuted(!isMuted());
      g.state.settings.muted = isMuted();
      this.hdr.mute.textContent = isMuted() ? '🔇' : '🔊';
    };
    setMuted(!!g.state.settings.muted);
    this.hdr.mute.textContent = isMuted() ? '🔇' : '🔊';
  }

  renderHeader() {
    const g = this.game, t = g.theme;
    const boostLeft = Math.max(0, g.state.boostUntil - Date.now());
    this.hdr.value.textContent = fmt(g.state.primary);
    const hasCrew = Object.values(g.state.gens).some(n => n > 0);
    this.hdr.rate.textContent = hasCrew
      ? `${fmt(g.prodPerSec())}/s from crew`
      : 'Hire crew to earn while idle';
    this.hdr.prestige.textContent = `💎 ${g.state.prestige.held}`;
    this.hdr.premium.textContent = `💠 ${g.state.premium}`;
    this.hdr.boost.classList.toggle('active', boostLeft > 0);
    this.hdr.boost.textContent = boostLeft ? `⚡ ${fmtTime(boostLeft / 1000)}` : '2×';
  }

  // ---------- signature bar: health + depth ----------

  buildSigBar() {
    this.sigBar.innerHTML = `
      <div class="bar health"><div class="bar-fill"></div><span></span></div>
      <div class="depth-row">
        <div class="bar depth"><div class="bar-fill"></div><span></span></div>
        <button class="btn btn-descend" id="btn-descend"></button>
      </div>`;
    this.sig = {
      hpFill: this.sigBar.querySelector('.health .bar-fill'),
      hpText: this.sigBar.querySelector('.health span'),
      dFill: this.sigBar.querySelector('.depth .bar-fill'),
      dText: this.sigBar.querySelector('.depth span'),
      descend: this.sigBar.querySelector('#btn-descend'),
    };
    this.sig.descend.onclick = () => {
      const p = this.game.signature.panel();
      const a = p.actions.find(x => x.id === 'descend');
      if (a?.enabled) { a.onClick(); this.renderSigBar(); }
    };
  }

  renderSigBar() {
    const g = this.game;
    const hp = g.field.hp(), maxHp = g.field.maxHpValue();
    const pct = Math.max(0, Math.min(1, hp / maxHp));
    this.sig.hpFill.style.width = `${pct * 100}%`;
    this.sig.hpFill.classList.toggle('low', pct < 0.34);
    this.sig.hpText.textContent = `♥ ${Math.max(0, Math.ceil(hp))} / ${Math.round(maxHp)}`;
    const p = g.signature.panel();
    this.sig.dFill.style.width = `${p.progress * 100}%`;
    const a = p.actions.find(x => x.id === 'descend');
    // Ready: name the reward. Not ready: name what is still required.
    this.sig.dText.textContent = a.enabled ? `${p.title} — ready to descend` : `${p.title} · ${p.progressLabel}`;
    this.sig.descend.textContent = a.enabled && p.nextMultiplier ? `⬇ ${p.nextMultiplier} ore` : a.label;
    this.sig.descend.disabled = !a.enabled;
    this.sig.descend.classList.toggle('ready', a.enabled);
    this.sig.descend.title = a.enabled ? a.hint : p.progressLabel;
  }

  // ---------- panels ----------

  renderPanel() {
    for (const b of this.tabs.children) b.classList.toggle('on', b.dataset.tab === this.tab);
    sdk.clearAllBanners();
    this.panel.innerHTML = '';
    if (this.tab === 'crew') this.renderCrew();
    else if (this.tab === 'shop') this.renderShop();
    else this.renderPrestige();
    this.attachBanner();
  }

  // Menu screens carry a banner slot; the SDK fills it when present and the
  // container simply stays empty otherwise (adblock / local dev).
  attachBanner() {
    const slot = el('div', 'banner-slot');
    slot.id = `banner-${this.tab}`;
    this.panel.append(slot);
    sdk.requestBanner(slot.id, 320, 50);
  }

  refreshPanel() {
    if (this.tab === 'crew') {
      for (const row of this.panel.querySelectorAll('.gen-row')) {
        const g = this.game.theme.generators.find(x => x.id === row.dataset.gen);
        if (g) this.fillGenRow(row, g);
      }
    } else if (this.tab === 'prestige') {
      const gainEl = this.panel.querySelector('.prestige-gain');
      if (gainEl) {
        const gain = this.game.prestigeGainNow();
        gainEl.textContent = `+${gain} 💎 ${this.game.theme.resources.prestige.name}`;
        const btn = this.panel.querySelector('#btn-prestige');
        if (btn) btn.disabled = gain < 1 || !this.game.state.run.active;
      }
      for (const b of this.panel.querySelectorAll('.meta-row button')) {
        const def = this.game.metaUpgradeDefs.find(d => d.id === b.dataset.meta);
        if (def) b.disabled = !!this.game.state.metaUpgrades[def.id] || this.game.state.prestige.held < def.cost;
      }
    }
  }

  renderCrew() {
    const note = el('p', 'panel-note', 'Crew mine on their own — they are the figures working the veins on screen.');
    this.panel.append(note);
    for (const g of this.game.theme.generators) {
      const row = el('div', 'gen-row');
      row.dataset.gen = g.id;
      row.innerHTML = `
        <div class="gen-icon">${g.name.slice(0, 1)}</div>
        <div class="gen-info">
          <div class="gen-name">${g.name} <span class="gen-owned"></span></div>
          <div class="gen-prod"></div>
        </div>
        <div class="gen-buy">
          <button class="btn buy-1"></button>
          <button class="btn buy-max"></button>
        </div>`;
      row.querySelector('.buy-1').onclick = () => this.game.buyGenerator(g, 1) && this.renderHeader();
      row.querySelector('.buy-max').onclick = () => this.game.buyGenerator(g, 'max') && this.renderHeader();
      this.fillGenRow(row, g);
      this.panel.append(row);
    }
  }

  fillGenRow(row, g) {
    const game = this.game;
    const owned = game.state.gens[g.id];
    const cost1 = game.genCost(g, 1);
    const maxN = game.genMaxAffordable(g);
    row.querySelector('.gen-owned').textContent = owned ? `×${owned}` : '';
    row.querySelector('.gen-prod').textContent = owned
      ? `${fmt(g.baseProd * owned)}/s base`
      : `${fmt(g.baseProd)}/s each`;
    const b1 = row.querySelector('.buy-1');
    b1.textContent = `${fmt(cost1)}`;
    b1.disabled = !game.state.primary.gte(cost1);
    const bm = row.querySelector('.buy-max');
    bm.textContent = maxN > 1 ? `Max ×${maxN}` : 'Max';
    bm.disabled = maxN < 1;
  }

  renderShop() {
    const g = this.game, t = g.theme;
    const wrap = el('div', 'shop-wrap');
    wrap.innerHTML = `
      <div class="shop-head">
        <div class="shop-balance">💠 ${g.state.premium} ${t.resources.premium.name}</div>
        <p class="panel-note">Earned by reaching new depths. Spent to skip an ad.</p>
      </div>`;
    this.panel.append(wrap);

    const daily = el('div', 'meta-row');
    daily.innerHTML = `
      <div class="gen-info">
        <div class="gen-name">Supply Drop</div>
        <div class="gen-prod">+3 ${t.resources.premium.name}, once per session</div>
      </div>`;
    const dailyBtn = el('button', 'btn btn-ad', g.ads.dailyClaimUsedThisSession ? 'Claimed' : '📺 Claim');
    dailyBtn.disabled = g.ads.dailyClaimUsedThisSession || !g.ads.enabled('dailyFreeCurrency');
    dailyBtn.onclick = () => {
      g.ads.dailyFreeCurrency(() => {
        g.grantPremium(3);
        sfx.buy();
        this.toast(`+3 ${t.resources.premium.name}`);
        this.renderPanel();
      });
    };
    daily.append(dailyBtn);
    this.panel.append(daily);

    const boost = el('div', 'meta-row');
    boost.innerHTML = `
      <div class="gen-info">
        <div class="gen-name">Double Output</div>
        <div class="gen-prod">2× all ore for ${t.ads?.boost2xMinutes ?? 5} minutes</div>
      </div>`;
    const boostBtn = el('button', 'btn', 'Activate');
    boostBtn.onclick = () => this.offerBoost();
    boost.append(boostBtn);
    this.panel.append(boost);
  }

  renderPrestige() {
    const g = this.game, t = g.theme;
    const wrap = el('div', 'prestige-wrap');
    wrap.innerHTML = `
      <div class="prestige-card">
        <div class="prestige-label">Cash out this expedition</div>
        <div class="prestige-gain"></div>
        <p class="prestige-hint">Ends the run. ${t.resources.primary.name} and crew reset; ${t.resources.prestige.name} are forever, +${t.economy.prestigePerLevelBonusPct}% output each.</p>
        <button class="btn btn-big" id="btn-prestige">💎 Cash out &amp; dig again</button>
      </div>
      <h3 class="meta-head">Permanent upgrades</h3>`;
    wrap.querySelector('#btn-prestige').onclick = () => {
      const summary = g.endRun('voluntary');
      if (summary) this.showRunSummary(summary);
    };
    this.panel.append(wrap);
    for (const def of g.metaUpgradeDefs) {
      const owned = !!g.state.metaUpgrades[def.id];
      const row = el('div', 'meta-row');
      row.innerHTML = `
        <div class="gen-info">
          <div class="gen-name">${def.name} ${owned ? '✅' : ''}</div>
          <div class="gen-prod">${def.desc}</div>
        </div>
        <button class="btn" data-meta="${def.id}">${owned ? 'Owned' : `💎 ${def.cost}`}</button>`;
      const btn = row.querySelector('button');
      btn.disabled = owned || g.state.prestige.held < def.cost;
      btn.onclick = () => { if (g.buyMetaUpgrade(def.id)) this.renderPanel(); };
      this.panel.append(row);
    }
  }

  // ---------- ad offers (every one has a non-ad path, per spec Part E) ----------

  offerBoost() {
    const g = this.game;
    if (Date.now() < g.state.boostUntil) return;
    this.choiceModal({
      title: '⚡ Double Output',
      body: `2× all ore for ${g.theme.ads?.boost2xMinutes ?? 5} minutes.`,
      adLabel: '📺 Watch to activate',
      onAd: () => g.ads.boost2x(() => { g.applyBoost2x(); this.toast('2× output active'); }),
      altLabel: `💠 ${BOOST_CRYSTAL_COST}`,
      altEnabled: g.state.premium >= BOOST_CRYSTAL_COST,
      onAlt: () => { g.state.premium -= BOOST_CRYSTAL_COST; g.applyBoost2x(); this.toast('2× output active'); },
    });
  }

  choiceModal({ title, body, adLabel, onAd, altLabel, altEnabled, onAlt, dismissLabel = 'Not now', onDismiss }) {
    const m = this.modal('choice');
    m.append(el('h2', null, title));
    if (body) m.append(el('p', null, body));
    const ad = el('button', 'btn btn-ad btn-big', adLabel);
    ad.onclick = () => { this.closeModal(); onAd(); };
    m.append(ad);
    if (altLabel) {
      const alt = el('button', 'btn', altLabel);
      alt.disabled = !altEnabled;
      alt.onclick = () => { this.closeModal(); onAlt(); };
      m.append(alt);
    }
    const no = el('button', 'btn btn-quiet', dismissLabel);
    no.onclick = () => { this.closeModal(); onDismiss?.(); };
    m.append(no);
  }

  // ---------- level up ----------

  showLevelUp(choices, wasReroll) {
    const g = this.game;
    sfx.levelUp();
    const m = this.modal('level-up');
    m.append(el('h2', null, `Level ${g.state.run.level + 1}`));
    m.append(el('p', null, 'Pick one. It lasts this run only.'));
    const cards = el('div', 'choice-cards');
    for (const c of choices) {
      const card = el('button', `choice ${c.rare ? 'rare' : ''}`);
      card.append(el('div', 'choice-name', c.name), el('div', 'choice-desc', c.desc));
      card.onclick = () => { this.closeModal(); g.run.choose(c, wasReroll); sfx.buy(); };
      cards.append(card);
    }
    m.append(cards);
    if (!wasReroll && g.ads.enabled('rerollUpgrade')) {
      const row = el('div', 'modal-row');
      const rb = el('button', 'btn btn-ad', '📺 Reroll');
      rb.onclick = () => g.ads.rerollUpgrade(() => g.run.reroll());
      const cb = el('button', 'btn', `💠 ${REROLL_CRYSTAL_COST} Reroll`);
      cb.disabled = g.state.premium < REROLL_CRYSTAL_COST;
      cb.onclick = () => { g.state.premium -= REROLL_CRYSTAL_COST; g.run.reroll(); };
      row.append(rb, cb);
      m.append(row);
    }
  }

  // ---------- death / revive ----------

  onDying() {
    const g = this.game;
    sfx.hurt();
    if (!g.ads.canRevive() && g.state.premium < REVIVE_CRYSTAL_COST) {
      this.onDeath(g.endRun('death'));
      return;
    }
    const m = this.modal('revive');
    m.append(el('h2', null, '💀 You went down'));
    m.append(el('p', null, `Depth ${g.signature.band + 1} · ${fmtTime(g.state.run.seconds)} in`));
    const count = el('div', 'revive-count', '5');
    m.append(count);
    let left = 5;
    const timer = setInterval(() => {
      left -= 1;
      count.textContent = String(left);
      if (left <= 0) decline();
    }, 1000);
    const decline = () => {
      clearInterval(timer);
      this.closeModal();
      this.onDeath(g.endRun('death'));
    };
    if (g.ads.canRevive()) {
      const rb = el('button', 'btn btn-ad btn-big', '📺 Get back up');
      rb.onclick = () => {
        clearInterval(timer);
        this.closeModal();
        g.ads.revive(() => { g.revive(); this.toast('Back on your feet'); });
      };
      m.append(rb);
    }
    const cb = el('button', 'btn', `💠 ${REVIVE_CRYSTAL_COST} Get back up`);
    cb.disabled = g.state.premium < REVIVE_CRYSTAL_COST;
    cb.onclick = () => {
      clearInterval(timer);
      this.closeModal();
      g.state.premium -= REVIVE_CRYSTAL_COST;
      g.revive();
      this.toast('Back on your feet');
    };
    m.append(cb);
    const db = el('button', 'btn btn-quiet', 'End the run');
    db.onclick = decline;
    m.append(db);
  }

  onDeath(summary) { if (summary) this.showRunSummary(summary); }

  showRunSummary(summary) {
    const g = this.game, t = g.theme;
    g.paused = false;
    // Reaching a new deepest band is the non-ad source of premium currency.
    let crystals = 0;
    if (summary.depth - 1 > (g.state.stats.bestDepthBanked ?? 0)) {
      crystals = (summary.depth - 1) - (g.state.stats.bestDepthBanked ?? 0);
      g.state.stats.bestDepthBanked = summary.depth - 1;
      g.grantPremium(crystals);
    }
    const m = this.modal('summary');
    m.append(
      el('h2', null, summary.reason === 'death' ? '💀 The deep took you' : '🏁 Expedition banked'),
      el('div', 'summary-stats', ''),
    );
    const stats = m.querySelector('.summary-stats');
    for (const [k, v] of [
      ['Time', fmtTime(summary.runSeconds)],
      ['Depth', `${summary.depth}`],
      ['Level', `${summary.level}`],
      ['Cleared', `${summary.kills}`],
    ]) {
      const cell = el('div', 'summary-cell');
      cell.append(el('div', 'summary-k', k), el('div', 'summary-v', v));
      stats.append(cell);
    }
    m.append(el('p', 'summary-gain', `+${summary.gain} 💎 ${t.resources.prestige.name}`));
    if (crystals > 0) m.append(el('p', 'summary-bonus', `New depth record · +${crystals} 💠 ${t.resources.premium.name}`));
    const btn = el('button', 'btn btn-big', '⛏ Dig again — stronger');
    btn.onclick = () => {
      this.closeModal();
      g.ads.runEndInterstitial(() => {
        g.startRun();
        this.renderPanel();
        this.renderSigBar();
      });
    };
    m.append(btn);
    const spend = el('button', 'btn btn-quiet', '💎 Spend gems first');
    spend.onclick = () => { this.closeModal(); this.tab = 'prestige'; this.renderPanel(); };
    m.append(spend);
  }

  // ---------- offline ----------

  showOfflineClaim(offer, then) {
    const g = this.game, t = g.theme;
    const done = () => { this.closeModal(); then?.(); };
    const m = this.modal('offline');
    m.append(
      el('h2', null, '⛏ The crew kept working'),
      el('p', null, `${fmtTime(offer.seconds)} away`),
      el('p', 'summary-gain', `+${fmt(offer.amount)} ${t.resources.primary.name}`),
    );
    if (g.ads.enabled('offlineDoubler')) {
      const dbl = el('button', 'btn btn-ad btn-big', `📺 Take ${fmt(offer.amount.mulNum(2))} (2×)`);
      dbl.onclick = () => { done(); g.ads.offlineDoubler(() => g.claimOffline(offer, true)); };
      m.append(dbl);
    }
    const claim = el('button', 'btn', `Take ${fmt(offer.amount)}`);
    claim.onclick = () => { done(); g.claimOffline(offer, false); };
    m.append(claim);
  }

  // ---------- wall offer ----------

  maybeOfferWall() {
    const g = this.game;
    if (!g.state.run.active || this.wallBanner || this.modalOpen) return;
    if (!g.ads.enabled('skipWall')) return;
    if (!g.run.checkWall()) return;
    const grant = g.prodPerSec().mulNum(90);
    if (grant.isZero()) return;
    const b = el('div', 'wall-banner');
    b.append(el('span', null, 'Stuck for ore?'));
    const dismiss = () => { b.remove(); this.wallBanner = null; };
    const ad = el('button', 'btn btn-ad', `📺 +${fmt(grant)}`);
    ad.onclick = () => { g.ads.skipWall(() => { g.earn(grant); this.toast(`+${fmt(grant)}`); }); dismiss(); };
    const alt = el('button', 'btn', `💠 ${SKIP_CRYSTAL_COST}`);
    alt.disabled = g.state.premium < SKIP_CRYSTAL_COST;
    alt.onclick = () => { g.state.premium -= SKIP_CRYSTAL_COST; g.earn(grant); this.toast(`+${fmt(grant)}`); dismiss(); };
    const x = el('button', 'btn-x', '✕');
    x.onclick = dismiss;
    b.append(ad, alt, x);
    this.root.append(b);
    this.wallBanner = b;
    setTimeout(dismiss, 20000);
  }

  // ---------- hint / modal / toast ----------

  // The coach teaches one thing at a time and advances only when the player
  // has actually done it. A single hint that vanishes on first touch left
  // people staring at a screen they could not read.
  coachSteps() {
    const t = this.game.theme;
    return [
      { id: 'mine', text: `Walk onto a glowing vein — you swing automatically`,
        done: (g) => g.state.prestige.lifetime.gt(5) },
      { id: 'hire', text: `${fmt(this.game.state.primary)} ${t.resources.primary.name} — hire a ${t.generators[0].name} from the Crew list`,
        done: (g) => Object.values(g.state.gens).some(n => n > 0) },
      { id: 'crew', text: 'Blue crew mine for you — even while you are away',
        hold: 7 },
      { id: 'descend', text: 'Fill the Depth bar, then Descend: richer ore, but you will not be alone',
        done: (g) => g.signature.band > 0 },
    ];
  }

  startCoach() {
    const g = this.game;
    // Returning players already know this; never replay it.
    if (g.state.stats.runs > 0 || g.state.prestige.lifetime.gt(200)) return;
    this.coachIndex = 0;
    this.coachHeld = 0;
    this.coachEl = el('div', 'coach');
    this.playfield.append(this.coachEl);
    this.renderCoach();
  }

  renderCoach() {
    if (!this.coachEl) return;
    const steps = this.coachSteps();
    const step = steps[this.coachIndex];
    if (!step) { this.endCoach(); return; }
    this.coachEl.textContent = step.text;
    this.coachEl.dataset.step = step.id;
  }

  tickCoach(dt) {
    if (!this.coachEl) return;
    const steps = this.coachSteps();
    const step = steps[this.coachIndex];
    if (!step) { this.endCoach(); return; }
    this.coachHeld += dt;
    const satisfied = step.hold ? this.coachHeld >= step.hold : step.done(this.game);
    if (satisfied) {
      this.coachIndex += 1;
      this.coachHeld = 0;
      if (this.coachIndex >= steps.length) { this.endCoach(); return; }
      this.coachEl.classList.remove('pop');
      void this.coachEl.offsetWidth; // restart the attention animation
      this.coachEl.classList.add('pop');
      this.renderCoach();
    } else if (step.id === 'hire') {
      this.renderCoach(); // keep the live ore count in the prompt
    }
  }

  endCoach() {
    if (!this.coachEl) return;
    this.coachEl.remove();
    this.coachEl = null;
    track('tutorial_complete');
  }

  modal(kind) {
    this.modalHost.innerHTML = '';
    this.modalOpen = true;
    const back = el('div', 'modal-back');
    const box = el('div', `modal ${kind}`);
    back.append(box);
    this.modalHost.append(back);
    return box;
  }

  closeModal() {
    this.modalHost.innerHTML = '';
    this.modalOpen = false;
  }

  toast(msg) {
    const n = el('div', 'toast', msg);
    this.toastHost.append(n);
    setTimeout(() => n.classList.add('out'), 2000);
    setTimeout(() => n.remove(), 2600);
  }
}
