// ============================================================
// HSGGod — shared "god mode" cheat.
// Type "godmode" anywhere in a game to turn it on: it grants
// unlimited lives (each game gates its own life-loss on HSGGod.on)
// and can pop a picker to jump to any level / stage / difficulty.
//
// Usage in a game:
//   <script src="../../assets/js/godmode.js"></script>
//   HSGGod.watch(() => {            // fires when "godmode" is typed
//     HSGGod.enable();              // flips HSGGod.on + shows the badge
//     HSGGod.picker({ levels: 6, label: 'Level', onJump: n => jumpToLevel(n) });
//   });
//   // ...and somewhere in the lose logic:
//   if (!(window.HSGGod && HSGGod.on)) lives--;
// ============================================================
(function () {
  const NS = { on: false };
  let styled = false, badgeEl = null, overlayEl = null;

  function injectStyles() {
    if (styled) return; styled = true;
    const css = `
    .hsg-god-badge{position:fixed;left:10px;bottom:10px;z-index:99998;
      font-family:'Inter',system-ui,sans-serif;font-weight:800;font-size:.72rem;letter-spacing:.06em;
      color:#ffe08a;background:rgba(24,16,40,.92);border:1.5px solid #7a5cc0;border-radius:99px;
      padding:.32rem .7rem;box-shadow:0 4px 14px rgba(0,0,0,.4);pointer-events:none;user-select:none}
    .hsg-god-ov{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
      padding:1.2rem;background:rgba(8,6,18,.82);backdrop-filter:blur(3px);
      font-family:'Inter',system-ui,sans-serif;color:#eee}
    .hsg-god-ov.hidden{display:none}
    .hsg-god-card{background:#151130;border:2px solid #6a54a0;border-radius:16px;padding:1.2rem 1.3rem 1.3rem;
      max-width:min(92vw,460px);width:100%;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.5);max-height:88vh;overflow-y:auto}
    .hsg-god-card h3{margin:.1rem 0 .1rem;font-family:Georgia,serif;font-size:1.5rem;color:#fff}
    .hsg-god-card .sub{color:#b8a8e6;font-size:.86rem;margin-bottom:.9rem}
    .hsg-god-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:.45rem;margin:.2rem 0 1rem}
    .hsg-god-grid.tiers{grid-template-columns:1fr 1fr}
    .hsg-god-grid button{font-family:inherit;font-weight:800;font-size:.92rem;padding:.55rem .3rem;cursor:pointer;
      color:#eaf0ff;background:#26205a;border:1.5px solid #4a3f8a;border-radius:9px;transition:transform .1s,background .12s}
    .hsg-god-grid.tiers button{font-size:.98rem;padding:.7rem .4rem}
    .hsg-god-grid button:hover{background:#372c78;transform:translateY(-1px)}
    .hsg-god-close{font-family:inherit;font-weight:800;cursor:pointer;color:#cdd6ff;background:rgba(255,255,255,.1);
      border:1.5px solid #5a4f95;border-radius:10px;padding:.55rem 1.4rem}
    .hsg-god-close:hover{background:rgba(255,255,255,.18)}`;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  function showBadge() {
    if (badgeEl) return;
    injectStyles();
    badgeEl = document.createElement('div');
    badgeEl.className = 'hsg-god-badge';
    badgeEl.textContent = '😈 GOD MODE';
    document.body.appendChild(badgeEl);
  }

  // Flip god mode on (idempotent). Games read HSGGod.on to skip life-loss / game-over.
  NS.enable = function () {
    if (NS.on) return;
    NS.on = true;
    showBadge();
  };

  // Register the "godmode" typed-sequence detector. cb() runs each time it's typed.
  NS.watch = function (cb) {
    let buf = '';
    window.addEventListener('keydown', function (e) {
      const t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.key && e.key.length === 1) buf = (buf + e.key.toLowerCase()).slice(-7);
      if (buf.endsWith('godmode')) { buf = ''; try { cb(); } catch (err) { /* ignore */ } }
    });
  };

  // Build + show a jump picker.
  //   opts.levels : number  -> buttons 1..N, onJump(n)
  //   opts.tiers  : [{v,label}] -> named buttons, onJump(v)
  //   opts.label  : noun for the header ('Level' | 'Wave' | 'Stage' | 'Level')
  //   opts.onJump : (value) => void   (called then the picker closes)
  //   opts.note   : optional extra line
  NS.picker = function (opts) {
    opts = opts || {};
    injectStyles();
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'hsg-god-ov hidden';
      overlayEl.innerHTML = '<div class="hsg-god-card"><h3>😈 God mode</h3>' +
        '<div class="sub" data-god-sub></div><div class="hsg-god-grid" data-god-grid></div>' +
        '<button class="hsg-god-close" data-god-close>Close</button></div>';
      document.body.appendChild(overlayEl);
      overlayEl.addEventListener('click', function (e) { if (e.target === overlayEl) overlayEl.classList.add('hidden'); });
      overlayEl.querySelector('[data-god-close]').addEventListener('click', function () { overlayEl.classList.add('hidden'); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlayEl && !overlayEl.classList.contains('hidden')) overlayEl.classList.add('hidden'); });
    }
    const label = opts.label || 'Level';
    const grid = overlayEl.querySelector('[data-god-grid]');
    const sub = overlayEl.querySelector('[data-god-sub]');
    grid.innerHTML = '';
    const jump = function (v) { overlayEl.classList.add('hidden'); if (opts.onJump) opts.onJump(v); };
    if (opts.tiers && opts.tiers.length) {
      grid.className = 'hsg-god-grid tiers';
      opts.tiers.forEach(function (t) {
        const b = document.createElement('button'); b.textContent = t.label;
        b.addEventListener('click', function () { jump(t.v); });
        grid.appendChild(b);
      });
      sub.textContent = 'Unlimited lives on. Jump to any ' + label.toLowerCase() + '.';
    } else if (opts.levels > 0) {
      grid.className = 'hsg-god-grid';
      for (let i = 1; i <= opts.levels; i++) {
        const b = document.createElement('button'); b.textContent = i;
        (function (n) { b.addEventListener('click', function () { jump(n); }); })(i);
        grid.appendChild(b);
      }
      sub.textContent = 'Unlimited lives on. Jump to any ' + label.toLowerCase() + ' (1–' + opts.levels + ').';
    } else {
      grid.className = 'hsg-god-grid'; grid.innerHTML = '';
      sub.textContent = opts.note || 'Unlimited lives on.';
    }
    overlayEl.classList.remove('hidden');
  };

  window.HSGGod = NS;
})();
