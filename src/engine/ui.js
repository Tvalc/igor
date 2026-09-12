// DOM/CSS UI + canvas-2D playfield (spec Part L: no WebGL anywhere).
// All menus (generators, prestige tree, modals) are DOM so they render fast on
// low-end devices and stay outside the game loop; the canvas draws only the
// animated playfield via the signature module.
import { fmt, fmtTime } from './format.js';
import { track } from './analytics.js';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.tab = 'mine';
    this.particles = [];
    this.tapCount = 0;
    this.tutorialStep = this.game.state.stats.runs > 0 || this.game.state.gens[game.theme.generators[0].id] > 0 ? 2 : 0;
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
      this.sigPanel = el('div', 'sig-panel'),
      this.tabs = el('nav', 'tabs'),
      this.panel = el('main', 'panel'),
      this.modalHost = el('div', 'modal-host'),
      this.toastHost = el('div', 'toast-host'),
    );

    this.canvas = el('canvas', 'field-canvas');
    this.playfield.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.playfield.addEventListener('pointerdown', (e) => this.onTap(e));

    for (const [id, label] of [['mine', '⛏ Mine'], ['prestige', '💎 Prestige']]) {
      const b = el('button', 'tab-btn', label);
      b.dataset.tab = id;
      b.addEventListener('click', () => { this.tab = id; this.renderPanel(); });
      this.tabs.append(b);
    }

    document.addEventListener('contextmenu', (e) => e.preventDefault()); // CrazyGames requirement
    this.renderHeader();
    this.renderPanel();
    if (this.tutorialStep < 2) this.showTutorial();
  }

  // ---------- loops ----------

  startLoops() {
    // Logic + DOM refresh at 10 Hz; canvas at rAF (auto-throttled by browser)
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      this.game.tick(dt);
      this.renderHeader();
      this.renderSigPanel();
      this.refreshPanel();
      this.maybeOfferWall();
    }, 100);

    const draw = (tms) => {
      this.resizeCanvas();
      const { ctx, canvas } = this;
      const w = canvas.width, h = canvas.height;
      this.game.signature.render?.(ctx, w, h, tms / 1000);
      this.drawParticles(ctx, tms / 1000);
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

  // ---------- header (built once; updated in place so buttons never get
  // swapped out from under a mid-press finger) ----------

  buildHeader() {
    const g = this.game, t = g.theme;
    this.header.innerHTML = `
      <div class="res-primary">
        <span class="res-name">${t.resources.primary.name}</span>
        <span class="res-value"></span>
        <span class="res-rate"></span>
      </div>
      <div class="res-side">
        <span class="res-prestige"></span>
        <button class="btn-boost" id="btn-boost"></button>
      </div>`;
    this.hdr = {
      value: this.header.querySelector('.res-value'),
      rate: this.header.querySelector('.res-rate'),
      prestige: this.header.querySelector('.res-prestige'),
      boost: this.header.querySelector('#btn-boost'),
    };
    this.hdr.boost.onclick = () => {
      if (Date.now() < g.state.boostUntil) return;
      g.ads.boost2x(() => { g.applyBoost2x(); this.toast('2× production active!'); });
    };
  }

  renderHeader() {
    if (!this.hdr) this.buildHeader();
    const g = this.game, t = g.theme;
    const boostLeft = Math.max(0, g.state.boostUntil - Date.now());
    this.hdr.value.textContent = fmt(g.state.primary);
    this.hdr.rate.textContent = `${fmt(g.prodPerSec())}/s`;
    this.hdr.prestige.textContent = `💎 ${g.state.prestige.held} ${t.resources.prestige.name}`;
    this.hdr.boost.classList.toggle('active', boostLeft > 0);
    this.hdr.boost.textContent = boostLeft ? `⚡ 2× ${fmtTime(boostLeft / 1000)}` : '📺 2× boost';
  }

  // ---------- signature panel (same build-once pattern; action buttons are
  // persistent slots keyed by action id) ----------

  buildSigPanel(p) {
    this.sigPanel.innerHTML = `
      <div class="sig-title"></div>
      <div class="bar stability"><div class="bar-fill"></div><span></span></div>
      <div class="bar descend"><div class="bar-fill"></div><span></span></div>
      <div class="sig-actions"></div>`;
    const host = this.sigPanel.querySelector('.sig-actions');
    this.sig = {
      title: this.sigPanel.querySelector('.sig-title'),
      stabFill: this.sigPanel.querySelector('.stability .bar-fill'),
      stabText: this.sigPanel.querySelector('.stability span'),
      descFill: this.sigPanel.querySelector('.descend .bar-fill'),
      descText: this.sigPanel.querySelector('.descend span'),
      buttons: {},
    };
    for (const a of p.actions) {
      const b = el('button', 'btn sig-btn');
      b.onclick = () => this.sigActionById[a.id]?.onClick();
      host.append(b);
      this.sig.buttons[a.id] = b;
    }
  }

  renderSigPanel() {
    const p = this.game.signature.panel?.();
    if (!p) { this.sigPanel.hidden = true; return; }
    this.sigPanel.hidden = false;
    if (!this.sig) this.buildSigPanel(p);
    this.sigActionById = Object.fromEntries(p.actions.map(a => [a.id, a]));
    this.sig.title.textContent = p.title;
    this.sig.stabFill.style.width = `${p.stability}%`;
    this.sig.stabText.textContent = `Stability ${Math.round(p.stability)}%`;
    this.sig.descFill.style.width = `${p.descendProgress * 100}%`;
    this.sig.descText.textContent = p.descendLabel;
    for (const a of p.actions) {
      const b = this.sig.buttons[a.id];
      if (!b) continue;
      b.textContent = a.label;
      b.disabled = !a.enabled;
    }
  }

  // ---------- panels ----------

  renderPanel() {
    for (const b of this.tabs.children) b.classList.toggle('on', b.dataset.tab === this.tab);
    this.panel.innerHTML = '';
    if (this.tab === 'mine') this.renderGenerators();
    else this.renderPrestige();
  }

  refreshPanel() {
    // cheap in-place refresh of dynamic bits (costs/affordability) at 10 Hz
    if (this.tab === 'mine') {
      for (const row of this.panel.querySelectorAll('.gen-row')) {
        const g = this.game.theme.generators.find(x => x.id === row.dataset.gen);
        this.fillGenRow(row, g);
      }
    } else {
      const gainEl = this.panel.querySelector('.prestige-gain');
      if (gainEl) {
        const gain = this.game.prestigeGainNow();
        gainEl.textContent = `Cash out now for +${gain} ${this.game.theme.resources.prestige.name}`;
        const btn = this.panel.querySelector('#btn-prestige');
        if (btn) btn.disabled = gain < 1 || !this.game.state.run.active;
      }
      for (const b of this.panel.querySelectorAll('.meta-row button')) {
        const def = this.game.metaUpgradeDefs.find(d => d.id === b.dataset.meta);
        if (def) b.disabled = !!this.game.state.metaUpgrades[def.id] || this.game.state.prestige.held < def.cost;
      }
    }
  }

  renderGenerators() {
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
      row.querySelector('.buy-1').onclick = () => { if (this.game.buyGenerator(g, 1)) this.afterBuy(); };
      row.querySelector('.buy-max').onclick = () => { if (this.game.buyGenerator(g, 'max')) this.afterBuy(); };
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
    b1.textContent = `Buy 1 — ${fmt(cost1)}`;
    b1.disabled = !game.state.primary.gte(cost1);
    const bm = row.querySelector('.buy-max');
    bm.textContent = maxN > 1 ? `Max ×${maxN} — ${fmt(game.genCost(g, maxN))}` : 'Max';
    bm.disabled = maxN < 1;
  }

  afterBuy() {
    this.renderHeader();
    if (this.tutorialStep === 1) this.advanceTutorial();
  }

  renderPrestige() {
    const g = this.game, t = g.theme;
    const wrap = el('div', 'prestige-wrap');
    wrap.innerHTML = `
      <div class="prestige-card">
        <div class="prestige-gain"></div>
        <p class="prestige-hint">Ends the run: ${t.resources.primary.name} and gear reset, ${t.resources.prestige.name} are forever (+${t.economy.prestigePerLevelBonusPct}% production each).</p>
        <button class="btn btn-big" id="btn-prestige">💎 Cash out & restart</button>
      </div>
      <h3 class="meta-head">Permanent upgrades</h3>`;
    wrap.querySelector('#btn-prestige').onclick = () => {
      const summary = g.endRun('voluntary');
      if (summary) this.showRunSummary(summary);
    };
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
      wrap.append(row);
    }
    this.panel.append(wrap);
  }

  // ---------- tap ----------

  onTap(e) {
    const gain = this.game.tap();
    if (gain.isZero()) return;
    const r = this.playfield.getBoundingClientRect();
    this.particles.push({ x: e.clientX - r.left, y: e.clientY - r.top, t0: performance.now() / 1000, text: `+${fmt(gain)}` });
    if (this.particles.length > 24) this.particles.shift();
    this.tapCount += 1;
    if (this.tutorialStep === 0 && this.tapCount >= 3) this.advanceTutorial();
  }

  drawParticles(ctx, t) {
    this.particles = this.particles.filter(p => t - p.t0 < 1);
    ctx.textAlign = 'center';
    ctx.font = '700 16px system-ui, sans-serif';
    for (const p of this.particles) {
      const age = t - p.t0;
      ctx.fillStyle = `rgba(255, 210, 74, ${(1 - age).toFixed(2)})`;
      ctx.fillText(p.text, p.x, p.y - age * 48);
    }
  }

  // ---------- tutorial (2 steps, ≤15s) ----------

  showTutorial() {
    this.tutorialEl = el('div', 'tutorial', this.tutorialStep === 0
      ? `👆 Tap the shaft to mine ${this.game.theme.resources.primary.name}!`
      : `Buy your first ${this.game.theme.generators[0].name} below ⬇`);
    this.root.append(this.tutorialEl);
  }

  advanceTutorial() {
    this.tutorialStep += 1;
    this.tutorialEl?.remove();
    if (this.tutorialStep === 1) this.showTutorial();
    else track('tutorial_complete');
  }

  // ---------- level up ----------

  showLevelUp(choices, wasReroll) {
    const g = this.game;
    const m = this.modal('level-up');
    m.append(el('h2', null, `Level ${g.state.run.level + 1}! Pick one:`));
    const cards = el('div', 'choice-cards');
    for (const c of choices) {
      const card = el('button', `choice ${c.rare ? 'rare' : ''}`);
      card.append(el('div', 'choice-name', c.name), el('div', 'choice-desc', c.desc));
      card.onclick = () => { this.closeModal(); g.run.choose(c, wasReroll); };
      cards.append(card);
    }
    m.append(cards);
    if (g.ads.enabled('rerollUpgrade') && !wasReroll) {
      const rb = el('button', 'btn btn-ad', '📺 Reroll choices');
      rb.onclick = () => g.ads.rerollUpgrade(() => g.run.reroll());
      m.append(rb);
    }
  }

  // ---------- death / revive / summary ----------

  onDying() {
    const g = this.game;
    if (!g.ads.canRevive()) { this.onDeath(g.endRun('death')); return; }
    const m = this.modal('revive');
    m.append(el('h2', null, '💥 Cave-in!'));
    const count = el('div', 'revive-count', '5');
    m.append(count);
    let left = 5;
    const timer = setInterval(() => {
      left -= 1;
      count.textContent = String(left);
      if (left <= 0) { clearInterval(timer); decline(); }
    }, 1000);
    const decline = () => {
      clearInterval(timer);
      this.closeModal();
      this.onDeath(g.endRun('death'));
    };
    const rb = el('button', 'btn btn-ad btn-big', '📺 Shore up & keep digging');
    rb.onclick = () => {
      clearInterval(timer);
      this.closeModal();
      g.ads.revive(() => { g.revive(); g.paused = false; this.toast('Back in action!'); });
    };
    const db = el('button', 'btn', 'Accept fate');
    db.onclick = decline;
    m.append(rb, db);
  }

  onDeath(summary) { if (summary) this.showRunSummary(summary); }

  showRunSummary(summary) {
    const g = this.game, t = g.theme;
    g.paused = false;
    const m = this.modal('summary');
    m.append(
      el('h2', null, summary.reason === 'death' ? '💥 The mine claimed you' : '🏁 Expedition complete'),
      el('p', null, `Run: ${fmtTime(summary.runSeconds)} · Level ${summary.level}`),
      el('p', null, `Lifetime ${t.resources.primary.name}: ${fmt(summary.lifetime)}`),
      el('p', 'summary-gain', `+${summary.gain} 💎 ${t.resources.prestige.name}`),
    );
    const btn = el('button', 'btn btn-big', '⛏ Dig again — stronger');
    btn.onclick = () => {
      this.closeModal();
      g.ads.runEndInterstitial(() => {
        g.startRun();
        this.renderPanel();
      });
    };
    m.append(btn);
  }

  // ---------- offline ----------

  showOfflineClaim(offer) {
    const g = this.game, t = g.theme;
    const m = this.modal('offline');
    m.append(
      el('h2', null, '⛏ While you were away…'),
      el('p', null, `Your crew mined for ${fmtTime(offer.seconds)}:`),
      el('p', 'summary-gain', `+${fmt(offer.amount)} ${t.resources.primary.name}`),
    );
    const claim = el('button', 'btn', `Claim ${fmt(offer.amount)}`);
    claim.onclick = () => { this.closeModal(); g.claimOffline(offer, false); };
    m.append(claim);
    if (g.ads.enabled('offlineDoubler')) {
      const dbl = el('button', 'btn btn-ad btn-big', `📺 Claim ${fmt(offer.amount.mulNum(2))} (2×)`);
      dbl.onclick = () => {
        this.closeModal();
        g.ads.offlineDoubler(() => g.claimOffline(offer, true));
      };
      m.append(dbl);
    }
  }

  // ---------- wall / skip offer ----------

  maybeOfferWall() {
    const g = this.game;
    if (!g.state.run.active || this.wallBanner || this.modalOpen) return;
    if (!g.run.checkWall()) return;
    if (!g.ads.enabled('skipWall')) return;
    const grant = g.prodPerSec().mulNum(90);
    if (grant.isZero()) return;
    const b = el('div', 'wall-banner');
    b.append(el('span', null, 'Progress slowing?'));
    const ad = el('button', 'btn btn-ad', `📺 +${fmt(grant)} instantly`);
    ad.onclick = () => {
      g.ads.skipWall(() => { g.earn(grant); this.toast(`+${fmt(grant)}!`); });
      dismiss();
    };
    const x = el('button', 'btn-x', '✕');
    const dismiss = () => { b.remove(); this.wallBanner = null; };
    x.onclick = dismiss;
    b.append(ad, x);
    this.root.append(b);
    this.wallBanner = b;
    setTimeout(dismiss, 20000);
  }

  // ---------- modal / toast plumbing ----------

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
    setTimeout(() => n.classList.add('out'), 2200);
    setTimeout(() => n.remove(), 2800);
  }
}
