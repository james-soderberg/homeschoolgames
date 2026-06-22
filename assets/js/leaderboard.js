/* =========================================================
   HomeschoolGames — Shared Leaderboard (local / localStorage)
   ---------------------------------------------------------
   Per-game persistent Top-10 streak board. When a finished
   streak is good enough (>= minStreak) AND would land in the
   top ten, a modal invites the player to add their name.
   Names are shown as first name + last initial ("Megan S.").

   Usage:
     const board = HSGLeaderboard.init({
       gameId: 'bible-quiz',
       gameName: 'Bible Quiz',
       minStreak: 5,
       mount: document.getElementById('leaderboard') // el | selector | array
     });
     // when a streak run ends:
     board.submit(endedStreakValue);
   ========================================================= */
(function () {
  'use strict';

  var PREFIX = 'hsg_lb_';
  var MAX = 10;
  var MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

  function storageKey(gameId) { return PREFIX + gameId; }

  function load(gameId) {
    try {
      var raw = localStorage.getItem(storageKey(gameId));
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.filter(function (e) {
        return e && typeof e.name === 'string' && typeof e.score === 'number';
      });
    } catch (e) {
      return [];
    }
  }

  function save(gameId, list) {
    try {
      localStorage.setItem(storageKey(gameId), JSON.stringify(list));
    } catch (e) { /* storage full / blocked — fail quietly */ }
  }

  // "Megan Smith" -> "Megan S."  |  "Megan" -> "Megan"  |  "" -> "Anonymous"
  function formatName(raw) {
    var s = (raw == null ? '' : String(raw)).replace(/\s+/g, ' ').trim();
    // keep letters (any language), numbers, spaces, apostrophes, hyphens
    s = s.replace(/[^\p{L}\p{N}'\- ]/gu, '').trim();
    if (!s) return 'Anonymous';
    var cap = function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; };
    var parts = s.split(' ');
    var out;
    if (parts.length === 1) {
      out = cap(parts[0]);
    } else {
      var first = cap(parts[0]);
      var lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
      out = first + ' ' + lastInitial + '.';
    }
    if (out.length > 18) out = out.slice(0, 18);
    return out;
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolveMounts(m) {
    if (!m) return [];
    if (typeof m === 'string') return Array.prototype.slice.call(document.querySelectorAll(m));
    if (m.nodeType === 1) return [m];
    if (typeof m.length === 'number') return Array.prototype.slice.call(m);
    return [];
  }

  // ---- Name-entry modal ----
  function openModal(opts) {
    var overlay = document.createElement('div');
    overlay.className = 'hsg-lb-overlay';
    overlay.innerHTML =
      '<div class="hsg-lb-modal" role="dialog" aria-modal="true" aria-label="New high streak">' +
        '<div class="hsg-lb-trophy">🏆</div>' +
        '<h3 class="hsg-lb-modal-title">Top 10 Streak!</h3>' +
        '<p class="hsg-lb-modal-sub">You hit a streak of <strong>' + opts.score + '</strong> in ' +
          esc(opts.gameName) + '. Add your name to the leaderboard!</p>' +
        '<input class="hsg-lb-input" type="text" maxlength="24" placeholder="Your name" ' +
          'autocomplete="off" autocorrect="off" spellcheck="false" />' +
        '<p class="hsg-lb-note">Shown as a first name + last initial, e.g. “Megan S.”</p>' +
        '<div class="hsg-lb-actions">' +
          '<button type="button" class="hsg-lb-skip">Skip</button>' +
          '<button type="button" class="hsg-lb-save">Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    var input = overlay.querySelector('.hsg-lb-input');
    var done = false;

    function cleanup() {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
    }
    function save() {
      if (done) return; done = true;
      var val = input.value;
      cleanup();
      opts.onSave(val);
    }
    function skip() {
      if (done) return; done = true;
      cleanup();
      if (opts.onSkip) opts.onSkip();
    }
    // Capture phase so the game's own key handlers don't also fire.
    function onKey(e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      else if (e.key === 'Escape') { e.preventDefault(); skip(); }
    }

    overlay.querySelector('.hsg-lb-save').addEventListener('click', save);
    overlay.querySelector('.hsg-lb-skip').addEventListener('click', skip);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) skip(); });
    document.addEventListener('keydown', onKey, true);

    // focus after paint
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 30);
  }

  // ---- Board ----
  function Board(opts) {
    this.gameId = opts.gameId;
    this.gameName = opts.gameName || 'this game';
    this.minStreak = opts.minStreak || 5;
    this.mounts = resolveMounts(opts.mount);
    this._modalOpen = false;
    this.render();
  }

  Board.prototype.list = function () { return load(this.gameId); };

  Board.prototype.qualifies = function (score) {
    if (!score || score < this.minStreak) return false;
    var list = load(this.gameId);
    if (list.length < MAX) return true;
    return score > list[list.length - 1].score; // beat the lowest of the ten
  };

  Board.prototype.submit = function (score) {
    if (this._modalOpen) return false;
    if (!this.qualifies(score)) return false;
    this._modalOpen = true;
    var self = this;
    openModal({
      gameName: this.gameName,
      score: score,
      onSave: function (rawName) { self._modalOpen = false; self._add(rawName, score); },
      onSkip: function () { self._modalOpen = false; }
    });
    return true;
  };

  Board.prototype._add = function (rawName, score) {
    var list = load(this.gameId);
    var ts = Date.now();
    list.push({ name: formatName(rawName), score: score, ts: ts });
    // higher score first; earlier timestamp wins ties
    list.sort(function (a, b) { return (b.score - a.score) || (a.ts - b.ts); });
    list = list.slice(0, MAX);
    save(this.gameId, list);
    this.render(ts);
  };

  Board.prototype.clear = function () {
    if (window.confirm('Clear this leaderboard? This cannot be undone.')) {
      try { localStorage.removeItem(storageKey(this.gameId)); } catch (e) {}
      this.render();
    }
  };

  Board.prototype.render = function (highlightTs) {
    if (!this.mounts.length) return;
    var list = load(this.gameId);
    var self = this;
    var html;

    if (!list.length) {
      html =
        '<div class="hsg-lb">' +
          '<div class="hsg-lb-head"><h2>🏆 Top Streaks</h2></div>' +
          '<p class="hsg-lb-empty">No streaks yet.<br>Get <strong>' + this.minStreak +
            ' in a row</strong> to claim a spot!</p>' +
        '</div>';
    } else {
      var rows = list.map(function (e, i) {
        var rank = i + 1;
        var badge = MEDALS[rank] || rank;
        var isNew = highlightTs && e.ts === highlightTs ? ' is-new' : '';
        return '<li class="hsg-lb-row' + isNew + '">' +
            '<span class="hsg-lb-rank">' + badge + '</span>' +
            '<span class="hsg-lb-name">' + esc(e.name) + '</span>' +
            '<span class="hsg-lb-score">🔥 ' + e.score + '</span>' +
          '</li>';
      }).join('');
      html =
        '<div class="hsg-lb">' +
          '<div class="hsg-lb-head"><h2>🏆 Top Streaks</h2>' +
            '<button type="button" class="hsg-lb-clear">Clear</button></div>' +
          '<ol class="hsg-lb-list">' + rows + '</ol>' +
        '</div>';
    }

    this.mounts.forEach(function (mount) {
      mount.innerHTML = html;
      var clearBtn = mount.querySelector('.hsg-lb-clear');
      if (clearBtn) clearBtn.addEventListener('click', function () { self.clear(); });
    });
  };

  window.HSGLeaderboard = {
    init: function (opts) { return new Board(opts); },
    formatName: formatName  // exposed for testing
  };
})();
