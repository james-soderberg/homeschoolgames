/* HSGLoop - pause a game's requestAnimationFrame loop while the tab is hidden.
   Backgrounded tabs (and split-screen / picture-in-picture on Chromebooks and
   tablets) keep firing rAF in some setups; a paused game rendering 60fps to a
   hidden tab is pure battery drain. Each game registers once with hooks that
   close over its own loop variables:

     HSGLoop.guard({
       isActive: () => rafId != null,                 // is the loop running now?
       stop:     () => { cancelAnimationFrame(rafId); rafId = null; },
       start:    () => { lastTs = 0; rafId = requestAnimationFrame(loop); }
     });

   On hide we stop the loop if it was active and remember that; on show we
   restart it (start() resets the game's own delta-time base so dt doesn't
   spike after a long pause). Games whose loop was already idle stay idle. */
(function () {
  var reg = [];
  function apply() {
    var hidden = document.hidden;
    for (var i = 0; i < reg.length; i++) {
      var g = reg[i];
      if (hidden) {
        g._was = !!g.isActive();
        if (g._was) { try { g.stop(); } catch (e) {} }
      } else if (g._was) {
        g._was = false;
        try { g.start(); } catch (e) {}
      }
    }
  }
  document.addEventListener('visibilitychange', apply);
  window.HSGLoop = {
    guard: function (g) { g._was = false; reg.push(g); return g; }
  };
})();
