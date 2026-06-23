// ============================================================
// HSGBridge — reusable "build-the-bridge" game shell.
// You answer questions; your character steps forward EVERY question.
// A correct answer lays the next plank; a wrong one doesn't — so each
// mistake eats into your lead. Step past the last plank and you fall.
// Reach the far cliff to clear the level (bridges get longer & harder).
//
// Self-contained: injects its own CSS, builds its own DOM, drives the loop.
// Uses window.HSGSound / HSGfx if present; takes a streak rail instance.
//
// HSGBridge.init({
//   mount,                       // element to build the game inside
//   rail,                        // HSGStreak instance (optional)
//   makeQuestion(level) -> { prompt, choices:[a,b,c,d], answer },
//   levelLength(level) -> int,   // planks needed to cross (default 8 + 2/level)
//   startLead,                   // pre-built planks of buffer (default 4)
//   allGamesHref,
// })
// ============================================================
(function () {
  const STEP = 58, CLIFFW = 72, PLANK_W = 52, GUY_W = 34, LEAD_MAX = 6;
  const KEYS = ['A', 'B', 'C', 'D'];

  const style = document.createElement('style');
  style.textContent = `
    .br-game { max-width: 760px; margin: 0 auto; }
    .br-hud { display:flex; gap:.6rem; align-items:center; margin-bottom:.6rem; flex-wrap:wrap; font-family:var(--font-sans); }
    .br-pill { background:var(--cream-dark); border:1.5px solid var(--border); border-radius:99px;
      padding:.4rem .9rem; font-weight:700; font-size:.9rem; color:var(--ink); }
    .br-lead { display:flex; gap:3px; align-items:center; margin-left:auto; }
    .br-pip { width:12px; height:12px; border-radius:3px; background:var(--border); transition:background .2s; }
    .br-pip.on { background:var(--green); }
    .br-lead.danger .br-pip.on { background:var(--red); }

    .br-viewport { position:relative; height:210px; border:2px solid var(--border); border-radius:14px;
      overflow:hidden; background:linear-gradient(#cfeaf5 0%, #e8f4f8 55%, #6b5b45 55%, #41372a 100%);
      box-shadow:0 2px 8px rgba(26,23,20,.07); }
    .br-track { position:absolute; inset:0; transition:transform .45s cubic-bezier(.4,.1,.3,1); }
    .br-cliff { position:absolute; bottom:0; height:54%; background:linear-gradient(#7a6a4a,#5c4a32);
      border-top:4px solid #8a795a; }
    .br-cliff-left { left:0; width:${CLIFFW}px; border-radius:0 6px 0 0; }
    .br-cliff-right { width:160px; border-radius:6px 0 0 0; }
    .br-plank { position:absolute; height:12px; width:${PLANK_W}px; border-radius:3px;
      background:linear-gradient(#9b7a4f,#7a5e3a); box-shadow:0 2px 3px rgba(0,0,0,.25); }
    .br-plank.new { animation:brDrop .35s cubic-bezier(.3,1.4,.5,1); }
    @keyframes brDrop { from{ transform:translateY(-26px); opacity:.2; } to{ transform:none; opacity:1; } }
    .br-guy { position:absolute; font-size:1.9rem; line-height:1; width:${GUY_W}px; text-align:center;
      transition:left .45s cubic-bezier(.4,.1,.3,1), transform .6s ease, opacity .6s ease; }
    .br-guy.fall { transform:translateY(160px) rotate(420deg); opacity:0; transition:transform 1s cubic-bezier(.5,.1,.7,1), opacity 1s ease; }
    .br-guy.cheer { animation:brCheer .5s ease; }
    @keyframes brCheer { 0%,100%{ transform:translateY(0);} 40%{ transform:translateY(-16px);} }

    .br-prompt { text-align:center; font-family:var(--font-serif); font-weight:600;
      font-size:clamp(1.8rem,5vw,2.6rem); margin:1rem 0 .5rem; }
    .br-feedback { min-height:1.6rem; text-align:center; font-weight:600; font-size:1.02rem; margin-bottom:.5rem; }
    .br-choices { display:grid; grid-template-columns:1fr 1fr; gap:.7rem; }
    .br-opt { background:#fff; border:2.5px solid var(--border); border-radius:12px; padding:.9rem;
      font-family:var(--font-serif); font-size:1.4rem; font-weight:600; color:var(--ink); cursor:pointer;
      display:flex; align-items:center; justify-content:center; gap:.5rem; min-height:62px;
      box-shadow:0 2px 6px rgba(26,23,20,.07); transition:border-color .12s, background .12s, transform .1s; }
    .br-opt .k { font-family:var(--font-sans); font-size:.7rem; font-weight:700; color:var(--ink-light);
      background:var(--cream-dark); border-radius:5px; padding:.1rem .4rem; }
    .br-opt:hover:not(:disabled){ border-color:var(--gold); background:#FFFDF4; transform:translateY(-2px); }
    .br-opt.correct{ background:#EAF4EE; border-color:var(--green); color:var(--green); }
    .br-opt.wrong{ background:#FAE8E8; border-color:var(--red); color:var(--red); }
    .br-opt.reveal{ background:#EAF4EE; border-color:var(--green); color:var(--green); }
    .br-opt:disabled{ cursor:default; transform:none; }
    @media (max-width:480px){ .br-choices{ grid-template-columns:1fr; } }
  `;
  (document.head || document.documentElement).appendChild(style);

  function init(cfg) {
    const mount = cfg.mount;
    const rail = cfg.rail || { hit(){}, end(){}, reset(){} };
    const makeQuestion = cfg.makeQuestion;
    const levelLength = cfg.levelLength || (lv => 8 + (lv - 1) * 2);
    const startLead = cfg.startLead || 4;
    const fx = window.HSGfx, snd = window.HSGSound || { correct(){}, wrong(){}, streak(){}, tick(){} };

    mount.innerHTML = `
      <div class="br-game">
        <div class="br-hud">
          <span class="br-pill" data-level>Level 1</span>
          <span class="br-pill" data-dist>0 m</span>
          <span class="br-lead" data-lead></span>
        </div>
        <div class="br-viewport"><div class="br-track">
          <div class="br-cliff br-cliff-left"></div>
          <div class="br-planks"></div>
          <div class="br-cliff br-cliff-right"></div>
          <div class="br-guy">🚶</div>
        </div></div>
        <div class="br-prompt"></div>
        <div class="br-feedback"></div>
        <div class="br-choices"></div>
      </div>`;

    const el = sel => mount.querySelector(sel);
    const viewport = el('.br-viewport'), track = el('.br-track'), planksEl = el('.br-planks');
    const guy = el('.br-guy'), cliffR = el('.br-cliff-right');
    const levelEl = el('[data-level]'), distEl = el('[data-dist]'), leadEl = el('[data-lead]');
    const promptEl = el('.br-prompt'), feedbackEl = el('.br-feedback'), choicesEl = el('.br-choices');

    let level, L, guyPos, builtFront, q;
    let totalCorrect, totalQ, streak, bestStreak, distanceBase;
    let busy = false, over = false;

    const xAt = i => CLIFFW + i * STEP;

    function startGame() {
      level = 1; totalCorrect = 0; totalQ = 0; streak = 0; bestStreak = 0; distanceBase = 0;
      over = false;
      startLevel();
    }

    function startLevel() {
      L = levelLength(level);
      guyPos = 0;
      builtFront = Math.min(startLead, L);
      guy.className = 'br-guy';
      guy.textContent = '🚶';
      render(false);
      nextQuestion();
    }

    function nextQuestion() {
      busy = false;
      feedbackEl.textContent = '';
      q = makeQuestion(level);
      promptEl.textContent = q.prompt;
      choicesEl.innerHTML = '';
      q.choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'br-opt';
        b.dataset.idx = i;
        b.dataset.val = c;
        b.innerHTML = `<span class="k">${KEYS[i]}</span><span>${c}</span>`;
        b.addEventListener('click', () => answer(String(c), b));
        choicesEl.appendChild(b);
      });
    }

    function render(animate) {
      // planks
      planksEl.innerHTML = '';
      for (let i = 1; i <= builtFront; i++) {
        const p = document.createElement('div');
        p.className = 'br-plank' + (animate && i === builtFront ? ' new' : '');
        p.style.left = (xAt(i) - PLANK_W / 2) + 'px';
        p.style.bottom = '45%';
        planksEl.appendChild(p);
      }
      // far cliff after position L
      cliffR.style.left = (xAt(L) + STEP / 2) + 'px';
      // guy
      guy.style.left = (xAt(guyPos) - GUY_W / 2) + 'px';
      guy.style.bottom = '47%';
      // camera follows guy (~38% from left), clamped
      const trackW = xAt(L) + STEP / 2 + 160;
      const vw = viewport.clientWidth || 700;
      let tx = -(xAt(guyPos) - vw * 0.38);
      tx = Math.min(0, Math.max(-(trackW - vw), tx));
      track.style.transform = `translateX(${tx}px)`;
      // hud
      levelEl.textContent = 'Level ' + level;
      distEl.textContent = ((distanceBase + guyPos) * 10) + ' m';
      const lead = Math.max(0, builtFront - guyPos);
      leadEl.innerHTML = '';
      leadEl.classList.toggle('danger', lead <= 1);
      for (let i = 0; i < LEAD_MAX; i++) {
        const pip = document.createElement('span');
        pip.className = 'br-pip' + (i < lead ? ' on' : '');
        leadEl.appendChild(pip);
      }
    }

    function answer(val, btn) {
      if (busy || over) return;
      busy = true;
      const correct = val === String(q.answer);
      totalQ++;
      guyPos++;                      // step forward no matter what

      choicesEl.querySelectorAll('.br-opt').forEach(b => b.disabled = true);

      if (correct) {
        totalCorrect++; streak++;
        if (streak > bestStreak) bestStreak = streak;
        builtFront = Math.min(L, builtFront + 1);   // lay the next plank
        rail.hit(); snd.correct();
        btn.classList.add('correct');
        feedbackEl.innerHTML = '<span style="color:var(--green)">✓ Plank laid!</span>';
        // streak bonus: repair an extra plank (regain lead)
        if (fx && fx.milestone(streak)) { builtFront = Math.min(L, builtFront + 1); snd.streak(streak); }
      } else {
        const ended = streak; streak = 0;
        rail.end(); snd.wrong();
        btn.classList.add('wrong');
        choicesEl.querySelectorAll('.br-opt').forEach(b => {
          if (b.dataset.val === String(q.answer)) b.classList.add('reveal');
        });
        feedbackEl.innerHTML = `<span style="color:var(--red)">✗ ${q.answer} — no plank!</span>`;
      }

      const fell = guyPos > builtFront;
      const cleared = !fell && guyPos >= L;
      render(true);

      setTimeout(() => {
        if (fell) return doFall();
        if (cleared) return doLevelClear();
        nextQuestion();
      }, correct ? 650 : 1200);
    }

    function doFall() {
      over = true;
      guy.textContent = '😵';
      guy.classList.add('fall');
      snd.wrong();
      setTimeout(showSummary, 950);
    }

    function doLevelClear() {
      guy.classList.add('cheer');
      if (fx) { fx.confetti({ count: 50 }); fx.flash('rgba(42,92,63,.35)'); }
      feedbackEl.innerHTML = `<span style="color:var(--green)">🎉 Level ${level} cleared!</span>`;
      distanceBase += L;
      level++;
      setTimeout(startLevel, 1100);
    }

    function showSummary() {
      const dist = (distanceBase + guyPos) * 10;
      if (fx) {
        fx.showSummary({
          title: `Reached Level ${level} · ${dist} m`,
          correct: totalCorrect, total: totalQ, best: bestStreak,
          onPlayAgain: () => { rail.end(); startGame(); },
          allGamesHref: cfg.allGamesHref || '../../index.html',
        });
      }
    }

    document.addEventListener('keydown', e => {
      if (busy || over) return;
      const idx = ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
      if (idx === -1) return;
      const b = choicesEl.querySelector(`.br-opt[data-idx="${idx}"]`);
      if (b && !b.disabled) b.click();
    });

    window.addEventListener('resize', () => { if (!over) render(false); });

    startGame();
    return {
      restart: startGame,
      _debug: () => ({ level, L, guyPos, builtFront, over, totalCorrect, totalQ, streak, bestStreak, answer: q && q.answer }),
    };
  }

  window.HSGBridge = { init };
})();
