// ============================================================
// HSGBridge - real-time "lay-the-path runner".
// Pick a difficulty -> 3·2·1·GO -> your character WALKS forward at a steady
// speed and never stops. Every correct answer drops the next block ahead of
// him; if he reaches the end of the laid path he falls into the chasm. Reach
// the far platform to clear the level - each level is faster, harder, and has
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

  // base walking speed (px/sec) per difficulty tier index (Easy is gentle for little kids)
  const TIER_SPEED = [18, 34, 44, 56];

  // Each level is a different TRAVERSAL, not just a new backdrop. Level 1 is the
  // flat wooden drawbridge; after that the laid path RISES (rise = px climbed per
  // block) so the runner scales a mountain, a cliff, and beyond. block = art class,
  // rail = rope side-rail (drawbridge only), climb = use base/summit not gatehouse.
  // sx = horizontal px per block step (W = walk across; 0 = climb straight up).
  // rise = vertical px per block step. struct = finish structure to draw.
  const MODES = [
    { key:'bridge',   terrain:'canyon',   sx:W, rise:0,  block:'',       rail:true,  struct:'gate',   climb:false },
    { key:'mountain', terrain:'mountain', sx:W, rise:12, block:'ledge',  rail:false, struct:'summit', climb:true  },
    { key:'cliff',    terrain:'cliff',    sx:0, rise:30, block:'piton',  rail:false, struct:'summit', climb:true  },
    { key:'ladder',   terrain:'cliff',    sx:0, rise:24, block:'rung',   rail:false, struct:'summit', climb:true, ladder:true },
    { key:'boat',     terrain:'river',    sx:W, rise:0,  block:'raft',   rail:false, struct:'dock',   climb:false, boat:true },
    { key:'volcano',  terrain:'volcano',  sx:W, rise:15, block:'ledge',  rail:false, struct:'summit', climb:true  },
    { key:'tower',    terrain:'city',     sx:W, rise:20, block:'girder', rail:false, struct:'summit', climb:true  },
    { key:'sky',      terrain:'sky',      sx:W, rise:9,  block:'cloud',  rail:false, struct:'summit', climb:true  },
  ];
  const modeFor = lvl => MODES[(lvl - 1) % MODES.length];

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
    .br-bg { position:absolute; inset:0; overflow:hidden; }            /* fixed cinematic backdrop */
    .br-bg .layer { position:absolute; left:0; right:0; }
    .br-world { position:absolute; inset:0; will-change:transform; }   /* scrolls with the runner */

    /* wooden drawbridge plank */
    .br-block { position:absolute; height:16px; border-radius:2px;
      background:
        repeating-linear-gradient(90deg, rgba(0,0,0,.10) 0, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 11px, rgba(0,0,0,.10) 12px),
        linear-gradient(#b48a52, #8a6638);
      border-top:1px solid #cda06a; border-bottom:1px solid #5e451f;
      box-shadow:0 4px 5px rgba(0,0,0,.35), inset 0 -2px 3px rgba(0,0,0,.22); }
    .br-block::before, .br-block::after { content:''; position:absolute; top:5px; width:4px; height:4px;
      border-radius:50%; background:#3a2c18; box-shadow:0 1px 0 rgba(255,255,255,.2); }
    .br-block::before { left:4px; } .br-block::after { right:4px; }
    .br-block.new { animation:brDrop .28s cubic-bezier(.3,1.5,.5,1); }
    @keyframes brDrop { from{ transform:translateY(-34px) rotate(-8deg); opacity:.2; } to{ transform:none; opacity:1; } }
    /* climbing-path block art (mountain ledges, cliff pitons, steel girders, clouds) */
    .br-block.ledge { background:linear-gradient(#8a6f4e,#5d452a); border-top-color:#a98a63; border-bottom-color:#3c2c19; }
    .br-block.piton { background:linear-gradient(#9a9488,#615b4d); border-top-color:#b8b2a3; border-bottom-color:#3e392f; }
    .br-block.piton::before, .br-block.piton::after { background:#c9c2b0; box-shadow:0 1px 1px rgba(0,0,0,.4); }
    .br-block.girder { background:repeating-linear-gradient(90deg,#586071 0,#586071 10px,#454c5b 10px,#454c5b 20px); border-top-color:#7a8294; border-bottom-color:#2c313c; }
    .br-block.cloud { background:linear-gradient(#ffffff,#dde9f6); border-radius:14px; border-top-color:#fff; border-bottom-color:#cdd9e6; box-shadow:0 6px 12px rgba(80,110,150,.2); }
    .br-block.cloud::before, .br-block.cloud::after { display:none; }
    .br-block.rung { height:9px; background:linear-gradient(#7a5230,#583a1d); border-radius:5px; border-top-color:#9a6f44; border-bottom-color:#3a2613; }
    .br-block.rung::before, .br-block.rung::after { display:none; }
    .br-block.raft { background:repeating-linear-gradient(90deg,#a9763f 0,#a9763f 9px,#8f5f2f 9px,#8f5f2f 18px); border-top-color:#c2925a; border-bottom-color:#5a3c1d; }
    .br-char.climbing svg { transform:rotate(-9deg); transition:transform .25s; }
    .br-char.boat::before { content:''; position:absolute; left:-12px; right:-12px; bottom:-2px; height:18px; z-index:-1;
      background:linear-gradient(#8a5a2c,#5e3c18); border-radius:0 0 14px 14px / 0 0 22px 22px; box-shadow:0 4px 6px rgba(0,0,0,.32); }

    /* rope side-rail + posts */
    .br-rail { position:absolute; height:4px; border-radius:99px;
      background:repeating-linear-gradient(90deg,#7a5e36 0,#7a5e36 5px,#9a7a4a 5px,#9a7a4a 10px); }
    .br-post { position:absolute; width:4px; background:#6b5028; border-radius:2px; }

    /* stone gatehouse towers */
    .br-tower { position:absolute; border-radius:3px 3px 0 0;
      background:
        repeating-linear-gradient(0deg, rgba(0,0,0,.12) 0, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 16px, rgba(0,0,0,.12) 18px),
        repeating-linear-gradient(90deg, rgba(0,0,0,.10) 0, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 24px, rgba(0,0,0,.10) 26px),
        linear-gradient(#9a9183,#6a6256);
      border:2px solid #57503f; box-shadow:0 6px 14px rgba(0,0,0,.35); }
    .br-merlon { position:absolute; top:-10px; height:12px; width:100%;
      background:repeating-linear-gradient(90deg,#8a8174 0,#8a8174 12px,transparent 12px,transparent 20px); }
    .br-chain { position:absolute; height:5px; transform-origin:left center; border-radius:99px;
      background:repeating-linear-gradient(90deg,#2e2e2e 0,#2e2e2e 4px,#6b6b6b 4px,#6b6b6b 8px); }
    .br-flag { position:absolute; width:0; height:0; border-left:18px solid var(--gold);
      border-top:8px solid transparent; border-bottom:8px solid transparent; }
    .br-flagpole { position:absolute; width:3px; background:#4a4036; }
    .br-slab { position:absolute; height:16px; border-radius:2px;
      background:linear-gradient(#8f8678,#615a4d); border-top:3px solid #a89e8b;
      box-shadow:0 4px 6px rgba(0,0,0,.3); }

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
    .br-char.sprint svg { transform:rotate(-13deg); transition:transform .2s; }
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

    .br-input-row { display:flex; align-items:center; justify-content:center; gap:.7rem; margin-top:.75rem; flex-wrap:wrap; }
    .br-num { width:150px; text-align:center; font-family:var(--font-serif); font-size:1.8rem; font-weight:600;
      padding:.35rem .6rem; border:2.5px solid var(--gold); border-radius:12px; background:#fff; color:var(--ink); outline:none; }
    .br-num:focus { box-shadow:0 0 0 3px rgba(196,160,64,.3); }
    .br-help-label { font-size:.8rem; color:var(--ink-light); font-family:var(--font-sans); }
    .br-answers { display:grid; grid-template-columns:1fr 1fr; gap:.6rem; margin-top:.55rem; }
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
    const rail = cfg.rail || { hit(){}, broke(){}, gameOver(){}, reset(){}, setLevel(){} };
    const tiers = cfg.tiers || [{ key:'easy', label:'Easy', desc:'' }];
    const makeQuestion = cfg.makeQuestion;
    const fx = window.HSGfx, snd = window.HSGSound || { correct(){}, wrong(){}, streak(){}, tick(){}, finish(){} };

    mount.innerHTML = `
      <div class="br-wrap">
        <div class="br-hud">
          <span class="br-pill" data-level>Level 1</span>
          <span class="br-pill" data-dist>0 ft</span>
          <div class="br-leadbar"><i></i></div>
        </div>
        <div class="br-stage">
          <div class="br-bg"></div>
          <div class="br-world">
            <div class="br-plats"></div>
            <div class="br-blocks"></div>
          </div>
          <div class="br-char">${CHAR_SVG}</div>
          <div class="br-prompt" style="display:none"></div>
          <div class="br-danger"></div>
          <div class="br-countdown" style="display:none"></div>
          <div class="br-start"></div>
        </div>
        <div class="br-input-row" style="display:none">
          <input class="br-num" type="text" inputmode="numeric" autocomplete="off" placeholder="answer">
          <span class="br-help-label">just <b>type the answer</b>, or tap a choice</span>
        </div>
        <div class="br-answers"></div>
      </div>`;

    const $ = s => mount.querySelector(s);
    const stage = $('.br-stage'), world = $('.br-world'), bg = $('.br-bg'),
      blocksEl = $('.br-blocks'), platsEl = $('.br-plats'), charEl = $('.br-char'),
      promptEl = $('.br-prompt'), dangerEl = $('.br-danger'), cdEl = $('.br-countdown'),
      startEl = $('.br-start'), answersEl = $('.br-answers'),
      inputRow = $('.br-input-row'), inputEl = $('.br-num'),
      levelEl = $('[data-level]'), distEl = $('[data-dist]'), leadbar = $('.br-leadbar'), leadFill = $('.br-leadbar > i');

    let tierIdx = 0, level = 1, terrain, mode = MODES[0], q;
    let runnerX, builtBlocks, target, speed, coasting;
    let running = false, over = false, raf = 0, lastTs = 0;
    let totalCorrect = 0, totalQ = 0, streak = 0, bestStreak = 0, distanceBase = 0;
    let charScreenX = 220;

    const builtFrontX = () => START_PLAT + builtBlocks * W;
    const finishX = () => START_PLAT + target * W;
    // Scroll the world so the runner stays centred. sx<W tips the path toward
    // vertical (sx=0 ⇒ climb straight up); rise scrolls it DOWN so he ascends.
    const setWorld = () => {
      const p = (runnerX - START_PLAT) / W;
      const tx = charScreenX - (START_PLAT + p * mode.sx);
      const ty = Math.max(0, p) * mode.rise;
      world.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
    };

    function showStart() {
      running = false; over = false; cancelAnimationFrame(raf);
      answersEl.innerHTML = ''; promptEl.style.display = 'none'; inputRow.style.display = 'none';
      startEl.style.display = 'flex';
      startEl.innerHTML = `<div class="br-start-card">
        <h2>Bridge Run</h2>
        <p>Your runner never stops walking. Answer fast to lay the path ahead, or he falls!</p>
        ${tiers.map((t,i)=>`<button class="br-tier" data-i="${i}"><b class="${t.key==='einstein'?'em':''}">${t.label}</b><span>${t.desc||''}</span></button>`).join('')}
      </div>`;
      startEl.querySelectorAll('.br-tier').forEach(b =>
        b.addEventListener('click', () => { snd.tick(); tierIdx = +b.dataset.i; level = 1;
          totalCorrect = 0; totalQ = 0; streak = 0; bestStreak = 0; distanceBase = 0;
          rail.setLevel(tiers[tierIdx].key, tiers[tierIdx].label);  // per-tier streak board
          startEl.style.display = 'none'; startLevel(); }));
    }

    function startLevel() {
      mode = modeFor(level);
      terrain = { key: mode.terrain };
      target = 11 + level * 2;
      speed = TIER_SPEED[tierIdx] + (level - 1) * 6;
      runnerX = RUN_X0;
      builtBlocks = Math.min(HEAD_START, target);
      coasting = false; over = false;
      charScreenX = Math.max(120, (stage.clientWidth || 700) * 0.3);
      charEl.className = 'br-char' + (mode.climb ? ' climbing' : '') + (mode.boat ? ' boat' : '');
      charEl.style.setProperty('--wd', (22 / speed).toFixed(2) + 's');
      buildScene();
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

    // Cinematic, fixed-to-stage backdrop the drawbridge overlooks.
    function buildScene() {
      const G = GROUND_BOTTOM;            // ground-line, % from bottom
      const ridge = (bottom, h, color, op, pts) =>
        `<div class="layer" style="bottom:${bottom}%;height:${h}px;background:${color};opacity:${op};clip-path:polygon(${pts})"></div>`;
      let html = '';
      if (terrain.key === 'canyon') {
        html += `<div class="layer" style="inset:0;background:linear-gradient(#9cc7e6 0%,#cfe3ec 45%,#f3e3bf 72%)"></div>`;
        html += `<div class="layer" style="top:8%;left:74%;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,#fff6d8,#ffe39a);box-shadow:0 0 50px 18px rgba(255,227,154,.6)"></div>`;
        html += ridge(`${G - 6}`, 130, '#c79a63', .55, '0 100%,12% 30%,24% 60%,40% 18%,55% 55%,70% 25%,85% 60%,100% 35%,100% 100%');
        html += ridge(`${G - 2}`, 90, '#a9743f', .8, '0 100%,15% 45%,30% 70%,50% 35%,68% 65%,82% 40%,100% 60%,100% 100%');
        html += `<div class="layer" style="bottom:0;height:${G}%;background:linear-gradient(#7a5a3c,#3a2616 55%,#160d06)"></div>`;
        html += `<div class="layer" style="bottom:5%;height:5px;background:linear-gradient(90deg,transparent,#bfe0ef88,transparent);filter:blur(2px)"></div>`;
      } else if (terrain.key === 'mountain') {
        html += `<div class="layer" style="inset:0;background:linear-gradient(#7fb6e6 0%,#bfe0f2 52%,#eaf5fb 100%)"></div>`;
        html += `<div class="layer" style="top:10%;left:14%;width:62px;height:62px;border-radius:50%;background:radial-gradient(circle,#fffbe8,#ffe39a);box-shadow:0 0 44px 14px rgba(255,227,154,.5)"></div>`;
        html += ridge(`${G - 2}`, 200, 'linear-gradient(#9db3d4,#6c83a8)', .85, '0 100%,16% 34%,28% 58%,44% 14%,58% 50%,72% 22%,86% 52%,100% 30%,100% 100%');
        html += ridge(`${G + 22}`, 70, '#eef4fb', .9, '0 100%,42% 10%,50% 22%,58% 10%,100% 100%');   // snow cap
        html += `<div class="layer" style="bottom:0;height:${G + 60}%;left:34%;right:0;background:linear-gradient(120deg,#6e8b4e,#3f5a2e);clip-path:polygon(0 100%,26% 46%,100% 0,100% 100%)"></div>`;
        let pine = '';
        for (let i = 0; i < 7; i++) pine += `<div style="position:absolute;left:${46 + i * 7}%;bottom:${G + 6 + i * 7}%;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:18px solid #2f4a24"></div>`;
        html += `<div class="layer" style="inset:0">${pine}</div>`;
        html += `<div class="layer" style="bottom:0;height:${G}%;background:linear-gradient(#5d7a3e,#34471f 60%,#1c2810)"></div>`;
      } else if (terrain.key === 'cliff') {
        html += `<div class="layer" style="inset:0;background:linear-gradient(#cfe7f5 0%,#a7c8dd 46%,#6b8aa0 100%)"></div>`;
        html += ridge(`${G - 4}`, 90, '#8aa0b4', .5, '0 100%,20% 50%,40% 70%,60% 45%,80% 68%,100% 50%,100% 100%');   // hazy far peaks
        html += `<div class="layer" style="bottom:0;height:150%;left:48%;right:0;background:linear-gradient(90deg,#564c43,#73685b 35%,#8b7f6e);box-shadow:inset 28px 0 50px rgba(0,0,0,.28)"></div>`;   // the cliff wall
        let cr = '';
        for (let i = 0; i < 7; i++) cr += `<div style="position:absolute;left:${52 + i * 6}%;top:${(i * 13) % 40}%;width:3px;height:${40 + (i * 17 % 40)}%;background:rgba(0,0,0,.18)"></div>`;
        html += `<div class="layer" style="inset:0">${cr}</div>`;
        html += `<div class="layer" style="bottom:0;height:${G}%;background:linear-gradient(#6a5e4e,#3a3024)"></div>`;
      } else if (terrain.key === 'volcano') {
        html += `<div class="layer" style="inset:0;background:linear-gradient(#3a1f2e 0%,#6e2f25 60%,#a23a1e 100%)"></div>`;
        html += `<div class="layer" style="bottom:${G - 4}%;left:8%;width:340px;height:200px;background:#2a1a16;clip-path:polygon(0 100%,38% 8%,46% 14%,62% 8%,100% 100%)"></div>`;
        html += `<div class="layer" style="bottom:${G + 32}%;left:30%;width:120px;height:60px;background:radial-gradient(circle at 50% 100%,#ffe07a,#ff7a1e 55%,transparent 75%);filter:blur(2px)"></div>`;
        html += `<div class="layer" style="bottom:0;height:${G}%;background:linear-gradient(#ff9a3c,#ff5a00 35%,#7a1500 80%,#2a0a00)"></div>`;
        let emb = '';
        for (let i = 0; i < 16; i++) emb += `<div style="position:absolute;bottom:${G + (i*53%55)}%;left:${(i*61%100)}%;width:3px;height:3px;border-radius:50%;background:#ffce6a;box-shadow:0 0 6px 2px rgba(255,150,40,.7)"></div>`;
        html += `<div class="layer" style="inset:0">${emb}</div>`;
      } else if (terrain.key === 'city') {
        html += `<div class="layer" style="inset:0;background:linear-gradient(#f6c98a 0%,#d98a8a 40%,#5b6a93 100%)"></div>`;
        html += `<div class="layer" style="top:14%;left:12%;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle,#fff3d8,#ffba6e);opacity:.9"></div>`;
        let far = '', near = '';
        for (let i = 0; i < 12; i++) {
          const h = 90 + (i * 53 % 130), w = 34 + (i * 17 % 26);
          far += `<div style="position:absolute;bottom:${G}%;left:${i*90}px;width:${w}px;height:${h}px;background:#41506e;opacity:.6"></div>`;
        }
        for (let i = 0; i < 9; i++) {
          const h = 130 + (i * 71 % 170), w = 46 + (i * 23 % 30), l = i * 150 + 30;
          let win = '';
          for (let r = 0; r < Math.floor(h / 22); r++) for (let c = 0; c < Math.floor(w / 16); c++)
            if ((r * 7 + c * 3 + i) % 3) win += `<span style="position:absolute;left:${6 + c*16}px;bottom:${10 + r*22}px;width:7px;height:10px;background:#ffe9a8;opacity:.85"></span>`;
          near += `<div style="position:absolute;bottom:${G}%;left:${l}px;width:${w}px;height:${h}px;background:#2c3550">${win}</div>`;
        }
        html += `<div class="layer" style="inset:0">${far}</div><div class="layer" style="inset:0">${near}</div>`;
        html += `<div class="layer" style="bottom:0;height:${G}%;background:linear-gradient(#3a4258,#202738 60%,#11151f)"></div>`;
      } else if (terrain.key === 'river') {
        html += `<div class="layer" style="inset:0;background:linear-gradient(#9fd0f2 0%,#c7e7f5 55%,#cdeede 100%)"></div>`;
        html += `<div class="layer" style="top:12%;left:72%;width:58px;height:58px;border-radius:50%;background:radial-gradient(circle,#fffbe8,#ffe39a);opacity:.9"></div>`;
        html += ridge(`${G}`, 80, 'linear-gradient(#6e9e54,#4f7a3a)', .85, '0 100%,10% 50%,30% 64%,50% 44%,70% 62%,90% 48%,100% 58%,100% 100%');   // green banks
        html += `<div class="layer" style="bottom:0;height:${G}%;background:linear-gradient(#5fb6d6,#2f7fa6 60%,#1d5f80)"></div>`;   // water
        let sh = '';
        for (let i = 0; i < 12; i++) sh += `<div style="position:absolute;bottom:${(i * 7) % G}%;left:${(i * 53 % 92)}%;width:${28 + i * 4}px;height:2px;background:rgba(255,255,255,.4);border-radius:99px"></div>`;
        html += `<div class="layer" style="inset:0">${sh}</div>`;   // shimmer
      } else { // sky
        html += `<div class="layer" style="inset:0;background:linear-gradient(#5aa6e8 0%,#9fd0f2 60%,#d8eefb 100%)"></div>`;
        html += `<div class="layer" style="top:10%;left:70%;width:70px;height:70px;border-radius:50%;background:radial-gradient(circle,#fffbe8,#ffe9a0);box-shadow:0 0 60px 22px rgba(255,233,160,.5)"></div>`;
        let clouds = '';
        for (let i = 0; i < 9; i++) {
          const t = 12 + (i * 29 % 55), l = i * 160 + 20, s = 60 + (i * 19 % 70);
          clouds += `<div style="position:absolute;top:${t}%;left:${l}px;width:${s+40}px;height:${s*0.5}px;background:rgba(255,255,255,.92);border-radius:99px;box-shadow:24px 8px 0 -6px rgba(255,255,255,.9),-24px 10px 0 -8px rgba(255,255,255,.85);filter:blur(.5px)"></div>`;
        }
        html += `<div class="layer" style="inset:0">${clouds}</div>`;
        html += `<div class="layer" style="bottom:0;height:${G}%;background:linear-gradient(rgba(216,238,251,.7),rgba(216,238,251,0))"></div>`;
      }
      bg.innerHTML = html;
    }

    // The drawbridge itself (scrolls with the world).
    function renderBlocks(animateLast) {
      const sx = mode.sx, rise = mode.rise;
      const blkBottom = i => `calc(${GROUND_BOTTOM}% - 16px + ${(i * rise).toFixed(1)}px)`;
      const fvx = START_PLAT + target * sx;          // finish: visual x (= finishX when sx=W)
      const summitY = (target * rise).toFixed(1);    // finish: px above the start line
      blocksEl.innerHTML = '';

      // path blocks (planks / ledges / pitons / rungs / girders / clouds / rafts)
      for (let i = 0; i < builtBlocks; i++) {
        const blk = document.createElement('div');
        blk.className = 'br-block' + (mode.block ? ' ' + mode.block : '') + (animateLast && i === builtBlocks - 1 ? ' new' : '');
        blk.style.left = (START_PLAT + i * sx + 2) + 'px';
        blk.style.width = (W - 4) + 'px';
        blk.style.bottom = blkBottom(i);
        blocksEl.appendChild(blk);
      }
      // two vertical side-rails make the rungs read as a ladder
      if (mode.ladder && builtBlocks > 0) {
        const h = (builtBlocks - 1) * rise + 30;
        [8, W - 12].forEach(off => {
          const rl = document.createElement('div');
          rl.className = 'br-post';
          rl.style.left = (START_PLAT + off) + 'px';
          rl.style.bottom = `calc(${GROUND_BOTTOM}% - 10px)`;
          rl.style.height = h + 'px';
          blocksEl.appendChild(rl);
        });
      }
      // rope side-rail + posts - flat drawbridge only
      if (mode.rail && builtBlocks > 0) {
        const span = builtBlocks * W;
        const rail = document.createElement('div');
        rail.className = 'br-rail';
        rail.style.left = START_PLAT + 'px'; rail.style.width = span + 'px';
        rail.style.bottom = `calc(${GROUND_BOTTOM}% + 20px)`;
        blocksEl.appendChild(rail);
        for (let i = 0; i <= builtBlocks; i += 2) {
          const post = document.createElement('div');
          post.className = 'br-post';
          post.style.left = (START_PLAT + i * W) + 'px';
          post.style.bottom = `${GROUND_BOTTOM}%`; post.style.height = '22px';
          blocksEl.appendChild(post);
        }
      }

      platsEl.innerHTML = '';
      const startSlab = document.createElement('div');
      startSlab.className = 'br-slab';
      startSlab.style.left = '-40px'; startSlab.style.width = (START_PLAT + 44) + 'px';
      startSlab.style.bottom = `calc(${GROUND_BOTTOM}% - 16px)`;
      platsEl.appendChild(startSlab);

      // finish flag at a given vertical expression (poles + pennant)
      const flagAt = (x, expr) => {
        const pole = document.createElement('div');
        pole.className = 'br-flagpole';
        pole.style.left = (x + 24) + 'px'; pole.style.height = '34px';
        pole.style.bottom = `calc(${expr})`;
        platsEl.appendChild(pole);
        const flag = document.createElement('div');
        flag.className = 'br-flag';
        flag.style.left = (x + 27) + 'px';
        flag.style.bottom = `calc(${expr} + 28px)`;
        platsEl.appendChild(flag);
      };

      if (mode.struct === 'gate') {
        const towerH = 150, towerDrop = 60;
        const tower = (x, w) => {
          const t = document.createElement('div');
          t.className = 'br-tower';
          t.style.left = x + 'px'; t.style.width = w + 'px'; t.style.height = towerH + 'px';
          t.style.bottom = `calc(${GROUND_BOTTOM}% - ${towerDrop}px)`;
          t.innerHTML = '<div class="br-merlon"></div>';
          platsEl.appendChild(t);
        };
        tower(-40, START_PLAT + 40);
        tower(fvx, 200);
        const finSlab = document.createElement('div');
        finSlab.className = 'br-slab';
        finSlab.style.left = (fvx - 4) + 'px'; finSlab.style.width = '204px';
        finSlab.style.bottom = `calc(${GROUND_BOTTOM}% - 16px)`;
        platsEl.appendChild(finSlab);
        const topY = `calc(${GROUND_BOTTOM}% - ${towerDrop}px + ${towerH}px - 16px)`;
        [-7, 1].forEach(off => {
          const ch = document.createElement('div');
          ch.className = 'br-chain';
          ch.style.left = (START_PLAT - 16 + off) + 'px'; ch.style.bottom = topY;
          ch.style.width = '78px'; ch.style.transform = 'rotate(72deg)';
          platsEl.appendChild(ch);
        });
        flagAt(fvx, `${GROUND_BOTTOM}% - ${towerDrop}px + ${towerH}px - 6px`);
      } else if (mode.struct === 'summit') {
        const summit = document.createElement('div');
        summit.className = 'br-slab';
        summit.style.left = (fvx - 4) + 'px'; summit.style.width = '200px';
        summit.style.bottom = `calc(${GROUND_BOTTOM}% - 16px + ${summitY}px)`;
        platsEl.appendChild(summit);
        flagAt(fvx, `${GROUND_BOTTOM}% + ${summitY}px`);
      } else { // dock - the far shore for the boat
        const dock = document.createElement('div');
        dock.className = 'br-slab';
        dock.style.left = (fvx - 4) + 'px'; dock.style.width = '204px';
        dock.style.bottom = `calc(${GROUND_BOTTOM}% - 16px)`;
        platsEl.appendChild(dock);
        flagAt(fvx, `${GROUND_BOTTOM}% + 2px`);
      }
    }

    function placeChar() {
      charEl.style.left = charScreenX + 'px';
      charEl.style.bottom = `calc(${GROUND_BOTTOM}% - 6px)`;
      setWorld();
    }

    function loop(ts) {
      if (!running) return;
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      runnerX += speed * dt;
      setWorld();

      const dist = distanceBase + Math.floor((runnerX - RUN_X0) / W * 10);
      distEl.textContent = Math.max(0, dist) + ' ft';

      if (runnerX >= finishX()) return clearLevel();
      const lead = builtFrontX() - runnerX;
      const onStart = runnerX <= START_PLAT;
      if (!onStart && lead <= 0) {
        // Deity mode: never fall - hold the runner at the edge of the laid path
        // until the next correct answer extends it. (Unlimited lives.)
        if (window.HSGGod && HSGGod.on) { runnerX = builtFrontX() - 1; setWorld(); }
        else return fall();
      }

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
      inputRow.style.display = 'flex';
      inputEl.value = '';
      inputEl.focus();
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
      // Path is built - sprint to the finish so you never wait on a big lead.
      const remaining = finishX() - runnerX;
      speed = Math.max(speed * 2.6, remaining / 1.6);   // ~1.6s dash, min 2.6× pace
      charEl.style.setProperty('--wd', Math.max(0.14, 22 / speed).toFixed(2) + 's');
      charEl.classList.add('sprint');
      promptEl.style.display = 'block';
      promptEl.textContent = '🏁 Sprint to the finish!';
      inputRow.style.display = 'none';
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
        streak = 0; rail.broke(); snd.wrong();
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
      charEl.classList.remove('walk', 'sprint'); charEl.classList.add('cheer');
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
      const banked = Math.max(0, dist);   // score is how far you ran
      if (fx) {
        fx.showSummary({
          title: `You ran ${Math.max(0,dist)} ft`,
          correct: totalCorrect, total: totalQ, best: bestStreak,
          onPlayAgain: () => { rail.reset(); level = 1; totalCorrect = 0; totalQ = 0; streak = 0; bestStreak = 0; distanceBase = 0; startLevel(); },
          allGamesHref: cfg.allGamesHref || '../../index.html',
          extraHTML: '<div id="brBoard" style="text-align:left;margin:0.25rem 0 0.5rem"></div>',
          // run over: bank the longest streak + show placement/name entry inline
          onMount: card => rail.gameOver(banked, card.querySelector('#brBoard')),
        });
      } else {
        rail.gameOver(banked);
      }
    }

    // typed numeric answer (fast path) - digits + optional leading minus.
    // Auto-submit the instant the typed value matches the answer, so a correct
    // number counts immediately without pressing Enter. (Wrong values keep
    // waiting - typing toward a multi-digit answer is never penalised.)
    inputEl.addEventListener('input', () => {
      inputEl.value = inputEl.value.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '');
      if (running && !coasting && q && inputEl.value === String(q.answer)) answer(inputEl.value);
    });
    inputEl.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (!running || coasting) return;
      const v = inputEl.value.trim();
      if (v === '' || v === '-') return;
      answer(v);
    });

    document.addEventListener('keydown', e => {
      if (e.target === inputEl) return;     // typing handles its own keys
      if (!running || coasting) return;
      const idx = ['a','b','c','d'].indexOf(e.key.toLowerCase());
      if (idx === -1) return;
      const b = answersEl.querySelector(`.br-opt[data-idx="${idx}"]`);
      if (b) b.click();
    });
    window.addEventListener('resize', () => { if (running) { charScreenX = Math.max(120, stage.clientWidth * 0.3); placeChar(); } });

    showStart();
    return {
      // God-mode jump: start a fresh run at level n with the current tier.
      jumpTo: (n) => {
        level = Math.max(1, n | 0);
        totalCorrect = 0; totalQ = 0; streak = 0; bestStreak = 0; distanceBase = 0;
        rail.setLevel(tiers[tierIdx].key, tiers[tierIdx].label);
        startEl.style.display = 'none';
        startLevel();
      },
      _debug: () => ({ level, target, builtBlocks, runnerX: Math.round(runnerX), running, over, coasting, speed,
        totalCorrect, totalQ, streak, bestStreak, answer: q && q.answer, tier: tiers[tierIdx] && tiers[tierIdx].key }),
      _tick: (ms) => loop((lastTs || 0) + ms),
      // static visual preview of a level's scene (no countdown/loop) - for screenshots
      _preview: (n, blocks) => {
        running = false; cancelAnimationFrame(raf);
        startEl.style.display = 'none'; promptEl.style.display = 'none'; answersEl.innerHTML = '';
        level = n; mode = modeFor(n); terrain = { key: mode.terrain };
        target = 11 + n * 2; builtBlocks = Math.min(blocks || 7, target);
        runnerX = START_PLAT + (builtBlocks - 2) * W;
        charScreenX = Math.max(120, (stage.clientWidth || 700) * 0.3);
        charEl.className = 'br-char walk' + (mode.climb ? ' climbing' : '') + (mode.boat ? ' boat' : '');
        buildScene(); renderBlocks(false); placeChar();
        levelEl.textContent = 'Level ' + n;
      },
    };
  }

  window.HSGBridge = { init };
})();
