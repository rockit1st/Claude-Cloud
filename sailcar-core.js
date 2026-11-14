// Sail Car Lab — shared core
// ─────────────────────────────────────────────────────────────────────────────
// • SailLab.register(module)  — each module file (sailcar-m1.js …) calls this once
// • SailLab.physics           — ONE physics model of two box fans blowing a sail car down
//                               the hallway, used by every simulator and the Design Studio
// • SailLab.ui / SailLab.draw — small helpers so every module looks and behaves the same
// • Progress (which modules a student has passed) is saved in Firestore
//   (sailcar_progress/{uid}); if the database refuses, it falls back to this browser.
(function () {
  'use strict';

  const TEACHER_EMAIL = 'ncapellini@hhh.k12.ny.us';
  const QUIZ_SIZE = 5, PASS_COUNT = 4;              // 4 of 5 (80%) unlocks the next module
  const modules = [];

  // ── tiny DOM helpers ──────────────────────────────────────────────────────
  const SVGNS = 'http://www.w3.org/2000/svg';
  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;          // only for module-authored static text
      else if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function svg(tag, attrs, parent, text) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function fmt(v, d) { return (Math.round(v * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toFixed(d || 0); }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ── PHYSICS ───────────────────────────────────────────────────────────────
  // Units: metres, kilograms, seconds, newtons.  x = distance from the fan.
  const AIR = 1.2, G = 9.81;
  // TWO box fans side by side on high, at the start of the hallway (Mr. Capellini's setup).
  // About 3.5 m/s at the grilles. The wide jet from two fans fades slowly down the hall:
  //   wind(x) = v0 / (1 + x / L)
  // L is calibrated from real results with these fans: paper-sail SLEDS (no wheels, about 20 g,
  // sliding friction about 0.3, a 20 cm × 22 cm sail) typically slid about 25 ft (7.6 m), the
  // best about 30 ft — so the wind is still about 1.35 m/s at 7.6 m.
  const FAN = { v0: 3.5, L: 4.8, count: 2 };
  const SLED_FRICTION = 0.3;   // a paper or cardstock sled SLIDING on hallway tile (wheels are about 10× less)
  // A typical student car: popsicle-stick chassis, skewer axles in straws, 4 plastic
  // wheels, a 20 cm × 20 cm paper sail on a skewer mast.
  const DEFAULT_CAR = {
    mass: 0.07,        // kg   (70 g)
    sailArea: 0.04,    // m²   (20 cm × 20 cm)
    sailCd: 1.2,       // how well the sail catches wind (flat ≈ 1.2, cupped ≈ 1.4)
    sailAngle: 0,      // degrees the sail is turned away from facing the fan
    sailHeight: 0.13,  // m    height of the middle of the sail above the floor
    bodyArea: 0.003,   // m²   front of the chassis + wheels
    bodyCd: 1.0,
    crr: 0.025,        // rolling friction: wheels + axles (0.01 smooth … 0.08 rubbing)
    cgHeight: 0.03,    // m    height of the centre of gravity
    cgToFront: 0.08,   // m    centre of gravity to the front axle (longer = harder to tip forward)
    wheelbase: 0.16,   // m    front axle to back axle
    veerDeg: 0         // degrees the front axle is turned off square (crooked axles make the car curve)
  };
  function windAt(x, fan) { fan = fan || FAN; return x < 0 ? 0 : fan.v0 / (1 + x / fan.L); }
  // Air pushes on an area. rel = wind speed − car speed. Positive = pushes the car forward.
  // When the car is faster than the wind (rel < 0) the same force slows it down: that is drag.
  function airForce(rel, area, cd, angleDeg) {
    const c = Math.cos((angleDeg || 0) * Math.PI / 180);
    return 0.5 * AIR * cd * area * rel * Math.abs(rel) * c * c;
  }
  function rollingFriction(mass, crr) { return crr * mass * G; }
  const STICKY = 1.3;   // it takes a bit more push to START rolling than to KEEP rolling
  // The hallway: the ONE place its size lives (simulate() reads it every run). A car that rolls
  // `length` metres has reached the far end; it hits a wall 10 cm before it drifts `width` / 2 sideways.
  // The real hallway (the teacher: about 60–80 ft long from the fans, 10–12 ft wide) → 70 ft × 11 ft.
  // Change it here if the hallway is measured; every simulator and the Studio read it from here.
  const HALL = { length: 21.3, width: 3.35 };
  // Names this calibration (FAN, STICKY, the crawl rule, DEFAULT_CAR, HALL). The Design Studio stores it
  // with each prediction and ignores predictions made with a different one — change it whenever any of those change.
  const MODEL_VERSION = 'two-fans-2';   // 2 = the 70 ft × 11 ft hallway

  // Simulate one run down the hallway. Returns distance travelled and why it stopped.
  function simulate(carIn, optsIn) {
    const car = Object.assign({}, DEFAULT_CAR, carIn || {});
    const o = Object.assign({ fan: FAN, startX: 0.3, hallLength: HALL.length, hallWidth: HALL.width, dt: 0.004, maxTime: 240, recordEvery: 0.04 }, optsIn || {});
    let x = o.startX, v = 0, t = 0, moving = false, top = 0, reason = 'coasted to a stop', recT = 0;
    let path = 0, lateral = 0;                       // distance rolled along its own path, and sideways drift
    const trace = [];
    // a crooked front axle steers the car round a circle of radius wheelbase / tan(angle)
    const turnR = car.veerDeg ? car.wheelbase / Math.tan(Math.abs(car.veerDeg) * Math.PI / 180) : Infinity;
    const startPush = airForce(windAt(x, o.fan), car.sailArea, car.sailCd, car.sailAngle) + airForce(windAt(x, o.fan), car.bodyArea, car.bodyCd, 0);
    function rec(fs, fb, fr) { trace.push({ t: t, x: x - o.startX, v: v, wind: windAt(x, o.fan), thrust: fs, body: fb, friction: fr, lateral: lateral }); }
    while (t < o.maxTime) {
      const wind = windAt(x, o.fan), rel = wind - v;
      const fs = airForce(rel, car.sailArea, car.sailCd, car.sailAngle);
      const fb = airForce(rel, car.bodyArea, car.bodyCd, 0);
      const fr = rollingFriction(car.mass, car.crr);
      // Tipping forward: the wind pushes high on the sail; the car's weight holds the back down.
      if (Math.max(0, fs) * (car.sailHeight - car.cgHeight) > car.mass * G * car.cgToFront) { reason = 'tipped over'; rec(fs, fb, fr); break; }
      if (!moving) {
        if (fs + fb > fr * STICKY) moving = true;
        else { reason = t === 0 ? 'never moved' : 'coasted to a stop'; rec(fs, fb, 0); break; }
      }
      const a = (fs + fb - fr) / car.mass;
      v += a * o.dt;
      if (v <= 0) { v = 0; moving = false; }
      // crawling (under 5 cm/s) and the push can't beat sticky friction: a real car just stops here
      if (v < 0.05 && fs + fb < fr * STICKY) { v = 0; moving = false; }
      path += v * o.dt; t += o.dt;
      if (turnR === Infinity) x = o.startX + path;
      else { const th = Math.min(Math.PI / 2, path / turnR); x = o.startX + turnR * Math.sin(th); lateral = turnR * (1 - Math.cos(th)); }
      if (v > top) top = v;
      if (t >= recT) { rec(fs, fb, moving ? fr : 0); recT += o.recordEvery; }
      if (lateral > o.hallWidth / 2 - 0.1) { reason = 'hit the wall'; break; }
      // (other modules compare against this exact reason; the hall's length is in opts.hallLength)
      if (x - o.startX >= o.hallLength) { reason = 'reached the end of the hall'; break; }
    }
    rec(0, 0, 0);
    return { distance: x - o.startX, topSpeed: top, time: t, reason: reason, trace: trace, startPush: startPush,
             friction: rollingFriction(car.mass, car.crr), car: car, opts: o };
  }

  const physics = { AIR: AIR, G: G, FAN: FAN, SLED_FRICTION: SLED_FRICTION, DEFAULT_CAR: DEFAULT_CAR, STICKY: STICKY,
                    HALL: HALL, MODEL_VERSION: MODEL_VERSION,
                    windAt: windAt, airForce: airForce, rollingFriction: rollingFriction, simulate: simulate };

  // ── DRAWING ───────────────────────────────────────────────────────────────
  const draw = {
    // arrow from (x1,y1) to (x2,y2) with an optional label
    arrow: function (parent, x1, y1, x2, y2, color, label, opts) {
      opts = opts || {};
      const g = svg('g', { class: 'sl-arrow' }, parent);
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 2) return g;
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len, hw = opts.head || 7;
      svg('line', { x1: x1, y1: y1, x2: x2 - ux * hw, y2: y2 - uy * hw, stroke: color, 'stroke-width': opts.width || 4, 'stroke-linecap': 'round' }, g);
      svg('polygon', { points: [x2, y2, x2 - ux * hw * 1.6 - uy * hw, y2 - uy * hw * 1.6 + ux * hw, x2 - ux * hw * 1.6 + uy * hw, y2 - uy * hw * 1.6 - ux * hw].join(','), fill: color }, g);
      if (label) svg('text', { x: (x1 + x2) / 2 + (opts.dx || 0), y: (y1 + y2) / 2 + (opts.dy == null ? -9 : opts.dy), 'text-anchor': 'middle', fill: color, 'font-size': opts.size || 12, 'font-weight': 700, class: 'sl-lbl' }, g, label);
      return g;
    },
    // the box fans seen from the side (two side by side look like one), at (x, floorY)
    fan: function (parent, x, floorY, size, label) {
      size = size || 60;
      const g = svg('g', { class: 'sl-fan' }, parent);
      svg('rect', { x: x, y: floorY - size, width: size * 0.32, height: size, rx: 4, fill: '#3a2a5a', stroke: '#9080b0', 'stroke-width': 2 }, g);
      for (let i = 1; i < 5; i++) svg('line', { x1: x + 3, y1: floorY - size + i * size / 5, x2: x + size * 0.32 - 3, y2: floorY - size + i * size / 5, stroke: '#6a5a8a', 'stroke-width': 1.5 }, g);
      svg('text', { x: x + size * 0.16, y: floorY + 14, 'text-anchor': 'middle', fill: '#9080b0', 'font-size': 10 }, g, label || '2 FANS');
      return g;
    },
    // a sail car seen from the side; (x, floorY) = back wheel contact point. 1 unit ≈ 1 px per cm × scale
    car: function (parent, x, floorY, o) {
      o = Object.assign({ scale: 1, length: 24, sailW: 20, sailH: 20, mastH: 26, cupped: false, wheelR: 3, color: '#b44fff', sailColor: '#f0e6ff', tilt: 0 }, o || {});
      const s = o.scale, g = svg('g', { class: 'sl-car' }, parent);
      if (o.tilt) g.setAttribute('transform', 'rotate(' + o.tilt + ',' + (x + o.length * s) + ',' + floorY + ')');
      const r = o.wheelR * s, deckY = floorY - r * 2 - 1 * s;
      svg('rect', { x: x - r * 0.4, y: deckY, width: o.length * s + r * 0.8, height: 2 * s, rx: 1, fill: '#d8b070', stroke: '#a07830', 'stroke-width': 0.6 }, g); // popsicle-stick deck
      [x + r, x + o.length * s - r].forEach(function (cx) {
        svg('circle', { cx: cx, cy: floorY - r, r: r, fill: '#222', stroke: '#888', 'stroke-width': Math.max(1, s * 0.6) }, g);
        svg('circle', { cx: cx, cy: floorY - r, r: Math.max(1, r * 0.3), fill: '#ccc' }, g);
      });
      const mastX = x + o.length * s * (o.mastAt != null ? o.mastAt : 0.45), mastTop = deckY - o.mastH * s;   // mastAt: 0 = back … 1 = front
      svg('line', { x1: mastX, y1: deckY, x2: mastX, y2: mastTop, stroke: '#c8a060', 'stroke-width': Math.max(1.5, s * 0.8) }, g);
      // The sail faces the fan (to the left). Drawn turned a little toward us so you can see its face;
      // a cupped sail bulges away from the wind.
      const sTop = mastTop, sBot = mastTop + o.sailH * s, depth = o.sailW * s * 0.45, drop = o.sailW * s * 0.12, bulge = o.cupped ? o.sailW * s * 0.18 : 0;
      svg('path', { d: 'M ' + mastX + ',' + sTop + ' L ' + (mastX - depth) + ',' + (sTop + drop) +
                       ' Q ' + (mastX - depth + bulge) + ',' + ((sTop + sBot) / 2 + drop) + ' ' + (mastX - depth) + ',' + (sBot + drop) +
                       ' L ' + mastX + ',' + sBot + ' Q ' + (mastX + bulge) + ',' + ((sTop + sBot) / 2) + ' ' + mastX + ',' + sTop + ' Z',
        fill: o.sailColor, stroke: '#9080b0', 'stroke-width': 0.9, opacity: 0.92 }, g);
      return g;
    }
  };

  // ── UI HELPERS ────────────────────────────────────────────────────────────
  let uid = 0;
  const ui = {
    // labelled slider: returns { get(), set(v), input }
    slider: function (parent, o) {
      const id = 'sl-s' + (++uid);
      const out = h('span', { class: 'sl-val' });
      const input = h('input', { type: 'range', id: id, min: o.min, max: o.max, step: o.step || 1, value: o.value });
      const fmtV = o.format || function (v) { return v + (o.unit ? ' ' + o.unit : ''); };
      function show() { out.textContent = fmtV(Number(input.value)); }
      input.addEventListener('input', function () { show(); if (o.onInput) o.onInput(Number(input.value)); });
      parent.appendChild(h('div', { class: 'sl-ctrl' }, [h('label', { for: id, class: 'sl-ctrl-lbl' }, [o.label + ' ', out]), input]));
      show();
      return { input: input, get: function () { return Number(input.value); }, set: function (v) { input.value = v; show(); } };
    },
    // chip buttons, one choice: returns { get(), set(v) }
    choice: function (parent, o) {
      let val = o.value;
      const row = h('div', { class: 'sl-chips', role: 'group', 'aria-label': o.label });
      const btns = o.options.map(function (op) {
        const b = h('button', { type: 'button', class: 'sl-chip', text: op.label, 'aria-pressed': String(op.value === val) });
        b.addEventListener('click', function () { set(op.value); if (o.onChange) o.onChange(val); });
        row.appendChild(b);
        return b;
      });
      function set(v) { val = v; o.options.forEach(function (op, i) { btns[i].classList.toggle('active', op.value === v); btns[i].setAttribute('aria-pressed', String(op.value === v)); }); }
      set(val);
      parent.appendChild(h('div', { class: 'sl-ctrl' }, [h('div', { class: 'sl-ctrl-lbl', text: o.label }), row]));
      return { get: function () { return val; }, set: set };
    },
    // callout box: kind = 'tip' | 'warn' | 'good' | 'build'
    note: function (parent, kind, html) { const n = h('div', { class: 'sl-note sl-note-' + (kind || 'tip'), html: html }); parent.appendChild(n); return n; },

    // The hallway simulator: fan on the left, the car rolls right, forces drawn on the car.
    //   getCar()  → car parameters (merged over DEFAULT_CAR)
    //   opts      → simulate() options (fan, startX, hallLength…), plus
    //               { getOpts() → options read fresh on every run (e.g. a fan-speed control),
    //                 showForces (default true), scaleM (metres shown; default fits the run),
    //                 playSpeed (default: 2×, faster for long runs so it lasts ≤ ~9 s), onResult(result) }
    // Returns { run(), reset(), last() }
    trackSim: function (parent, getCar, opts) {
      opts = opts || {};
      const box = h('div', { class: 'sl-track' });
      parent.appendChild(box);
      // drawn at the real on-screen width, so labels stay readable on a phone
      let W = 820, XEND = W - 20;
      const H = 210, FLOOR = 170, X0 = 70;
      function cur() { return Object.assign({}, opts, opts.getOpts ? opts.getOpts() : {}); }
      const sv = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'sl-track-svg', role: 'img', 'aria-label': 'Hallway simulator' }, box);
      function fit() {
        W = Math.max(360, Math.min(820, Math.round(box.clientWidth || 820)));
        XEND = W - 20;
        sv.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      }
      const readout = h('div', { class: 'sl-readout', 'aria-live': 'polite' });
      const runBtn = h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: '▶ Run' });
      const resetBtn = h('button', { type: 'button', class: 'sl-btn', text: '↺ Reset' });
      // shown while a run plays sped up, so nobody expects a real car to be this quick
      const speedTag = h('span', { class: 'sl-speed', hidden: true });
      box.appendChild(h('div', { class: 'sl-track-bar' }, [runBtn, resetBtn, speedTag, readout]));
      let raf = null, last = null, scaleM = 8;
      function pxOf(m) { return X0 + 18 + m / scaleM * (XEND - X0 - 40); }
      function scene(distM, carState) {
        fit();
        sv.textContent = '';
        svg('rect', { x: 0, y: 0, width: W, height: H, fill: '#120826' }, sv);
        svg('line', { x1: 10, y1: FLOOR, x2: W - 10, y2: FLOOR, stroke: '#4a3a6a', 'stroke-width': 3 }, sv);
        // metre marks
        const pxPerM = (XEND - X0 - 40) / scaleM;
        const step = pxPerM >= 40 ? 1 : pxPerM >= 20 ? 2 : pxPerM >= 10 ? 4 : 5;
        for (let m = 0; m <= scaleM + 0.001; m += step) {
          const px = pxOf(m);
          svg('line', { x1: px, y1: FLOOR, x2: px, y2: FLOOR + 8, stroke: '#6a5a8a', 'stroke-width': 1.5 }, sv);
          svg('text', { x: px, y: FLOOR + 22, 'text-anchor': 'middle', fill: '#9080b0', 'font-size': 11 }, sv, m + ' m');
        }
        draw.fan(sv, X0 - 40, FLOOR, 70);
        // wind streaks: fewer and shorter where the wind is weaker
        const o = cur();
        for (let m = 0.2; m < scaleM; m += scaleM / 22) {
          const w = windAt(m + (o.startX || 0.3), o.fan), len = Math.min(26, w * 8), op = Math.min(0.55, w / FAN.v0 * 0.6);
          [70, 100, 130].forEach(function (y, i) {
            const px = pxOf(m) + (i % 2) * 8;
            svg('line', { x1: px, y1: FLOOR - y, x2: px + len, y2: FLOOR - y, stroke: '#7ad7ff', 'stroke-width': 1.5, opacity: op.toFixed(2), 'stroke-linecap': 'round' }, sv);
          });
        }
        if (distM != null) {
          const fx = pxOf(distM);
          svg('line', { x1: fx, y1: FLOOR - 150, x2: fx, y2: FLOOR, stroke: '#f0c040', 'stroke-dasharray': '4,4', 'stroke-width': 1.5 }, sv);
        }
        const c = Object.assign({}, DEFAULT_CAR, getCar());
        const sailSide = Math.sqrt(c.sailArea) * 100, carScale = W < 600 ? 1.8 : 2.4;
        const st = carState || { x: 0, tilt: 0 };
        draw.car(sv, pxOf(st.x) - 12, FLOOR, { scale: carScale, sailW: sailSide, sailH: Math.max(6, sailSide * Math.max(0.2, Math.cos(c.sailAngle * Math.PI / 180))), mastH: Math.max(sailSide, c.sailHeight * 100 + sailSide / 2), cupped: c.sailCd > 1.3, tilt: st.tilt || 0 });
        if (st.forces && opts.showForces !== false) {
          const cx = pxOf(st.x) + 10, k = 260;         // px per newton
          const push = st.forces.thrust + st.forces.body;
          if (Math.abs(push) > 0.002) draw.arrow(sv, cx, FLOOR - 120, cx + Math.max(-90, Math.min(90, push * k)), FLOOR - 120, push >= 0 ? '#40e080' : '#ff5050', push >= 0 ? 'wind push' : 'air drag', { width: 4 });
          if (st.forces.friction > 0.001) draw.arrow(sv, cx, FLOOR - 4, cx - Math.min(90, st.forces.friction * k), FLOOR - 4, '#ffa040', 'friction', { width: 3, dy: 16 });
        }
      }
      function show(text) { readout.textContent = text; }
      function stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = null; runBtn.disabled = false; speedTag.hidden = true;
      }
      function reset() {
        stop();
        scaleM = opts.scaleM || 8;
        scene(null, null);
        show('Press ▶ Run to send your car down the hallway.');
      }
      function run() {
        if (raf) cancelAnimationFrame(raf);
        const res = simulate(getCar(), cur());
        last = res;
        scaleM = opts.scaleM || Math.max(6, Math.ceil(res.distance * 1.15));
        runBtn.disabled = true;
        const speedUp = opts.playSpeed || Math.max(2, res.time / 9), t0 = performance.now(), tr = res.trace;
        const times = Math.round(speedUp);
        speedTag.textContent = '▶▶ ×' + times + ' speed';
        speedTag.title = 'Playing ' + times + ' times faster than real life. The real run takes about ' + fmt(res.time, 0) + ' s.';
        speedTag.hidden = times <= 1;
        let i = 0;
        function frame(now) {
          if (!box.isConnected) { raf = null; return; }   // the step was closed mid-run
          const tt = (now - t0) / 1000 * speedUp;
          while (i < tr.length - 1 && tr[i + 1].t <= tt) i++;
          const p = tr[i], done = i >= tr.length - 1;
          const tipped = res.reason === 'tipped over' && done;
          scene(done ? res.distance : null, { x: p.x, tilt: tipped ? 35 : 0, forces: done ? null : { thrust: p.thrust, body: p.body, friction: p.friction } });
          show((done ? '🏁 ' : '') + fmt(p.x, 2) + ' m · speed ' + fmt(p.v, 2) + ' m/s · wind ' + fmt(p.wind, 2) + ' m/s');
          if (!done) { raf = requestAnimationFrame(frame); return; }
          stop();
          const why = { 'never moved': '😴 It never moved — the wind’s push was smaller than friction.', 'tipped over': '🤸 It tipped over! The push high on the sail flipped it forward.',
                        'hit the wall': '🧱 It veered into the wall.', 'reached the end of the hall': '🏆 It made it to the end of the ' + Number(res.opts.hallLength.toFixed(1)) + ' m (' + Math.round(res.opts.hallLength * 3.28084) + ' ft) hall!', 'coasted to a stop': '🛑 It coasted to a stop.' }[res.reason] || '';
          show('📏 ' + fmt(res.distance, 2) + ' m in ' + fmt(res.time, 1) + ' s · top speed ' + fmt(res.topSpeed, 2) + ' m/s — ' + why);
          if (opts.onResult) opts.onResult(res);
        }
        raf = requestAnimationFrame(frame);
      }
      runBtn.addEventListener('click', run);
      resetBtn.addEventListener('click', reset);
      reset();
      return { run: run, reset: reset, last: function () { return last; }, stop: stop };
    }
  };

  // ── PROGRESS ──────────────────────────────────────────────────────────────
  // sailcar_progress/{uid} = { uid, name, email, updatedAt,
  //                            modules: { <moduleId>: { attempts, best, total, passed, passedAt } },
  //                            design }   ← written only by the Design Studio; never touched here
  // The database copy is the truth. Every save is a TRANSACTION that reads the database copy and adds
  // this device's news to it (a pass never goes backwards, best = highest, attempts add up), so a
  // second Chromebook or an old tab can never erase a pass. This browser keeps a backup copy
  // (localStorage): quiz attempts that haven't reached the database yet wait there as "pending" and
  // upload on the next try — after each quiz, on a timer, when the network comes back, and on the
  // next visit.
  const PROGRESS_FIELDS = ['uid', 'name', 'email', 'updatedAt', 'modules'];   // the only fields this file writes
  const RETRY_S = [5, 15, 60, 120, 300];                                      // seconds between tries after a failure

  function count(v) { v = Math.floor(Number(v)); return isFinite(v) && v > 0 ? v : 0; }
  function earliest(a, b) { return a && b ? Math.min(a, b) : (a || b || null); }
  // one module's record, cleaned to exactly the five fields the database expects (null if it isn't one)
  function cleanRec(r) {
    if (!r || typeof r !== 'object') return null;
    const passed = r.passed === true, at = Number(r.passedAt);
    return { attempts: count(r.attempts), best: count(r.best), total: count(r.total) || QUIZ_SIZE, passed: passed,
             passedAt: passed && isFinite(at) && at > 0 ? at : null };
  }
  // two copies of the SAME history (e.g. the database's and this device's): keep the most of each
  function mergeRec(a, b) {
    a = cleanRec(a); b = cleanRec(b);
    if (!a || !b) return a || b;
    const passed = a.passed || b.passed;
    return { attempts: Math.max(a.attempts, b.attempts), best: Math.max(a.best, b.best), total: Math.max(a.total, b.total),
             passed: passed, passedAt: passed ? earliest(a.passedAt, b.passedAt) : null };
  }
  // NEW attempts (d) on top of a record (r): attempts add up
  function addAttempts(r, d) {
    d = cleanRec(d);
    r = cleanRec(r) || { attempts: 0, best: 0, total: d.total, passed: false, passedAt: null };
    const passed = r.passed || d.passed;
    return { attempts: r.attempts + d.attempts, best: Math.max(r.best, d.best), total: d.total || r.total,
             passed: passed, passedAt: passed ? earliest(r.passedAt, d.passedAt) : null };
  }
  function mergeMods(a, b) {
    const out = {};
    [a, b].forEach(function (src) {
      if (src && typeof src === 'object') Object.keys(src).forEach(function (k) { const r = mergeRec(out[k], src[k]); if (r) out[k] = r; });
    });
    return out;
  }
  function isGraded(id) { return modules.some(function (m) { return m.id === id && !m.noQuiz; }); }
  // the database copy (every module kept) + attempts not uploaded yet + this device's copy
  function combine(serverMods, localMods, pending) {
    const out = mergeMods(serverMods, null);
    Object.keys(pending || {}).forEach(function (k) { if (isGraded(k) && cleanRec(pending[k])) out[k] = addAttempts(out[k], pending[k]); });
    Object.keys(localMods || {}).forEach(function (k) { if (isGraded(k)) { const r = mergeRec(out[k], localMods[k]); if (r) out[k] = r; } });
    return out;
  }
  function modsSig(mods) {
    return JSON.stringify(Object.keys(mods || {}).sort().map(function (k) { return [k, cleanRec(mods[k])]; }));
  }

  // This device's backup: { modules: what this device knows, pending: attempts not in the database yet,
  // sending: writes whose answer hasn't come back yet — [{ id, sig: the modules it wrote, pending: the attempts it carried }] }.
  // Shared by every tab of this browser; kept in memory instead if the browser blocks storage.
  let memLocal = null, storageOk = true;
  function readLocal() {
    let raw = null, l = memLocal;
    if (storageOk) {
      try { raw = localStorage.getItem(progress.key()); } catch (e) { storageOk = false; }
      if (storageOk) { try { l = JSON.parse(raw || 'null'); } catch (e) { l = null; } }
    }
    l = l && typeof l === 'object' ? l : {};
    return { modules: l.modules && typeof l.modules === 'object' ? l.modules : {},
             pending: l.pending && typeof l.pending === 'object' ? l.pending : {},
             sending: Array.isArray(l.sending) ? l.sending.filter(function (f) { return f && typeof f.id === 'string' && typeof f.sig === 'string' && f.pending && typeof f.pending === 'object'; }) : [] };
  }
  function writeLocal(change) {
    const l = readLocal();
    change(l);
    memLocal = l;
    if (storageOk) { try { localStorage.setItem(progress.key(), JSON.stringify({ v: 2, modules: l.modules, pending: l.pending, sending: l.sending })); } catch (e) { storageOk = false; } }
    return l;
  }
  // The write f reached the database: the attempts it carried are not pending any more. Every other write
  // still listed was worked out from an older copy of the database, so the database turns it down: forget it.
  function landed(l, f) {
    Object.keys(f.pending).forEach(function (k) {
      const p = l.pending[k], left = p ? count(p.attempts) - count(f.pending[k] && f.pending[k].attempts) : 0;
      if (left > 0) p.attempts = left; else delete l.pending[k];
    });
    l.sending = [];
  }

  // One upload at a time across this browser's tabs (where the browser supports it), so two tabs
  // never add the same pending attempts twice.
  function withLock(name, fn) {
    const L = typeof navigator !== 'undefined' && navigator.locks;
    if (!L || typeof L.request !== 'function' || typeof AbortController === 'undefined') return fn();
    let entered = false;
    const ac = new AbortController(), t = setTimeout(function () { ac.abort(); }, 20000);
    return L.request(name, { signal: ac.signal }, function () { entered = true; clearTimeout(t); return fn(); })
      .catch(function (e) {
        if (entered || (e && e.name === 'AbortError')) throw e;
        clearTimeout(t);
        return fn();                          // this page may not use locks: go without
      });
  }
  function withTimeout(p, ms) {
    return new Promise(function (resolve, reject) {
      const t = setTimeout(function () { reject({ code: 'timeout' }); }, ms);
      p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }

  // Read the database copy, add this device's news, write it back — all in one transaction.
  // A write can reach the database and still look failed, when the Wi-Fi drops before the answer comes
  // back. The database library then runs the transaction again (or the next upload does), and adding the
  // pending attempts a second time would count them twice. So each write is listed first (local.sending:
  // exactly what it writes and which pending attempts it carries). A later read that finds exactly that
  // in the database knows the write landed: those attempts come out of pending before anything is added.
  // (The progress doc has no room for a device mark, so if another device of the same student wrote exactly
  // the same records a moment earlier, that looks the same: those attempts count once instead of twice.
  // A pass is never lost: passes are also kept in local.modules.)
  function upload(u) {
    const db = firebase.firestore(), ref = db.collection('sailcar_progress').doc(u.uid);
    let server = null, out = null, id = null;
    const tx = db.runTransaction(function (t) {
      return t.get(ref).then(function (snap) {
        server = snap.exists ? (snap.data() || {}) : null;
        let l = readLocal();             // read here: another tab may have added attempts meanwhile
        const sig = server ? modsSig(server.modules) : null;
        if (server && l.sending.some(function (f) { return f.sig === sig; })) {
          l = writeLocal(function (x) { const f = x.sending.filter(function (f) { return f.sig === sig; })[0]; if (f) landed(x, f); });
        }
        id = null;
        out = combine(server && server.modules, l.modules, l.pending);
        if (server ? modsSig(out) === sig : !Object.keys(out).length) return;   // nothing new
        const entry = { id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10), sig: modsSig(out), pending: l.pending };
        id = entry.id;
        writeLocal(function (x) { x.sending = x.sending.concat([entry]).slice(-8); });
        t.set(ref, { uid: u.uid, name: String(u.displayName || u.email || '').slice(0, 100), email: String(u.email || '').slice(0, 100),
                     updatedAt: firebase.firestore.FieldValue.serverTimestamp(), modules: out },
              { mergeFields: PROGRESS_FIELDS });   // 'design' (the Studio's) is left exactly as it is
      });
    });
    // runs whenever the transaction ends well, even if we stopped waiting for it
    return tx.then(function () {
      const l = writeLocal(function (l) {
        const mine = id && l.sending.filter(function (f) { return f.id === id; })[0];
        if (mine) landed(l, mine);       // (not listed any more: a later read already found it and took it out)
        Object.keys(l.pending).forEach(function (k) {     // tidy: nothing here can ever upload
          if (!isGraded(k) || !count(l.pending[k] && l.pending[k].attempts)) delete l.pending[k];
        });
        l.modules = mergeMods(l.modules, out);
      });
      return { server: server || {}, modules: out, local: l };
    });
  }

  let running = null, queued = null, retryTimer = null, failures = 0, lastSig = '', onlineHooked = false;
  function changed() {
    const s = progress.mode + '|' + modsSig(progress.data.modules);
    if (s === lastSig) return;
    lastSig = s;
    if (typeof progress.onChange === 'function') { try { progress.onChange(); } catch (e) { console.error(e); } }
  }
  function syncOnce() {
    const u = progress.user;
    clearTimeout(retryTimer); retryTimer = null;
    if (!u || typeof firebase === 'undefined' || !firebase.firestore) return Promise.resolve(false);
    return Promise.resolve().then(function () {       // (a throw anywhere below becomes a failed try, never an exception)
      return withLock('sailcar-progress-' + u.uid, function () { return withTimeout(upload(u), 30000); });
    }).then(function (res) {
      if (progress.user !== u) return false;
      failures = 0;
      progress.mode = 'cloud';
      progress.data = Object.assign({}, res.server, {
        modules: mergeMods(combine(res.modules, res.local.modules, res.local.pending), progress.data.modules) });
      changed();
      return true;
    }, function (err) {
      if (progress.user !== u) return false;
      failures++;
      progress.mode = 'local';
      console.warn('Sail Car Lab: progress kept on this device for now (' + ((err && (err.code || err.name)) || err) + '); trying again soon.');
      retryTimer = setTimeout(sync, RETRY_S[Math.min(failures, RETRY_S.length) - 1] * 1000);
      changed();
      return false;
    });
  }
  // Upload now (or right after the upload already running). Resolves true once the database has
  // everything, false if it couldn't be reached (it tries again by itself). Never rejects.
  function sync() {
    if (running) {
      if (!queued) queued = running.then(function () { queued = null; return sync(); });
      return queued;
    }
    running = syncOnce().then(function (ok) { running = null; return ok; }, function () { running = null; return false; });
    return running;
  }

  const progress = {
    user: null, mode: 'loading', data: { modules: {} },
    lastSync: Promise.resolve(false),
    onChange: null,                        // called when the passes or the cloud/device mode change
    key: function () { return 'sailcar-progress-' + (progress.user ? progress.user.uid : 'anon'); },
    // Resolves once the database copy is in (or after 10 s on a very slow network: then this
    // device's copy is shown and the database copy arrives through onChange).
    load: function (user) {
      progress.user = user;
      memLocal = null; storageOk = true;
      progress.mode = 'loading';
      progress.data = { modules: combine(null, readLocal().modules, null) };
      if (!onlineHooked && typeof window.addEventListener === 'function') {
        onlineHooked = true;
        window.addEventListener('online', function () { if (progress.user && progress.mode !== 'cloud') sync(); });
      }
      return new Promise(function (resolve) {
        const slow = setTimeout(function () { if (progress.mode === 'loading') progress.mode = 'local'; resolve(); }, 10000);
        progress.lastSync = sync();
        progress.lastSync.then(function () { clearTimeout(slow); resolve(); });
      });
    },
    passed: function (id) { const m = progress.data.modules[id]; return !!(m && m.passed); },
    get: function (id) { return progress.data.modules[id] || null; },
    // Saves on this device at once and resolves with passed-or-not straight away; the upload runs
    // in the background (progress.lastSync tells how it went).
    record: function (id, score, total) {
      const passedNow = score >= Math.ceil(total * PASS_COUNT / QUIZ_SIZE);
      const d = { attempts: 1, best: count(score), total: count(total) || QUIZ_SIZE, passed: passedNow, passedAt: passedNow ? Date.now() : null };
      progress.data.modules[id] = addAttempts(progress.data.modules[id], d);
      writeLocal(function (l) {
        l.pending[id] = addAttempts(l.pending[id], d);
        l.modules[id] = mergeRec(l.modules[id], progress.data.modules[id]);
      });
      progress.lastSync = sync();
      return Promise.resolve(passedNow);
    },
    save: function () { progress.lastSync = sync(); return progress.lastSync; },
    sync: sync,
    pendingCount: function () { const p = readLocal().pending; return Object.keys(p).reduce(function (n, k) { return n + count(p[k] && p[k].attempts); }, 0); }
  };

  // ── LAB SHELL (hub, module player, quiz) ──────────────────────────────────
  const state = { isTeacher: false, current: null, step: 0, cleanups: [], doneSteps: {} };
  function $(id) { return document.getElementById(id); }

  function register(m) {
    if (!m || !m.id) throw new Error('module needs an id');
    modules.push(m);
    modules.sort(function (a, b) { return (a.num || 99) - (b.num || 99); });
  }
  function unlocked(i) {
    if (state.isTeacher || i === 0) return true;
    const prev = modules[i - 1];
    return prev && (prev.noQuiz ? true : progress.passed(prev.id)) && unlocked(i - 1);
  }

  function renderHub() {
    const hub = $('sl-hub');
    hub.textContent = '';
    const graded = modules.filter(function (m) { return !m.noQuiz; });
    const doneN = graded.filter(function (m) { return progress.passed(m.id); }).length;
    hub.appendChild(h('div', { class: 'sl-progress' }, [
      h('div', { class: 'sl-progress-txt', text: state.isTeacher ? 'Teacher view: every module is open so you can preview it.' : doneN + ' of ' + graded.length + ' modules passed' + (doneN === graded.length ? ' — the Design Studio is open! 🏁' : '') }),
      h('div', { class: 'sl-progress-bar' }, [h('div', { class: 'sl-progress-fill', style: 'width:' + (graded.length ? doneN / graded.length * 100 : 0) + '%' })])
    ]));
    if (progress.mode === 'local' && !state.isTeacher) ui.note(hub, 'warn', '⚠️ Couldn’t reach the class database, so your progress is kept on <strong>this device only</strong> for now. It will upload to your class account by itself as soon as the database can be reached — until then, keep using this device.');
    const grid = h('div', { class: 'sl-grid' });
    modules.forEach(function (m, i) {
      const open = unlocked(i), rec = progress.get(m.id), passed = progress.passed(m.id);
      const card = h('button', { type: 'button', class: 'sl-card' + (open ? '' : ' locked') + (passed ? ' passed' : ''), disabled: !open, 'aria-label': 'Module ' + m.num + ': ' + m.title + (open ? '' : ' (locked)') });
      card.appendChild(h('div', { class: 'sl-card-num', text: m.noQuiz ? 'FINAL' : 'MODULE ' + m.num }));
      card.appendChild(h('div', { class: 'sl-card-icon', text: open ? m.icon : '🔒' }));
      card.appendChild(h('div', { class: 'sl-card-title', text: m.title }));
      card.appendChild(h('div', { class: 'sl-card-blurb', text: m.blurb || '' }));
      card.appendChild(h('div', { class: 'sl-card-status', text: passed ? '✓ Passed (' + rec.best + '/' + (rec.total || QUIZ_SIZE) + ')' : open ? (rec && rec.attempts ? 'Check: best ' + rec.best + '/' + (rec.total || QUIZ_SIZE) + ' — try again' : (m.minutes ? '~' + m.minutes + ' min' : 'Start')) : 'Pass module ' + (m.num - 1) + ' to unlock' }));
      if (open) card.addEventListener('click', function () { openModule(i); });
      grid.appendChild(card);
    });
    hub.appendChild(grid);
  }

  function cleanup() { state.cleanups.forEach(function (fn) { try { fn(); } catch (e) {} }); state.cleanups = []; }

  function openModule(i, stepIdx) {
    cleanup();
    state.current = i; state.step = stepIdx || 0;
    $('sl-hub-wrap').style.display = 'none';
    $('sl-teacher').style.display = 'none';
    $('sl-module').style.display = 'block';
    renderStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function closeModule() {
    cleanup();
    state.current = null;
    $('sl-module').style.display = 'none';
    $('sl-hub-wrap').style.display = 'block';
    if (state.isTeacher) $('sl-teacher').style.display = 'block';
    renderHub();
  }

  function renderStep() {
    cleanup();
    const m = modules[state.current], box = $('sl-module');
    const steps = m.steps || [], onQuiz = !m.noQuiz && state.step >= steps.length;
    box.textContent = '';
    const head = h('div', { class: 'sl-mod-head' }, [
      h('button', { type: 'button', class: 'sl-btn sl-back', text: '← All modules', onclick: closeModule }),
      h('div', { class: 'sl-mod-title' }, [h('span', { class: 'sl-mod-icon', text: m.icon }), (m.noQuiz ? '' : 'Module ' + m.num + ': ') + m.title])
    ]);
    box.appendChild(head);
    const dots = h('div', { class: 'sl-dots', 'aria-label': 'Progress through this module' });
    const n = steps.length + (m.noQuiz ? 0 : 1);
    for (let k = 0; k < n; k++) dots.appendChild(h('span', { class: 'sl-dot' + (k === state.step ? ' on' : k < state.step ? ' done' : ''), title: k < steps.length ? steps[k].title : 'Check' }));
    box.appendChild(dots);
    const body = h('div', { class: 'sl-step' });
    box.appendChild(body);
    const nav = h('div', { class: 'sl-nav' });
    box.appendChild(nav);
    if (onQuiz) { renderQuiz(m, body, nav); return; }

    const st = steps[state.step], key = m.id + ':' + state.step;
    body.appendChild(h('h2', { class: 'sl-step-title', text: st.title }));
    const content = h('div', { class: 'sl-step-body' });
    body.appendChild(content);
    const doneMsg = h('div', { class: 'sl-done', 'aria-live': 'polite' });
    const nextBtn = h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: state.step === steps.length - 1 ? (m.noQuiz ? 'Finish' : 'Take the check →') : 'Next →' });
    function refreshNext() {
      const ok = !st.challenge || state.doneSteps[key] || state.isTeacher;
      nextBtn.disabled = !ok;
      nextBtn.title = ok ? '' : 'Finish the challenge first';
    }
    const api = {
      done: function (msg) {
        if (!state.doneSteps[key]) { state.doneSteps[key] = true; doneMsg.textContent = '✅ ' + (msg || 'Challenge complete!'); doneMsg.classList.add('show'); refreshNext(); }
      },
      isDone: function () { return !!state.doneSteps[key]; },
      onLeave: function (fn) { state.cleanups.push(fn); },
      physics: physics, ui: ui, draw: draw, h: h, svg: svg, fmt: fmt, isTeacher: state.isTeacher
    };
    if (st.html) content.innerHTML = st.html;
    if (st.render) st.render(content, api);
    if (st.challenge) {
      body.appendChild(h('div', { class: 'sl-challenge' }, [h('strong', { text: '🎯 Challenge: ' }), st.challenge]));
      if (state.doneSteps[key]) { doneMsg.textContent = '✅ Challenge complete!'; doneMsg.classList.add('show'); }
    }
    body.appendChild(doneMsg);
    if (state.step > 0) nav.appendChild(h('button', { type: 'button', class: 'sl-btn', text: '← Back', onclick: function () { state.step--; renderStep(); } }));
    nav.appendChild(nextBtn);
    nextBtn.addEventListener('click', function () {
      if (nextBtn.disabled) return;
      if (state.step < steps.length - 1 || !m.noQuiz) { state.step++; renderStep(); } else closeModule();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    refreshNext();
  }

  function renderQuiz(m, body, nav) {
    const pool = m.quiz || [];
    const qs = shuffle(pool).slice(0, Math.min(QUIZ_SIZE, pool.length)).map(function (q) {
      const order = shuffle(q.options.map(function (_, i) { return i; }));
      return { q: q, order: order, picked: null };
    });
    const need = Math.ceil(qs.length * PASS_COUNT / QUIZ_SIZE);
    body.appendChild(h('h2', { class: 'sl-step-title', text: '✅ Check your understanding' }));
    body.appendChild(h('p', { class: 'sl-quiz-help', text: 'Answer all ' + qs.length + ' questions. Get ' + need + ' right to unlock the next module. You can try again as many times as you need — the questions change.' }));
    const list = h('ol', { class: 'sl-quiz' });
    qs.forEach(function (item, qi) {
      const li = h('li', { class: 'sl-q' });
      li.appendChild(h('div', { class: 'sl-q-text', text: item.q.q }));
      const opts = h('div', { class: 'sl-q-opts', role: 'radiogroup' });
      item.order.forEach(function (oi) {
        const id = 'sl-q' + qi + '-' + oi;
        const input = h('input', { type: 'radio', name: 'sl-q' + qi, id: id, value: oi });
        input.addEventListener('change', function () { item.picked = oi; submit.disabled = qs.some(function (x) { return x.picked == null; }); });
        opts.appendChild(h('label', { class: 'sl-q-opt', for: id }, [input, h('span', { text: item.q.options[oi] })]));
      });
      li.appendChild(opts);
      li.appendChild(h('div', { class: 'sl-q-why' }));
      list.appendChild(li);
    });
    body.appendChild(list);
    const result = h('div', { class: 'sl-quiz-result', 'aria-live': 'polite' });
    body.appendChild(result);
    const submit = h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: 'Check my answers', disabled: true });
    nav.appendChild(h('button', { type: 'button', class: 'sl-btn', text: '← Back to the lesson', onclick: function () { state.step = (m.steps || []).length - 1; renderStep(); } }));
    nav.appendChild(submit);
    submit.addEventListener('click', function () {
      let score = 0;
      qs.forEach(function (item, qi) {
        const li = list.children[qi], right = item.picked === item.q.answer;
        if (right) score++;
        li.classList.add(right ? 'right' : 'wrong');
        li.querySelectorAll('input').forEach(function (inp) { inp.disabled = true; });
        li.querySelector('.sl-q-why').textContent = (right ? '✓ ' : '✗ Correct answer: ' + item.q.options[item.q.answer] + '. ') + (item.q.why || '');
      });
      submit.disabled = true;
      // saved on this device at once, so the result shows straight away; the upload runs in the background
      progress.record(m.id, score, qs.length).then(function (passedNow) {
        result.textContent = '';
        const nextIdx = state.current + 1, hasNext = nextIdx < modules.length;
        if (passedNow) {
          result.className = 'sl-quiz-result pass';
          result.appendChild(h('div', { class: 'sl-quiz-score', text: '🎉 ' + score + ' / ' + qs.length + ' — passed!' }));
          if (hasNext) result.appendChild(h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: 'Start module ' + (modules[nextIdx].noQuiz ? '“' + modules[nextIdx].title + '”' : modules[nextIdx].num) + ' →', onclick: function () { openModule(nextIdx); } }));
          confetti();
        } else {
          result.className = 'sl-quiz-result fail';
          result.appendChild(h('div', { class: 'sl-quiz-score', text: score + ' / ' + qs.length + ' — you need ' + need + '. Read the explanations, then try a new set.' }));
          result.appendChild(h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: '↻ Try again', onclick: function () { renderStep(); } }));
          result.appendChild(h('button', { type: 'button', class: 'sl-btn', text: 'Review the lesson', onclick: function () { state.step = 0; renderStep(); } }));
        }
        const saved = h('div', { class: 'sl-save-note', text: '☁️ Saving to your class account…' });
        result.appendChild(saved);
        progress.lastSync.then(function (ok) {
          saved.textContent = ok ? '☁️ Saved to your class account.'
                                 : '💾 Saved on this device. It will upload to your class account by itself when the class database can be reached.';
        });
        result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  function confetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#b44fff', '#00f5ff', '#ff2d78', '#f0c040', '#40e080'];
    for (let i = 0; i < 40; i++) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:-10px;left:' + (Math.random() * 100) + 'vw;width:8px;height:8px;border-radius:2px;z-index:999;pointer-events:none;background:' + colors[i % 5];
      document.body.appendChild(d);
      const dur = 1400 + Math.random() * 1200;
      d.animate([{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(' + (window.innerHeight + 30) + 'px) rotate(' + (Math.random() * 720) + 'deg)' }], { duration: dur, easing: 'ease-in' });
      setTimeout(function () { d.remove(); }, dur);
    }
  }

  // ── TEACHER: class progress ───────────────────────────────────────────────
  function renderTeacher() {
    const box = $('sl-teacher');
    box.style.display = 'block';
    box.textContent = '';
    box.appendChild(h('h2', { class: 'sl-teacher-title', text: '👩‍🏫 Class progress' }));
    const sel = h('select', { id: 'sl-class', 'aria-label': 'Class' }, [h('option', { value: '', text: 'Loading classes…' })]);
    const status = h('div');                       // a problem loading everyone's progress stays visible here
    const table = h('div', { class: 'sl-table-wrap' });
    box.appendChild(sel); box.appendChild(status); box.appendChild(table);
    const db = firebase.firestore();
    let all = {}, classes = [], ticket = 0, loads = 0;
    // Offline, Firestore answers a read from its (often empty) cache. That is not "no classes" or "nobody has
    // started", so a cached answer counts as a failed read: the teacher gets a Retry instead of a wrong table.
    function fromServer(snap) { if (snap.metadata && snap.metadata.fromCache) throw { code: 'unavailable' }; return snap; }
    function retryNote(where, text, again) {
      const b = h('button', { type: 'button', class: 'sl-btn', text: '↻ Retry', style: 'margin-left:8px' });
      b.addEventListener('click', again);
      where.appendChild(h('p', { class: 'sl-muted' }, [text, b]));
    }
    sel.addEventListener('change', function () { showClass(sel.value); });
    function load() {
      const run = ++loads;
      all = {}; classes = []; ++ticket;
      status.textContent = ''; table.textContent = '';
      sel.textContent = ''; sel.appendChild(h('option', { value: '', text: 'Loading classes…' }));
      db.collection('sailcar_progress').get().then(fromServer).then(function (snap) {
        snap.docs.forEach(function (d) { all[d.id] = d.data(); });
      }, function (err) {
        if (err && err.code === 'permission-denied') {   // today's rules: show the rosters anyway
          status.appendChild(h('p', { class: 'sl-muted', text: 'Progress can’t be loaded yet (' + err.code + '). Publish the new Firestore rules first.' }));
          return;
        }
        throw err;
      })
        .then(function () { return db.collection('classes').where('teacherEmail', '==', TEACHER_EMAIL).get(); })
        .then(fromServer)
        .then(function (snap) {
          if (run !== loads) return;
          sel.textContent = '';
          classes = snap.docs.map(function (d) { return { id: d.id, name: String(d.data().name || 'Class') }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
          if (!classes.length) { sel.appendChild(h('option', { value: '', text: 'No classes yet — create one on the Classes page' })); return; }
          classes.forEach(function (c) { sel.appendChild(h('option', { value: c.id, text: c.name })); });
          showClass(classes[0].id);
        }).catch(function (err) {
          if (run !== loads) return;
          console.warn('Sail Car Lab: class progress not loaded (' + ((err && err.code) || err) + ')');
          sel.textContent = '';
          sel.appendChild(h('option', { value: '', text: 'Couldn’t load your classes' }));
          status.textContent = '';
          retryNote(status, err && err.code === 'permission-denied' ? 'Couldn’t load your classes (permission-denied). Tap Retry to try again.' : 'Couldn’t load your classes — check Wi-Fi and tap Retry.', load);
        });
    }
    load();
    function showClass(classId) {
      const mine = ++ticket, cls = classes.filter(function (c) { return c.id === classId; })[0], name = cls ? cls.name : 'Class';
      table.textContent = '';
      table.appendChild(h('p', { class: 'sl-muted', text: 'Loading ' + name + '…' }));
      db.collection('enrollments').where('classId', '==', classId).get().then(fromServer).then(function (snap) {
        if (mine !== ticket) return;             // another class was picked while this one loaded
        table.textContent = '';
        table.appendChild(h('h3', { class: 'sl-class-name', text: name }));
        const kids = snap.docs.map(function (d) { return d.data(); }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
        if (!kids.length) { table.appendChild(h('p', { class: 'sl-muted', text: 'No students have joined this class yet.' })); return; }
        const graded = modules.filter(function (m) { return !m.noQuiz; });
        const t = h('table', { class: 'sl-table' });
        t.appendChild(h('thead', null, [h('tr', null, [h('th', { text: 'Student' })].concat(graded.map(function (m) { return h('th', { title: m.title, text: m.icon + ' ' + m.num }); })).concat([h('th', { text: 'Done' })]))]));
        const tb = h('tbody');
        kids.forEach(function (k) {
          const p = (all[k.uid] && all[k.uid].modules) || {};
          let n = 0;
          const cells = graded.map(function (m) {
            const r = p[m.id];
            if (r && r.passed) { n++; return h('td', { class: 'ok', title: 'Best ' + (r.best || 0) + '/' + (r.total || QUIZ_SIZE) + ', ' + (r.attempts || 0) + ' attempt(s)', text: '✓' }); }
            if (r && r.attempts) return h('td', { class: 'try', title: 'Best ' + (r.best || 0) + '/' + (r.total || QUIZ_SIZE) + ', ' + r.attempts + ' attempt(s)', text: (r.best || 0) + '/' + (r.total || QUIZ_SIZE) });
            return h('td', { class: 'none', text: '·' });
          });
          tb.appendChild(h('tr', null, [h('td', { text: k.name || k.email })].concat(cells).concat([h('td', { text: n + '/' + graded.length })])));
        });
        t.appendChild(tb);
        table.appendChild(t);
        table.appendChild(h('p', { class: 'sl-muted', text: '✓ = passed · 3/5 = best score so far (not passed yet) · · = not started. Hover a cell to see attempts.' }));
      }).catch(function (err) {
        if (mine !== ticket) return;
        table.textContent = '';
        retryNote(table, err && err.code === 'unavailable' ? 'Couldn’t load ' + name + ' — check Wi-Fi and tap Retry.' : 'Could not load ' + name + ' (' + (err && err.code) + ').',
                  function () { showClass(classId); });
      });
    }
  }

  // ── START ─────────────────────────────────────────────────────────────────
  function start(user) {
    state.isTeacher = (user.email || '') === TEACHER_EMAIL;
    // a background upload finished (or failed): refresh the hub if it is on screen
    progress.onChange = function () { if (state.current == null && $('sl-hub-wrap').style.display === 'block') renderHub(); };
    progress.load(user).then(function () {
      $('sl-loading').style.display = 'none';
      $('sl-hub-wrap').style.display = 'block';
      renderHub();
      if (state.isTeacher) renderTeacher();
      // deep link: sail-car-lab.html#studio opens that module if it is unlocked
      function follow() {
        const want = (location.hash || '').slice(1);
        const i = modules.findIndex(function (m) { return m.id === want; });
        if (i >= 0 && unlocked(i) && state.current !== i) openModule(i);
      }
      follow();
      window.addEventListener('hashchange', follow);
    });
  }

  window.SailLab = { register: register, physics: physics, draw: draw, ui: ui, h: h, svg: svg, fmt: fmt, progress: progress,
                     start: start, modules: modules, isTeacher: function () { return state.isTeacher; },
                     _test: { unlocked: unlocked, openModule: openModule, state: state } };
})();
