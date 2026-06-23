// ============================================================
// HSGBridge — real-time "lay-the-path runner".
// Pick a difficulty -> 3·2·1·GO -> your character WALKS forward at a steady
// speed and never stops. Every correct answer drops the next block ahead of
// him; if he reaches the end of the laid path he falls into the chasm. Reach
// the far platform to clear the level — each level is faster, harder, and has
// new terrain (canyon, volcano, skyscrapers, sky).
//
// Self-contained: injects CSS, builds DOM, runs the loop. Reusable: pass
// tiers + makeQuestion(level, tierKey).
//
// HSGBridge.init({ mount, rail, tiers:[{key,label,desc}], makeQuestion(level,tier) })
// ============================================================
(function () {
  const W = 54, START_PLAT = 96, RUN_X0 = 48, HEAD_START = 5, KEYS = ['A','B','C','D'];
  const GROUND_BOTTOM = 34;   // % of stage height where the path sits

  // base walking speed (px/sec) per difficulty tier index
  const TIER_SPEED = [26, 34, 44, 56];

  const TERRAINS = [
    { key:'canyon',  sky:'linear-gradient(#cfeaf5,#e8f4f8)', abyss:'linear-gradient(#7a6650,#2a2018 60%,#140f0a)',
      block:'linear-gradient(#9b7a4f,#7a5e3a)', plat:'#7a6a4a', deco:'canyon' },
    { key:'volcano', sky:'linear-gradient(#39202e,#7a3b2e)', abyss:'linear-gradient(#ffb24a,#ff5a00 40%,#7a1500)',
      block:'linear-gradient(#4a3a30,#2c211b)', plat:'#3a2c22', deco:'volcano' },
    { key:'city',    sky:'linear-gradient(#bfe0f5,#eaf5fb)', abyss:'linear-gradient(#9fb0c0,#5a6a78)',
      block:'linear-gradient(#d8b25a,#b5903a)', plat:'#caa24a', deco:'city', rope:true },
    { key:'sky',     sky:'linear-gradient(#6fb7ef,#bfe3f7)', abyss:'linear-gradient(rgba(255,255,255,.5),rgba(255,255,255,0))',
      block:'linear-gradient(#eee,#cfcfcf)', plat:'#dcdcdc', deco:'sky', rope:true },
  ];

  const style = document.createElement('style');
  style.textContent = `
    .br-wrap { max-width: 820px; margin: 0 auto; font-family: var(--font-sans); }
    .br-hud { display:flex; gap:.5rem; align-items:center; margin-bottom:.5rem; }
    .br-pill { background:var(--cream-dark); border:1.5px solid var(--border); border-radius:99px;
      padding:.35rem .85rem; font-weight:700; font-size:.85rem; color:var(--ink); }
    .br-leadbar { flex:1; height:12px; border-radius:99px; background:var(--cream-dark);
      border:1.5px solid var(--border); overflow:hidden; max-width:240px; margin-left:auto; }
    .br-leadbar > i { display:block; height:100%; width:100%; background:var(--green); transition:width .12s linear; }
    .br-leadbar.danger > i { background:var(--red); }

    .br-stage { position:relative; height:400px; border:2px solid var(--border); border-radius:14px;
      overflow:hidden; box-shadow:0 2px 10px rgba(26,23,20,.1); }
    .br-world { position:absolute; inset:0; will-change:transform; }
    .br-sky { position:absolute; inset:0; }
    .br-abyss { position:absolute; left:0; right:0; bottom:0; height:${GROUND_BOTTOM}%; }
    .br-deco { position:absolute; inset:0; pointer-events:none; }

    .br-block { position:absolute; height:14px; width:${W}px; border-radius:3px; box-shadow:0 3px 4px rgba(0,0,0,.28); }
    .br-block.new { animation:brDrop .28s cubic-bezier(.3,1.5,.5,1); }
    @keyframes brDrop { from{ transform:translateY(-34px); opacity:.2; } to{ transform:none; opacity:1; } }
    .br-rope { position:absolute; height:3px; background:#6b5436; box-shadow:0 1px 0 rgba(0,0,0,.3); }
    .br-plat { position:absolute; height:40px; border-radius:4px 4px 0 0; }

    .br-char { position:absolute; width:42px; height:64px; transform:translateX(-50%);
      transition:transform .25s; }
    .br-char svg { width:42px; height:64px; overflow:visible; display:block; }
    .br-char svg line { stroke:#2c2722; stroke-width:5; stroke-linecap:round; }
    .br-char svg .body { stroke-width:6; }
    .br-char svg circle { fill:#f2c98a; stroke:#2c2722; stroke-width:3; }
    .br-char svg .shirt { stroke:#C4A040; }
    .br-leg, .br-arm { transform-box:view-box; }
    .br-leg { transform-origin:21px 40px; }
    .br-arm { transform-origin:21px 25px; }
    .br-char.walk { animation:brBob var(--wd,.5s) linear infinite; }
    .br-char.walk .br-leg-a { animation:brLegA var(--wd,.5s) linear infinite; }
    .br-char.walk .br-leg-b { animation:brLegB var(--wd,.5s) linear infinite; }
    .br-char.walk .br-arm-a { animation:brArmA var(--wd,.5s) linear infinite; }
    .br-char.walk .br-arm-b { animation:brArmB var(--wd,.5s) linear infinite; }
    @keyframes brBob  { 0%,100%{ transform:translateX(-50%) translateY(0);} 50%{ transform:translateX(-50%) translateY(-3px);} }
    @keyframes brLegA { 0%,100%{ transform:rotate(24deg);} 50%{ transform:rotate(-24deg);} }
    @keyframes brLegB { 0%,100%{ transform:rotate(-24deg);} 50%{ transform:rotate(24deg);} }
    @keyframes brArmA { 0%,100%{ transform:rotate(-20deg);} 50%{ transform:rotate(20deg);} }
    @keyframes brArmB { 0%,100%{ transform:rotate(20deg);} 50%{ transform:rotate(-20deg);} }
    .br-char.fall { animation:brFall 1s cubic-bezier(.5,.1,.7,1) forwards; }
    @keyframes brFall { to { transform:translateX(-50%) translateY(240px) rotate(500deg); opacity:0; } }
    .br-char.cheer { animation:brCheer .6s ease; }
    @keyframes brCheer { 0%,100%{ transform:translateX(-50%) translateY(0);} 45%{ transform:translateX(-50%) translateY(-22px);} }

    .br-prompt { position:absolute; top:14px; left:50%; transform:translateX(-50%);
      background:rgba(255,255,255,.92); border:2px solid var(--border); border-radius:12px;
      padding:.4rem 1.1rem; font-family:var(--font-serif); font-weight:600; font-size:clamp(1.6rem,4.5vw,2.4rem);
      color:var(--ink); white-space:nowrap; box-shadow:0 3px 10px rgba(26,23,20,.15); }
    .br-stage.flash-g::after, .br-stage.flash-r::after { content:''; position:absolute; inset:0; pointer-events:none; }
    .br-stage.flash-g::after { box-shadow:inset 0 0 0 5px var(--green); animation:brFade .35s ease forwards; }
    .br-stage.flash-r::after { box-shadow:inset 0 0 0 5px var(--red);   animation:brFade .35s ease forwards; }
    @keyframes brFade { from{ opacity:1; } to{ opacity:0; } }
    .br-danger { position:absolute; inset:0; pointer-events:none; opacity:0; transition:opacity .2s;
      box-shadow:inset 0 0 60px 12px rgba(139,32,32,.6); }
    .br-danger.on { opacity:1; animation:brPulse .6s ease-in-out infinite; }
    @keyframes brPulse { 0%,100%{ opacity:.55; } 50%{ opacity:1; } }

    .br-countdown { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      font-family:var(--font-serif); font-weight:700; font-size:6rem; color:#fff; text-shadow:0 4px 16px rgba(0,0,0,.4);
      pointer-events:none; }
    .br-countdown span { animation:brCount .6s ease; }
    @keyframes brCount { 0%{ opacity:0; transform:scale(.3);} 40%{ opacity:1; transform:scale(1.1);} 100%{ opacity:.85; transform:scale(1);} }

    .br-answers { display:grid; grid-template-columns:1fr 1fr; gap:.6rem; margin-top:.75rem; }
    .br-opt { background:#fff; border:2.5px solid var(--border); border-radius:12px; padding:.85rem;
      font-family:var(--font-serif); font-size:1.5rem; font-weight:600; color:var(--ink); cursor:pointer;
      display:flex; align-items:center; justify-content:center; gap:.5rem; min-height:60px;
      box-shadow:0 2px 6px rgba(26,23,20,.07); transition:border-color .1s, background .1s, transform .08s; }
    .br-opt .k { font-family:var(--font-sans); font-size:.7rem; font-weight:700; color:var(--ink-light);
      background:var(--cream-dark); border-radius:5px; padding:.1rem .4rem; }
    .br-opt:hover { border-color:var(--gold); background:#FFFDF4; transform:translateY(-2px); }
    @media (max-width:480px){ .br-answers{ grid-template-columns:1fr 1fr; } .br-opt{ font-size:1.25rem; min-height:52px; } }

    .br-start { position:absolute; inset:0; background:rgba(26,23,20,.55); backdrop-filter:blur(3px);
      display:flex; align-items:center; justify-content:center; z-index:5; }
    .br-start-card { background:var(--cream); border:2px solid var(--border); border-radius:16px;
      padding:1.1rem 1.25rem; max-width:380px; width:90%; text-align:center; box-shadow:0 16px 50px rgba(26,23,20,.35); }
    .br-start-card h2 { font-family:var(--font-serif); margin:0 0 .1rem; font-size:1.5rem; }
    .br-start-card p { margin:0 0 .7rem; color:var(--ink-light); font-size:.85rem; line-height:1.35; }
    .br-tier { display:block; width:100%; text-align:left; background:#fff; border:2px solid var(--border);
      border-radius:12px; padding:.55rem .85rem; margin-bottom:.45rem; cursor:pointer; transition:all .12s; }
    .br-tier:hover { border-color:var(--gold); transform:translateY(-2px); }
    .br-tier b { font-family:var(--font-serif); font-size:1.15rem; }
    .br-tier span { display:block; font-size:.8rem; color:var(--ink-light); }
    .br-tier .em { color:var(--gold); }
  `;
  (document.head || document.documentElement).appendChild(style);

  const CHAR_SVG = `<svg viewBox="0 0 42 64">
    <g class="br-arm br-arm-b"><line x1="21" y1="25" x2="11" y2="38"/></g>
    <g class="br-leg br-leg-b"><line x1="21" y1="40" x2="13" y2="58"/></g>
    <line class="body shirt" x1="21" y1="24" x2="21" y2="40"/>
    <circle cx="21" cy="14" r="8"/>
    <g class="br-arm br-arm-a"><line x1="21" y1="25" x2="31" y2="38"/></g>
    <g class="br-leg br-leg-a"><line x1="21" y1="40" x2="29" y2="58"/></g>
  </svg>`;

  function init(cfg) {
    const mount = cfg.mount;
    const rail = cfg.rail || { hit(){}, end(){}, reset(){} };
    const tiers = cfg.tiers || [{ key:'easy', label:'Easy', desc:'' }];
    const makeQuestion = cfg.makeQuestion;
    const fx = window.HSGfx, snd = window.HSGSound || { correct(){}, wrong(){}, streak(){}, tick(){}, finish(){} };

    mount.innerHTML = `
      <div class="br-wrap">
        <div class="br-hud">
          <span class="br-pill" data-level>Level 1</span>
          <span class="br-pill" data-dist>0 m</span>
          <div class="br-leadbar"><i></i></div>
        </div>
        <div class="br-stage">
          <div class="br-world">
            <div class="br-sky"></div>
            <div class="br-abyss"></div>
            <div class="br-deco"></div>
            <div class="br-blocks"></div>
            <div class="br-plats"></div>
          </div>
          <div class="br-char">${CHAR_SVG}</div>
          <div class="br-prompt" style="display:none"></div>
          <div class="br-danger"></div>
          <div class="br-countdown" style="display:none"></div>
          <div class="br-start"></div>
        </div>
        <div class="br-answers"></div>
      </div>`;

    const $ = s => mount.querySelector(s);
    const stage = $('.br-stage'), world = $('.br-world'), sky = $('.br-sky'), abyss = $('.br-abyss'),
      deco = $('.br-deco'), blocksEl = $('.br-blocks'), platsEl = $('.br-plats'), charEl = $('.br-char'),
      promptEl = $('.br-prompt'), dangerEl = $('.br-danger'), cdEl = $('.br-countdown'),
      startEl = $('.br-start'), answersEl = $('.br-answers'),
      levelEl = $('[data-level]'), distEl = $('[data-dist]'), leadbar = $('.br-leadbar'), leadFill = $('.br-leadbar > i');

    let tierIdx = 0, level = 1, terrain, q;
    let runnerX, builtBlocks, target, speed, coasting;
    let running = false, over = false, raf = 0, lastTs = 0;
    let totalCorrect = 0, totalQ = 0, streak = 0, bestStreak = 0, distanceBase = 0;
    let charScreenX = 220;

    const builtFrontX = () => START_PLAT + builtBlocks * W;
    const finishX = () => START_PLAT + target * W;

    function showStart() {
      running = false; over = false; cancelAnimationFrame(raf);
      answersEl.innerHTML = ''; promptEl.style.display = 'none';
      startEl.style.display = 'flex';
      startEl.innerHTML = `<div class="br-start-card">
        <h2>Bridge Run</h2>
        <p>Your runner never stops walking. Answer fast to lay the path ahead — or he falls!</p>
        ${tiers.map((t,i)=>`<button class="br-tier" data-i="${i}"><b class="${t.key==='einstein'?'em':''}">${t.label}</b><span>${t.desc||''}</span></button>`).join('')}
      </div>`;
      startEl.querySelectorAll('.br-tier').forEach(b =>
        b.addEventListener('click', () => { snd.tick(); tierIdx = +b.dataset.i; level = 1;
          totalCorrect = 0; totalQ = 0; streak = 0; bestStreak = 0; distanceBase = 0;
          startEl.style.display = 'none'; startLevel(); }));
    }

    function startLevel() {
      terrain = TERRAINS[(level - 1) % TERRAINS.length];
      target = 11 + level * 2;
      speed = TIER_SPEED[tierIdx] + (level - 1) * 6;
      runnerX = RUN_X0;
      builtBlocks = Math.min(HEAD_START, target);
      coasting = false; over = false;
      charScreenX = Math.max(120, (stage.clientWidth || 700) * 0.3);
      charEl.className = 'br-char';
      charEl.style.setProperty('--wd', (22 / speed).toFixed(2) + 's');
      paintTerrain();
      renderBlocks(false);
      placeChar();
      levelEl.textContent = 'Level ' + level;
      countdown(() => { running = true; lastTs = 0; charEl.classList.add('walk'); newQuestion(); raf = requestAnimationFrame(loop); });
    }

    function countdown(done) {
      cdEl.style.display = 'flex';
      const seq = ['3','2','1','GO!'];
      let i = 0;
      const tick = () => {
        cdEl.innerHTML = `<span>${seq[i]}</span>`;
        snd.tick();
        i++;
        if (i < seq.length) setTimeout(tick, 600);
        else setTimeout(() => { cdEl.style.display = 'none'; done(); }, 500);
      };
      tick();
    }

    function paintTerrain() {
      sky.style.background = terrain.sky;
      abyss.style.background = terrain.abyss;
      deco.innerHTML = '';
      if (terrain.deco === 'volcano') {
        deco.innerHTML = `<div style="position:absolute;left:0;right:0;bottom:${GROUND_BOTTOM}%;height:8px;background:linear-gradient(90deg,#ffd24a,#ff7a00);filter:blur(3px);opacity:.7"></div>`;
      } else if (terrain.deco === 'city') {
        let b = '';
        for (let i = 0; i < 9; i++) {
          const h = 30 + (i * 37 % 60), w = 26 + (i * 13 % 20), l = i * 110 + 20;
          b += `<div style="position:absolute;bottom:${GROUND_BOTTOM}%;left:${l}px;width:${w}px;height:${h+40}%;background:#9aa7b3;opacity:.55;border-radius:3px 3px 0 0"></div>`;
        }
        deco.innerHTML = b;
      } else if (terrain.deco === 'sky') {
        let c = '';
        for (let i = 0; i < 7; i++) {
          const t = 8 + (i * 29 % 50), l = i * 150 + 30, s = 40 + (i * 17 % 50);
          c += `<div style="position:absolute;top:${t}%;left:${l}px;width:${s+30}px;height:${s*0.5}px;background:rgba(255,255,255,.85);border-radius:99px;filter:blur(1px)"></div>`;
        }
        deco.innerHTML = c;
      }
    }

    function renderBlocks(animateLast) {
      blocksEl.innerHTML = '';
      // rope line for tightrope terrains
      if (terrain.rope) {
        const rope = document.createElement('div');
        rope.className = 'br-rope';
        rope.style.left = START_PLAT + 'px';
        rope.style.width = (target * W) + 'px';
        rope.style.bottom = `calc(${GROUND_BOTTOM}% - 3px)`;
        blocksEl.appendChild(rope);
      }
      for (let i = 0; i < builtBlocks; i++) {
        const blk = document.createElement('div');
        blk.className = 'br-block' + (animateLast && i === builtBlocks - 1 ? ' new' : '');
        blk.style.left = (START_PLAT + i * W + 3) + 'px';
        blk.style.width = (terrain.rope ? W - 10 : W - 6) + 'px';
        const h = terrain.rope ? 9 : 14;
        blk.style.height = h + 'px';
        blk.style.bottom = `calc(${GROUND_BOTTOM}% - ${h}px)`;
        blk.style.background = terrain.block;
        blocksEl.appendChild(blk);
      }
      // platforms: start + finish (top sits on the ground line)
      platsEl.innerHTML = '';
      [[0, START_PLAT], [finishX(), 220]].forEach(([x, w]) => {
        const p = document.createElement('div');
        p.className = 'br-plat';
        p.style.left = x + 'px'; p.style.width = w + 'px';
        p.style.height = '46px';
        p.style.bottom = `calc(${GROUND_BOTTOM}% - 46px)`;
        p.style.background = terrain.plat;
        platsEl.appendChild(p);
      });
    }

    function placeChar() {
      charEl.style.left = charScreenX + 'px';
      charEl.style.bottom = `calc(${GROUND_BOTTOM}% - 6px)`;
      world.style.transform = `translateX(${charScreenX - runnerX}px)`;
    }

    function loop(ts) {
      if (!running) return;
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      runnerX += speed * dt;
      world.style.transform = `translateX(${charScreenX - runnerX}px)`;

      const dist = distanceBase + Math.floor((runnerX - RUN_X0) / W * 10);
      distEl.textContent = Math.max(0, dist) + ' m';

      if (runnerX >= finishX()) return clearLevel();
      const lead = builtFrontX() - runnerX;
      const onStart = runnerX <= START_PLAT;
      if (!onStart && lead <= 0) return fall();

      const leadFrac = Math.max(0, Math.min(1, lead / (W * (HEAD_START + 1))));
      leadFill.style.width = (leadFrac * 100) + '%';
      leadbar.classList.toggle('danger', lead < W * 1.6);
      dangerEl.classList.toggle('on', !onStart && lead < W * 1.4);

      raf = requestAnimationFrame(loop);
    }

    function newQuestion() {
      if (builtBlocks >= target) return enterCoast();
      q = makeQuestion(level, tiers[tierIdx].key);
      promptEl.style.display = 'block';
      promptEl.textContent = q.prompt;
      answersEl.innerHTML = '';
      q.choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'br-opt';
        b.dataset.idx = i; b.dataset.val = c;
        b.innerHTML = `<span class="k">${KEYS[i]}</span><span>${c}</span>`;
        b.addEventListener('click', () => answer(String(c)));
        answersEl.appendChild(b);
      });
    }

    function enterCoast() {
      coasting = true;
      promptEl.style.display = 'block';
      promptEl.textContent = '🏁 Made it — run!';
      answersEl.innerHTML = '';
    }

    function answer(val) {
      if (!running || coasting) return;
      totalQ++;
      const correct = val === String(q.answer);
      if (correct) {
        totalCorrect++; streak++;
        if (streak > bestStreak) bestStreak = streak;
        if (builtBlocks < target) builtBlocks++;
        rail.hit(); snd.correct();
        stage.classList.remove('flash-g'); void stage.offsetWidth; stage.classList.add('flash-g');
        if (fx && fx.milestone(streak)) { if (builtBlocks < target) builtBlocks++; snd.streak(streak); }
        renderBlocks(true);
      } else {
        streak = 0; rail.end(); snd.wrong();
        stage.classList.remove('flash-r'); void stage.offsetWidth; stage.classList.add('flash-r');
      }
      newQuestion();
    }

    function fall() {
      running = false; over = true; cancelAnimationFrame(raf);
      charEl.classList.remove('walk'); charEl.classList.add('fall');
      dangerEl.classList.remove('on');
      promptEl.style.display = 'none'; answersEl.innerHTML = '';
      snd.wrong();
      setTimeout(summary, 1000);
    }

    function clearLevel() {
      running = false; cancelAnimationFrame(raf);
      charEl.classList.remove('walk'); charEl.classList.add('cheer');
      dangerEl.classList.remove('on');
      promptEl.style.display = 'block'; promptEl.textContent = `🎉 Level ${level} cleared!`;
      answersEl.innerHTML = '';
      if (fx) { fx.confetti({ count: 50 }); fx.flash('rgba(42,92,63,.3)'); }
      distanceBase += Math.floor((finishX() - RUN_X0) / W * 10);
      level++;
      setTimeout(startLevel, 1300);
    }

    function summary() {
      const dist = distanceBase + Math.floor((runnerX - RUN_X0) / W * 10);
      if (fx) {
        fx.showSummary({
          title: `${tiers[tierIdx].label} · Level ${level} · ${Math.max(0,dist)} m`,
          correct: totalCorrect, total: totalQ, best: bestStreak,
          onPlayAgain: () => { rail.end(); level = 1; totalCorrect = 0; totalQ = 0; streak = 0; bestStreak = 0; distanceBase = 0; startLevel(); },
          allGamesHref: cfg.allGamesHref || '../../index.html',
        });
      }
    }

    document.addEventListener('keydown', e => {
      if (!running || coasting) return;
      const idx = ['a','b','c','d'].indexOf(e.key.toLowerCase());
      if (idx === -1) return;
      const b = answersEl.querySelector(`.br-opt[data-idx="${idx}"]`);
      if (b) b.click();
    });
    window.addEventListener('resize', () => { if (running) { charScreenX = Math.max(120, stage.clientWidth * 0.3); placeChar(); } });

    showStart();
    return {
      _debug: () => ({ level, target, builtBlocks, runnerX: Math.round(runnerX), running, over, coasting,
        totalCorrect, totalQ, streak, bestStreak, answer: q && q.answer, tier: tiers[tierIdx] && tiers[tierIdx].key }),
      _tick: (ms) => loop((lastTs || 0) + ms),
    };
  }

  window.HSGBridge = { init };
})();
