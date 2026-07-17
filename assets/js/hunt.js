/* =========================================================
   HomeschoolGames — The Hunt (site-wide scavenger hunt)
   ---------------------------------------------------------
   Each clue is a riddle whose answer is a secret WORD. Type the
   word on the home page to open a hidden GAME; reach that game's
   GOAL and the next clue is revealed.

   A game reports progress with one line:
       if (window.HSGHunt) HSGHunt.reach('flappy', score);
   HSGHunt handles everything else (advancing the hunt + popping a
   self-contained "clue unlocked" banner).

   The Treasure Hunt page reads HSGHunt.current()/step() to show the
   active clue + progress. The home page reads HSGHunt.codes to wire
   each secret word to its game.

   To add a link: append to STEPS and drop the one-line hook in that
   game. Nothing else to touch.
   ========================================================= */
(function () {
  'use strict';
  var STEP_KEY = 'hsg_hunt_step';

  // ---- the chain ----------------------------------------------------------
  // riddle  → the puzzle the player solves to a single `word`
  // word    → typed on the home page to `open` the hidden game
  // game    → the key that game reports with HSGHunt.reach(key, value)
  // goal    → value that must be reached inside the game
  // trial   → plain-English goal shown in the journal (must NOT reveal `word`)
  var STEPS = [
    { word: 'secret', open: 'games/secret-flap/index.html', game: 'flappy', goal: 15,
      accept: ['secret', 'secrets'],
      riddle: 'This one magic whisper we kept.',
      hint: "Ignore the words, notice the letters. If you're still stuck, another clue lies at the completion of the Exodus Journey (Hard or Solomon level difficulty).",
      trial: 'Slip past a score of 15 without falling.' },

    { word: 'independence', open: 'games/type-invaders/index.html?arcade', game: 'typeinvaders', goal: 8,
      accept: ['independence'], mono: true,
      riddle: 'F I R N E D E E D P O E M N R D I E N N G C S E',
      hint: 'Keep only the letters on the even beat — the 2nd, the 4th, the 6th, and so on — and discard the rest. What remains is a young nation’s founding cry. Speak it.',
      trial: 'Then hold the capital to Wave 8 in the arcade.' },

    // PLACEHOLDER — revealed when the arcade trial is cleared; real clue lands soon.
    { placeholder: true, word: '__soon__', open: 'index.html', game: 'todo', goal: 1,
      accept: ['__soon__'],
      riddle: 'The capital holds and the saucers scatter — but the next stretch of the trail is still being carved…',
      hint: 'This clue is a placeholder. The real one arrives soon, hunter.',
      trial: 'Coming soon.' }
  ];

  var TREASURE = {
    title: 'The Cartographer’s Hoard',
    text: 'Every trial passed, every buried game unearthed. The last clue dissolves and the map is finally yours — you are a true explorer.'
  };

  // ---- state --------------------------------------------------------------
  function step() { try { return parseInt(localStorage.getItem(STEP_KEY)) || 0; } catch (e) { return 0; } }
  function setStep(n) { try { localStorage.setItem(STEP_KEY, String(n)); } catch (e) {} }
  function done() { return step() >= STEPS.length; }
  function current() { return done() ? null : STEPS[step()]; }

  // A game calls this at its milestone. If it matches the active step and the
  // goal is met, advance and reveal the next clue. Idempotent & self-guarding.
  function reach(game, value) {
    if (done()) return null;
    var i = step(), s = STEPS[i];
    if (!s || s.game !== game || value < s.goal) return null;
    setStep(i + 1);
    var next = STEPS[i + 1] || null;
    banner(next);
    return { cleared: s, next: next };
  }

  // ---- the "clue unlocked" banner (self-contained; any game can pop it) ----
  var cssDone = false;
  function ensureCss() {
    if (cssDone) return; cssDone = true;
    var st = document.createElement('style');
    st.textContent =
      '.hsg-hunt-banner{position:fixed;top:0;left:50%;transform:translate(-50%,-130%);z-index:99999;' +
      'width:min(94vw,470px);background:linear-gradient(#20180d,#150e06);color:#f0e6cf;' +
      'border:1px solid #c8a24a;border-top:none;border-radius:0 0 16px 16px;box-shadow:0 16px 44px rgba(0,0,0,.55);' +
      'padding:1rem 2.2rem 1.05rem 1.2rem;font-family:Inter,system-ui,sans-serif;' +
      'transition:transform .45s cubic-bezier(.2,.9,.3,1.15);}' +
      '.hsg-hunt-banner.show{transform:translate(-50%,0);}' +
      '.hsg-hunt-banner .hh-tag{font-weight:800;font-size:.78rem;letter-spacing:.03em;color:#e7c979;margin-bottom:.35rem;}' +
      '.hsg-hunt-banner .hh-riddle{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.18rem;line-height:1.4;font-style:italic;}' +
      '.hsg-hunt-banner .hh-hint{font-size:.72rem;color:#b6a985;margin-top:.55rem;line-height:1.5;}' +
      '.hsg-hunt-banner .hh-hint b{color:#e7c979;font-weight:800;}' +
      '.hsg-hunt-banner .hh-x{position:absolute;top:.35rem;right:.5rem;width:1.5rem;height:1.5rem;background:none;border:none;' +
      'color:#8a7a55;font-size:1.2rem;cursor:pointer;line-height:1;}' +
      '.hsg-hunt-banner .hh-x:hover{color:#f0e6cf;}';
    document.head.appendChild(st);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function banner(next) {
    if (typeof document === 'undefined') return;
    ensureCss();
    var b = document.createElement('div');
    b.className = 'hsg-hunt-banner';
    b.innerHTML = (next
      ? '<div class="hh-tag">🗝 Trial cleared — a new clue surfaces!</div>' +
        '<div class="hh-riddle">“' + esc(next.riddle) + '”</div>' +
        '<div class="hh-hint">' + (next.placeholder
          ? 'More of the trail is still being carved — check back soon, hunter.'
          : 'Solve it to one word, then type it on the home page. Track the hunt: type <b>treasure</b>.') + '</div>'
      : '<div class="hh-tag">🏆 You found the treasure!</div>' +
        '<div class="hh-riddle">' + esc(TREASURE.text) + '</div>' +
        '<div class="hh-hint">Type <b>treasure</b> on the home page to open your journal.</div>'
      ) + '<button class="hh-x" aria-label="Dismiss">×</button>';
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('show'); });
    var close = function () { b.classList.remove('show'); setTimeout(function () { if (b.parentNode) b.remove(); }, 450); };
    b.querySelector('.hh-x').addEventListener('click', close);
    setTimeout(close, 14000);
    try { if (window.HSGSound && HSGSound.powerup) HSGSound.powerup(); } catch (e) {}
  }

  window.HSGHunt = {
    STEPS: STEPS, TREASURE: TREASURE,
    step: step, done: done, current: current, reach: reach,
    setStep: function (n) { setStep(n); },
    reset: function () { setStep(0); },
    // word -> url map for the home-page code listener
    codes: STEPS.map(function (s) { return { code: s.word, url: s.open }; })
  };
})();
