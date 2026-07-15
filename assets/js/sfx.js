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

  // A burst of filtered noise — the crack/blast of an explosion or fire.
  function noiseBurst(start, dur, { gain = 0.2, freq = 1600, freqEnd = 160, type = 'lowpass' } = {}) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + start;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0); src.stop(t0 + dur + 0.02);
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

    // ---- space / arcade effects (Type Invaders) ----
    // a quick "pew" — light enough to fire on every keystroke
    laser() {
      if (muted) return;
      tone(900, 0, 0.09, { type: 'square', gain: 0.045, glideTo: 200 });
      tone(1800, 0, 0.05, { type: 'sawtooth', gain: 0.025, glideTo: 700 });
    },
    // an explosion — layered decaying broadband NOISE (no oscillator tone, so it
    // can never read as a beep/error): a bright crack transient, then a roaring
    // body that decays into a low rumble ~0.65s tail. The amplitude decay is
    // baked into each sample buffer for an instant, natural blast attack; the
    // filters are low-Q so the noise stays broadband (a boom, not a buzz).
    boom(big) {
      if (muted) return;
      const c = ac(); if (!c) return;
      const t0 = c.currentTime;
      const S = big ? 1 : 0.72;
      // one decaying-noise layer; hp=true swaps the lowpass for a highpass (crack)
      const layer = (dur, cut0, cut1, gain, q, decayPow, hp, atk) => {
        const len = Math.max(1, Math.floor(c.sampleRate * dur));
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decayPow);
        const src = c.createBufferSource(); src.buffer = buf;
        const f = c.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass';
        f.frequency.setValueAtTime(cut0, t0);
        f.frequency.linearRampToValueAtTime(cut1, t0 + dur * 0.7);
        f.Q.setValueAtTime(q, t0);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(gain, t0 + (atk || 0.012));   // short attack ramp → soft "whoomph", not a gunshot snap
        src.connect(f).connect(g).connect(c.destination);
        src.start(t0); src.stop(t0 + dur + 0.02);
      };
      layer(0.14,            1500, 3800, 0.13, 0.5, 2.4, true, 0.006); // soft dark crack (not a bright gunshot)
      layer(0.80 * S + 0.20, 3400, 900,  0.30, 0.6, 1.3, false, 0.012); // roaring body
      layer(0.95 * S + 0.20, 1200, 300,  0.30, 0.6, 1.5, false, 0.014); // mid rumble
      layer(1.05 * S + 0.25, 380,  110,  0.34, 0.7, 1.6, false, 0.014); // deep low boom (low Q → not buzzy)
    },
    // A fiery explosion — a soft-swelling WHOOSH + flickering crackle rather than a
    // bang/gunshot. No sharp transient: everything ramps in and the noise sweeps
    // downward (fire spreading), with a bright sizzle on top (embers).
    fireburst(big) {
      if (muted) return;
      const c = ac(); if (!c) return;
      const t0 = c.currentTime;
      const S = big ? 1 : 0.75;
      // noise layer: soft attack, frequency sweep, exp decay, optional flicker (crackle)
      const layer = (dur, type, cut0, cut1, q, gain, atk, crackle) => {
        const len = Math.max(1, Math.floor(c.sampleRate * dur));
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          let a = Math.pow(1 - i / len, 1.4);                    // overall decay
          if (crackle) a *= (Math.random() < 0.45 ? 1 : 0.14);   // sparse flicker → fiery sizzle
          d[i] = (Math.random() * 2 - 1) * a;
        }
        const src = c.createBufferSource(); src.buffer = buf;
        const f = c.createBiquadFilter(); f.type = type;
        f.frequency.setValueAtTime(cut0, t0);
        f.frequency.exponentialRampToValueAtTime(Math.max(60, cut1), t0 + dur * 0.85);
        f.Q.setValueAtTime(q, t0);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(gain, t0 + atk);          // soft swell — no gunshot snap
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f).connect(g).connect(c.destination);
        src.start(t0); src.stop(t0 + dur + 0.02);
      };
      // 1) the WHOOSH: airy roar sweeping downward (fire billowing out)
      layer(0.55 * S + 0.30, 'lowpass',  1000, 240, 0.4, 0.30, 0.045, false);
      // 2) bright fiery sizzle/crackle on top (flickering embers)
      layer(0.70 * S + 0.28, 'highpass', 1700, 3400, 0.5, 0.11, 0.030, true);
      // 3) warm low swell for weight — soft, not a thump
      layer(0.70 * S + 0.25, 'lowpass',  340,  90,  0.6, 0.22, 0.055, false);
    },
    // the swish of an arrow/projectile loosed — broadband noise through a
    // sweeping bandpass (a "whoosh", never a tone).
    whoosh() {
      if (muted) return;
      const c = ac(); if (!c) return;
      const t0 = c.currentTime, dur = 0.26;
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.setValueAtTime(0.8, t0);
      f.frequency.setValueAtTime(700, t0);
      f.frequency.exponentialRampToValueAtTime(2600, t0 + dur * 0.6);  // sweep up = the swish
      f.frequency.exponentialRampToValueAtTime(1200, t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.24, t0 + 0.04);                 // swell
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);           // fade
      src.connect(f).connect(g).connect(c.destination);
      src.start(t0); src.stop(t0 + dur + 0.02);
    },
    // an enemy plasma bolt fired / a warning
    alarm() {
      if (muted) return;
      tone(340, 0, 0.16, { type: 'sawtooth', gain: 0.06, glideTo: 210 });
    },
    // grabbed a power-up
    powerup() {
      if (muted) return;
      tone(523, 0, 0.10, { type: 'triangle', gain: 0.12 });
      tone(784, 0.08, 0.12, { type: 'triangle', gain: 0.12 });
      tone(1047, 0.16, 0.18, { type: 'sine', gain: 0.12 });
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
