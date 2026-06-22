/* =========================================================
   HomeschoolGames — Fire Streak Rail
   ---------------------------------------------------------
   A live animated streak counter + a Streak Leaderboard.

     const rail = HSGStreak.init({
       gameId: 'bible-quiz',
       gameName: 'Bible Quiz',
       minStreak: 5,
       mount: document.getElementById('streakRail')  // el | selector
     });

     rail.hit();    // one correct answer — bump, flare, +1, record check
     rail.end();    // streak failed / game over — record to leaderboard, reset
     rail.reset();  // silent reset (new game), no leaderboard prompt

   Leaderboard storage shares the key from the old module
   ('hsg_lb_<gameId>') so any existing scores carry over.
   Names are shown as first name + last initial ("Megan S.").
   ========================================================= */
(function () {
  'use strict';

  var PREFIX = 'hsg_lb_';
  var MAX = 10;
  var MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
  var LABELS = ['STREAK', 'STREAK', 'HEATING UP', 'ON FIRE!', 'BLAZING!', 'INFERNO!'];
  var CONFETTI_COLORS = ['#E0531B', '#E0A53B', '#2E8FE0', '#2A5C3F', '#D62828', '#C4A040'];

  function storageKey(id) { return PREFIX + id; }
  function load(id) {
    try {
      var raw = localStorage.getItem(storageKey(id));
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.filter(function (e) { return e && typeof e.name === 'string' && typeof e.score === 'number'; });
    } catch (e) { return []; }
  }
  function save(id, list) {
    try { localStorage.setItem(storageKey(id), JSON.stringify(list)); } catch (e) {}
  }

  function formatName(raw) {
    var s = (raw == null ? '' : String(raw)).replace(/\s+/g, ' ').trim();
    s = s.replace(/[^\p{L}\p{N}'\- ]/gu, '').trim();
    if (!s) return 'Anonymous';
    var cap = function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; };
    var parts = s.split(' ');
    var out = parts.length === 1
      ? cap(parts[0])
      : cap(parts[0]) + ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.';
    return out.length > 18 ? out.slice(0, 18) : out;
  }
  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function levelFor(n) {
    if (n <= 0) return 0;
    if (n <= 2) return 1;
    if (n <= 4) return 2;
    if (n <= 9) return 3;
    if (n <= 19) return 4;
    return 5;
  }
  function resolveMount(m) {
    if (!m) return null;
    if (typeof m === 'string') return document.querySelector(m);
    if (m.nodeType === 1) return m;
    return null;
  }

  // ---- shared edge-glow overlay (one for the page) ----
  var edgeEl = null;
  function edgeGlow(level) {
    if (!edgeEl) {
      edgeEl = document.createElement('div');
      edgeEl.className = 'hsg-edge-glow';
      document.body.appendChild(edgeEl);
    }
    edgeEl.classList.toggle('on', level >= 4);
    edgeEl.classList.toggle('blue', level >= 5);
  }

  function fireConfetti() {
    var wrap = document.createElement('div');
    wrap.className = 'hsg-confetti';
    for (var i = 0; i < 34; i++) {
      var p = document.createElement('i');
      var left = Math.random() * 100;
      var dur = 1.1 + Math.random() * 0.9;
      var delay = Math.random() * 0.25;
      p.style.left = left + 'vw';
      p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      p.style.animationDuration = dur + 's';
      p.style.animationDelay = delay + 's';
      p.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    setTimeout(function () { wrap.remove(); }, 2400);
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'hsg-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3000);
  }

  // ---- name-entry modal ----
  function openModal(opts) {
    var overlay = document.createElement('div');
    overlay.className = 'hsg-overlay';
    overlay.innerHTML =
      '<div class="hsg-modal" role="dialog" aria-modal="true" aria-label="New high streak">' +
        '<div class="big-flame">🔥</div>' +
        '<h3>Streak of ' + opts.score + '!</h3>' +
        '<p class="sub">You made the <strong>Top 10</strong> in ' + esc(opts.gameName) +
          '. Add your name to the Streak Leaderboard!</p>' +
        '<input type="text" maxlength="24" placeholder="Your name" autocomplete="off" ' +
          'autocorrect="off" spellcheck="false" />' +
        '<p class="note">Shown as a first name + last initial, e.g. “Megan S.”</p>' +
        '<div class="actions">' +
          '<button type="button" class="skip">Skip</button>' +
          '<button type="button" class="save">Save</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    var input = overlay.querySelector('input');
    var done = false;
    function cleanup() { document.removeEventListener('keydown', onKey, true); overlay.remove(); }
    function doSave() { if (done) return; done = true; var v = input.value; cleanup(); opts.onSave(v); }
    function doSkip() { if (done) return; done = true; cleanup(); if (opts.onSkip) opts.onSkip(); }
    function onKey(e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); doSave(); }
      else if (e.key === 'Escape') { e.preventDefault(); doSkip(); }
    }
    overlay.querySelector('.save').addEventListener('click', doSave);
    overlay.querySelector('.skip').addEventListener('click', doSkip);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) doSkip(); });
    document.addEventListener('keydown', onKey, true);
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 30);
  }

  // ---- Rail ----
  function Rail(opts) {
    this.gameId = opts.gameId;
    this.gameName = opts.gameName || 'this game';
    this.minStreak = opts.minStreak || 5;
    this.value = 0;
    this._recordFired = false;
    this.mount = resolveMount(opts.mount);
    this._modalOpen = false;
    if (this.mount) this._build();
    this.renderBoard();
    this._paint(false);
  }

  Rail.prototype._build = function () {
    this.mount.classList.add('hsg-rail');
    this.mount.innerHTML =
      '<div class="hsg-streak" data-level="0">' +
        '<span class="flame">🔥</span>' +
        '<span class="count">0</span>' +
        '<span class="streak-label">STREAK</span>' +
        '<span class="streak-best">best  0</span>' +
      '</div>' +
      '<div class="hsg-board"></div>';
    this.streakEl = this.mount.querySelector('.hsg-streak');
    this.flameEl = this.mount.querySelector('.flame');
    this.countEl = this.mount.querySelector('.count');
    this.labelEl = this.mount.querySelector('.streak-label');
    this.bestEl = this.mount.querySelector('.streak-best');
    this.boardEl = this.mount.querySelector('.hsg-board');
  };

  Rail.prototype.bestToBeat = function () {
    var l = load(this.gameId);
    return l.length ? l[0].score : 0;
  };

  Rail.prototype._paint = function (animate) {
    if (!this.streakEl) return;
    var lvl = levelFor(this.value);
    this.streakEl.dataset.level = lvl;
    this.countEl.textContent = this.value;
    this.flameEl.textContent = lvl >= 5 ? '❄️🔥' : '🔥';
    this.labelEl.textContent = LABELS[lvl];
    this.bestEl.textContent = 'best  ' + Math.max(this.value, this.bestToBeat());
    edgeGlow(lvl);
    if (animate) {
      var el = this.streakEl;
      el.classList.remove('bump');
      void el.offsetWidth; // restart animation
      el.classList.add('bump');
      var plus = document.createElement('span');
      plus.className = 'hsg-plusone';
      plus.textContent = '+1';
      el.appendChild(plus);
      setTimeout(function () { plus.remove(); }, 900);
    }
  };

  // one correct answer
  Rail.prototype.hit = function () {
    this.value++;
    this._paint(true);
    var btb = this.bestToBeat();
    if (!this._recordFired && this.value >= this.minStreak && this.value > btb) {
      this._recordFired = true;
      toast('🔥 NEW RECORD — ' + this.value + '!');
      fireConfetti();
    }
  };

  Rail.prototype.qualifies = function (score) {
    if (!score || score < this.minStreak) return false;
    var list = load(this.gameId);
    if (list.length < MAX) return true;
    return score > list[list.length - 1].score;
  };

  // streak failed or game over
  Rail.prototype.end = function () {
    var score = this.value;
    this.value = 0;
    this._recordFired = false;
    this._paint(false);
    if (this._modalOpen || !this.qualifies(score)) return false;
    this._modalOpen = true;
    var self = this;
    openModal({
      gameName: this.gameName,
      score: score,
      onSave: function (raw) { self._modalOpen = false; self._add(raw, score); },
      onSkip: function () { self._modalOpen = false; }
    });
    return true;
  };

  // silent reset (new game / difficulty change) — no prompt
  Rail.prototype.reset = function () {
    this.value = 0;
    this._recordFired = false;
    this._paint(false);
  };

  Rail.prototype._add = function (raw, score) {
    var list = load(this.gameId);
    var ts = Date.now();
    list.push({ name: formatName(raw), score: score, ts: ts });
    list.sort(function (a, b) { return (b.score - a.score) || (a.ts - b.ts); });
    list = list.slice(0, MAX);
    save(this.gameId, list);
    this.renderBoard(ts);
    this._paint(false); // refresh "best"
  };

  Rail.prototype.clear = function () {
    if (window.confirm('Clear this leaderboard? This cannot be undone.')) {
      try { localStorage.removeItem(storageKey(this.gameId)); } catch (e) {}
      this.renderBoard();
      this._paint(false);
    }
  };

  Rail.prototype.renderBoard = function (highlightTs) {
    if (!this.boardEl) return;
    var list = load(this.gameId);
    var self = this;
    var inner;
    if (!list.length) {
      var prompt = this.minStreak <= 1
        ? 'Get any streak to claim the<br>first spot!'
        : 'Get <strong>' + this.minStreak + ' in a row</strong> to claim a spot!';
      inner =
        '<div class="hsg-board-head"><h2>🏆 Streak Leaderboard</h2></div>' +
        '<p class="hsg-board-empty">No streaks yet.<br>' + prompt + '</p>';
    } else {
      var rows = list.map(function (e, i) {
        var rank = i + 1;
        var badge = MEDALS[rank] || rank;
        var isNew = (highlightTs && e.ts === highlightTs) ? ' is-new' : '';
        return '<li class="hsg-board-row' + isNew + '">' +
            '<span class="hsg-board-rank">' + badge + '</span>' +
            '<span class="hsg-board-name">' + esc(e.name) + '</span>' +
            '<span class="hsg-board-score">🔥 ' + e.score + '</span>' +
          '</li>';
      }).join('');
      inner =
        '<div class="hsg-board-head"><h2>🏆 Streak Leaderboard</h2>' +
          '<button type="button" class="hsg-board-clear">Clear</button></div>' +
        '<ol class="hsg-board-list">' + rows + '</ol>';
    }
    this.boardEl.innerHTML = inner;
    var clearBtn = this.boardEl.querySelector('.hsg-board-clear');
    if (clearBtn) clearBtn.addEventListener('click', function () { self.clear(); });
  };

  window.HSGStreak = {
    init: function (opts) { return new Rail(opts); },
    formatName: formatName
  };
})();
