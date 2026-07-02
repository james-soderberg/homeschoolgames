// ============================================================
// HSGFit — keep a <canvas> sized to its container and, on resize,
// hand the game the numbers it needs to REPOSITION its entities
// instead of leaving them stranded in the old coordinate system.
//
// Games that store positions in logical pixels (or grid cells) drift
// out of place when the viewport changes: the canvas is re-measured
// but the bird / foes / snake keep their old coordinates, causing
// unfair deaths and stuck states. This helper centralizes the fix.
//
//   const fit = HSGFit.attach(canvas, container, {
//     maxDPR: 2, minW: 300, minH: 300,
//     onResize({ rect, dpr, size, first }) {
//       // 1) work out your logical size from the container
//       const prevW = W, prevH = H;
//       ({ W, H } = size(Math.max(300, rect.width), rect.height));
//       // 2) on a real resize (not the first sizing), rescale entities
//       if (!first) rescaleEntities(W / prevW, H / prevH);
//     }
//   });
//   fit.W, fit.H, fit.dpr   // current logical size + device pixel ratio
//   fit.trigger()           // force a re-measure (e.g. at game start)
//
// Notes:
//  • resize + orientationchange + bfcache pageshow are all handled and
//    coalesced to one callback per animation frame (no thrash).
//  • A collapsed/hidden container (width or height 0) is ignored so the
//    game keeps its last good size instead of snapping to nothing.
//  • size(W,H) sets the HiDPI backing store and the 1-unit-per-logical-px
//    transform, and returns the clamped {W, H, dpr} it applied.
// ============================================================
(function () {
  'use strict';

  function attach(canvas, container, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const maxDPR = opts.maxDPR || 2;
    const minW = opts.minW || 1, minH = opts.minH || 1;
    let curW = 0, curH = 0, curDPR = 1;
    let lastW = 0, lastH = 0;      // last good container measurement
    let rafId = 0;

    function measure() {
      const r = container.getBoundingClientRect();
      let w = Math.round(r.width), h = Math.round(r.height);
      if (w < 1 || h < 1) { w = lastW; h = lastH; }   // hidden/collapsed → reuse last
      else { lastW = w; lastH = h; }
      return { width: w, height: h };
    }

    // Set the backing store (HiDPI) + transform for a given logical size.
    // Returns the clamped size actually applied.
    function size(W, H) {
      W = Math.max(minW, Math.round(W));
      H = Math.max(minH, Math.round(H));
      const dpr = Math.min(window.devicePixelRatio || 1, maxDPR);
      curW = W; curH = H; curDPR = dpr;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { W: W, H: H, dpr: dpr };
    }

    function run(first) {
      const rect = measure();
      if (rect.width < 1 || rect.height < 1) return;   // never sized yet
      const dpr = Math.min(window.devicePixelRatio || 1, maxDPR);
      if (opts.onResize) opts.onResize({ rect: rect, dpr: dpr, size: size, first: !!first });
    }

    function schedule() {
      if (rafId) return;
      rafId = requestAnimationFrame(function () { rafId = 0; run(false); });
    }

    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.addEventListener('pageshow', schedule);   // bfcache restore

    run(true);   // initial sizing — first=true so the game skips entity rescale

    return {
      get W() { return curW; },
      get H() { return curH; },
      get dpr() { return curDPR; },
      ctx: ctx,
      trigger: function (asFirst) { run(!!asFirst); },
      size: size,
    };
  }

  window.HSGFit = { attach: attach };
})();
