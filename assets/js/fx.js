// ============================================================
// HSGfx - celebration effects + animated end-of-session summary.
// Self-contained: injects its own CSS. No external assets.
// API:
//   HSGfx.confetti({count, big})
//   HSGfx.flash(color)
//   HSGfx.shake()
//   HSGfx.milestone(streak)   // celebrates only on multiples of 5; returns true if it fired
//   HSGfx.showSummary({title, correct, total, best, onPlayAgain, allGamesHref})
// ============================================================
(function () {
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#C4A040', '#E8D08A', '#2A5C3F', '#8B2020', '#1A5C6B', '#4A2C6B'];

  // ---- injected styles ----
  const style = document.createElement('style');
  style.textContent = `
    .hsg-fx-layer{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:9000;}
    .hsg-confetti{position:absolute;top:-5vh;width:10px;height:14px;border-radius:2px;opacity:0.95;
      animation:hsgFall linear forwards;}
    @keyframes hsgFall{to{transform:translateY(112vh) rotate(var(--spin));opacity:0.9;}}
    .hsg-flash{position:fixed;inset:0;z-index:8900;pointer-events:none;opacity:0;
      animation:hsgFlash .5s ease-out forwards;}
    @keyframes hsgFlash{0%{opacity:.55;}100%{opacity:0;}}
    @keyframes hsgShake{0%,100%{transform:translate(0,0);}20%{transform:translate(-6px,3px);}
      40%{transform:translate(6px,-3px);}60%{transform:translate(-4px,2px);}80%{transform:translate(4px,-2px);}}
    .hsg-shaking{animation:hsgShake .45s ease;}
    .hsg-banner{position:fixed;left:50%;top:38%;z-index:9100;
      pointer-events:none;text-align:center;}
    .hsg-banner-inner{display:inline-block;font-family:var(--font-serif,serif);font-weight:700;
      color:#fff;padding:.5rem 1.5rem;border-radius:99px;white-space:nowrap;
      text-shadow:0 2px 10px rgba(0,0,0,.25);animation:hsgBanner 1.6s cubic-bezier(.2,1.3,.4,1) forwards;}
    @keyframes hsgBanner{
      0%{opacity:0;transform:translate(-50%,-50%) scale(.4);}
      15%{opacity:1;transform:translate(-50%,-50%) scale(1.1);}
      30%{transform:translate(-50%,-50%) scale(1);}
      75%{opacity:1;transform:translate(-50%,-150%) scale(1);}
      100%{opacity:0;transform:translate(-50%,-260%) scale(.9);}}

    .hsg-summary{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;
      background:rgba(26,23,20,.55);backdrop-filter:blur(3px);padding:1.25rem;
      animation:hsgFade .35s ease;}
    @keyframes hsgFade{from{opacity:0;}to{opacity:1;}}
    .hsg-summary-card{background:var(--cream,#F7F3EC);border:2px solid var(--border,#D4C9B5);
      border-radius:18px;max-width:420px;width:100%;padding:1.75rem 1.5rem 1.5rem;text-align:center;
      box-shadow:0 18px 60px rgba(26,23,20,.35);animation:hsgPopCard .45s cubic-bezier(.2,1.2,.4,1);}
    @keyframes hsgPopCard{from{opacity:0;transform:translateY(18px) scale(.92);}to{opacity:1;transform:none;}}
    .hsg-summary-title{font-family:var(--font-sans,sans-serif);font-size:.8rem;font-weight:700;
      letter-spacing:.12em;text-transform:uppercase;color:var(--ink-light,#4A453F);margin:0 0 .35rem;}
    .hsg-grade{font-family:var(--font-serif,serif);font-weight:700;line-height:1;
      font-size:5.5rem;margin:.2rem 0;display:inline-block;animation:hsgGradePop .6s cubic-bezier(.2,1.5,.4,1) .15s both;}
    @keyframes hsgGradePop{0%{opacity:0;transform:scale(.2) rotate(-12deg);}
      70%{transform:scale(1.15) rotate(4deg);}100%{opacity:1;transform:scale(1) rotate(0);}}
    .hsg-grade-msg{font-family:var(--font-serif,serif);font-size:1.5rem;font-weight:600;
      color:var(--ink,#1A1714);margin:.1rem 0 1.1rem;}
    .hsg-stats{display:flex;gap:.6rem;justify-content:center;margin-bottom:1.35rem;}
    .hsg-stat{flex:1;background:#fff;border:1.5px solid var(--border,#D4C9B5);border-radius:12px;
      padding:.7rem .4rem;}
    .hsg-stat-num{font-family:var(--font-serif,serif);font-size:1.9rem;font-weight:700;line-height:1;
      color:var(--ink,#1A1714);}
    .hsg-stat-num.best{color:var(--gold,#C4A040);}
    .hsg-stat-label{font-family:var(--font-sans,sans-serif);font-size:.66rem;font-weight:700;
      letter-spacing:.06em;text-transform:uppercase;color:var(--ink-light,#4A453F);margin-top:.3rem;}
    .hsg-summary-actions{display:flex;flex-direction:column;gap:.6rem;}
    .hsg-btn-primary{background:var(--gold,#C4A040);color:var(--ink,#1A1714);border:none;border-radius:12px;
      padding:.95rem;font-size:1.05rem;font-weight:700;font-family:var(--font-sans,sans-serif);cursor:pointer;
      transition:background .15s,transform .1s;}
    .hsg-btn-primary:hover{background:#b08e30;transform:translateY(-1px);}
    .hsg-btn-link{background:none;border:none;color:var(--ink-light,#4A453F);font-size:.9rem;cursor:pointer;
      font-family:var(--font-sans,sans-serif);text-decoration:underline;padding:.3rem;}
    .hsg-btn-link:hover{color:var(--ink,#1A1714);}
  `;
  (document.head || document.documentElement).appendChild(style);

  let layer = null;
  function fxLayer() {
    if (!layer) { layer = document.createElement('div'); layer.className = 'hsg-fx-layer'; document.body.appendChild(layer); }
    return layer;
  }

  function confetti(opts = {}) {
    if (REDUCED) return;
    const count = opts.count || 50;
    const big = !!opts.big;
    const L = fxLayer();
    for (let i = 0; i < count; i++) {
      const c = document.createElement('div');
      c.className = 'hsg-confetti';
      const size = (big ? 9 : 6) + Math.floor(seeded(i) * 9);
      c.style.left = (seeded(i + 7) * 100) + 'vw';
      c.style.width = size + 'px';
      c.style.height = (size + 4) + 'px';
      c.style.background = COLORS[i % COLORS.length];
      c.style.setProperty('--spin', (540 + Math.floor(seeded(i + 3) * 540)) + 'deg');
      const dur = 1.4 + seeded(i + 11) * 1.6;
      c.style.animationDuration = dur + 's';
      c.style.animationDelay = (seeded(i + 5) * 0.3) + 's';
      L.appendChild(c);
      setTimeout(() => c.remove(), (dur + 0.4) * 1000);
    }
  }
  // deterministic-ish jitter (Math.random is fine here, but keep variety without it being gating)
  function seeded(n) { return ((Math.sin(n * 999.7) * 43758.5) % 1 + 1) % 1 * 0.5 + Math.random() * 0.5; }

  function flash(color) {
    if (REDUCED) return;
    const f = document.createElement('div');
    f.className = 'hsg-flash';
    f.style.background = color || 'rgba(196,160,64,.5)';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 600);
  }

  function shake() {
    if (REDUCED) return;
    const main = document.querySelector('.game-main') || document.body;
    main.classList.remove('hsg-shaking');
    void main.offsetWidth; // reflow to restart
    main.classList.add('hsg-shaking');
    setTimeout(() => main.classList.remove('hsg-shaking'), 500);
  }

  function banner(text, color) {
    const b = document.createElement('div');
    b.className = 'hsg-banner';
    const inner = document.createElement('div');
    inner.className = 'hsg-banner-inner';
    inner.style.background = color;
    inner.style.fontSize = 'clamp(1.6rem, 7vw, 2.8rem)';
    inner.textContent = text;
    b.appendChild(inner);
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1700);
  }

  // Celebrate streak milestones (every 5). Escalates with size.
  function milestone(streak) {
    if (!streak || streak % 5 !== 0) return false;
    const tier = streak / 5; // 1,2,3,...
    const labels = ['', `${streak} IN A ROW!`, `${streak} STREAK! 🔥`, `UNSTOPPABLE · ${streak}! 🔥`, `LEGENDARY · ${streak}! 🏆`];
    const colors = ['', '#2A5C3F', '#C4A040', '#8B2020', '#4A2C6B'];
    const idx = Math.min(tier, 4);
    banner(labels[idx], colors[idx]);
    confetti({ count: 30 + tier * 25, big: tier >= 2 });
    if (tier >= 2) flash('rgba(196,160,64,.45)');
    if (tier >= 2) shake();
    return true;
  }

  // ---- grades ----
  function gradeFor(pct) {
    if (pct >= 95) return { g: 'A+', msg: 'Outstanding!', win: true, color: '#2A5C3F' };
    if (pct >= 90) return { g: 'A',  msg: 'Excellent!',  win: true, color: '#2A5C3F' };
    if (pct >= 80) return { g: 'B',  msg: 'Great job!',  win: true, color: '#2A5C3F' };
    if (pct >= 70) return { g: 'C',  msg: 'Nice work!',  win: true, color: '#C4A040' };
    if (pct >= 60) return { g: 'D',  msg: 'Keep going!', win: false, color: '#C4A040' };
    return { g: 'F', msg: 'Try again!', win: false, color: '#8B2020' };
  }

  function countUp(el, to, dur) {
    if (REDUCED || to === 0) { el.textContent = to; return; }
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function showSummary({ title = 'Round complete', correct = 0, total = 0, best = 0, onPlayAgain, allGamesHref = '../../index.html', extraHTML = '', onMount, stats }) {
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const grade = gradeFor(pct);
    // Callers may pass their own stat tiles; otherwise fall back to the default three.
    const statsHTML = (stats && stats.length)
      ? stats.map(s => `<div class="hsg-stat"><div class="hsg-stat-num${s.cls ? ' ' + s.cls : ''}" data-num="${s.num}">0</div><div class="hsg-stat-label">${s.label}</div></div>`).join('')
      : `<div class="hsg-stat"><div class="hsg-stat-num" data-num="${pct}">0</div><div class="hsg-stat-label">% Score</div></div>
          <div class="hsg-stat"><div class="hsg-stat-num" data-num="${correct}">0</div><div class="hsg-stat-label">Correct</div></div>
          <div class="hsg-stat"><div class="hsg-stat-num best" data-num="${best}">0</div><div class="hsg-stat-label">Best streak</div></div>`;

    const overlay = document.createElement('div');
    overlay.className = 'hsg-summary';
    overlay.innerHTML = `
      <div class="hsg-summary-card" role="dialog" aria-label="Results">
        <p class="hsg-summary-title">${title}</p>
        <div class="hsg-grade" style="color:${grade.color}">${grade.g}</div>
        <div class="hsg-grade-msg">${grade.msg}</div>
        <div class="hsg-stats">
          ${statsHTML}
        </div>
        ${extraHTML}
        <div class="hsg-summary-actions">
          <button class="hsg-btn-primary" id="hsgPlayAgain">Play again →</button>
          <a class="hsg-btn-link" href="${allGamesHref}">← All games</a>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    if (typeof onMount === 'function') onMount(overlay.querySelector('.hsg-summary-card'));

    // animate the numbers + celebrate
    setTimeout(() => {
      overlay.querySelectorAll('.hsg-stat-num').forEach((el, i) => {
        countUp(el, parseInt(el.dataset.num, 10), 850 + i * 120);
      });
      if (grade.win) confetti({ count: 70, big: true });
      if (window.HSGSound) HSGSound.finish(grade.win);
    }, 350);

    overlay.querySelector('#hsgPlayAgain').addEventListener('click', () => {
      overlay.remove();
      if (onPlayAgain) onPlayAgain();
    });
  }

  window.HSGfx = { confetti, flash, shake, milestone, showSummary, gradeFor };
})();
