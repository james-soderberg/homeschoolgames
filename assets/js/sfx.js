// ============================================================
// HSGSound — tiny synthesized sound effects (no audio files).
// Web Audio API; lazily created on first sound (after a user gesture).
// Auto-injects a mute toggle into the site nav. Mute persists.
// API: HSGSound.correct() .wrong() .streak(level) .finish(win) .tick()
// ============================================================
(function () {
  const LS_KEY = 'hsg_muted';
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(LS_KEY) === '1'; } catch (e) {}

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // One tone with an ADSR-ish envelope.
  function tone(freq, start, dur, { type = 'sine', gain = 0.18, glideTo = null } = {}) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function chord(freqs, start, dur, opts) {
    freqs.forEach(f => tone(f, start, dur, opts));
  }

  const API = {
    get muted() { return muted; },

    correct() {
      if (muted) return;
      // bright two-note rise
      tone(660, 0, 0.12, { type: 'triangle', gain: 0.16 });
      tone(990, 0.09, 0.16, { type: 'triangle', gain: 0.16 });
    },

    wrong() {
      if (muted) return;
      // soft descending buzz
      tone(220, 0, 0.22, { type: 'sawtooth', gain: 0.12, glideTo: 140 });
    },

    tick() {
      if (muted) return;
      tone(520, 0, 0.05, { type: 'square', gain: 0.06 });
    },

    // Escalating arpeggio for streak milestones. level = streak count.
    streak(level) {
      if (muted) return;
      const tier = Math.min(4, Math.floor(level / 5)); // 5->1, 10->2, ...
      const base = [523, 659, 784, 1047]; // C major arpeggio
      const extra = [1319, 1568];
      const notes = base.concat(tier >= 3 ? extra : []);
      notes.forEach((f, i) => tone(f * (1 + tier * 0.0), i * 0.07, 0.18, { type: 'triangle', gain: 0.15 }));
      // sparkle on big ones
      if (tier >= 2) tone(2093, notes.length * 0.07, 0.25, { type: 'sine', gain: 0.1 });
    },

    // Session/grade fanfare.
    finish(win = true) {
      if (muted) return;
      if (win) {
        chord([523, 659, 784], 0.0, 0.5, { type: 'triangle', gain: 0.13 });
        chord([784, 988, 1175], 0.16, 0.6, { type: 'triangle', gain: 0.13 });
        tone(1568, 0.34, 0.7, { type: 'sine', gain: 0.12 });
      } else {
        chord([392, 466], 0.0, 0.5, { type: 'sawtooth', gain: 0.1, glideTo: 330 });
      }
    },

    toggle() {
      muted = !muted;
      try { localStorage.setItem(LS_KEY, muted ? '1' : '0'); } catch (e) {}
      updateBtn();
      if (!muted) API.tick(); // confirm un-mute audibly
      return muted;
    },
  };

  // ---- Mute toggle button, injected into the site nav ----
  let btn = null;
  function updateBtn() {
    if (!btn) return;
    btn.textContent = muted ? '🔇' : '🔊';
    btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }
  function injectButton() {
    const nav = document.querySelector('.site-nav');
    if (!nav) return;
    const style = document.createElement('style');
    style.textContent = `
      .hsg-sound-toggle{background:none;border:1.5px solid var(--border);border-radius:99px;
        width:2.1rem;height:2.1rem;font-size:1rem;cursor:pointer;line-height:1;
        display:inline-flex;align-items:center;justify-content:center;margin-left:0.5rem;
        transition:border-color .15s,transform .1s;}
      .hsg-sound-toggle:hover{border-color:var(--gold);transform:translateY(-1px);}`;
    document.head.appendChild(style);
    btn = document.createElement('button');
    btn.className = 'hsg-sound-toggle';
    btn.addEventListener('click', API.toggle);
    nav.appendChild(btn);
    updateBtn();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }

  window.HSGSound = API;
})();
