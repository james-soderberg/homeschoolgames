// ============================================================
// HSGCircuit — a tiny DC circuit solver for the "Current" game.
//
// It does real Modified Nodal Analysis (MNA): batteries are ideal voltage
// sources with a small internal resistance; bulbs/resistors/closed switches/
// intact fuses are resistors; wires are ideal (they just merge terminals into
// one node). Solve G·v = i, read the current down each branch, and a bulb's
// brightness is its real power P = I²R relative to what it would dissipate
// alone on a fresh battery. Series bulbs dim, parallel bulbs stay bright —
// because the math says so, not because we told it to.
//
// Pure + DOM-free so it runs in Node for the simulation tests too.
//   HSGCircuit.simulate(components, wires) -> physics result
// ============================================================
(function (root) {
  'use strict';

  const K = {
    BATTERY_V: 9,      // default cell voltage
    R_INT: 0.5,        // battery internal resistance (keeps shorts finite & realistic)
    BULB_R: 10,        // default bulb resistance
    SWITCH_R: 1e-3,    // closed switch / intact fuse: near-ideal but measurable
    FUSE_R: 1e-3,
    GMIN: 1e-9,        // tiny leak to ground on every node → never singular
    OVERHEAT_I: 5,     // amps through a source before we call it a short/overheat
    FUSE_RATING: 3,    // default amps a fuse tolerates before it blows
    EPS_I: 1e-4,       // below this many amps we treat a branch as "off"
  };
  // A bulb of resistance r, alone on a fresh cell, dissipates this — its "full brightness".
  const ratedPower = (r, v) => { const i = v / (r + K.R_INT); return i * i * r; };

  // ---- linear solve: Gauss–Jordan with partial pivoting (returns null if singular) ----
  function solveLinear(A, b) {
    const n = b.length;
    if (n === 0) return [];
    // work on copies
    const M = A.map((row, i) => row.slice().concat(b[i]));
    for (let col = 0; col < n; col++) {
      // partial pivot
      let piv = col, best = Math.abs(M[col][col]);
      for (let r = col + 1; r < n; r++) { const a = Math.abs(M[r][col]); if (a > best) { best = a; piv = r; } }
      if (best < 1e-15) return null;
      if (piv !== col) { const t = M[piv]; M[piv] = M[col]; M[col] = t; }
      // normalize + eliminate
      const pv = M[col][col];
      for (let c = col; c <= n; c++) M[col][c] /= pv;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col];
        if (f === 0) continue;
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
    return M.map(row => row[n]);
  }

  // ---- MNA: node 0 is ground. resistors:[{n1,n2,r}], sources:[{n1,n2,v}] (V(n1)-V(n2)=v) ----
  function mna(numNodes, resistors, sources) {
    const n = numNodes - 1;            // unknown node voltages: nodes 1..numNodes-1
    const m = sources.length;
    const size = n + m;
    const A = Array.from({ length: size }, () => new Array(size).fill(0));
    const z = new Array(size).fill(0);
    const gi = node => node - 1;       // node index in the reduced system (ground → -1)

    // tiny conductance to ground everywhere for numerical safety
    for (let i = 0; i < n; i++) A[i][i] += K.GMIN;

    for (const e of resistors) {
      const g = 1 / e.r, a = gi(e.n1), b = gi(e.n2);
      if (a >= 0) A[a][a] += g;
      if (b >= 0) A[b][b] += g;
      if (a >= 0 && b >= 0) { A[a][b] -= g; A[b][a] -= g; }
    }
    sources.forEach((s, k) => {
      const a = gi(s.n1), b = gi(s.n2), r = n + k;
      if (a >= 0) { A[a][r] += 1; A[r][a] += 1; }
      if (b >= 0) { A[b][r] -= 1; A[r][b] -= 1; }
      z[r] = s.v;
    });

    const x = solveLinear(A, z);
    if (!x) return null;
    const v = new Array(numNodes).fill(0);
    for (let i = 1; i < numNodes; i++) v[i] = x[gi(i)];
    const sourceCurrents = sources.map((_, k) => x[n + k]);
    return { v, sourceCurrents };
  }

  // ---- union–find over terminal ids ----
  function makeDSU() {
    const p = new Map();
    const find = x => { if (!p.has(x)) p.set(x, x); let r = x; while (p.get(r) !== r) r = p.get(r); while (p.get(x) !== r) { const nx = p.get(x); p.set(x, r); x = nx; } return r; };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) p.set(ra, rb); };
    return { find, union, has: x => p.has(x) };
  }

  const termId = (comp, name) => comp.id + '.' + name;
  const TERMS = { battery: ['pos', 'neg'], bulb: ['a', 'b'], resistor: ['a', 'b'], switch: ['a', 'b'], fuse: ['a', 'b'] };

  // ============================================================
  // simulate(components, wires) — the whole physics pass.
  //   components: [{ id, type, v?, r?, closed?, blown?, rating? }]
  //   wires:      [[terminalId, terminalId], ...]   (terminalId = "compId.name")
  // ============================================================
  function simulate(components, wires) {
    wires = wires || [];
    const dsu = makeDSU();
    // register every terminal
    for (const c of components) for (const t of (TERMS[c.type] || ['a', 'b'])) dsu.find(termId(c, t));
    // ideal wires merge terminals into shared nodes
    for (const w of wires) { if (w && w[0] && w[1]) dsu.union(w[0], w[1]); }

    // choose ground: the node touching a battery's negative terminal (else any node)
    let groundRoot = null;
    const firstBat = components.find(c => c.type === 'battery');
    if (firstBat) groundRoot = dsu.find(termId(firstBat, 'neg'));

    // number the real nodes, ground = 0
    const rootToNode = new Map();
    if (groundRoot != null) rootToNode.set(groundRoot, 0);
    let next = rootToNode.size ? 1 : 0;
    const nodeOf = tid => {
      const r = dsu.find(tid);
      if (!rootToNode.has(r)) { rootToNode.set(r, next++); }
      return rootToNode.get(r);
    };
    // assign all real terminals first so battery internal nodes come after
    for (const c of components) for (const t of (TERMS[c.type] || ['a', 'b'])) nodeOf(termId(c, t));
    if (rootToNode.size === 0) return emptyResult(components);
    let numNodes = next;

    const resistors = [];
    const sources = [];
    // remember how to read each component's current back out
    const readback = [];   // {comp, kind, n1, n2, r} or battery source ref

    for (const c of components) {
      if (c.type === 'battery') {
        const v = c.v != null ? c.v : K.BATTERY_V;
        const nPos = nodeOf(termId(c, 'pos'));
        const nNeg = nodeOf(termId(c, 'neg'));
        const nInt = numNodes++;                 // hidden node between EMF and its internal resistance
        sources.push({ n1: nInt, n2: nNeg, v });
        resistors.push({ n1: nInt, n2: nPos, r: K.R_INT });
        readback.push({ comp: c, kind: 'battery', srcIndex: sources.length - 1, nInt, nPos });
      } else if (c.type === 'bulb' || c.type === 'resistor') {
        const r = c.r != null ? c.r : (c.type === 'bulb' ? K.BULB_R : 100);
        const n1 = nodeOf(termId(c, 'a')), n2 = nodeOf(termId(c, 'b'));
        resistors.push({ n1, n2, r });
        readback.push({ comp: c, kind: c.type, n1, n2, r });
      } else if (c.type === 'switch') {
        if (c.closed) {
          const n1 = nodeOf(termId(c, 'a')), n2 = nodeOf(termId(c, 'b'));
          resistors.push({ n1, n2, r: K.SWITCH_R });
          readback.push({ comp: c, kind: 'switch', n1, n2, r: K.SWITCH_R });
        } else readback.push({ comp: c, kind: 'switch', open: true });
      } else if (c.type === 'fuse') {
        if (!c.blown) {
          const n1 = nodeOf(termId(c, 'a')), n2 = nodeOf(termId(c, 'b'));
          resistors.push({ n1, n2, r: K.FUSE_R });
          readback.push({ comp: c, kind: 'fuse', n1, n2, r: K.FUSE_R });
        } else readback.push({ comp: c, kind: 'fuse', open: true });
      }
    }

    const sol = mna(numNodes, resistors, sources);
    if (!sol) return emptyResult(components);
    const { v, sourceCurrents } = sol;

    const per = {};          // per-component physics
    let roomLight = 0, shorted = false;
    const newlyBlown = [];

    for (const rb of readback) {
      const c = rb.comp;
      if (rb.open) { per[c.id] = { current: 0, power: 0, voltage: 0, brightness: 0, on: false }; continue; }
      if (rb.kind === 'battery') {
        const i = Math.abs(sourceCurrents[rb.srcIndex]);
        const vTerm = v[rb.nPos] - v[nodeOfNeg(c, nodeOf)];
        per[c.id] = { current: i, power: i * (c.v != null ? c.v : K.BATTERY_V), voltage: vTerm, on: i > K.EPS_I };
        if (i > K.OVERHEAT_I) shorted = true;
        continue;
      }
      const drop = v[rb.n1] - v[rb.n2];
      const i = drop / rb.r;
      const ai = Math.abs(i), power = ai * ai * rb.r;
      const rec = { current: ai, signedCurrent: i, power, voltage: Math.abs(drop), on: ai > K.EPS_I };
      if (rb.kind === 'bulb') {
        const rated = ratedPower(rb.r, K.BATTERY_V);
        rec.brightness = Math.max(0, Math.min(1.15, power / rated));
        roomLight += Math.min(1, rec.brightness);
      }
      if (rb.kind === 'fuse') {
        const rating = c.rating != null ? c.rating : K.FUSE_RATING;
        rec.rating = rating;
        if (ai > rating) newlyBlown.push(c.id);
      }
      per[c.id] = rec;
    }

    return {
      nodeVoltage: v, per, roomLight, shorted, newlyBlown,
      numNodes, ok: true,
    };
  }

  // helper: neg-terminal node of a battery (kept out of the hot loop for clarity)
  function nodeOfNeg(batteryComp, nodeOf) { return nodeOf(termId(batteryComp, 'neg')); }

  function emptyResult(components) {
    const per = {};
    for (const c of components) per[c.id] = { current: 0, power: 0, voltage: 0, brightness: 0, on: false };
    return { nodeVoltage: [], per, roomLight: 0, shorted: false, newlyBlown: [], numNodes: 0, ok: false };
  }

  const API = { simulate, mna, K, ratedPower, _solveLinear: solveLinear };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.HSGCircuit = API;
})(typeof window !== 'undefined' ? window : globalThis);
