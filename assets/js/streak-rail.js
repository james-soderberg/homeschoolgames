/* =========================================================
   Accidental Learning - Fire Streak Rail + Leaderboards
   ---------------------------------------------------------
   A live animated streak counter + per-game / per-level
   Top-10 leaderboards.

     const rail = HSGStreak.init({
       gameId: 'circa',
       gameName: 'Circa',
       minStreak: 1,
       mount: document.getElementById('streakRail'),  // el | selector
       boardMount: '.circa-leaderboard',              // optional extra boards
       level: 'all', levelName: 'All Time'            // optional starting level
     });

     rail.hit();                 // one correct answer - +1, track session best
     rail.set(n);                // set the live value (length/score metrics)
     rail.broke();               // streak snapped mid-game - reset to 0, NO prompt
     rail.gameOver(score?);      // game ended OR quit - bank the session-best;
                                 //   if it makes the Top 10, prompt for a name and
                                 //   show the placement. score? overrides the best.
     rail.setLevel(id, name);    // switch level: banks the old run, swaps the board
     rail.reset();               // silent reset (no prompt, clears session best)

   Each (game, level) gets its own board at hsg_lb_<gameId>__<level>.
   Single-level games (no `level`) keep the legacy key hsg_lb_<gameId>,
   so existing scores carry over. Names show as "Megan S.".

   Headless API for games with their own UI (no rail widget):
     HSGStreak.record({gameId, gameName, level, levelName, score,
                       minStreak, unit, onDone});   // prompt + save
     HSGStreak.renderBoardInto(elOrSelector, {gameId, level, minStreak, unit});
   ========================================================= */
