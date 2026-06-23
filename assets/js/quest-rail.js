/* =========================================================
   HomeschoolGames — Quest Rail engine
   ---------------------------------------------------------
   A reusable "build vs. threat" mechanic for the right rail.

     const quest = HSGQuest.init({
       gameId: 'bible-quiz',
       gameName: 'Bible Quiz',
       theme: HSGQuest.themes.ark,
       mount: document.getElementById('questRail'),
       boardMount: '.quest-board'   // optional extra leaderboard mounts
     });

     quest.correct();  // one correct answer  -> build a piece
     quest.wrong();    // one wrong answer    -> threat advances
     quest.endRun();   // bank the current run (e.g. on Start Over)

   A theme supplies the art + tuning (buildGoal, threatMax, relief,
   buildScene(host), render(host, state), onComplete, onFail, labels).
   Leaderboard ("most built in a run") reuses the .hsg-board / modal
   styles from streak-rail.css. Stored at hsg_quest_<gameId>.
   ========================================================= */
(function () {
  'use strict';

  var PREFIX = 'hsg_quest_';
  var MAX = 10;
  var MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

  function key(id) { return PREFIX + id; }
  function load(id) {
    try {
      var raw = localStorage.getItem(key(id));
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(function (e) { return e && typeof e.name === 'string' && typeof e.score === 'number'; }) : [];
    } catch (e) { return []; }
  }
  function save(id, list) { try { localStorage.setItem(key(id), JSON.stringify(list)); } catch (e) {} }

  function formatName(raw) {
    var s = (raw == null ? '' : String(raw)).replace(/\s+/g, ' ').trim().replace(/[^\p{L}\p{N}'\- ]/gu, '').trim();
    if (!s) return 'Anonymous';
    var cap = function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; };
    var p = s.split(' ');
    var out = p.length === 1 ? cap(p[0]) : cap(p[0]) + ' ' + p[p.length - 1].charAt(0).toUpperCase() + '.';
    return out.length > 18 ? out.slice(0, 18) : out;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function resolveOne(m) { return !m ? null : (typeof m === 'string' ? document.querySelector(m) : (m.nodeType === 1 ? m : null)); }
  function resolveAll(m) {
    if (!m) return [];
    if (typeof m === 'string') return Array.prototype.slice.call(document.querySelectorAll(m));
    if (m.nodeType === 1) return [m];
    if (typeof m.length === 'number') return Array.prototype.slice.call(m);
    return [];
  }

  // ---- name-entry modal (reuses .hsg-overlay/.hsg-modal from streak-rail.css) ----
  function openModal(opts) {
    var overlay = document.createElement('div');
    overlay.className = 'hsg-overlay';
    overlay.innerHTML =
      '<div class="hsg-modal" role="dialog" aria-modal="true">' +
        '<div class="big-flame">' + opts.emoji + '</div>' +
        '<h3>' + esc(opts.title) + '</h3>' +
        '<p class="sub">' + opts.sub + '</p>' +
        '<input type="text" maxlength="24" placeholder="Your name" autocomplete="off" autocorrect="off" spellcheck="false" />' +
        '<p class="note">Shown as a first name + last initial, e.g. “Megan S.”</p>' +
        '<div class="actions"><button type="button" class="skip">Skip</button><button type="button" class="save">Save</button></div>' +
      '</div>';
    document.body.appendChild(overlay);
    var input = overlay.querySelector('input');
    var done = false;
    function cleanup() { document.removeEventListener('keydown', onKey, true); overlay.remove(); }
    function doSave() { if (done) return; done = true; var v = input.value; cleanup(); opts.onSave(v); }
    function doSkip() { if (done) return; done = true; cleanup(); if (opts.onSkip) opts.onSkip(); }
    function onKey(e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); doSave(); } else if (e.key === 'Escape') { e.preventDefault(); doSkip(); } }
    overlay.querySelector('.save').addEventListener('click', doSave);
    overlay.querySelector('.skip').addEventListener('click', doSkip);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) doSkip(); });
    document.addEventListener('keydown', onKey, true);
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 30);
  }

  // ============================ Engine ============================
  function Quest(opts) {
    this.gameId = opts.gameId;
    this.gameName = opts.gameName || 'this game';
    this.theme = opts.theme;
    this.mount = resolveOne(opts.mount);
    this.extraBoards = resolveAll(opts.boardMount);
    this.extraBoards.forEach(function (el) { el.classList.add('hsg-board'); });

    this.build = 0;
    this.threat = 0;
    this.run = 0;       // builds completed this run
    this.busy = false;
    this._modalOpen = false;

    if (this.mount) {
      this.mount.classList.add('hsg-rail');
      this.mount.innerHTML = '<div class="quest-scene" id="questScene"></div><div class="hsg-board"></div>';
      this.sceneEl = this.mount.querySelector('.quest-scene');
      this.boardEl = this.mount.querySelector('.hsg-board');
      this.theme.buildScene(this.sceneEl);
    }
    this.render();
    this.renderBoard();
  }

  Quest.prototype.state = function () {
    return { build: this.build, threat: this.threat, run: this.run,
      buildGoal: this.theme.buildGoal, threatMax: this.theme.threatMax };
  };

  Quest.prototype.render = function () {
    if (this.sceneEl) this.theme.render(this.sceneEl, this.state());
  };

  Quest.prototype.correct = function () {
    if (this.busy) return;
    this.build++;
    this.threat = Math.max(0, this.threat - 1); // a right answer lifts the ark out of the water
    if (this.build >= this.theme.buildGoal) {
      this.run++;
      this.threat = Math.max(0, this.threat - (this.theme.threatRelief || 0));
      this.busy = true;
      this.render();
      if (this.theme.onComplete) this.theme.onComplete(this.sceneEl, this.state());
      var self = this;
      setTimeout(function () { self.build = 0; self.busy = false; self.render(); }, 5000);
    } else {
      this.render();
    }
  };

  Quest.prototype.wrong = function () {
    if (this.busy) return;
    this.threat++;
    if (this.threat >= this.theme.threatMax) {
      this.busy = true;
      if (this.theme.onFail) this.theme.onFail(this.sceneEl, this.state());
      this._bankRun();
      var self = this;
      setTimeout(function () {
        self.build = 0; self.threat = 0; self.run = 0; self.busy = false;
        self.render(); self.renderBoard();
      }, 1450);
    } else {
      this.render();
    }
  };

  // bank the run without a flood-out (e.g. Start Over / leaving)
  Quest.prototype.endRun = function () {
    if (this.busy) return;
    this._bankRun();
    this.build = 0; this.threat = 0; this.run = 0;
    this.render(); this.renderBoard();
  };

  Quest.prototype.qualifies = function (score) {
    if (!score || score < 1) return false;
    var list = load(this.gameId);
    if (list.length < MAX) return true;
    return score > list[list.length - 1].score;
  };

  Quest.prototype._bankRun = function () {
    var score = this.run;
    if (this._modalOpen || !this.qualifies(score)) return;
    this._modalOpen = true;
    var self = this;
    openModal({
      emoji: this.theme.emoji || '🏆',
      title: score + ' ' + (score === 1 ? this.theme.unit : this.theme.unitPlural) + '!',
      sub: 'You made the <strong>Top 10</strong> in ' + esc(this.gameName) + '. Add your name!',
      onSave: function (raw) { self._modalOpen = false; self._add(raw, score); },
      onSkip: function () { self._modalOpen = false; }
    });
  };

  Quest.prototype._add = function (raw, score) {
    var list = load(this.gameId);
    var ts = Date.now();
    list.push({ name: formatName(raw), score: score, ts: ts });
    list.sort(function (a, b) { return (b.score - a.score) || (a.ts - b.ts); });
    list = list.slice(0, MAX);
    save(this.gameId, list);
    this.renderBoard(ts);
  };

  Quest.prototype.clear = function () {
    if (window.confirm('Clear this leaderboard? This cannot be undone.')) {
      try { localStorage.removeItem(key(this.gameId)); } catch (e) {}
      this.renderBoard();
    }
  };

  Quest.prototype.renderBoard = function (highlightTs) {
    var targets = (this.boardEl ? [this.boardEl] : []).concat(this.extraBoards || []);
    if (!targets.length) return;
    var list = load(this.gameId);
    var self = this;
    var title = this.theme.boardTitle || '🏆 Leaderboard';
    var inner;
    if (!list.length) {
      inner = '<div class="hsg-board-head"><h2>' + title + '</h2></div>' +
        '<p class="hsg-board-empty">No runs yet.<br>' + (this.theme.boardEmpty || 'Start building to claim a spot!') + '</p>';
    } else {
      var rows = list.map(function (e, i) {
        var rank = i + 1;
        var badge = MEDALS[rank] || rank;
        var isNew = (highlightTs && e.ts === highlightTs) ? ' is-new' : '';
        return '<li class="hsg-board-row' + isNew + '">' +
            '<span class="hsg-board-rank">' + badge + '</span>' +
            '<span class="hsg-board-name">' + esc(e.name) + '</span>' +
            '<span class="hsg-board-score">' + (self.theme.scoreIcon || '') + ' ' + e.score + '</span>' +
          '</li>';
      }).join('');
      inner = '<div class="hsg-board-head"><h2>' + title + '</h2>' +
        '<button type="button" class="hsg-board-clear">Clear</button></div>' +
        '<ol class="hsg-board-list">' + rows + '</ol>';
    }
    targets.forEach(function (el) {
      el.innerHTML = inner;
      var c = el.querySelector('.hsg-board-clear');
      if (c) c.addEventListener('click', function () { self.clear(); });
    });
  };

  // ======================= Noah's Ark theme =======================
  // A big, animated, fairly realistic ark scene. 8 build stages reveal
  // an increasingly detailed wooden ark; the flood rises as a moving sea
  // with rain and drifting clouds; finishing pays off with a rainbow.
  function arkPartsSVG() {
    return [
      // 0 — hull
      '<g class="ark-part" data-s="0">' +
        '<path d="M44 206 L276 206 L266 240 Q230 256 160 256 Q90 256 54 240 Z" fill="#6e4322"/>' +
        '<path d="M58 222 Q160 233 262 222" fill="none" stroke="#4e2f19" stroke-width="2"/>' +
        '<path d="M54 236 Q160 248 266 236" fill="none" stroke="#4e2f19" stroke-width="2"/>' +
        '<path d="M44 206 L276 206 L274 211 L46 211 Z" fill="#8a5a2e"/>' +
      '</g>',
      // 1 — deck rail
      '<g class="ark-part" data-s="1">' +
        '<rect x="50" y="196" width="220" height="11" rx="3" fill="#8a5a2e"/>' +
        '<rect x="50" y="196" width="220" height="3.5" fill="#a9743b"/>' +
      '</g>',
      // 2 — cabin lower wall
      '<g class="ark-part" data-s="2">' +
        '<rect x="74" y="150" width="172" height="47" fill="#9c6a36"/>' +
        '<g stroke="#7c5026" stroke-width="1.5">' +
          '<line x1="100" y1="150" x2="100" y2="197"/><line x1="126" y1="150" x2="126" y2="197"/>' +
          '<line x1="152" y1="150" x2="152" y2="197"/><line x1="178" y1="150" x2="178" y2="197"/>' +
          '<line x1="204" y1="150" x2="204" y2="197"/><line x1="230" y1="150" x2="230" y2="197"/>' +
        '</g>' +
      '</g>',
      // 3 — cabin upper + round windows
      '<g class="ark-part" data-s="3">' +
        '<rect x="74" y="122" width="172" height="29" fill="#aa7740"/>' +
        '<circle cx="104" cy="137" r="8" fill="#bfe3f2" stroke="#6e4a26" stroke-width="2"/>' +
        '<circle cx="160" cy="137" r="8" fill="#bfe3f2" stroke="#6e4a26" stroke-width="2"/>' +
        '<circle cx="216" cy="137" r="8" fill="#bfe3f2" stroke="#6e4a26" stroke-width="2"/>' +
      '</g>',
      // 4 — pitched roof
      '<g class="ark-part" data-s="4">' +
        '<path d="M64 122 L256 122 L232 96 L88 96 Z" fill="#5a3115"/>' +
        '<g stroke="#43250f" stroke-width="1.5"><line x1="96" y1="105" x2="224" y2="105"/><line x1="88" y1="114" x2="232" y2="114"/></g>' +
        '<rect x="60" y="119" width="200" height="5" rx="2" fill="#6e4322"/>' +
      '</g>',
      // 5 — arched door
      '<g class="ark-part" data-s="5">' +
        '<path d="M142 197 L142 168 Q160 150 178 168 L178 197 Z" fill="#3f2410"/>' +
        '<line x1="160" y1="152" x2="160" y2="197" stroke="#2c1809" stroke-width="2"/>' +
        '<circle cx="171" cy="180" r="2.4" fill="#c9a24a"/>' +
      '</g>',
      // 6 — gangplank + barrel
      '<g class="ark-part" data-s="6">' +
        '<path d="M178 195 L232 247 L246 247 L190 191 Z" fill="#7c5026"/>' +
        '<g stroke="#5a3416" stroke-width="1.5"><line x1="196" y1="205" x2="210" y2="221"/><line x1="208" y1="213" x2="222" y2="229"/></g>' +
        '<ellipse cx="252" cy="240" rx="10" ry="12" fill="#8a5a2e" stroke="#5a3416" stroke-width="1.5"/>' +
      '</g>',
      // 7 — mast, flag, gold trim
      '<g class="ark-part" data-s="7">' +
        '<line x1="160" y1="96" x2="160" y2="74" stroke="#5a3416" stroke-width="3"/>' +
        '<path d="M160 75 L188 82 L160 90 Z" fill="#d62828"/>' +
        '<rect x="60" y="119" width="200" height="3" fill="#c9a24a" opacity="0.65"/>' +
      '</g>'
    ].join('');
  }

  var ark = {
    buildGoal: 8,
    threatMax: 6,        // hidden: net misses before the water covers the ark
    threatRelief: 1,
    emoji: '🛟',
    unit: 'ark', unitPlural: 'arks',
    scoreIcon: '🛟',
    boardTitle: '🛟 Arks Built',
    boardEmpty: 'Build an ark before the flood to claim a spot!',

    buildScene: function (host) {
      var rainbow = '';
      var rcols = ['#e5484d', '#f2913d', '#ffd23f', '#5bbf6a', '#3a9bd6', '#8a5bd6'];
      for (var i = 0; i < rcols.length; i++) {
        var r = 150 - i * 7;
        rainbow += '<path d="M' + (160 - r) + ' 300 A' + r + ' ' + r + ' 0 0 1 ' + (160 + r) + ' 300" fill="none" stroke="' + rcols[i] + '" stroke-width="7"/>';
      }
      var rain = '';
      for (var x = 8; x < 320; x += 19) {
        var d = ((x * 13) % 11) / 11;
        rain += '<line class="drop" x1="' + x + '" y1="-12" x2="' + (x - 4) + '" y2="3" style="animation-delay:-' + d.toFixed(2) + 's"/>';
      }
      var rays = '';
      for (var a = 0; a < 8; a++) {
        var ang = a * 45 * Math.PI / 180;
        rays += '<line x1="' + (258 + Math.cos(ang) * 26).toFixed(1) + '" y1="' + (56 + Math.sin(ang) * 26).toFixed(1) +
          '" x2="' + (258 + Math.cos(ang) * 34).toFixed(1) + '" y2="' + (56 + Math.sin(ang) * 34).toFixed(1) + '"/>';
      }
      var splash = '';
      var sx = [-34, -20, -8, 8, 20, 34, 0];
      for (var s = 0; s < sx.length; s++) splash += '<circle cx="160" cy="150" r="' + (3 + s % 3) + '" style="--sx:' + sx[s] + 'px"/>';
      var cloud = '<ellipse cx="20" cy="0" rx="20" ry="12"/><ellipse cx="40" cy="4" rx="15" ry="10"/><ellipse cx="6" cy="5" rx="13" ry="9"/>';

      host.innerHTML =
        '<div class="ark-stage">' +
          '<svg class="ark-svg" viewBox="0 0 320 300" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">' +
            '<defs>' +
              '<linearGradient id="qsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#aacbe6"/><stop offset="0.65" stop-color="#cddde8"/><stop offset="1" stop-color="#e6eef2"/></linearGradient>' +
              '<linearGradient id="qsea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#56abe1"/><stop offset="1" stop-color="#184f80"/></linearGradient>' +
            '</defs>' +
            '<rect class="sky" x="0" y="0" width="320" height="320" fill="url(#qsky)"/>' +
            '<g class="sun"><circle cx="258" cy="56" r="22" fill="#ffd23f"/><g class="rays" stroke="#ffd23f" stroke-width="3" stroke-linecap="round">' + rays + '</g></g>' +
            '<g class="clouds" fill="#ffffff">' +
              '<g class="cloud c1">' + cloud + '</g><g class="cloud c2">' + cloud + '</g><g class="cloud c3">' + cloud + '</g>' +
            '</g>' +
            '<g class="rainbow">' + rainbow + '</g>' +
            '<g class="rain" stroke="#cfe6f5" stroke-width="2" stroke-linecap="round">' + rain + '</g>' +
            // the ark rises and sinks as a unit
            '<g class="ark-lift"><g class="ark">' + arkPartsSVG() +
              '<g class="ark-animals">' +
                '<text x="118" y="193" font-size="20">🐘</text>' +
                '<text x="150" y="191" font-size="18">🦒</text>' +
                '<text x="184" y="194" font-size="18">🦁</text>' +
              '</g>' +
            '</g></g>' +
            // sea sits at a FIXED surface (y=210), translucent so the hull shows through
            '<g class="water">' +
              '<rect x="-24" y="210" width="368" height="170" fill="url(#qsea)" opacity="0.8"/>' +
              '<path class="wave wave2" d="M-24 210 q 22 -7 44 0 t 44 0 t 44 0 t 44 0 t 44 0 t 44 0 t 44 0 t 44 0 t 44 0 L 372 226 L -24 226 Z" fill="#3f93cf" opacity="0.55"/>' +
              '<path class="wave wave1" d="M-24 212 q 22 -8 44 0 t 44 0 t 44 0 t 44 0 t 44 0 t 44 0 t 44 0 t 44 0 t 44 0 L 372 228 L -24 228 Z" fill="#5cabe0" opacity="0.7"/>' +
            '</g>' +
            '<g class="splash" fill="#cfe9f8">' + splash + '</g>' +
            '<g class="builder" transform="translate(206,150)"><g class="hammer"><rect x="-2.5" y="-2" width="5" height="15" rx="2" fill="#6e4322"/><rect x="-9" y="-9" width="18" height="8" rx="2" fill="#9a9a9a"/></g><g class="dust" fill="#d8c7a8"><circle cx="0" cy="14" r="2"/><circle cx="6" cy="13" r="1.6"/><circle cx="-6" cy="13" r="1.6"/></g></g>' +
          '</svg>' +
          '<div class="ark-banner"></div>' +
        '</div>' +
        '<div class="quest-meters">' +
          '<span class="meter build">🔨 <b class="m-build">0</b>/8</span>' +
          '<span class="meter arks">🛟 <b class="m-arks">0</b></span>' +
        '</div>' +
        '<div class="quest-status">Keep the ark above water!</div>';
      host._lastBuild = 0;
    },

    render: function (host, st) {
      host.querySelectorAll('.ark-part').forEach(function (p) {
        var s = parseInt(p.dataset.s, 10);
        var built = s < st.build;
        p.classList.toggle('built', built);
        p.classList.toggle('pop', built && s === st.build - 1);
      });
      // the ark sinks toward the water as misses pile up, lifts when answered right
      var lift = host.querySelector('.ark-lift');
      if (lift) lift.style.transform = 'translateY(' + (st.threat / st.threatMax * 100).toFixed(1) + 'px)';
      var rain = host.querySelector('.rain');
      if (rain) rain.style.opacity = (0.24 + st.threat / st.threatMax * 0.6).toFixed(2);
      var prev = host._lastBuild || 0;
      if (st.build > prev) {
        var b = host.querySelector('.builder');
        if (b) { b.classList.remove('tapping'); b.getBoundingClientRect(); b.classList.add('tapping'); }
      }
      host._lastBuild = st.build;
      var mb = host.querySelector('.m-build'); if (mb) mb.textContent = st.build;
      var ma = host.querySelector('.m-arks'); if (ma) ma.textContent = st.run;
      var status = host.querySelector('.quest-status');
      if (status && !host._banner) {
        status.className = 'quest-status';
        if (st.threat >= st.threatMax - 2) { status.textContent = 'She\'s going under — answer fast!'; status.classList.add('bad'); }
        else { status.textContent = 'Keep the ark above water!'; }
      }
    },

    onComplete: function (host) {
      host._banner = true;
      var svg = host.querySelector('.ark-svg'); if (svg) svg.classList.add('saved');
      var animals = host.querySelector('.ark-animals'); if (animals) animals.classList.add('aboard');
      var banner = host.querySelector('.ark-banner'); if (banner) { banner.textContent = '🌈 Ark afloat!'; banner.className = 'ark-banner win show'; }
      var status = host.querySelector('.quest-status'); if (status) { status.textContent = 'The animals are safe — the rains stop!'; status.className = 'quest-status good'; }
      setTimeout(function () {
        host._banner = false;
        if (banner) banner.className = 'ark-banner';
        if (animals) animals.classList.remove('aboard');
        if (svg) svg.classList.remove('saved');
      }, 5000);
    },

    onFail: function (host) {
      host._banner = true;
      var svg = host.querySelector('.ark-svg'); if (svg) svg.classList.add('splashing');
      var lift = host.querySelector('.ark-lift'); if (lift) lift.style.transform = 'translateY(210px)'; // plunge under
      var banner = host.querySelector('.ark-banner'); if (banner) { banner.textContent = '🌊 The ark went under!'; banner.className = 'ark-banner fail show'; }
      var stage = host.querySelector('.ark-stage'); if (stage) { stage.classList.add('quest-shake'); setTimeout(function () { stage.classList.remove('quest-shake'); }, 420); }
      var status = host.querySelector('.quest-status'); if (status) { status.textContent = 'The flood won this time…'; status.className = 'quest-status bad'; }
      setTimeout(function () { host._banner = false; if (banner) banner.className = 'ark-banner'; if (svg) svg.classList.remove('splashing'); }, 1400);
    }
  };

  window.HSGQuest = {
    init: function (opts) { return new Quest(opts); },
    themes: { ark: ark },
    formatName: formatName
  };
})();
