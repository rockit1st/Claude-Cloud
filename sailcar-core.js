// Sail Car Lab — shared core
// ─────────────────────────────────────────────────────────────────────────────
// • SailLab.register(module)  — each module file (sailcar-m1.js …) calls this once
// • SailLab.physics           — ONE physics model of two box fans blowing a sail car down
//                               the hallway, used by every simulator and the Design Studio
// • SailLab.ui / SailLab.draw — small helpers so every module looks and behaves the same
//                               (ui.predict = the "Predict first" card; ui.word = a "Word to know" box)
// • SailLab.kid               — words and numbers for 6th graders: distances in FEET (inches under a foot),
//                               sizes they build and measure in INCHES (square inches for area), mass in
//                               grams, speeds in words, and forces NEVER as numbers: a force is an arrow
//                               (longer = bigger) and kid.compare() says how two forces compare in words.
//                               Students never see newtons, kg, m/s, metres, cm or mm. (The physics below
//                               stays in metres, kilograms and seconds: only the words are in feet and inches.)
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

  // ── WORDS AND NUMBERS FOR 6TH GRADERS ─────────────────────────────────────
  // Students never see newtons, kilograms or m/s, and never see a force as a number at all.
  //   FORCES: an arrow or bar whose LENGTH shows the size (draw.forceScale / ui.forceBars), with a word label,
  //           and words that COMPARE two forces:
  //             kid.compare(push, friction, { noun: 'friction' }) → 'about 20 times as strong as friction'
  //             kid.bigger(push, friction)                        → 'bigger'
  //   LENGTHS: US units only. The physics works in metres (and the stored runs and designs keep their numbers), so
  //   every length that reaches a student goes through one of these. Never write 'm', 'cm' or 'mm' in student text.
  //     DISTANCES (down the hall, from the fans, how far a car rolled) are FEET; under a foot they are inches:
  //       kid.dist(15.85)  → '52 ft'    kid.dist(7.62) → '25 ft'    kid.dist(2) → '6.6 ft'    kid.dist(0.1778) → '7 in'
  //       whole feet from 10 ft up, one decimal under 10 ft, whole inches under 1 ft, '0 ft' for nothing. No metres.
  //       kid.feet(25)     → '25 ft'   the same from a number of FEET (kid.feet(0.5) → '6 in')
  //     SIZES a student sets, builds or measures with a ruler (a sail, a stick, a mast, a wheel) are INCHES, to the nearest
  //     HALF inch: whole numbers as '8 in', halves as '6 1/2 in' (a fraction, never '6.5 in'):
  //       kid.len(20.32)   → '8 in'     kid.len(11) → '4 1/2 in'      (the real 11 cm craft stick)   kid.len(3) → '1 in'
  //       kid.lenIn(6.5)   → '6 1/2 in' the same from a number of INCHES (a slider's value): format: kid.lenIn
  //       kid.by(8, 8)     → '8 × 8 in'  (a sail's width and height)
  //       kid.area(0.04129) → '64 square inches'   from m²;   kid.areaIn(64) → '64 square inches' from square inches
  //     NUMBERS for sums and physics (not text): kid.inToCm(8) → 20.32, kid.inToM(8) → 0.2032, kid.cmToIn(20.32) → 8,
  //       kid.ftToM(70) → 21.34, kid.inches(11) → 4.5 (cm → inches, to the nearest half inch, the number kid.len shows).
  //   kid.grams(0.07)  → '70 g'                   (mass stays in grams: students weigh their real cars)
  //   kid.speed(1.4)   → 'walking speed'          (words, not m/s)
  const CLIP_N = 0.001 * G, FT_PER_M = 3.28084, CM_PER_IN = 2.54, SQIN_PER_M2 = 1 / (0.0254 * 0.0254);
  function r1(v) { return Math.round(v * 10) / 10; }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function clipsRaw(N) { return Math.abs(num(N)) / CLIP_N; }
  // feet, rounded the way they are shown: whole feet, one decimal under 10 ft
  function ftRound(f) { return Math.abs(f) < 9.95 ? r1(f) : Math.round(f); }
  // a length in FEET as text: '52 ft' · '6.6 ft' · '1 ft' · under a foot, whole inches: '7 in' · nothing: '0 ft'
  function feetText(f) {
    f = num(f);
    const inch = Math.round(Math.abs(f) * 12);        // 0.96 ft and up rounds to 12 in: that is '1 ft'
    if (inch === 0) return '0 ft';
    if (inch < 12) return (f < 0 ? '-' : '') + inch + ' in';
    return ftRound(f) + ' ft';
  }
  // inches to the nearest HALF inch (a ruler's friendly step); never negative
  function halfIn(inches) { return Math.round(Math.abs(num(inches)) * 2) / 2; }
  // that number as text, no unit: 8 → '8' · 4.5 → '4 1/2' · 0.5 → '1/2' · 0 → '0'
  function inNum(inches) {
    const v = halfIn(inches), w = Math.floor(v);
    return v - w >= 0.5 ? (w ? w + ' 1/2' : '1/2') : String(w);
  }
  function sqText(n) { n = Math.round(Math.abs(num(n))); return n + (n === 1 ? ' square inch' : ' square inches'); }

  // COMPARING TWO FORCES IN WORDS — the ONE vocabulary every module uses, so the whole lab sounds the same.
  // r = the bigger size ÷ the smaller size (signs are ignored: a force's direction is the arrow's job).
  //   r < 1.1                 'about the same'                    (less than 10% apart)
  //   1.1 ≤ r < 1.4           'a little bigger'  / 'a little smaller'
  //   1.4 ≤ r < 1.8           'bigger'           / 'smaller'
  //   r ≥ 1.8, a is bigger:   'about N times as strong'  when r is within 10% of N = 2, 3, 4, 5, 10 or 20
  //                                                       (2: 1.8–2.2 · 3: 2.7–3.3 · 4: 3.6–4.4 · 5: 4.5–5.5 · 10: 9–11 · 20: 18–22)
  //                           'more than N times as strong'  in the gaps (N = the biggest of those below r: TRUE, never a decimal)
  //   r ≥ 1.8, a is smaller:  'about half as strong'  (1.8–2.2) · 'less than half as strong' (2.2–4) · 'much smaller' (4 and up)
  //                           (never 'a third as strong' or 'N times smaller': to state a big ratio, put the bigger force first)
  //   one of them is 0:       'much bigger' / 'much smaller' (both 0: 'about the same')
  // Options:
  //   noun: 'friction'   → finishes the phrase: 'a little bigger than friction', 'about the same as friction',
  //                        'about 4 times as strong as friction', 'about half as strong as friction'
  //   times: false       → never a ratio: r ≥ 1.8 is 'much bigger' / 'much smaller'. Use it when the ratio is not
  //                        robust, or when the picture beside the words is not drawn to scale (see draw.forceScale:
  //                        { times: len.toScale(a) && len.toScale(b) }).
  //   exact: true        → for forces set on slider steps a student can count (squares of sail, steps of a slider,
  //                        "3 times as fast"), where the model's ratio is exact:
  //                          'the same' only when they are equal, and 1 < r < 1.1 is 'just a little bigger' / 'just a
  //                          little smaller' (so "balanced" is never claimed for forces that are not);
  //                          a whole-number ratio N = 2 … 20 is said exactly: 'N times as strong' (no "about": 8 squares
  //                          of sail push 8 times as hard, 3 times as fast is 9 times the drag), and r = 2 is 'half as strong';
  //                          otherwise 'about N times' / 'about half' only within 5% of N (strictly), and in the gaps
  //                          'more than N times as strong' with N = r rounded down (4.5 → 'more than 4 times'),
  //                          1.8 ≤ r ≤ 1.9 is 'bigger' / 'smaller', 'less than half' and 'much smaller' as above.
  // Boundaries are inclusive on the bigger side (exactly 1.1 is 'a little bigger', exactly 1.8 is 'about 2 times').
  const CMP = { SAME: 1.1, LITTLE: 1.4, RATIO: 1.8, NEAR: 0.1, NICE: [2, 3, 4, 5, 10, 20], HALF_MAX: 2.2, MUCH_SMALLER: 4,
                EXACT_NEAR: 0.05, EXACT_MAX: 20 };
  const EPS = 1e-9, WHOLE = 1e-6;   // WHOLE: how close (relative) a ratio must be to N to be "exactly N" (rounding only)
  function sizes(a, b) { return [Math.abs(num(a)), Math.abs(num(b))]; }
  // the "nice" whole number r is about (within 10%, or strictly within 5% for exact settings), or null
  function niceTimes(r, exact) {
    for (let i = 0; i < CMP.NICE.length; i++) {
      const off = Math.abs(r / CMP.NICE[i] - 1);
      if (exact ? off < CMP.EXACT_NEAR : off <= CMP.NEAR + EPS) return CMP.NICE[i];
    }
    return null;
  }
  // exact settings: r ≥ 1.8 (the bigger ÷ the smaller), up = a is the bigger one
  function exactTimes(r, up) {
    const n = Math.round(r), whole = n >= 2 && n <= CMP.EXACT_MAX && Math.abs(r / n - 1) < WHOLE;
    if (up) {
      if (whole) return n + ' times as strong';
      const near = niceTimes(r, true);
      if (near) return 'about ' + near + ' times as strong';
      if (r < 2) return 'bigger';                       // 1.8 … 1.9: too far from 2 to say "about 2 times"
      return 'more than ' + Math.min(Math.floor(r * (1 + EPS)), CMP.EXACT_MAX) + ' times as strong';
    }
    if (whole && n === 2) return 'half as strong';
    if (Math.abs(r / 2 - 1) < CMP.EXACT_NEAR) return 'about half as strong';
    if (r < 2) return 'smaller';
    return r * (1 + EPS) < CMP.MUCH_SMALLER ? 'less than half as strong' : 'much smaller';
  }
  function comparePhrase(a, b, o) {
    const s = sizes(a, b), big = Math.max(s[0], s[1]), small = Math.min(s[0], s[1]);
    if (big === 0) return o.exact ? 'the same' : 'about the same';
    const up = s[0] >= s[1], r = small === 0 ? Infinity : big / small, rr = r * (1 + EPS);
    if (o.exact && r <= 1 + EPS) return 'the same';
    if (rr < CMP.SAME) return o.exact ? (up ? 'just a little bigger' : 'just a little smaller') : 'about the same';
    if (rr < CMP.LITTLE) return up ? 'a little bigger' : 'a little smaller';
    if (rr < CMP.RATIO) return up ? 'bigger' : 'smaller';
    if (o.times === false || r === Infinity) return up ? 'much bigger' : 'much smaller';
    if (o.exact) return exactTimes(r, up);
    if (up) {
      const n = niceTimes(r);
      if (n) return 'about ' + n + ' times as strong';
      return 'more than ' + CMP.NICE.filter(function (k) { return k < r; }).pop() + ' times as strong';
    }
    if (r <= CMP.HALF_MAX * (1 + EPS)) return 'about half as strong';
    return rr < CMP.MUCH_SMALLER ? 'less than half as strong' : 'much smaller';
  }

  const kid = {
    CLIP_N: CLIP_N, FT_PER_M: FT_PER_M, COMPARE: CMP,
    // kid.compare(a, b, { noun, times, exact }) → how force a compares with force b, in the shared words above
    compare: function (a, b, o) {
      o = o || {};
      const p = comparePhrase(a, b, o);
      if (!o.noun) return p;
      return p + (/as strong$|the same$/.test(p) ? ' as ' : ' than ') + o.noun;
    },
    // kid.bigger(a, b) → 'bigger' | 'smaller' | 'about the same'   (less than 10% apart is 'about the same')
    bigger: function (a, b) {
      const s = sizes(a, b), big = Math.max(s[0], s[1]), small = Math.min(s[0], s[1]);
      if (big === 0 || (small > 0 && big / small * (1 + EPS) < CMP.SAME)) return 'about the same';
      return s[0] > s[1] ? 'bigger' : 'smaller';
    },
    // kid.times(a, b) → 2, 3, 4, 5, 10 or 20 when a is about that many times b (within 10%), else null.
    // For your own wording, e.g. 'about ' + n + ' times the push'. Only for a ≥ b; never a decimal.
    times: function (a, b) {
      const s = sizes(a, b);
      if (!(s[1] > 0) || s[0] / s[1] * (1 + EPS) < CMP.RATIO) return null;
      return niceTimes(s[0] / s[1]);
    },

    // ── NOT FOR STUDENT TEXT ── forces as paper clips (1 clip ≈ 1 g of weight ≈ 0.0098 N). Kept only for
    // teacher-only views and tests. Students see arrows and kid.compare() words, never these.
    // a force in paper clips, rounded the way it is shown: one decimal under 3, whole numbers above
    clips: function (N) { const c = clipsRaw(N); return c < 3 ? r1(c) : Math.round(c); },
    // (not for student text) 'about 32 paper clips' · 'about 1.8 paper clips' · 'about 1 paper clip' · 'less than 1 paper clip' · '0 paper clips'
    force: function (N) {
      const c = clipsRaw(N);
      if (c < 0.05) return '0 paper clips';
      if (c < 1) return 'less than 1 paper clip';
      const n = kid.clips(N);
      return 'about ' + n + ' paper clip' + (n === 1 ? '' : 's');
    },
    // (not for student text) the same, short: '32 clips' · '1.8 clips' · '<1 clip' · '0 clips'
    forceShort: function (N) {
      const c = clipsRaw(N);
      if (c < 0.05) return '0 clips';
      if (c < 1) return '<1 clip';
      const n = kid.clips(N);
      return n + (n === 1 ? ' clip' : ' clips');
    },
    // ── LENGTHS: feet and inches (see the list above). The physics gives metres; students only ever see these. ──
    // metres → a NUMBER of feet, rounded the way it is shown: whole feet, one decimal under 10 ft (0.6 for 7 in).
    // For a sum or a comparison (kid.ft(d) >= 40). For TEXT use kid.dist: it also says inches under a foot.
    ft: function (m) { return ftRound(num(m) * FT_PER_M); },
    // NOT FOR STUDENT TEXT: metres, rounded one decimal under 10 m. Kept so older callers and teacher-only checks still
    // run; students see feet (kid.dist) and inches (kid.len), never metres.
    m: function (m) { m = num(m); return Math.abs(m) < 9.95 ? r1(m) : Math.round(m); },
    // metres → TEXT in feet only: '52 ft' · '25 ft' · '6.6 ft' · '10 ft' · under 1 ft whole inches '7 in' · '0 ft'
    dist: function (m) { return feetText(num(m) * FT_PER_M); },
    // the same from a number of FEET (no metres round trip): kid.feet(25) → '25 ft' · kid.feet(6.6) → '6.6 ft' · kid.feet(0.5) → '6 in'
    feet: function (ft) { return feetText(ft); },
    // centimetres → TEXT in inches to the nearest half inch: '8 in' · '4 1/2 in' · '1 in' · '1/2 in' · '0 in'
    // (for the real objects: a 11 cm craft stick '4 1/2 in', a 15 cm jumbo stick '6 in', 21 cm '8 1/2 in', 3 cm wheels '1 in', 5 cm '2 in')
    len: function (cm) { return inNum(num(cm) / CM_PER_IN) + ' in'; },
    // a number of INCHES → TEXT, to the nearest half inch: kid.lenIn(8) '8 in' · kid.lenIn(6.5) '6 1/2 in' · kid.lenIn(6.4) '6 1/2 in'
    lenIn: function (inches) { return inNum(inches) + ' in'; },
    // a width and a height in INCHES → '8 × 8 in' · '4 1/2 × 6 in'
    by: function (w, h) { return inNum(w) + ' × ' + inNum(h) + ' in'; },
    // an area in m² → '64 square inches' · '1 square inch' (whole square inches)
    area: function (m2) { return sqText(num(m2) * SQIN_PER_M2); },
    // an area in SQUARE INCHES (a slider's width × height) → '64 square inches'
    areaIn: function (sqIn) { return sqText(sqIn); },
    // ── numbers (not text) ──
    CM_PER_IN: CM_PER_IN,
    inToCm: function (inches) { return num(inches) * CM_PER_IN; },        // 8 → 20.32: a slider's inches into the physics' centimetres
    inToM: function (inches) { return num(inches) * CM_PER_IN / 100; },   // 8 → 0.2032
    cmToIn: function (cm) { return num(cm) / CM_PER_IN; },                // 20.32 → 8 (not rounded: a saved design's cm back to a slider)
    ftToM: function (ft) { return num(ft) / FT_PER_M; },                  // 70 → 21.34
    // centimetres → a NUMBER of inches, to the nearest half inch (the number kid.len shows): kid.inches(11) → 4.5 · kid.inches(15) → 6
    inches: function (cm) { return halfIn(num(cm) / CM_PER_IN); },
    // kilograms → '70 g'
    grams: function (kg) { return Math.round(num(kg) * 1000) + ' g'; },
    // a speed (m/s) in words. The cars in our hallway top out around walking speed; the wind at the fans is a run.
    speed: function (mps) {
      const v = Math.abs(num(mps));
      return v < 0.05 ? 'stopped' : v < 0.3 ? 'creeping' : v < 0.9 ? 'a slow walk' : v < 1.6 ? 'walking speed'
           : v < 2.2 ? 'a fast walk' : v < 3.2 ? 'jogging speed' : 'running speed';
    },
    // a speed (m/s) in feet per second, rounded the way it is shown: '4.6 ft per second' (one decimal under 10)
    ftPerSec: function (mps) { return kid.ft(mps) + ' ft per second'; }
  };

  // ── DRAWING ───────────────────────────────────────────────────────────────
  // HONEST ARROWS: draw.forceScale(maxValue, maxPx, { min, over, zero }) → len(force) in px, ONE shared length rule
  // for every force drawn together (call it once per picture and use it for every arrow or bar in it).
  //   • a bigger force is never drawn shorter, and equal forces get exactly equal lengths;
  //   • TO SCALE (length ∝ force) from the knee (2 × min) up to maxPx, so a ratio you can see there is true;
  //   • a tiny force that would be shorter than the knee is drawn between min (default 14 px) and the knee, so it stays
  //     visible: it is then drawn a bit too LONG, never too short (the order stays right, the ratio looks smaller);
  //   • a force bigger than maxValue grows only a little more, up to maxPx + over (default 20% of maxPx), never past it;
  //   • |force| ≤ zero (default 0) → 0 px: draw no arrow.
  //   len.toScale(f) → true when f is drawn exactly to scale. A sentence next to the picture may state a ratio
  //   ('about 4 times as strong') only when both forces are: kid.compare(a, b, { times: len.toScale(a) && len.toScale(b) }).
  function forceScale(maxValue, maxPx, o) {
    o = o || {};
    const mx = Math.abs(num(maxValue)) || 1, px = Math.max(1, num(maxPx));
    const min = Math.min(o.min == null ? 14 : num(o.min), px / 2), knee = 2 * min;
    const over = o.over == null ? px * 0.2 : Math.max(0, num(o.over)), zero = Math.abs(num(o.zero));
    function lin(v) { return Math.abs(num(v)) / mx * px; }
    function len(v) {
      if (Math.abs(num(v)) <= zero) return 0;
      const l = lin(v);
      if (l <= 0) return 0;
      if (l < knee) return min + l * (knee - min) / knee;   // (min … knee): a tiny force stays visible
      if (l <= px) return l;                                // to scale
      return px + over * (1 - px / l);                      // (maxPx … maxPx + over): still growing, never off the picture
    }
    len.toScale = function (v) { const l = lin(v); return Math.abs(num(v)) > zero && l >= knee - 1e-9 && l <= px + 1e-9; };
    len.max = px + over;
    return len;
  }

  const draw = {
    forceScale: forceScale,
    // arrow from (x1,y1) to (x2,y2) with an optional label
    arrow: function (parent, x1, y1, x2, y2, color, label, opts) {
      opts = opts || {};
      const g = svg('g', { class: 'sl-arrow' }, parent);
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 2) return g;
      // (a short arrow gets a smaller head: the head is never longer than 80% of the arrow, so a 5 px arrow is still a little arrow;
      //  an arrow of 14 px or more is drawn exactly as before)
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len, hw = Math.min(opts.head || 7, len * 0.5);
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
      svg('text', { x: x + size * 0.16, y: floorY + 14, 'text-anchor': 'middle', fill: '#9080b0', 'font-size': 12 }, g, label || '2 FANS');
      return g;
    },
    // a sail car seen from the side; (x, floorY) = back wheel contact point. The sizes (length, sailW, sailH, mastH, wheelR) are
    // drawing units of 1 px per CENTIMETRE × scale: internal, never shown. From a student's inches pass kid.inToCm(inches).
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
  // The hallway simulator's force arrows, scaled for FRICTION (the force the push has to beat down the hall), not for
  // the big push at the start line: 1000 px per newton, to scale from 6 px (0.006 N) to 80 px (0.08 N). So every wheel
  // friction on a typical car is to scale (Spin freely 8 px, OK 17 px, Rubbing 48 px; Jammed 82 px is just squeezed),
  // and so is the faded push down the hall it is compared with. A bigger force (the start push) is squeezed into
  // 80–94 px: still the longest arrow, and never off the left edge at the start line. A push or drag under 0.001 N
  // (an eighth of the smallest friction) is not drawn; one just above it is a little 3 px arrow.
  const TRACK_LEN = forceScale(0.08, 80, { min: 3, over: 14, zero: 0.001 });
  const ui = {
    // labelled slider: returns { get(), set(v), input }
    //   o = { label, min, max, step, value, onInput(v), format(v) → the text after the label (default: v + unit),
    //         bar: { color, max (default o.max), px (default 110) } → a FORCE slider: a little arrow whose length shows
    //              the setting (draw.forceScale, so equal settings = equal arrows) and NO number (unless format is given),
    //         ends: ['small push', 'big push'] → words under the two ends of the slider,
    //         inches: true → a SIZE slider in inches (min, max, step, value and onInput are all inches; use whole inches, or
    //              half inches where a whole one is too coarse): shows '8 in' / '6 1/2 in' (kid.lenIn), and a screen reader
    //              hears the same. Convert to centimetres with kid.inToCm(v) before calling the physics,
    //         valueText(v) → what a screen reader says for the setting (e.g. kid.compare words) }
    slider: function (parent, o) {
      const id = 'sl-s' + (++uid);
      const out = h('span', { class: 'sl-val' });
      const input = h('input', { type: 'range', id: id, min: o.min, max: o.max, step: o.step || 1, value: o.value });
      const fmtV = o.format || (o.inches ? kid.lenIn : o.bar ? null : function (v) { return v + (o.unit ? ' ' + o.unit : ''); });
      const aria = o.valueText || (o.inches && !o.format ? kid.lenIn : null);
      const bar = o.bar ? h('span', { class: 'sl-vbar', 'aria-hidden': 'true', style: 'background:' + (o.bar.color || '#40e080') }) : null;
      const barLen = o.bar ? forceScale(o.bar.max == null ? o.max : o.bar.max, o.bar.px || 110, { min: 10, over: 0 }) : null;
      function show() {
        const v = Number(input.value);
        out.textContent = fmtV ? fmtV(v) : '';
        if (bar) { const w = barLen(v); bar.style.width = w + 'px'; bar.hidden = !(w > 0); out.appendChild(bar); }
        if (aria) input.setAttribute('aria-valuetext', aria(v));
      }
      input.addEventListener('input', function () { show(); if (o.onInput) o.onInput(Number(input.value)); });
      const kids = [h('label', { for: id, class: 'sl-ctrl-lbl' }, [o.label + ' ', out]), input];
      if (o.ends) kids.push(h('div', { class: 'sl-ends' }, [h('span', { text: o.ends[0] }), h('span', { text: o.ends[1] })]));
      parent.appendChild(h('div', { class: 'sl-ctrl' + (o.bar ? ' sl-ctrl-force' : '') }, kids));
      show();
      return { input: input, get: function () { return Number(input.value); }, set: function (v) { input.value = v; show(); } };
    },
    // FORCE BARS: forces as arrows on ONE honest scale (draw.forceScale), each with a WORD label and never a number.
    //   rows = [{ label: 'wind push', value: push, color: '#40e080' },
    //           { label: 'friction', value: friction, color: '#ffa040', dir: 'left' }]
    //   o = { max: the force that fills a row (default: the biggest in rows; give a fixed one so a student can compare
    //              one setting with the next), label: the aria-label (default: the arrows compared in kid.compare words) }
    // Every bar starts at the left edge, so the lengths line up; dir 'left' only turns the arrowhead (friction pushes back).
    // Returns { el, update(rows, max?), len } — len = the scale in use: len.toScale(v) for kid.compare's times option.
    forceBars: function (parent, rows, o) {
      o = Object.assign({}, o);
      const el = h('div', { class: 'sl-fbars', role: 'img' });
      parent.appendChild(el);
      const api = { el: el, len: null, update: update };
      function size(r) { return Math.abs(num(r.value)); }
      function update(newRows, max) {
        if (newRows) rows = newRows;
        if (max != null) o.max = max;
        const top = o.max != null ? Math.abs(num(o.max)) : rows.reduce(function (m, r) { return Math.max(m, size(r)); }, 0);
        const len = api.len = forceScale(top || 1, 88, { min: 6, over: 12 });    // lengths in % of the row
        el.textContent = '';
        rows.forEach(function (r) {
          const w = len(r.value), color = r.color || '#40e080';
          const bar = h('span', { class: 'sl-fbar' + (r.dir === 'left' ? ' sl-fbar-left' : ''), style: 'width:' + w.toFixed(2) + '%;background:' + color });
          if (!(w > 0)) bar.hidden = true;
          el.appendChild(h('div', { class: 'sl-fbar-row' }, [h('span', { class: 'sl-fbar-lbl', style: 'color:' + color, text: r.label }),
                                                            h('span', { class: 'sl-fbar-track' }, [bar])]));
        });
        // for screen readers: the longest arrow, then each other one compared with it (words only, no ratios)
        const big = rows.slice().sort(function (a, b) { return size(b) - size(a); })[0];
        el.setAttribute('aria-label', o.label || (big ? 'Force arrows. ' + rows.map(function (r) {
          return r === big ? r.label + ': the longest arrow.' : r.label + ': ' + kid.compare(r.value, big.value, { noun: big.label, times: false }) + '.';
        }).join(' ') : 'Force arrows.'));
      }
      update();
      return api;
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
    // "Word to know" box: introduce a key term ONCE (force, friction, drag, thrust, mass, inertia, balance point…),
    // then use that word the same way everywhere. meaningHtml is module-authored static text.
    word: function (parent, term, meaningHtml) {
      const n = h('div', { class: 'sl-note sl-note-word' }, [h('span', { class: 'sl-word-tag', text: '📘 Word to know' }), h('strong', { class: 'sl-word', text: term }), ' ']);
      n.appendChild(h('span', { html: meaningHtml }));
      parent.appendChild(n);
      return n;
    },

    // PREDICT FIRST: before an experiment, the student picks what they think will happen. A prediction is
    // never graded and never blocks Next — it only has to be picked before the experiment can run.
    //   o = { question, choices: [{ value, label }], onPick(value)  (optional),
    //         judge(result, value) → { text, right, why }  (optional: a trackSim gated by this card calls it
    //                                                       after each run and shows the answer by itself),
    //         hint  (optional: the line under the choices before a pick) }
    // Returns { el, get(), label(), reveal(text, wasRight, why), clear(), reset(), gate(button), onChange(fn), judge }
    //   reveal → "You predicted: <label>." + text + "✅ Good thinking! why" (wasRight true)
    //                                              / "🤔 Surprise! Here’s why: why" (wasRight false)
    //                                              / just why (wasRight null: nothing to judge)
    //   clear  → hides the reveal, keeps the choice (a trackSim's Reset and each new run do this)
    //   reset  → forgets the choice too (e.g. the student changed the experiment the question was about)
    //   gate(button) → keeps any other button disabled until a choice is picked (a trackSim does this itself)
    predict: function (parent, o) {
      o = o || {};
      const id = 'sl-p' + (++uid), choices = o.choices || [], subs = [];
      const HINT = o.hint || 'Pick one. Any guess is OK! Then test it to find out.';
      let val = null;
      const card = h('div', { class: 'sl-note sl-predict', role: 'group', 'aria-labelledby': id + '-q' });
      card.appendChild(h('div', { class: 'sl-predict-q', id: id + '-q' }, [h('span', { class: 'sl-predict-tag', text: '🤔 Predict first' }), o.question || 'What do you think will happen?']));
      const row = h('div', { class: 'sl-predict-opts', role: 'radiogroup', 'aria-labelledby': id + '-q' });
      const btns = choices.map(function (c, i) {
        const b = h('button', { type: 'button', class: 'sl-predict-opt', role: 'radio', 'aria-checked': 'false', tabindex: i === 0 ? '0' : '-1' },
                    [h('span', { class: 'sl-predict-dot', 'aria-hidden': 'true' }), h('span', { text: c.label })]);
        b.addEventListener('click', function () { pick(i); });
        // arrow keys move through the choices, like a normal set of radio buttons
        b.addEventListener('keydown', function (e) {
          const n = btns.length, k = e.key;
          let j = null;
          if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n;
          else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + n) % n;
          else if (k === 'Home') j = 0;
          else if (k === 'End') j = n - 1;
          if (j == null) return;
          e.preventDefault();
          btns[j].focus();
          pick(j);
        });
        row.appendChild(b);
        return b;
      });
      card.appendChild(row);
      const hint = h('div', { class: 'sl-predict-hint', text: HINT });
      const out = h('div', { class: 'sl-predict-out', 'aria-live': 'polite', hidden: true });
      card.appendChild(hint);
      card.appendChild(out);
      parent.appendChild(card);
      const gated = [];
      function labelOf(v) { const c = choices.filter(function (x) { return x.value === v; })[0]; return c ? c.label : ''; }
      function paint() {
        const at = choices.findIndex(function (c) { return c.value === val; });
        btns.forEach(function (b, i) {
          b.setAttribute('aria-checked', String(i === at));
          b.setAttribute('tabindex', i === (at < 0 ? 0 : at) ? '0' : '-1');
        });
        hint.textContent = val == null ? HINT : '👍 Got it. Now test it to find out!';
        gated.forEach(function (b) { b.disabled = val == null; b.title = val == null ? 'Make a prediction first ↑' : ''; });
      }
      function clear() { out.hidden = true; out.textContent = ''; card.classList.remove('sl-predict-yes', 'sl-predict-no'); }
      function pick(i) {
        const v = choices[i].value;
        if (v !== val) clear();                       // an answer to a different guess would be confusing
        val = v;
        paint();
        if (o.onPick) o.onPick(v);
        subs.forEach(function (fn) { fn(v); });
      }
      const api = {
        el: card, judge: o.judge || null,
        get: function () { return val; },
        label: function () { return labelOf(val); },
        reveal: function (text, wasRight, why) {
          out.textContent = '';
          if (val != null) out.appendChild(h('div', null, ['You predicted: ', h('strong', { text: labelOf(val) }), '.']));
          if (text) out.appendChild(h('div', { text: text }));
          if (wasRight === true) out.appendChild(h('div', null, [h('strong', { class: 'sl-predict-yes-txt', text: '✅ Good thinking!' }), why ? ' ' + why : '']));
          else if (wasRight === false) out.appendChild(h('div', null, why ? [h('strong', { class: 'sl-predict-no-txt', text: '🤔 Surprise! Here’s why:' }), ' ' + why]
                                                                           : [h('strong', { class: 'sl-predict-no-txt', text: '🤔 Surprise!' }), ' Scientists learn a lot from surprises.']));
          else if (why) out.appendChild(h('div', { text: why }));
          card.classList.toggle('sl-predict-yes', wasRight === true);
          card.classList.toggle('sl-predict-no', wasRight === false);
          out.hidden = false;
        },
        clear: clear,
        reset: function () { val = null; clear(); paint(); subs.forEach(function (fn) { fn(null); }); },
        gate: function (btn) { gated.push(btn); paint(); return btn; },
        onChange: function (fn) { subs.push(fn); }
      };
      paint();
      return api;
    },

    // The hallway simulator: fan on the left, the car rolls right, forces drawn on the car.
    //   getCar()  → car parameters (merged over DEFAULT_CAR)
    //   opts      → simulate() options (fan, startX, hallLength…), plus
    //               { getOpts() → options read fresh on every run (e.g. a fan-speed control),
    //                 showForces (default true), scaleM (the hallway length drawn, in METRES: internal, the marks on
    //                 the picture are always feet; default fits the run),
    //                 playSpeed (default: 2×, faster for long runs so it lasts ≤ ~9 s), onResult(result),
    //                 needPrediction: a ui.predict() card — ▶ Run stays disabled until a choice is picked,
    //                                 each run and Reset hide its old answer (the choice stays), and if the card
    //                                 has judge(result, value) its answer is shown after each run,
    //                 showSpeeds: true → the readout during a run gives car and wind speed in ft per second
    //                                 (default: the car's speed in words and whether it is slower or faster than the wind) }
    // Returns { run(), reset(), last(), stop() }
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
        W = Math.max(280, Math.min(820, Math.round(box.clientWidth || 820)));
        XEND = W - 20;
        sv.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      }
      const readout = h('div', { class: 'sl-readout', 'aria-live': 'polite' });
      const runBtn = h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: '▶ Run' });
      const resetBtn = h('button', { type: 'button', class: 'sl-btn', text: '↺ Reset' });
      // shown while a run plays sped up, so nobody expects a real car to be this quick
      const speedTag = h('span', { class: 'sl-speed', hidden: true });
      box.appendChild(h('div', { class: 'sl-track-bar' }, [runBtn, resetBtn, speedTag, readout]));
      let raf = null, last = null, scaleM = 8, idle = true;
      const P = opts.needPrediction || null;
      const READY = 'Press ▶ Run to send your car down the hallway.', NEED = 'Make a prediction first ↑';
      function needPick() { return !!(P && P.get() == null); }
      function updateRun() {
        runBtn.disabled = !!raf || needPick();
        runBtn.title = needPick() ? NEED : '';
      }
      // a pick enables ▶ Run; predict.reset() (the question changed) disables it again and says why
      if (P) P.onChange(function (v) {
        updateRun();
        if (raf) return;
        if (v == null) idle = true;
        if (idle) show(needPick() ? NEED : READY);
      });
      function pxOf(m) { return X0 + 18 + m / scaleM * (XEND - X0 - 40); }
      function scene(distM, carState) {
        fit();
        sv.textContent = '';
        svg('rect', { x: 0, y: 0, width: W, height: H, fill: '#120826' }, sv);
        svg('line', { x1: 10, y1: FLOOR, x2: W - 10, y2: FLOOR, stroke: '#4a3a6a', 'stroke-width': 3 }, sv);
        // foot marks (US tape measures): a label every 1, 2, 5, 10, 20 or 50 ft, whatever fits, small ticks between
        const pxPerFt = (XEND - X0 - 40) / (scaleM * FT_PER_M), ftMax = scaleM * FT_PER_M + 0.001;
        const lab = [1, 2, 5, 10, 20, 50].filter(function (s) { return s * pxPerFt >= 42; })[0] || 100;
        const minor = { 1: 0, 2: 1, 5: 1, 10: 5, 20: 10, 50: 10, 100: 50 }[lab];
        if (minor && minor * pxPerFt >= 8) for (let f = minor; f <= ftMax; f += minor) {
          if (f % lab) svg('line', { x1: pxOf(f / FT_PER_M), y1: FLOOR, x2: pxOf(f / FT_PER_M), y2: FLOOR + 5, stroke: '#4a3a6a', 'stroke-width': 1.5 }, sv);
        }
        for (let f = 0; f <= ftMax; f += lab) {
          const px = pxOf(f / FT_PER_M);
          svg('line', { x1: px, y1: FLOOR, x2: px, y2: FLOOR + 8, stroke: '#6a5a8a', 'stroke-width': 1.5 }, sv);
          svg('text', { x: px, y: FLOOR + 23, 'text-anchor': 'middle', fill: '#9080b0', 'font-size': 12 }, sv, f + ' ft');
        }
        draw.fan(sv, X0 - 40, FLOOR, 70);
        // wind streaks: fewer and shorter where the wind is weaker
        const o = cur();
        for (let m = 0.2; m < scaleM; m += scaleM / 22) {
          const w = windAt(m + (o.startX || 0.3), o.fan), len = Math.min(26, w * 8), op = Math.min(0.55, w / FAN.v0 * 0.6);
          [40, 65, 90].forEach(function (y, i) {
            const px = pxOf(m) + (i % 2) * 8;
            svg('line', { x1: px, y1: FLOOR - y, x2: px + len, y2: FLOOR - y, stroke: '#7ad7ff', 'stroke-width': 1.5, opacity: op.toFixed(2), 'stroke-linecap': 'round' }, sv);
          });
        }
        if (distM != null) {
          const fx = pxOf(distM);
          svg('line', { x1: fx, y1: FLOOR - 150, x2: fx, y2: FLOOR, stroke: '#f0c040', 'stroke-dasharray': '4,4', 'stroke-width': 1.5 }, sv);
        }
        const c = Object.assign({}, DEFAULT_CAR, getCar());
        const sailSide = Math.sqrt(c.sailArea) * 100, carScale = W < 600 ? 1.8 : 2.4, mastH = Math.max(sailSide, c.sailHeight * 100 + sailSide / 2);
        const st = carState || { x: 0, tilt: 0 };
        draw.car(sv, pxOf(st.x) - 12, FLOOR, { scale: carScale, sailW: sailSide, sailH: Math.max(6, sailSide * Math.max(0.2, Math.cos(c.sailAngle * Math.PI / 180))), mastH: mastH, cupped: c.sailCd > 1.3, tilt: st.tilt || 0 });
        if (st.forces && opts.showForces !== false) {
          // The push and friction, side by side on ONE line from ONE point above the car's mast (where the wind pushes):
          // the push goes right, friction goes left. Same height, same start, ONE honest scale (TRACK_LEN): the longer
          // arrow is always the bigger force, and equal arrows are balanced. Word labels only, never numbers.
          const f = st.forces, push = f.thrust + f.body, ox = pxOf(st.x) - 12 + 24 * carScale * 0.45, y0 = FLOOR - 142;   // (draw.car: 24 long, mast 45% along)
          // a still car (never moved): friction holds it back exactly as hard as the wind pushes: two equal arrows
          const pl = f.still ? Math.max(TRACK_LEN(push), 10) : TRACK_LEN(Math.abs(push)), fl = f.still ? pl : TRACK_LEN(f.friction);
          const carTop = FLOOR - carScale * (7 + mastH);                   // the mast's top (draw.car: wheels 3, deck 1)
          if (carTop - 4 > y0 + 10) svg('line', { x1: ox, y1: y0 + 8, x2: ox, y2: carTop - 4, stroke: '#9080b0', 'stroke-width': 1.5, 'stroke-dasharray': '3,3', opacity: 0.8 }, sv);
          function tag(g, text, color, x, y, anchor) { svg('text', { x: x, y: y, 'text-anchor': anchor, fill: color, 'font-size': 13, 'font-weight': 700, class: 'sl-lbl' }, g, text); }
          if (pl > 0 && push >= 0) tag(draw.arrow(sv, ox, y0, ox + pl, y0, '#40e080', '', { width: 4 }), 'wind push', '#40e080', ox + 4, y0 - 11, 'start');
          if (fl > 0) tag(draw.arrow(sv, ox, y0, ox - fl, y0, '#ffa040', '', { width: 4 }), 'friction', '#ffa040', ox - 4, y0 - 11, 'end');
          // the air pushing BACK on a car that outruns the wind (drag) is a second backward arrow: its own line under friction's
          if (pl > 0 && push < 0) tag(draw.arrow(sv, ox, y0 + 32, ox - pl, y0 + 32, '#ff5050', '', { width: 4 }), 'drag', '#ff5050', ox - 4, y0 + 21, 'end');
        }
      }
      function show(text) { readout.textContent = text; }
      function seconds(t) { const s = Math.max(1, Math.round(t)); return s + (s === 1 ? ' second' : ' seconds'); }
      // during a run: where the car is, how fast it goes, and how that compares with the wind
      function liveText(p) {
        if (opts.showSpeeds) return kid.dist(p.x) + ' · car ' + kid.ftPerSec(p.v) + ' · wind ' + kid.ftPerSec(p.wind);
        const vs = p.v < 0.05 ? '' : p.v > p.wind + 0.03 ? ' · faster than the wind!' : p.v < p.wind - 0.03 ? ' · slower than the wind' : ' · as fast as the wind';
        return kid.dist(p.x) + ' · ' + kid.speed(p.v) + vs;
      }
      function stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = null; speedTag.hidden = true;
        readout.removeAttribute('aria-busy');
        updateRun();
      }
      function reset() {
        stop();
        scaleM = opts.scaleM || 8;
        scene(null, null);
        idle = true;
        if (P) P.clear();                               // the old answer goes; the student's choice stays
        show(needPick() ? NEED : READY);
      }
      function run() {
        if (needPick()) { show(NEED); updateRun(); return; }   // commit to a guess first
        if (raf) cancelAnimationFrame(raf);
        if (P) P.clear();
        const res = simulate(getCar(), cur());
        last = res;
        idle = false;
        scaleM = opts.scaleM || Math.max(6, Math.ceil(res.distance * 1.15));
        runBtn.disabled = true;
        readout.setAttribute('aria-busy', 'true');      // screen readers hear the end, not every frame
        const speedUp = opts.playSpeed || Math.max(2, res.time / 9), t0 = performance.now(), tr = res.trace;
        const times = Math.round(speedUp);
        speedTag.textContent = '▶▶ ' + times + '× speed';
        speedTag.title = 'This plays ' + times + ' times faster than real life. The real run takes about ' + seconds(res.time) + '.';
        speedTag.hidden = times <= 1;
        let i = 0;
        function frame(now) {
          if (!box.isConnected) { raf = null; return; }   // the step was closed mid-run
          const tt = (now - t0) / 1000 * speedUp;
          while (i < tr.length - 1 && tr[i + 1].t <= tt) i++;
          const p = tr[i], done = i >= tr.length - 1;
          const tipped = res.reason === 'tipped over' && done, still = res.reason === 'never moved';
          // a car that never moved keeps two EQUAL arrows on screen (friction holds it back exactly as hard as the wind pushes);
          // every other run ends with the car stopped, so no arrows
          scene(done && !still ? res.distance : null, { x: p.x, tilt: tipped ? 35 : 0,
            forces: still ? { thrust: res.startPush, body: 0, friction: res.startPush, still: true } : done ? null : { thrust: p.thrust, body: p.body, friction: p.friction } });
          if (!done) { show(liveText(p)); raf = requestAnimationFrame(frame); return; }
          // (never moved: the push was at most the most friction can hold back at the start — not always less than rolling friction.
          //  Friction matches the push exactly, so the two arrows above are the same length: "balanced")
          const why = { 'never moved': '😴 It never moved. Friction held back just as hard as the wind pushed. The forces were balanced.',
                        'tipped over': '🤸 It tipped over! The wind pushed high on the sail and flipped the car forward.',
                        'hit the wall': '🧱 It curved off course and hit the wall.',
                        'reached the end of the hall': '🏆 It made it to the end of the ' + kid.dist(res.opts.hallLength) + ' hall!',
                        'coasted to a stop': '🛑 It slowed down and stopped.' }[res.reason] || '';
          show('📏 ' + kid.dist(res.distance) + (res.distance >= 0.01 ? ' in ' + seconds(res.time) + ' · top speed: ' + kid.speed(res.topSpeed) : '') + '. ' + why);
          stop();
          if (P && P.judge) { const j = P.judge(res, P.get()); if (j) P.reveal(j.text, j.right, j.why); }
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
  const PROGRESS_FIELDS = ['uid', 'name', 'email', 'updatedAt', 'modules'];   // the only fields this file always writes
  // 'classIds' (the classes the student joined, copied from their own enrollments) is written too when it
  // changed, so the teacher of each class can read this student's progress. The database only accepts it
  // when each id is a class the student really joined; before the new rules are published it refuses the
  // field, and the save is simply tried again without it.
  let idsDenied = false;                                                      // this page load: the database refused 'classIds'
  let idsCache = null;                                                        // { uid, at, ids } the last good read of the enrollments
  function enrolledIds(u) {
    if (idsCache && idsCache.uid === u.uid && Date.now() - idsCache.at < 120000) return Promise.resolve(idsCache.ids);
    return withTimeout(firebase.firestore().collection('enrollments').where('uid', '==', u.uid).get({ source: 'server' }), 8000).then(function (snap) {
      const seen = {};
      snap.docs.forEach(function (d) { const c = d.data() && d.data().classId; if (typeof c === 'string' && /^[A-Za-z0-9]{1,40}$/.test(c)) seen[c] = true; });
      const ids = Object.keys(seen).sort().slice(0, 4);
      idsCache = { uid: u.uid, at: Date.now(), ids: ids };
      return ids;
    }, function () { return null; });          // unknown (offline, denied): leave 'classIds' as it is
  }
  function sameIds(a, b) {
    a = Array.isArray(a) ? a : []; b = Array.isArray(b) ? b : [];
    return JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());
  }
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
  function upload(u, ids) {                 // ids: the class ids to store, or null to leave 'classIds' alone
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
        const idsNew = !!ids && !sameIds(ids, server && server.classIds);       // (a doc is only made once there is progress)
        if (server ? modsSig(out) === sig && !idsNew : !Object.keys(out).length) return;   // nothing new
        if (!server || modsSig(out) !== sig) {     // (a write of 'classIds' alone carries no attempts: nothing to track)
          const entry = { id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10), sig: modsSig(out), pending: l.pending };
          id = entry.id;
          writeLocal(function (x) { x.sending = x.sending.concat([entry]).slice(-8); });
        }
        if (server && modsSig(out) === sig) {      // only the class list changed: write just that, leave every other field as it is
          t.set(ref, { classIds: ids }, { mergeFields: ['classIds'] });
          return;
        }
        const data = { uid: u.uid, name: String(u.displayName || u.email || '').slice(0, 100), email: String(u.email || '').slice(0, 100),
                       updatedAt: firebase.firestore.FieldValue.serverTimestamp(), modules: out };
        const fields = PROGRESS_FIELDS.slice();
        if (idsNew) { data.classIds = ids; fields.push('classIds'); }
        t.set(ref, data, { mergeFields: fields });   // 'design' (the Studio's) is left exactly as it is
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

  // Tech Bucks: 10 for each module quiz that the database now shows as passed (students only; the
  // helper does nothing for teachers, and quietly does nothing for a pass it has already paid).
  function awardPasses() {
    try {
      if (!window.TechBucks || typeof window.TechBucks.award !== 'function') return;
      modules.forEach(function (m) {
        if (!m.noQuiz && progress.passed(m.id)) window.TechBucks.award('sailcar_quiz_' + m.id, 'Passed the ' + m.title + ' quiz');
      });
    } catch (e) { /* never get in the way of the lab */ }
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
      return withLock('sailcar-progress-' + u.uid, function () {
        return (idsDenied ? Promise.resolve(null) : enrolledIds(u)).then(function (ids) {
          return withTimeout(upload(u, ids), 30000).catch(function (err) {
            if (ids && err && err.code === 'permission-denied') {   // the database does not know 'classIds' yet: save without it
              idsDenied = true;
              return withTimeout(upload(u, null), 30000);
            }
            throw err;
          });
        });
      });
    }).then(function (res) {
      if (progress.user !== u) return false;
      failures = 0;
      progress.mode = 'cloud';
      progress.data = Object.assign({}, res.server, {
        modules: mergeMods(combine(res.modules, res.local.modules, res.local.pending), progress.data.modules) });
      changed();
      awardPasses();
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
  const state = { isTeacher: false, role: { isOwner: false, isTeacher: false, email: '' }, current: null, step: 0, cleanups: [], doneSteps: {} };
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
    if (progress.mode === 'local' && !state.isTeacher) ui.note(hub, 'warn', '⚠️ We can’t reach the class database right now. Your progress is saved on <strong>this device only</strong> for now. It will upload to your class account by itself later. Until then, keep using this device.');
    const grid = h('div', { class: 'sl-grid' });
    modules.forEach(function (m, i) {
      const open = unlocked(i), rec = progress.get(m.id), passed = progress.passed(m.id);
      const card = h('button', { type: 'button', class: 'sl-card' + (open ? '' : ' locked') + (passed ? ' passed' : ''), disabled: !open, 'aria-label': 'Module ' + m.num + ': ' + m.title + (open ? '' : ' (locked)') });
      card.appendChild(h('div', { class: 'sl-card-num', text: m.noQuiz ? 'FINAL' : 'MODULE ' + m.num }));
      card.appendChild(h('div', { class: 'sl-card-icon', text: open ? m.icon : '🔒' }));
      card.appendChild(h('div', { class: 'sl-card-title', text: m.title }));
      card.appendChild(h('div', { class: 'sl-card-blurb', text: m.blurb || '' }));
      card.appendChild(h('div', { class: 'sl-card-status', text: passed ? '✓ Passed (' + rec.best + '/' + (rec.total || QUIZ_SIZE) + ')' : open ? (rec && rec.attempts ? 'Best score ' + rec.best + '/' + (rec.total || QUIZ_SIZE) + '. Try again!' : (m.minutes ? 'About ' + m.minutes + ' min' : 'Start')) : 'Pass module ' + (m.num - 1) + ' to open this' }));
      if (open) card.addEventListener('click', function () { openModule(i); });
      grid.appendChild(card);
    });
    hub.appendChild(grid);
  }

  function cleanup() { state.cleanups.forEach(function (fn) { try { fn(); } catch (e) {} }); state.cleanups = []; }

  // A new step starts with the module's own top (back button, title, the job box) just under the fixed top bar. Scrolling
  // to the very top of the page would show the banner first and push "Your challenge" below the fold on a Chromebook.
  function scrollToStep() {
    let top = 0;
    try {
      const mod = $('sl-module'), bar = document.querySelector('.topnav');
      top = Math.max(0, mod.getBoundingClientRect().top + (window.pageYOffset || 0) - ((bar ? bar.offsetHeight : 0) + 8));
    } catch (e) {}
    window.scrollTo({ top: top, behavior: 'smooth' });
  }
  function openModule(i, stepIdx) {
    cleanup();
    state.current = i; state.step = stepIdx || 0;
    $('sl-hub-wrap').style.display = 'none';
    $('sl-teacher').style.display = 'none';
    $('sl-module').style.display = 'block';
    renderStep();
    scrollToStep();
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
    // The job comes first, right under the title, so a student who skips the reading still knows what to do.
    //   st.challenge = a challenge that must be finished before Next (the box turns green when it is done)
    //   st.job       = a plain "Your job" box that never blocks Next (steps with no challenge)
    //   st.todo      = 2-4 short numbered lines: how to do it
    const jobText = st.challenge || st.job;
    let jobBox = null;
    if (jobText) {
      jobBox = h('div', { class: 'sl-challenge' + (st.challenge ? '' : ' sl-job'), role: 'group', 'aria-label': st.challenge ? 'Your challenge' : 'Your job' });
      jobBox.appendChild(h('div', { class: 'sl-challenge-head' }, [h('strong', { text: st.challenge ? '🎯 Your challenge' : '👉 Your job' }), h('span', { class: 'sl-tick', text: '✅ Done!' })]));
      jobBox.appendChild(h('p', { class: 'sl-challenge-text', text: jobText }));
      if (st.todo && st.todo.length) {
        jobBox.appendChild(h('div', { class: 'sl-todo-label', text: 'How to do it:' }));
        const ol = h('ol', { class: 'sl-todo' });
        st.todo.forEach(function (t) { ol.appendChild(h('li', { text: t })); });
        jobBox.appendChild(ol);
      }
      body.appendChild(jobBox);
    }
    const content = h('div', { class: 'sl-step-body' });
    body.appendChild(content);
    const doneMsg = h('div', { class: 'sl-done', 'aria-live': 'polite' });
    const nextHint = h('div', { class: 'sl-next-hint', 'aria-live': 'polite' });
    const nextBtn = h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: state.step === steps.length - 1 ? (m.noQuiz ? 'Finish' : 'Take the check →') : 'Next →' });
    function refreshNext() {
      const ok = !st.challenge || state.doneSteps[key] || state.isTeacher;
      nextBtn.disabled = !ok;
      nextBtn.title = ok ? '' : 'Finish the challenge first.';
      nextHint.textContent = ok ? '' : '🎯 Finish the challenge at the top to go on.';
    }
    const api = {
      done: function (msg) {
        if (!state.doneSteps[key]) { state.doneSteps[key] = true; doneMsg.textContent = '✅ ' + (msg || 'Challenge complete!'); doneMsg.classList.add('show'); if (jobBox && st.challenge) jobBox.classList.add('done'); refreshNext(); }
      },
      isDone: function () { return !!state.doneSteps[key]; },
      onLeave: function (fn) { state.cleanups.push(fn); },
      physics: physics, kid: kid, ui: ui, draw: draw, h: h, svg: svg, fmt: fmt, isTeacher: state.isTeacher
    };
    if (st.html) content.innerHTML = st.html;
    if (st.render) st.render(content, api);
    if (st.challenge && state.doneSteps[key]) { doneMsg.textContent = '✅ Challenge complete!'; doneMsg.classList.add('show'); jobBox.classList.add('done'); }
    body.appendChild(doneMsg);
    body.appendChild(nextHint);
    if (state.step > 0) nav.appendChild(h('button', { type: 'button', class: 'sl-btn', text: '← Back', onclick: function () { state.step--; renderStep(); scrollToStep(); } }));
    nav.appendChild(nextBtn);
    nextBtn.addEventListener('click', function () {
      if (nextBtn.disabled) return;
      if (state.step < steps.length - 1 || !m.noQuiz) { state.step++; renderStep(); scrollToStep(); } else { closeModule(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
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
    body.appendChild(h('h2', { class: 'sl-step-title', text: '✅ Check what you learned' }));
    body.appendChild(h('p', { class: 'sl-quiz-help', text: 'Answer all ' + qs.length + ' questions. Get ' + need + ' right to open the next module. You can try as many times as you want. You get new questions each time.' }));
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
          result.appendChild(h('div', { class: 'sl-quiz-score', text: score + ' / ' + qs.length + ' — you need ' + need + ' to pass. Read why each answer is right, then try new questions.' }));
          result.appendChild(h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: '↻ Try again', onclick: function () { renderStep(); } }));
          result.appendChild(h('button', { type: 'button', class: 'sl-btn', text: 'Read the lesson again', onclick: function () { state.step = 0; renderStep(); } }));
        }
        const saved = h('div', { class: 'sl-save-note', text: '☁️ Saving to your class account…' });
        result.appendChild(saved);
        progress.lastSync.then(function (ok) {
          saved.textContent = ok ? '☁️ Saved to your class account.'
                                 : '💾 Saved on this device. It will upload to your class account by itself later.';
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
  // Shows the signed-in teacher's OWN classes only (the owner's too: only his own). Each student's progress
  // is read one document at a time: the database lets a teacher read a student's progress only while the
  // student is in one of the teacher's classes.
  function renderTeacher() {
    const box = $('sl-teacher');
    box.style.display = 'block';
    box.textContent = '';
    box.appendChild(h('h2', { class: 'sl-teacher-title', text: '👩‍🏫 Class progress' }));
    const sel = h('select', { id: 'sl-class', 'aria-label': 'Class' }, [h('option', { value: '', text: 'Loading classes…' })]);
    const status = h('div');                       // a problem loading the classes stays visible here
    const table = h('div', { class: 'sl-table-wrap' });
    box.appendChild(sel); box.appendChild(status); box.appendChild(table);
    const db = firebase.firestore();
    const myEmail = String(state.role.email || '').toLowerCase();
    let classes = [], ticket = 0, loads = 0;
    // Offline, Firestore answers a read from its (often empty) cache. That is not "no classes" or "nobody has
    // started", so a cached answer counts as a failed read: the teacher gets a Retry instead of a wrong table.
    function fromServer(snap) { if (snap.metadata && snap.metadata.fromCache) throw { code: 'unavailable' }; return snap; }
    function retryNote(where, text, again) {
      const b = h('button', { type: 'button', class: 'sl-btn', text: '↻ Retry', style: 'margin-left:8px' });
      b.addEventListener('click', again);
      where.appendChild(h('p', { class: 'sl-muted' }, [text, b]));
    }
    // one student's progress: { doc } (a missing doc is "not started"), { denied } or { failed }
    function readProgress(uid) {
      return db.collection('sailcar_progress').doc(uid).get({ source: 'server' }).then(function (d) {
        return { doc: d.exists ? d.data() : null };
      }, function (err) { return err && err.code === 'permission-denied' ? { denied: true } : { failed: true }; });
    }
    sel.addEventListener('change', function () { showClass(sel.value); });
    function load() {
      const run = ++loads;
      classes = []; ++ticket;
      status.textContent = ''; table.textContent = '';
      sel.textContent = ''; sel.appendChild(h('option', { value: '', text: 'Loading classes…' }));
      db.collection('classes').where('teacherEmail', '==', myEmail).get().then(fromServer)
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
        const kids = snap.docs.map(function (d) { return d.data(); }).filter(function (k) { return k && k.uid; })
          .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
        return Promise.all(kids.map(function (k) { return readProgress(String(k.uid)); })).then(function (got) { return { kids: kids, got: got }; });
      }).then(function (res) {
        if (mine !== ticket) return;             // another class was picked while this one loaded
        const kids = res.kids, got = res.got;
        table.textContent = '';
        table.appendChild(h('h3', { class: 'sl-class-name', text: name }));
        if (!kids.length) { table.appendChild(h('p', { class: 'sl-muted', text: 'No students have joined this class yet.' })); return; }
        const graded = modules.filter(function (m) { return !m.noQuiz; });
        const t = h('table', { class: 'sl-table' });
        t.appendChild(h('thead', null, [h('tr', null, [h('th', { text: 'Student' })].concat(graded.map(function (m) { return h('th', { title: m.title, text: m.icon + ' ' + m.num }); })).concat([h('th', { text: 'Done' })]))]));
        const tb = h('tbody');
        let anyDenied = false, anyFailed = false;
        kids.forEach(function (k, i) {
          const g = got[i] || {};
          if (g.denied) anyDenied = true;
          if (g.failed) anyFailed = true;
          const p = (g.doc && g.doc.modules) || {};
          let n = 0;
          const cells = graded.map(function (m) {
            const r = p[m.id];
            if (r && r.passed) { n++; return h('td', { class: 'ok', title: 'Best ' + (r.best || 0) + '/' + (r.total || QUIZ_SIZE) + ', ' + (r.attempts || 0) + ' attempt(s)', text: '✓' }); }
            if (r && r.attempts) return h('td', { class: 'try', title: 'Best ' + (r.best || 0) + '/' + (r.total || QUIZ_SIZE) + ', ' + r.attempts + ' attempt(s)', text: (r.best || 0) + '/' + (r.total || QUIZ_SIZE) });
            return h('td', { class: 'none', title: g.denied ? 'Not started, or has not opened the lab since the update' : g.failed ? 'Could not load' : null, text: g.failed ? '?' : '·' });
          });
          tb.appendChild(h('tr', null, [h('td', { text: k.name || k.email })].concat(cells).concat([h('td', { text: n + '/' + graded.length })])));
        });
        t.appendChild(tb);
        table.appendChild(t);
        table.appendChild(h('p', { class: 'sl-muted', text: '✓ = passed · 3/5 = best score so far (not passed yet) · · = not started. Hover a cell to see attempts.' +
          (anyDenied ? ' A student’s progress shows up here after they open the Sail Car Lab once.' : '') }));
        if (anyFailed) retryNote(table, '? = couldn’t load that student — check Wi-Fi and tap Retry.', function () { showClass(classId); });
      }).catch(function (err) {
        if (mine !== ticket) return;
        table.textContent = '';
        retryNote(table, err && err.code === 'unavailable' ? 'Couldn’t load ' + name + ' — check Wi-Fi and tap Retry.' : 'Could not load ' + name + ' (' + (err && err.code) + ').',
                  function () { showClass(classId); });
      });
    }
  }

  // ── START ─────────────────────────────────────────────────────────────────
  // who is a teacher: the owner, or anyone the owner added (teacher-role.js); without it, only the owner
  function findRole(user) {
    const email = String((user && user.email) || '').toLowerCase();
    if (window.TeacherRole && typeof window.TeacherRole.check === 'function' && typeof firebase !== 'undefined' && firebase.firestore) {
      return Promise.resolve(window.TeacherRole.check(firebase.firestore(), user)).catch(function () { return { isOwner: false, isTeacher: false, email: email }; });
    }
    return Promise.resolve({ isOwner: email === TEACHER_EMAIL, isTeacher: email === TEACHER_EMAIL, email: email });
  }
  function start(user) {
    findRole(user).then(function (role) {
      state.role = { isOwner: !!role.isOwner, isTeacher: !!role.isTeacher, email: String(role.email || user.email || '').toLowerCase() };
      state.isTeacher = state.role.isTeacher;
      go(user);
    });
  }
  function go(user) {
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

  window.SailLab = { register: register, physics: physics, kid: kid, draw: draw, ui: ui, h: h, svg: svg, fmt: fmt, progress: progress,
                     start: start, modules: modules, isTeacher: function () { return state.isTeacher; }, role: function () { return state.role; },
                     _test: { unlocked: unlocked, openModule: openModule, state: state } };
})();