(function () {
  'use strict';

  var PREFIX = 'hsg_lb_';
  var MAX = 10;
  var MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
  var LABELS = ['STREAK', 'STREAK', 'HEATING UP', 'ON FIRE!', 'BLAZING!', 'INFERNO!'];
  var CONFETTI_COLORS = ['#E0531B', '#E0A53B', '#2E8FE0', '#2A5C3F', '#D62828', '#C4A040'];

  // Inverted-score base for lower-is-better TIME boards (see the `soltime` unit): a
  // solve is stored as TIME_BASE - seconds so a faster time is a bigger number and
  // sorts first. 100000s (~27h) dwarfs any real solve, so the score stays a safe
  // positive integer well under the server's cap.
  var TIME_BASE = 100000;
  function fmtClock(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  // Per-metric presentation. `streak` is the default fire streak; every other unit
  // is a "highest value" metric and drives the rail widget with its own icon/label
  // (rIcon / rLabel) instead of the fire-streak escalation.
  var UNITS = {
    streak: { head: '🏆 Streak Leaderboard', score: function (n) { return '🔥 ' + n; },
              of: function (n) { return 'Streak of ' + n + '!'; }, claim: 'streak' },
    length: { head: '🏆 Longest Snakes',     score: function (n) { return '🐍 ' + n; },
              of: function (n) { return 'Length ' + n + '!'; }, claim: 'snake', rIcon: '🐍', rLabel: 'LENGTH' },
    wpm:    { head: '🏆 Fastest Racers',      score: function (n) { return n + ' wpm'; },
              of: function (n) { return n + ' WPM!'; },          claim: 'race', rIcon: '🏎️', rLabel: 'WPM' },
    towers: { head: '🏆 Top Flyers',          score: function (n) { return '🐲 ' + n; },
              of: function (n) { return n + ' towers!'; },       claim: 'flight', rIcon: '🐲', rLabel: 'TOWERS' },
    // money metric - score is stored in whole cents so sorting stays integer-clean
    takings: { head: "🏆 Day's Takings",       score: function (n) { return '$' + (n / 100).toFixed(2); },
              of: function (n) { return '$' + (n / 100).toFixed(2) + ' earned!'; }, claim: 'day', rIcon: '💰', rLabel: 'TAKINGS' },
    // distance metric - score is whole feet
    distance: { head: '🏁 Longest Runs',        score: function (n) { return n.toLocaleString() + ' ft'; },
              of: function (n) { return n.toLocaleString() + ' ft!'; },            claim: 'run', rIcon: '🏁', rLabel: 'FEET' },
    // miles metric - score is still stored in whole feet (so old runs and sorting
    // stay intact), but shown as miles to two decimals
    miles:  { head: '🏁 Longest Runs',        score: function (n) { return (n / 5280).toFixed(2) + ' mi'; },
              of: function (n) { return (n / 5280).toFixed(2) + ' miles!'; },       claim: 'run', rIcon: '🏁', rLabel: 'MILES' },
    // generic points metric - whole-number score, higher is better
    points: { head: '🏆 High Scores',           score: function (n) { return '⭐ ' + n.toLocaleString(); },
              of: function (n) { return n.toLocaleString() + ' pts!'; },           claim: 'score', rIcon: '⭐', rLabel: 'SCORE' },
    // Who Said It - score out of 24 (higher is better)
    wall24: { head: '🏆 Wall of Fame',           score: function (n) { return n + ' / 24'; },
              of: function (n) { return n + ' / 24!'; },                           claim: 'game', rIcon: '🏛️', rLabel: 'SCORE' },
    // Who Painted It - score out of 20 (higher is better)
    art20:  { head: '🏆 Master Curators',        score: function (n) { return n + ' / 20'; },
              of: function (n) { return n + ' / 20!'; },                           claim: 'game', rIcon: '🎨', rLabel: 'SCORE' },
    // Flag Frenzy - score out of 24 (higher is better)
    flags:  { head: '🏆 Flag Champions',        score: function (n) { return n + ' / 24'; },
              of: function (n) { return n + ' / 24!'; },                           claim: 'game', rIcon: '🚩', rLabel: 'SCORE' },
    // Map Quiz accuracy - a single integer encodes BOTH correct and wrong:
    //   score = correct*1000 + (999 - min(wrong,999))
    // so it sorts by most-correct first, then by fewest-wrong (best accuracy).
    // Displayed as "correct/total · pct%".
    mapscore: { head: '🗺️ Map Masters',
              score: function (n) { var c = Math.floor(n / 1000), w = 999 - (n % 1000), t = c + w, p = t ? Math.round(100 * c / t) : 100; return c + '/' + t + ' · ' + p + '%'; },
              of: function (n) { var c = Math.floor(n / 1000), w = 999 - (n % 1000), t = c + w, p = t ? Math.round(100 * c / t) : 100; return c + '/' + t + ' correct · ' + p + '%!'; },
              claim: 'map', rIcon: '🎯', rLabel: 'FOUND' },
    // Slide Puzzle solve time - LOWER is better. Stored inverted (TIME_BASE - seconds)
    // so faster solves rank first on the high-first board; display decodes to m:ss.
    soltime: { head: '🧩 Fastest Solves',
              score: function (n) { return fmtClock(TIME_BASE - n); },
              of:    function (n) { return 'Solved in ' + fmtClock(TIME_BASE - n) + '!'; },
              claim: 'solve', rIcon: '🧩', rLabel: 'TIME' },
    // Independence Day arcade - furthest wave held, tiebroken by hits: wave*1e5 + kills
    // (a deeper wave always outranks; equal waves sort by more kills). Higher is better.
    wave:   { head: '🕹 Furthest Waves',
              score: function (n) { return 'Wave ' + Math.floor(n / 100000) + ' · ' + (n % 100000) + ' hits'; },
              of:    function (n) { return 'Wave ' + Math.floor(n / 100000) + '!'; },
              claim: 'stand', rIcon: '🕹', rLabel: 'WAVE' },
    // Continuous-climb games (e.g. Tightrope) - highest level reached, higher is better.
    level:  { head: '🎪 Highest Climbers',
              score: function (n) { return 'Level ' + n; },
              of:    function (n) { return 'Level ' + n + '!'; },
              claim: 'climb', rIcon: '🎪', rLabel: 'LEVEL' },
    // Endless survival games (e.g. Tightrope) - how many rounds you stayed on, higher is better.
    rounds: { head: '🎪 Most Rounds Survived',
              score: function (n) { return n + (n === 1 ? ' round' : ' rounds'); },
              of:    function (n) { return 'Survived ' + n + (n === 1 ? ' round' : ' rounds') + '!'; },
              claim: 'run', rIcon: '🎪', rLabel: 'ROUNDS' }
  };
  function unitOf(u) { return UNITS[u] || UNITS.streak; }

  // ---- storage (keyed by the full game+level key) ----
  function levelKey(gameId, level) {
    return PREFIX + gameId + (level ? '__' + level : '');
  }
  function load(key) {
    try {
      var raw = localStorage.getItem(key);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.filter(function (e) { return e && typeof e.name === 'string' && typeof e.score === 'number'; });
    } catch (e) { return []; }
  }
  function save(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
  }
  function byScore(a, b) { return (b.score - a.score) || (a.ts - b.ts); }

  // ---- shared global boards (Cloudflare Pages Functions + D1) ----
  // localStorage stays as an instant, offline-safe cache of the last-seen global
  // board. Reads paint the cache immediately, then refresh from /api/top. Writes
  // record locally (optimistic) and POST to /api/score, reconciling from the reply.
  var API_BASE = '/api';
  var FETCH_TIMEOUT = 1500;
  function remoteEnabled() {
    return typeof fetch === 'function' &&
      typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
  }
  // normalize server rows into the same shape load()/boardHTML expect
  function normalizeList(list) {
    if (!Array.isArray(list)) return null;
    return list.filter(function (e) { return e && typeof e.name === 'string' && typeof e.score === 'number'; })
      .map(function (e) { return { name: e.name, score: e.score, ts: e.ts || 0, hinted: !!e.hinted }; })
      .slice(0, MAX);
  }

  // ---- pending queue: scores saved locally but not yet confirmed by the server.
  // A save records optimistically AND queues here; every board refresh re-submits
  // anything still pending, so a dropped/cancelled POST never loses the score.
  var PENDING_PREFIX = 'hsg_lbq_';
  function loadPending(key) {
    try { var raw = localStorage.getItem(PENDING_PREFIX + key); var l = raw ? JSON.parse(raw) : []; return Array.isArray(l) ? l : []; }
    catch (e) { return []; }
  }
  function savePending(key, list) {
    try {
      if (list && list.length) localStorage.setItem(PENDING_PREFIX + key, JSON.stringify(list.slice(0, 20)));
      else localStorage.removeItem(PENDING_PREFIX + key);
    } catch (e) {}
  }
  function addPending(key, entry) {
    var l = loadPending(key);
    if (!l.some(function (e) { return e.ts === entry.ts; })) { l.push(entry); savePending(key, l); }
  }
  function removePending(key, ts) {
    savePending(key, loadPending(key).filter(function (e) { return e.ts !== ts; }));
  }
  // display list = server list plus any still-pending local entries (deduped by ts)
  function mergeWithPending(key, serverList) {
    var pend = loadPending(key);
    if (!pend.length) return serverList;
    var seen = {};
    serverList.forEach(function (e) { seen[e.ts] = true; });
    var merged = serverList.concat(pend.filter(function (e) { return !seen[e.ts]; }));
    merged.sort(byScore);
    return merged.slice(0, MAX);
  }
  // re-POST everything still queued for this board (fire-and-forget)
  function flushPending(key) {
    if (!remoteEnabled()) return;
    loadPending(key).forEach(function (e) { submitScore(key, e); });
  }

  // GET the global top-10 for a board; on success refresh the cache (merged with
  // any pending local scores) and retry pending submits. Any failure (offline,
  // timeout, error) resolves null and the cache is left untouched.
  function fetchTop(key) {
    if (!remoteEnabled()) return Promise.resolve(null);
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT) : null;
    return fetch(API_BASE + '/top?board=' + encodeURIComponent(key), ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (list) {
        if (timer) clearTimeout(timer);
        var norm = normalizeList(list);
        if (norm) { var shown = mergeWithPending(key, norm); save(key, shown); flushPending(key); return shown; }
        return null;
      })
      .catch(function () { if (timer) clearTimeout(timer); return null; });
  }
  // Fetch the latest board, then run cb() regardless of outcome (cache is the
  // fallback). Keeps render paths sync-first: caller paints cache, then repaints.
  function withFreshBoard(key, cb) { fetchTop(key).then(function () { cb(); }); }
  // Queue + POST a score. Resolves { top, rank } on success (and clears it from
  // the queue), null otherwise. Malformed (400) is dropped; network/5xx/429 stay
  // queued for the next flush so the score is never lost.
  // ts of entries whose POST is currently outstanding. Guards against a board
  // refresh's flushPending firing a SECOND POST for the same entry while the first
  // is still in flight - which the server would otherwise store as a duplicate row.
  var inFlight = {};
  function submitScore(key, entry) {
    entry = { name: formatName(entry.name), score: entry.score, hinted: !!entry.hinted, ts: entry.ts };
    addPending(key, entry);   // queue first, so a failed/cancelled POST still retries later
    if (!remoteEnabled()) return Promise.resolve(null);
    var flightKey = key + '|' + entry.ts;
    if (inFlight[flightKey]) return Promise.resolve(null);   // this exact entry is already being POSTed
    inFlight[flightKey] = true;
    var clear = function () { delete inFlight[flightKey]; };
    return fetch(API_BASE + '/score', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board: key, name: entry.name, score: entry.score,
        hinted: entry.hinted ? 1 : 0, ts: entry.ts
      })
    })
      .then(function (r) { return r.text().then(function (t) { var b = null; try { b = JSON.parse(t); } catch (e) {} return { status: r.status, body: b }; }); })
      .then(function (resp) {
        clear();
        if (resp.status >= 200 && resp.status < 300 && resp.body && Array.isArray(resp.body.top)) {
          removePending(key, entry.ts);
          save(key, mergeWithPending(key, normalizeList(resp.body.top)));
          return resp.body;
        }
        if (resp.status === 400) removePending(key, entry.ts);   // malformed - never going to succeed
        return null;                                             // else keep queued for retry
      })
      .catch(function () { clear(); return null; });             // network error - keep queued
  }

  function qualifies(key, score, minStreak) {
    if (!score || score < (minStreak || 1)) return false;
    var list = load(key);
    if (list.length < MAX) return true;
    return score > list[list.length - 1].score;
  }
  // Where would `score` land right now (1-based)? Ties sit below equal earlier scores.
  function projectedRank(key, score) {
    var list = load(key).slice();
    var marker = { name: ' new', score: score, ts: Number.MAX_SAFE_INTEGER };
    list.push(marker);
    list.sort(byScore);
    for (var i = 0; i < list.length; i++) if (list[i] === marker) return i + 1;
    return list.length;
  }
  // Insert a real entry; returns { list, rank, ts }.
  function addScore(key, rawName, score, hinted) {
    var list = load(key);
    var ts = Date.now();
    var entry = { name: formatName(rawName), score: score, ts: ts };
    if (hinted) entry.hinted = true;
    list.push(entry);
    list.sort(byScore);
    list = list.slice(0, MAX);
    save(key, list);
    var rank = 0;
    for (var i = 0; i < list.length; i++) if (list[i].ts === ts) { rank = i + 1; break; }
    return { list: list, rank: rank, ts: ts };
  }

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function placeBadge(rank) { return MEDALS[rank] || ('#' + rank); }

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
  function resolveAll(m) {
    if (!m) return [];
    if (typeof m === 'string') return Array.prototype.slice.call(document.querySelectorAll(m));
    if (m.nodeType === 1) return [m];
    if (typeof m.length === 'number') return Array.prototype.slice.call(m);
    return [];
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
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      p.style.animationDuration = (1.1 + Math.random() * 0.9) + 's';
      p.style.animationDelay = (Math.random() * 0.25) + 's';
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

  // ---- name-entry modal (now shows the placement just earned) ----
  function openModal(opts) {
    var u = unitOf(opts.unit);
    var where = esc(opts.gameName) + (opts.levelName ? ' - ' + esc(opts.levelName) : '');
    var place = opts.rank ? (placeBadge(opts.rank) + ' ' + ordinal(opts.rank) + ' place') : 'the Top 10';
    var overlay = document.createElement('div');
    overlay.className = 'hsg-overlay';
    overlay.innerHTML =
      '<div class="hsg-modal" role="dialog" aria-modal="true" aria-label="New high score">' +
        '<div class="big-flame">' + (opts.rank === 1 ? '🏆' : '🔥') + '</div>' +
        '<h3>' + esc(u.of(opts.score)) + '</h3>' +
        '<p class="sub">You took <strong>' + place + '</strong> in ' + where +
          '. Add your name to the leaderboard!</p>' +
        '<input type="text" maxlength="24" placeholder="Your name" autocomplete="off" ' +
          'autocorrect="off" spellcheck="false" value="' + esc(opts.prefill || '') + '" />' +
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
    setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 30);
  }

  // ---- board rendering (shared by rail + headless API) ----
  function boardHTML(key, opts) {
    var u = unitOf(opts.unit);
    var list = load(key);
    var min = opts.minStreak || 1;
    if (!list.length) {
      var isStreak = !opts.unit || opts.unit === 'streak';
      var prompt = min <= 1
        ? 'Be the first to claim a spot!'
        : (isStreak ? 'Get <strong>' + min + ' in a row</strong> to claim a spot!'
                    : 'Reach <strong>' + min + '</strong> to claim a spot!');
      return '<div class="hsg-board-head"><h2>' + u.head + '</h2></div>' +
        '<p class="hsg-board-empty">No scores yet.<br>' + prompt + '</p>';
    }
    var anyHinted = false;
    var rows = list.map(function (e, i) {
      var rank = i + 1;
      var badge = MEDALS[rank] || rank;
      var isNew = (opts.highlightTs && e.ts === opts.highlightTs) ? ' is-new' : '';
      var star = e.hinted ? '<span class="hsg-hint-star" title="used hints">*</span>' : '';
      if (e.hinted) anyHinted = true;
      return '<li class="hsg-board-row' + isNew + '">' +
          '<span class="hsg-board-rank">' + badge + '</span>' +
          '<span class="hsg-board-name">' + esc(e.name) + star + '</span>' +
          '<span class="hsg-board-score">' + u.score(e.score) + '</span>' +
        '</li>';
    }).join('');
    var clearBtn = opts.allowClear === false ? '' :
      '<button type="button" class="hsg-board-clear">Clear</button>';
    var legend = anyHinted ? '<p class="hsg-board-legend"><span class="hsg-hint-star">*</span> used hints</p>' : '';
    return '<div class="hsg-board-head"><h2>' + u.head + '</h2>' + clearBtn + '</div>' +
      '<ol class="hsg-board-list">' + rows + '</ol>' + legend;
  }

  // ---- inline end-of-game panel (no popup) ----
  // Renders the leaderboard into `target`; if the score makes the Top 10 it shows
  // an inline placement banner + name entry above the board. onSaved(rank) fires
  // after the player saves their name.
  function endPanel(elOrSel, opts) {
    var targets = resolveAll(elOrSel);
    if (!targets.length) return;
    var key = levelKey(opts.gameId, opts.level || '');
    var min = opts.minStreak || 1;
    // Instant: paint the cached board (no prompt yet) so there's no blank flash.
    targets.forEach(function (host) {
      host.classList.add('hsg-endpanel');
      host.innerHTML = boardHTML(key, { unit: opts.unit, minStreak: min, allowClear: false });
    });
    // Then refresh from the global board and draw the real panel - the "did you
    // make the Top 10?" decision is against the freshest board, not a stale cache.
    withFreshBoard(key, function () {
      var canEnter = qualifies(key, opts.score, min);
      targets.forEach(function (host) {
        function draw(highlightTs, entered) {
          var promptHTML = '';
          if (canEnter && !entered) {
            var rank = projectedRank(key, opts.score);
            var star = opts.hinted ? ' <span class="hsg-hint-star">*</span>' : '';
            promptHTML =
              '<div class="hsg-ep-prompt">' +
                '<p class="hsg-ep-place">' + placeBadge(rank) + ' You took <strong>' + ordinal(rank) + ' place</strong>' +
                  (opts.levelName ? ' - ' + esc(opts.levelName) : '') + '!' + star + '</p>' +
                '<div class="hsg-ep-row">' +
                  '<input class="hsg-ep-input" type="text" maxlength="24" placeholder="Your name" ' +
                    'autocomplete="off" autocorrect="off" spellcheck="false" value="' + esc(lastName()) + '">' +
                  '<button type="button" class="hsg-ep-save">Save</button>' +
                '</div>' +
              '</div>';
          }
          host.innerHTML = promptHTML +
            boardHTML(key, { unit: opts.unit, minStreak: min, highlightTs: highlightTs, allowClear: false });
          var saveBtn = host.querySelector('.hsg-ep-save');
          if (saveBtn) {
            var input = host.querySelector('.hsg-ep-input');
            var doSave = function () {
              if (saveBtn.disabled) return;
              saveBtn.disabled = true;
              var v = input.value;
              setLastName(v);
              var res = addScore(key, v, opts.score, opts.hinted);   // optimistic local
              draw(res.ts, true);
              if (opts.onSaved) opts.onSaved(res.rank);
              submitScore(key, { name: v, score: opts.score, hinted: opts.hinted, ts: res.ts })
                .then(function (sr) { if (sr) draw(res.ts, true); });  // reconcile board with the server
            };
            saveBtn.addEventListener('click', doSave);
            input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
          }
        }
        draw(null, false);
      });
    });
  }

  // ---- Rail ----
  function Rail(opts) {
    this.gameId = opts.gameId;
    this.gameName = opts.gameName || 'this game';
    this.minStreak = opts.minStreak || 5;
    this.unit = opts.unit || 'streak';
    this.level = opts.level || '';
    this.levelName = opts.levelName || '';
    this.value = 0;
    this.best = 0;            // longest streak / highest value THIS session
    this._hinted = false;     // did the player use a hint this run?
    this._recordFired = false;
    this._modalOpen = false;
    this.mount = resolveMount(opts.mount);
    this.extraBoards = resolveAll(opts.boardMount);
    this.extraBoards.forEach(function (el) { el.classList.add('hsg-board'); });
    if (this.mount) this._build();
    this.renderBoard();
    this._paint(false);
  }

  Rail.prototype._key = function () { return levelKey(this.gameId, this.level); };

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
    var l = load(this._key());
    return l.length ? l[0].score : 0;
  };

  Rail.prototype._paint = function (animate) {
    if (!this.streakEl) return;
    this.countEl.textContent = this.value;
    if (!this.unit || this.unit === 'streak') {   // fire-streak escalation
      var lvl = levelFor(this.value);
      this.streakEl.dataset.level = lvl;
      this.flameEl.textContent = lvl >= 5 ? '❄️🔥' : '🔥';
      this.labelEl.textContent = LABELS[lvl];
      edgeGlow(lvl);
    } else {                                       // a highest-value metric (length / wpm / points…)
      var u = unitOf(this.unit);
      this.streakEl.dataset.level = 1;             // steady, non-escalating look
      this.flameEl.textContent = u.rIcon || '⭐';
      this.labelEl.textContent = u.rLabel || 'SCORE';
    }
    this.bestEl.textContent = 'best  ' + Math.max(this.best, this.bestToBeat());
    if (animate) {
      var el = this.streakEl;
      el.classList.remove('bump');
      void el.offsetWidth;
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
    if (this.value > this.best) this.best = this.value;
    this._paint(true);
    var btb = this.bestToBeat();
    if (!this._recordFired && this.value >= this.minStreak && this.value > btb) {
      this._recordFired = true;
      toast('🔥 NEW RECORD - ' + this.value + '!');
      fireConfetti();
    }
  };

  // set the live value directly (length / cumulative score metrics)
  Rail.prototype.set = function (n) {
    this.value = n;
    if (n > this.best) this.best = n;
    this._paint(false);
  };

  // streak snapped but the game continues - no prompt, keep the session best
  Rail.prototype.broke = function () {
    this.value = 0;
    this._recordFired = false;
    this._paint(false);
  };

  // mark that the player used a hint this run (baked into the recorded entry)
  Rail.prototype.usedHint = function () { this._hinted = true; };

  // game over OR quit - bank the session best (or an explicit score). If `target`
  // is given, render the placement + name entry INLINE into that element (no
  // popup); otherwise fall back to the modal. Records only if it makes the Top 10.
  Rail.prototype.gameOver = function (scoreOverride, target) {
    var score = (typeof scoreOverride === 'number') ? scoreOverride : this.best;
    var key = this._key();
    var hinted = this._hinted;
    var self = this;
    this.value = 0; this.best = 0; this._recordFired = false; this._hinted = false;
    this._paint(false);
    if (target) {   // inline end-screen panel - the preferred, no-popup path
      endPanel(target, {
        gameId: this.gameId, gameName: this.gameName, level: this.level,
        levelName: this.levelName, unit: this.unit, score: score,
        minStreak: this.minStreak, hinted: hinted,
        onSaved: function () { self.renderBoard(); self._paint(false); }
      });
      return true;
    }
    if (this._modalOpen) return false;
    // When offline, fall back to the sync cache check; when online, decide against
    // the freshly-fetched global board.
    if (!remoteEnabled() && !qualifies(key, score, this.minStreak)) return false;
    this._modalOpen = true;
    withFreshBoard(key, function () {
      if (!qualifies(key, score, self.minStreak)) { self._modalOpen = false; return; }
      openModal({
        gameName: self.gameName, levelName: self.levelName, unit: self.unit,
        score: score, rank: projectedRank(key, score), prefill: lastName(),
        onSave: function (raw) {
          self._modalOpen = false;
          setLastName(raw);
          var res = addScore(key, raw, score, hinted);
          self.renderBoard(res.ts, true);
          self._paint(false);
          submitScore(key, { name: raw, score: score, hinted: hinted, ts: res.ts })
            .then(function (sr) { if (sr) self.renderBoard(res.ts, true); });
        },
        onSkip: function () { self._modalOpen = false; }
      });
    });
    return true;
  };

  // silent reset (new game) - clears live value, session best, and hint flag
  Rail.prototype.reset = function () {
    this.value = 0; this.best = 0; this._recordFired = false; this._hinted = false;
    this._paint(false);
  };

  // switch to a different level: bank the current run (prompts only if it
  // qualifies), then point the board at the new level and reset.
  Rail.prototype.setLevel = function (level, levelName) {
    if (this.best > 0) this.gameOver();        // bank the run we're leaving
    this.level = level || '';
    this.levelName = levelName || '';
    this.value = 0; this.best = 0; this._recordFired = false; this._hinted = false;
    this.renderBoard();
    this._paint(false);
  };

  Rail.prototype.clear = function () {
    if (window.confirm('Clear your local copy of this board? The shared leaderboard is not affected.')) {
      try { localStorage.removeItem(this._key()); } catch (e) {}
      this.renderBoard();
      this._paint(false);
    }
  };

  Rail.prototype.renderBoard = function (highlightTs, skipRemote) {
    var targets = (this.boardEl ? [this.boardEl] : []).concat(this.extraBoards || []);
    if (!targets.length) return;
    var self = this;
    var key = this._key();
    function paint() {
      var inner = boardHTML(key, {
        unit: self.unit, minStreak: self.minStreak, highlightTs: highlightTs
      });
      targets.forEach(function (el) {
        el.innerHTML = inner;
        var clearBtn = el.querySelector('.hsg-board-clear');
        if (clearBtn) clearBtn.addEventListener('click', function () { self.clear(); });
      });
    }
    paint();
    // Pull the latest global board in the background, then repaint + refresh the
    // "best to beat" readout. skipRemote avoids a redundant fetch right after a save.
    if (!skipRemote) withFreshBoard(key, function () { paint(); self._paint(false); });
  };

  // ---- remember the last name entered (across all games) ----
  var NAME_KEY = 'hsg_player_name';
  function lastName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function setLastName(raw) {
    var s = (raw == null ? '' : String(raw)).trim();
    if (s) { try { localStorage.setItem(NAME_KEY, s); } catch (e) {} }
  }

  // ---- headless API: for games that keep their own UI (no rail widget) ----
  // Prompts (if the score qualifies) and records it. Calls onDone(rank|null).
  function record(opts) {
    var key = levelKey(opts.gameId, opts.level || '');
    var min = opts.minStreak || 1;
    // Refresh from the global board first so the "made the Top 10?" check is live.
    withFreshBoard(key, function () {
      if (!qualifies(key, opts.score, min)) { if (opts.onDone) opts.onDone(null); return; }
      openModal({
        gameName: opts.gameName || 'this game', levelName: opts.levelName || '',
        unit: opts.unit, score: opts.score, rank: projectedRank(key, opts.score),
        prefill: lastName(),
        onSave: function (raw) {
          setLastName(raw);
          var res = addScore(key, raw, opts.score, opts.hinted);
          // onDone often navigates, so fire it once (optimistic); the POST syncs
          // the cache in the background for the next board render.
          if (opts.onDone) opts.onDone(res.rank, res.ts);
          submitScore(key, { name: raw, score: opts.score, hinted: opts.hinted, ts: res.ts });
        },
        onSkip: function () { if (opts.onDone) opts.onDone(null); }
      });
    });
    return true;
  }

  function renderBoardInto(elOrSel, opts) {
    var targets = resolveAll(elOrSel);
    if (!targets.length) return;
    var key = levelKey(opts.gameId, opts.level || '');
    function paint() {
      var inner = boardHTML(key, {
        unit: opts.unit, minStreak: opts.minStreak,
        highlightTs: opts.highlightTs, allowClear: opts.allowClear
      });
      targets.forEach(function (el) {
        el.classList.add('hsg-board');
        el.innerHTML = inner;
        var clearBtn = el.querySelector('.hsg-board-clear');
        if (clearBtn) clearBtn.addEventListener('click', function () {
          if (window.confirm('Clear your local copy of this board? The shared leaderboard is not affected.')) {
            try { localStorage.removeItem(key); } catch (e) {}
            renderBoardInto(elOrSel, opts);
          }
        });
      });
    }
    paint();                       // instant from cache
    withFreshBoard(key, paint);    // then the live global board
  }

  // ---- start-screen "targets to beat": one collapsible board per difficulty ----
  // opts: { gameId, unit, minStreak, levels:[{key,label,icon}], title }. Each row
  // shows the level's current #1; clicking it expands that level's full Top-10.
  function levelBoards(elOrSel, opts) {
    var targets = resolveAll(elOrSel);
    if (!targets.length) return;
    var levels = opts.levels || [];
    var unit = opts.unit, min = opts.minStreak || 1, gameId = opts.gameId;
    var u = unitOf(unit);
    var openKey = null;   // which level is expanded (persists across repaints)
    function rowHTML(lv) {
      var key = levelKey(gameId, lv.key || '');
      var list = load(key), top = list.length ? list[0] : null;
      var open = (lv.key || '') === openKey;
      var summary = top
        ? '<span class="lbv-top-name">' + esc(top.name) + '</span><span class="lbv-top-score">' + u.score(top.score) + '</span>'
        : '<span class="lbv-top-empty">be the first</span>';
      var body = open ? '<div class="lbv-body">' + boardHTML(key, { unit: unit, minStreak: min, allowClear: false }) + '</div>' : '';
      return '<div class="lbv-lv' + (open ? ' open' : '') + '" data-lv="' + esc(lv.key || '') + '">' +
        '<button type="button" class="lbv-head">' +
          '<span class="lbv-name">' + (lv.icon ? esc(lv.icon) + ' ' : '') + esc(lv.label) + '</span>' +
          '<span class="lbv-top">' + summary + '</span>' +
          '<span class="lbv-caret">' + (open ? '▴' : '▾') + '</span>' +
        '</button>' + body + '</div>';
    }
    function paint() {
      targets.forEach(function (host) {
        host.classList.add('lbv');
        host.innerHTML = '<div class="lbv-title">' + esc(opts.title || '🏆 Leaderboards — scores to beat') + '</div>' +
          '<div class="lbv-list">' + levels.map(rowHTML).join('') + '</div>';
        host.querySelectorAll('.lbv-head').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var k = btn.parentNode.getAttribute('data-lv');
            openKey = (openKey === k) ? null : k;
            paint();
          });
        });
      });
    }
    paint();   // instant from cache
    // refresh each level's global board, repaint as each lands
    levels.forEach(function (lv) { withFreshBoard(levelKey(gameId, lv.key || ''), paint); });
  }

  window.HSGStreak = {
    init: function (opts) { return new Rail(opts); },
    record: record,
    endPanel: endPanel,
    renderBoardInto: renderBoardInto,
    levelBoards: levelBoards,
    // Format a raw score with a unit's display rule (e.g. 'miles' -> '6.40 mi').
    formatScore: function (unit, n) { return unitOf(unit).score(n); },
    // Human heading for a unit (e.g. 'wpm' -> '🏆 Fastest Racers').
    unitHead: function (unit) { return unitOf(unit).head; },
    qualifies: function (gameId, level, score, minStreak) { return qualifies(levelKey(gameId, level), score, minStreak); },
    bestScore: function (gameId, level) { var l = load(levelKey(gameId, level)); return l.length ? l[0].score : 0; },
    // Turn a raw solve time (seconds) into the inverted score a `soltime` board expects.
    encodeTime: function (seconds) { return TIME_BASE - Math.max(0, Math.floor(seconds)); },
    formatName: formatName,
    lastName: lastName
  };
})();
