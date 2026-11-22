// Sail Car Lab — Module 6: Balance & Stability
// The balance point (center of gravity), why the wind from the two box fans flips a car forward over its
// front wheels, and why crooked axles curve a car into the wall.
// Written for 6th graders: short sentences, no formulas, distances in FEET (SailLab.kid.dist), sizes in INCHES (kid.lenIn,
// kid.by), and NO force
// numbers or force units: a force is an arrow whose LENGTH shows its size (draw.forceScale: ONE honest scale per
// picture, so a bigger force is never drawn shorter), with a word label, and the words COMPARE two forces with the
// lab's shared vocabulary (kid.compare). Tipping is shown as a tug-of-war of two bars, "tipping" against "holding
// down", also on one honest scale per step. A sentence states a ratio ("about 3 times as strong") only when both
// bars or arrows it compares are drawn to scale. Behind the bars is simulate()'s own rule (students never see it):
//   the car flips if  sail push × (sail height − balance-point height)  >  weight × (balance point to front axle)
// and a front axle turned off square makes simulate() steer the car round a circle (radius = wheelbase ÷ tan(angle)).
// Every number a student reads (grams, inches, feet) is worked out from SailLab.physics and simulate() when the page loads.
// CHALLENGE FIRST: every step opens with a box right under its title (the core draws it): step.challenge (one short sentence, must be
// finished before Next) or step.job (steps with no challenge), plus step.todo (2-4 short numbered lines, using the control names exactly as
// they are on screen). The lesson text under it only explains. The challenge sentence says exactly what api.done() checks.
// UNITS: students set and read INCHES (sliders, chips, labels) and FEET (distances). The physics stays metric inside:
// makeCar() turns the inches into centimetres (kid.inToCm, × 2.54) before anything reaches simulate(). The module's own
// drawing sizes (px per cm) are internal and never shown.
(function () {
  'use strict';
  const P = SailLab.physics, D = P.DEFAULT_CAR, G = P.G, kid = SailLab.kid;
  // The hallway's size lives ONLY in sailcar-core.js (SailLab.physics.HALL: 70 ft × 11 ft today). Every hallway number
  // below — the goals, the map, the text — is worked out from it and from simulate(), so re-measuring the hall needs no edit here.
  const HALL = P.HALL;
  const LONG_HALL = 1000;                               // "in a longer hall": the same run with no end wall, so cars that reach the end can still be compared
  const START = 0.3;                                    // the start line: 0.3 m (about 1 ft) from the fans (simulate's default startX)
  const PAPER = 0.08;                                   // printer paper weighs about 80 g per square metre
  const FRAME = D.mass - D.sailArea * PAPER;            // the everyday 70 g car without its paper sail (66.8 g)
  const FRAME_H = 0.025;                                // its balance point is 2.5 cm (1 in) up (3 cm with the sail, like DEFAULT_CAR)
  const NICKEL = 0.005, COIN_H = 0.03;                  // a US nickel is 5 g; taped flat on the chassis, about 1 in (3 cm) off the floor
  const STICK = 0.0005;                                 // a longer chassis needs more stick and glue: about 0.5 g per cm (1.3 g per in)
  const MAP_M = HALL.length;                            // step 4: the top-down map shows the whole hallway, start line to far end
  // THE EVERYDAY CAR (steps 1 and 2): an 8 in square sail on a 6 in chassis, 70 g. Its size in INCHES is what students read;
  // toCm() turns every inch a student sets into the centimetres the physics uses (inches × 2.54).
  const toCm = kid.inToCm;
  const SAIL_IN = 8, CHASSIS_IN = 6;
  const CHASSIS_CM = toCm(CHASSIS_IN);                  // drawing units: px per cm, never shown
  // A car built from the everyday one, every size in INCHES: a wb in chassis (front axle to back axle), a side × side in
  // paper sail whose bottom sits gap in above the chassis (so its middle is 1 in + gap + half the sail above the floor), and
  // nickels taped over the back axle. Chassis, wheels, mast and sail sit mid-way between the axles. cgIn (optional) sets
  // the balance point directly (inches behind the front axle).
  function makeCar(side, gap, wb, nickels, cgIn) {
    const sideCm = toCm(side), gapCm = toCm(gap), wbCm = toCm(wb);
    const area = sideCm * sideCm / 10000, sail = area * PAPER, frame = FRAME + (wbCm - CHASSIS_CM) * STICK, coins = nickels * NICKEL;
    const mass = frame + sail + coins, sh = 0.03 + gapCm / 100 + sideCm / 200;
    return { mass: mass, sailArea: area, sailHeight: sh, wheelbase: wbCm / 100,
             cgToFront: cgIn != null ? toCm(cgIn) / 100 : ((frame + sail) * wbCm / 200 + coins * wbCm / 100) / mass,
             cgHeight: (frame * FRAME_H + sail * sh + coins * COIN_H) / mass };
  }
  // The tug-of-war at the start line, where the push is biggest (the car is still and the wind is strongest).
  // tip and hold are simulate()'s two sides (in N·cm, used only to size the bars); simulate() flips the car exactly when tip > hold.
  function turns(c) {
    const push = P.airForce(P.windAt(START), c.sailArea, D.sailCd, 0), weight = c.mass * G;
    const tipArm = (c.sailHeight - c.cgHeight) * 100, holdArm = c.cgToFront * 100;
    return { push: push, weight: weight, tipArm: tipArm, holdArm: holdArm, tip: push * tipArm, hold: weight * holdArm };
  }
  // the fewest nickels (0–4) that stop this car flipping, or null if even 4 can't
  function fewestNickels(side, gap, wb) {
    for (let n = 0; n <= 4; n++) { const t = turns(makeCar(side, gap, wb, n)); if (t.tip <= t.hold) return n; }
    return null;
  }
  // The tug-of-war bars: ONE honest scale per step (draw.forceScale). max = the biggest bar the step can make, which
  // fills the row. A bar shorter than 2 × TUG_MIN of the row is drawn a bit too long (so it stays visible): it is then
  // not to scale. min is a share of the row, so which bars are to scale is the same on a phone and on a laptop.
  const TUG_MIN = 0.02;
  function tugScale(max, w) { return SailLab.draw.forceScale(max, w, { min: w * TUG_MIN, over: 0 }); }
  // The two sides of the tug-of-war in words (kid.compare: the whole lab's vocabulary), never a number with a unit.
  // The bigger side goes first. A ratio ("about 3 times as strong") only when both bars are drawn to scale.
  function isTie(t) { return kid.bigger(t.tip, t.hold) === 'about the same'; }
  function compare(t, max) {
    if (!(t.tip > 0)) return 'Nothing is tipping the car.';
    const len = tugScale(max, 100), o = { times: len.toScale(t.tip) && len.toScale(t.hold) };
    return t.tip >= t.hold ? 'Tipping is ' + kid.compare(t.tip, t.hold, Object.assign({ noun: 'holding down' }, o)) + '.'
                           : 'Holding down is ' + kid.compare(t.hold, t.tip, Object.assign({ noun: 'tipping' }, o)) + '.';
  }
  function verdict(t) {
    const flips = t.tip > t.hold;
    if (isTie(t)) return flips ? 'Tipping wins by a hair, so the car flips. Real builders leave room to spare.'
                               : 'Holding down wins by a hair. One gust could flip it! Real builders leave room to spare.';
    return flips ? 'The back wheels lift. The car flips onto its nose!' : 'The car stays on all four wheels.';
  }
  // write a readout from plain strings and ['bold'] pieces — never innerHTML
  function say(api, box, parts) {
    box.textContent = '';
    parts.forEach(function (p) { box.appendChild(typeof p === 'string' ? document.createTextNode(p) : api.h('strong', { text: p[0] })); });
  }
  const RED = '#ff6060', BLUE = '#7ad7ff', GREEN = '#40e080', MUTED = '#9080b0';
  const nickels = function (v) { return v + ' (' + v * 5 + ' g)'; };
  const deg = function (v) { return (Math.round(v * 100) / 100) + '°'; };

  // ── Step 1: the finger test ─────────────────────────────────────────────
  // The everyday car (8 in sail, 6 in chassis) with n nickels on the back: where its balance point is, and whether a
  // finger f INCHES behind the front axle holds it level. The balance point only moves a few tenths of an inch, so the
  // finger slider moves in HALF inches (a whole inch is too coarse) and the tolerance is a quarter inch: exactly one
  // finger spot balances each car. The challenge: level, with 2 or more nickels.
  const BAL_TOL = 0.25;
  const FINGER = { min: 1, max: 6, step: 0.5 };
  function fingerTest(n, f) {
    const cg = kid.cmToIn(makeCar(SAIL_IN, 0, CHASSIS_IN, n).cgToFront * 100), ok = Math.abs(f - cg) <= BAL_TOL + 1e-9;
    return { cg: cg, ok: ok, done: ok && n >= 2 };
  }
  const FINGER_START = { n: 0, f: 2 };
  const CG0 = fingerTest(0, 0).cg;                      // 3 in: the everyday car with no nickels (the middle of its chassis)

  // ── Step 2: will it flip? (predict first) ───────────────────────────────
  // Nothing above the prediction says what happens: the "door hinge" idea and "the wind tips the car forward" come
  // only after the first test (in flipJudge's answer and the "How tipping works" note that appears then).
  // The three sliders, all in INCHES and whole inches (the sail and the gap move 2 in at a time, like the old 5 cm steps).
  const S2 = { side: { min: 4, max: 14, step: 2 }, gap: { min: 0, max: 6, step: 2 }, cg: { min: 1, max: 5, step: 1 } };
  const MAX_SIDE_CM = toCm(S2.side.max);
  function flipCar(side, gap, cg) { return makeCar(side, gap, CHASSIS_IN, 0, cg); }
  const FLIP_START = { side: 12, gap: 4, cg: 3 };        // a big sail on a tall mast: it flips
  const FLIP_PREDICT = {
    question: 'This car has a big sail on a tall mast. What will it do when the fans turn on?',
    choices: [{ value: 'stay', label: 'Stay on its wheels and roll away' },
              { value: 'nose', label: 'Flip forward onto its nose' },
              { value: 'back', label: 'Tip backward toward the fans' }]
  };
  // the answer after a test: { text, right, why } for the car being tested (t = its tug-of-war)
  function flipJudge(t, v) {
    const flips = t.tip > t.hold;
    const text = flips ? 'The car flipped forward onto its nose.' : 'The car stayed on its wheels.';
    const why = v === 'back'
      ? 'The wind blows away from the fans. So it pushes the car forward, never back toward the fans.'
      : flips ? 'The wind pushes high on the sail and tips the car forward. Its weight could not hold the back down.'
              : 'Holding down beat tipping. So the back wheels stayed on the floor.';
    return { text: text, right: (flips ? 'nose' : 'stay') === v, why: why };
  }
  // the biggest push and the biggest bar the step-2 sliders can make, so the arrows and the bars always fit
  const MAXPUSH = P.airForce(P.windAt(START), MAX_SIDE_CM * MAX_SIDE_CM / 10000, D.sailCd, 0);
  const MAX2 = (function () {
    let m = 0;
    for (let s = S2.side.min; s <= S2.side.max; s += S2.side.step) for (let g = S2.gap.min; g <= S2.gap.max; g += S2.gap.step) [S2.cg.min, S2.cg.max].forEach(function (cg) { const t = turns(flipCar(s, g, cg)); m = Math.max(m, t.tip, t.hold); });
    return m;
  })();
  // Step 2's picture draws the wind's push and the car's weight as two arrows on ONE scale: F2MAX (the biggest push
  // or weight the sliders can make) is px long. A force under 30% of F2MAX is drawn a bit too long (min = 15% of px),
  // so which arrows are to scale does not depend on the screen width.
  const MAXW2 = flipCar(S2.side.max, 0, S2.cg.min).mass * G;   // the heaviest step-2 car: the biggest sail
  const F2MAX = Math.max(MAXPUSH, MAXW2);
  function pushScale(px) { return SailLab.draw.forceScale(F2MAX, px, { min: px * 0.15, over: 0 }); }
  // how long (px) the biggest push is drawn: it must just fit between the fans and the biggest sail (drawing px per cm K)
  function pushPx(FA, K, fanR) { return Math.max(40, Math.min(90, Math.floor(FA - CHASSIS_CM / 2 * K - MAX_SIDE_CM * 0.45 * K - 6 - (fanR + 8)))); }
  // "The push is about the same as the weight." (a ratio only when both arrows are drawn to scale)
  function pushVsWeight(t) {
    const len = pushScale(100);
    return 'The push is ' + kid.compare(t.push, t.weight, { noun: 'the weight', times: len.toScale(t.push) && len.toScale(t.weight) }) + '.';
  }

  // ── Step 3: tame the big sail ───────────────────────────────────────────
  // The 12 × 12 in sail's farthest non-flipping run with the step's controls (gap 0/2/4 in, chassis 5/6/9 in,
  // 0–4 nickels), in a hall with no end: only a low sail + long chassis + 2–3 nickels gets past the end of our hall.
  // (All in inches: makeCar turns them into centimetres for simulate().)
  const BIG = 12, BIG_AREA = toCm(BIG) * toCm(BIG) / 10000, BIG_TXT = kid.by(BIG, BIG);   // '12 × 12 in'
  const SIDES = [8, 10, 12], GAPS = [0, 2, 4], BASES = [5, 6, 9];
  const BIG_START = { side: 12, gap: 4, wb: 6, n: 0 };
  function longer(car, opts) { return P.simulate(car, Object.assign({}, opts || {}, { hallLength: LONG_HALL })).distance; }
  const BIG_BEST = (function () {
    let best = 0;
    GAPS.forEach(function (gap) {
      BASES.forEach(function (wb) {
        for (let n = 0; n <= 4; n++) { const r = P.simulate(makeCar(BIG, gap, wb, n), { hallLength: LONG_HALL }); if (r.reason !== 'tipped over') best = Math.max(best, r.distance); }
      });
    });
    return best;
  })();
  // The goal: all the way to the END of the hallway (4 nickels is too heavy to get there). If the hall is ever made longer than
  // even the best big-sail car can roll, the goal becomes the whole feet that car can still reach.
  const GOAL_IS_END = BIG_BEST >= HALL.length;
  const HALL_GOAL = GOAL_IS_END ? HALL.length : Math.floor(BIG_BEST * kid.FT_PER_M) / kid.FT_PER_M;
  // the challenge rule (the step calls it before api.done(); the check script tests it): the big sail, no flip, goal reached
  function tamed(r) {
    return r.car.sailArea >= BIG_AREA - 1e-6 && r.reason !== 'tipped over' &&
           (GOAL_IS_END ? r.reason === 'reached the end of the hall' : r.distance >= HALL_GOAL - 1e-9);
  }
  // The builds that pass, and whether every one of them uses all three fixes (a lower sail than the 4 in gap it starts
  // with, a longer chassis than 6 in, and nickels). Today: gap 0 + 9 in + 2 or 3 nickels, so the page says "all three".
  const BIG_WINNERS = [];
  GAPS.forEach(function (gap) {
    BASES.forEach(function (wb) {
      for (let n = 0; n <= 4; n++) if (tamed(P.simulate(makeCar(BIG, gap, wb, n)))) BIG_WINNERS.push({ gap: gap, wb: wb, n: n });
    });
  });
  const ALL_THREE = BIG_WINNERS.length > 0 && BIG_WINNERS.every(function (w) { return w.gap < BIG_START.gap && w.wb > BIG_START.wb && w.n > BIG_START.n; });
  const MAX3 = (function () {
    let m = 0;
    SIDES.forEach(function (s) { GAPS.forEach(function (g) { BASES.forEach(function (wb) { for (let n = 0; n <= 4; n++) { const t = turns(makeCar(s, g, wb, n)); m = Math.max(m, t.tip, t.hold); } }); }); });
    return m;
  })();
  const GOAL3_TXT = GOAL_IS_END ? 'the end of the ' + kid.dist(HALL.length) + ' hall' : kid.dist(HALL_GOAL);
  const GOAL3_SHORT = GOAL_IS_END ? 'to the end of the hall' : kid.dist(HALL_GOAL);      // the challenge sentence: "Get the big-sail car to the end of the hall without flipping."

  // ── Step 4: square axles (predict first) ────────────────────────────────
  // The goal: at least 40 ft without hitting a wall, checked on the distance as the student sees it (kid.ft rounds).
  // ¼° off — the least crooked axle on the slider — hits the wall at about 35 ft; square axles roll about 53 ft.
  // A prediction is about ONE axle angle: moving the slider asks for a new one (as in Module 1), so the run that passes
  // the challenge is judged against what the student predicted for the square axle. "Wheels roll the way they point"
  // and "a giant circle" come only after a roll (in axleJudge's answer), never above the prediction.
  const GOAL_FT = 40, START_DEG = 1;
  function straightOK(r) { return r.reason !== 'hit the wall' && kid.ft(r.distance) >= GOAL_FT; }
  const DEFAULT_RUN = P.simulate({});
  const STRAIGHT_RUN = DEFAULT_RUN.distance;                        // a square-axled default car (about 53 ft: it coasts to a stop inside the hall)
  const HALL_W = DEFAULT_RUN.opts.hallWidth;                        // = HALL.width (11 ft today)
  const ROOM = HALL_W / 2 - 0.1;                                    // simulate() calls it a wall hit 4 in (half a car) before the wall
  const WALL_AT = function (a) { return P.simulate({ veerDeg: a }).distance; };
  const AXLE_PREDICT = {
    question: 'What will the car do when you press ▶ Roll?',
    choices: [{ value: 'straight', label: 'Roll straight down the hall' },
              { value: 'miss', label: 'Curve a little, but miss the walls' },
              { value: 'wall', label: 'Curve into a wall' }]
  };
  function axleJudge(r, v) {
    const wall = r.reason === 'hit the wall', end = r.reason === 'reached the end of the hall';
    const text = wall ? 'The car curved and hit the wall after ' + kid.dist(r.distance) + '.'
               : end ? 'The car rolled straight to the end of the hall.' : 'The car rolled straight for ' + kid.dist(r.distance) + '.';
    const why = !wall ? 'Square axles point straight down the hall. So the car rolls straight.'
              : v === 'miss' ? 'Even a tiny turn makes the car drive in a circle. Our hall is narrow, so the circle reaches a wall.'
              : 'Wheels roll the way they point. Even ' + deg(r.car.veerDeg) + ' off makes the car drive in a circle, and our hall is narrow.';
    return { text: text, right: (wall ? 'wall' : 'straight') === v, why: why };
  }

  // ── Drawing helpers ─────────────────────────────────────────────────────
  // The pictures are drawn at their real on-screen width (260–560 px) and shown 1 : 1, so a 13 px label is 13 px
  // on a phone too (a fixed 560-wide drawing shrank the labels to about 8 px on a 360 px phone).
  function boardWidth(el) { return Math.max(260, Math.min(560, Math.round(el.clientWidth || 560))); }
  function newBoard(api, el, aria) { return api.svg('svg', { role: 'img', 'aria-label': aria }, el); }
  function startBoard(api, s, W, H) {
    s.textContent = '';
    s.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    s.setAttribute('width', W);
    api.svg('rect', { x: 0, y: 0, width: W, height: H, rx: 12, fill: '#120826' }, s);
  }
  // redraw when the window (or a turned phone) changes width; stops when the student leaves the step
  function keepFitted(api, el, paint) {
    let w = boardWidth(el);
    function onResize() { const n = boardWidth(el); if (n !== w) { w = n; paint(); } }
    window.addEventListener('resize', onResize);
    api.onLeave(function () { window.removeEventListener('resize', onResize); });
  }
  function label(api, s, x, y, text, o) {
    o = o || {};
    return api.svg('text', { x: x, y: y, 'text-anchor': o.anchor || 'start', fill: o.color || '#c8b8ea', 'font-size': o.size || 14,
      'font-weight': o.bold === false ? 400 : 700, class: 'sl-lbl' }, s, text);
  }
  // a "Word to know" box at the very top of the step (above the step's html)
  function wordFirst(api, el, term, meaningHtml) {
    const box = api.ui.word(el, term, meaningHtml);
    el.insertBefore(box, el.firstChild);
    return box;
  }
  // The tug-of-war: two bars, tipping (red) against holding down (blue), at (x, y), w wide. max = the biggest value either
  // bar reaches on this step, so a bar's length can be compared across settings (tugScale: one honest scale, word labels,
  // never a number). grow (0–1) grows the tipping bar.
  function tugBars(api, s, x, y, w, t, max, grow, gap) {
    const len = tugScale(max, w);
    [['Tipping (wind)', t.tip * (grow == null ? 1 : grow), RED], ['Holding down (weight)', t.hold, BLUE]].forEach(function (b, i) {
      const yy = y + i * (gap || 52), bw = len(b[1]);
      label(api, s, x, yy, b[0], { color: b[2] });
      api.svg('rect', { x: x, y: yy + 7, width: w, height: 22, rx: 5, fill: '#ffffff', opacity: 0.06 }, s);
      if (bw) api.svg('rect', { x: x, y: yy + 7, width: bw, height: 22, rx: 5, fill: b[2], opacity: 0.88 }, s);
    });
  }

  SailLab.register({
    id: 'balance',
    num: 6,
    title: 'Balance & Stability',
    icon: '🎯',
    blurb: 'Find the balance point. Stop your car from flipping. Make it roll straight.',
    minutes: 15,
    steps: [
      {
        title: 'Find the balance point',
        html:
          '<p>Every object has a balance point. Scientists call it the <strong>center of gravity</strong>.</p>' +
          '<p>The balance point is always closer to the heavy parts. Where it sits decides if your car stays on its wheels. ' +
          'You will see how in the next step.</p>',
        challenge: 'Balance the car on your finger with 2 or more nickels.',
        todo: ['Slide “Nickels at the back” to 2.', 'Slide “Your finger, behind the front axle”.', 'Move your finger toward the end that drops.', 'Stop when you see “Balanced!”.'],
        render: function (el, api) {
          wordFirst(api, el, 'balance point', 'the spot where an object balances on your finger. It acts as if all its weight were right there.');
          const s = newBoard(api, el, 'A sail car resting on a fingertip');
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const coins = api.ui.slider(row, { label: 'Nickels at the back', min: 0, max: 4, step: 1, value: FINGER_START.n, format: nickels, onInput: draw });
          const finger = api.ui.slider(row, { label: 'Your finger, behind the front axle', min: FINGER.min, max: FINGER.max, step: FINGER.step, value: FINGER_START.f, inches: true, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          function draw() {
            const W = boardWidth(el), K = Math.max(4.2, Math.min(8, W / 55)), PY = Math.round(22 * K + 46), H = PY + 44;   // drawing px per cm · fingertip
            const n = coins.get(), f = finger.get(), test = fingerTest(n, f), cg = test.cg, ok = test.ok;
            const FA = Math.round(W / 2 + CHASSIS_CM / 2 * K), fx = FA - toCm(f) * K;                                     // front axle · finger
            startBoard(api, s, W, H);
            label(api, s, 14, 24, '← back (fans side)', { bold: false, color: MUTED, size: 13 });
            label(api, s, W - 14, 24, 'front →', { anchor: 'end', bold: false, color: MUTED, size: 13 });
            // the car rests on the fingertip; if the balance point isn't right above it, the heavy end drops
            const g = api.svg('g', { transform: 'rotate(' + (ok ? 0 : cg > f ? -8 : 8) + ',' + fx + ',' + PY + ')' }, s);
            api.draw.car(g, FA - (CHASSIS_CM + 1.5) * K, PY + 2 * K, { scale: K, length: CHASSIS_CM + 3, wheelR: 1.5, sailW: toCm(SAIL_IN), sailH: toCm(SAIL_IN), mastH: toCm(SAIL_IN), mastAt: 0.5 });
            for (let i = 0; i < n; i++) api.svg('rect', { x: FA - CHASSIS_CM * K - 9, y: PY - 2 * K - 4.5 * (i + 1), width: 19, height: 4, rx: 1, fill: '#c8c8d0', stroke: '#80808a', 'stroke-width': 0.8 }, g);
            if (n) label(api, g, FA - CHASSIS_CM * K - 14, PY - 2 * K - 4.5 * n + 4, n + ' nickel' + (n === 1 ? ' →' : 's →'), { anchor: 'end', color: '#c8c8d0', size: 13 });
            if (ok) {
              api.svg('circle', { cx: FA - toCm(cg) * K, cy: PY - K, r: 6, fill: '#00a8ff', stroke: '#fff', 'stroke-width': 1.5 }, g);
              label(api, s, FA - toCm(cg) * K + 14, PY - 30, 'balance point', { color: BLUE });
            }
            api.svg('rect', { x: fx - 11, y: PY, width: 22, height: H - PY + 20, rx: 11, fill: '#e2b08a', stroke: '#b07850', 'stroke-width': 1.5 }, s);
            api.svg('ellipse', { cx: fx, cy: PY + 9, rx: 6.5, ry: 5, fill: '#f4d4c0' }, s);
            if (ok) {
              say(api, out, ['⚖️ ', ['Balanced!'], ' The balance point is right above your finger, about ', [kid.lenIn(f)], ' behind the front axle.' +
                (n < 2 ? ' Now tape on 2 or more nickels. Then find the new balance point.' : '')]);
              if (test.done) api.done('The balance point moved toward the heavy end. It went from ' + kid.lenIn(CG0) + ' to about ' + kid.lenIn(f) + ' behind the front axle. ' +
                'Weight at the back moves the balance point back.');
            } else if (cg > f) say(api, out, ['↙️ The ', ['back'], ' end drops. The balance point is behind your finger. Slide your finger toward the back (a bigger number).']);
            else say(api, out, ['↘️ The ', ['front'], ' end drops. The balance point is in front of your finger. Slide your finger toward the front (a smaller number).']);
          }
          keepFitted(api, el, draw);
          draw();
        }
      },
      {
        title: 'Will it flip?',
        html:
          '<p>Let’s test a car at the start line. It sits close to the two fans, where the wind is strongest.</p>',
        job: 'Test the car. Then find what keeps a car from flipping.',
        todo: ['Answer the “Predict first” question.', 'Press “▶ Turn on the fans”.', 'Move the 3 sliders, one at a time.', 'Find which changes shrink the red bar.'],
        render: function (el, api) {
          wordFirst(api, el, 'stable', 'hard to tip over. A stable car stays on all four wheels.');
          const pr = api.ui.predict(el, { question: FLIP_PREDICT.question, choices: FLIP_PREDICT.choices });
          const go = api.h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: '▶ Turn on the fans' });
          el.appendChild(api.h('div', { class: 'sl-ctrl' }, [go]));
          pr.gate(go);
          const s = newBoard(api, el, 'A sail car seen from the side, and a tug-of-war between tipping and holding down');
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          // how tipping works: shown only after the first test, so it can't give the prediction away
          const how = api.ui.note(el, 'tip',
            '<p style="margin:0 0 8px">🚪 <strong>How tipping works:</strong> Push a door near its hinges. It barely moves. ' +
            'Push it far from the hinges, and it swings open. A push far from a hinge has more turning power.</p>' +
            '<p style="margin:0">Your car’s front wheels act like a hinge. The wind pushes high on the sail and tries to tip the car forward. ' +
            'The car’s weight holds the back down. It is a tug-of-war!</p>');
          how.hidden = true;
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const by = function (v) { return kid.by(v, v); };                                    // '8 × 8 in'
          const size = api.ui.slider(row, { label: 'Sail size (square)', min: S2.side.min, max: S2.side.max, step: S2.side.step, value: FLIP_START.side, format: by, valueText: by, onInput: slid });
          const gap = api.ui.slider(row, { label: 'Gap under the sail (tall mast)', min: S2.gap.min, max: S2.gap.max, step: S2.gap.step, value: FLIP_START.gap, inches: true, onInput: slid });
          const cgS = api.ui.slider(row, { label: 'Balance point, behind the front wheels', min: S2.cg.min, max: S2.cg.max, step: S2.cg.step, value: FLIP_START.cg, inches: true, onInput: slid });
          const sliders = [size, gap, cgS];
          const lock = api.h('div', { class: 'sl-predict-hint', text: '🔒 The sliders unlock after you test your prediction.' });
          el.appendChild(lock);
          sliders.forEach(function (c) { c.input.disabled = true; });
          let fansOn = false, grow = 0, tilt = 0, raf = null;
          // A prediction is judged once, by the first test after it is picked. Then it is spent: when the sliders change
          // the car, its answer goes, and later tests show only the plain result (the picture and the readout under it).
          // So a student is never told "You predicted … Surprise!" about a car they changed after predicting.
          let pending = false;
          pr.onChange(function (v) { pending = v != null; });
          function car() { return flipCar(size.get(), gap.get(), cgS.get()); }
          function paint() {
            const W = boardWidth(el), wide = W >= 520, K = wide ? 4.2 : 3.6;                 // wide: bars beside the car · narrow: below it
            const sideCm = toCm(size.get()), gapCm = toCm(gap.get()), c = car(), t = turns(c), flips = t.tip > t.hold;
            const FL = Math.round((3 + toCm(S2.gap.max) + MAX_SIDE_CM) * K + 20);            // floor: room for the tallest sail (1 in + 6 in + 14 in), drawing px per cm
            const FA = wide ? 230 : W - 108, fanS = wide ? 70 : 60, fanR = 10 + fanS * 0.32;  // the front wheels (the hinge) · the fans
            // ONE scale for the push and weight arrows (pushScale): the push on the biggest sail (14 in) just fits between the
            // fans and the sail. The "how far back" bracket sits below the longest weight arrow, so it never moves.
            const PX = pushPx(FA, K, fanR), flen = pushScale(PX);
            const BY = FL + Math.ceil(flen(MAXW2)) + 10, sceneH = BY + 22, H = wide ? sceneH : sceneH + 188;
            const mastX = FA - CHASSIS_CM / 2 * K, sailY = FL - c.sailHeight * 100 * K, sailL = mastX - sideCm * 0.45 * K;
            const cgX = FA - t.holdArm * K, cgY = FL - c.cgHeight * 100 * K, LX = FA + 24;
            startBoard(api, s, W, H);
            api.svg('line', { x1: 8, y1: FL, x2: wide ? 330 : W - 8, y2: FL, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            api.draw.fan(s, 10, FL, fanS, ' ');
            label(api, s, 6, FL - fanS - 8, '2 fans', { color: MUTED, bold: false, size: 13 });
            // the car (sail bottom 3 cm + gap off the floor); a faint copy shows it flipping
            const carO = { scale: K, length: CHASSIS_CM + 3, wheelR: 1.5, sailW: sideCm, sailH: sideCm, mastH: gapCm + sideCm - 1, mastAt: 0.5 };
            if (tilt > 0) api.draw.car(s, FA - (CHASSIS_CM + 1.5) * K, FL, Object.assign({ tilt: 24 * tilt }, carO)).setAttribute('opacity', 0.35);
            api.draw.car(s, FA - (CHASSIS_CM + 1.5) * K, FL, carO);
            if (fansOn) {                                                          // the hinge would hint "forward", so not before the test
              api.svg('polygon', { points: [FA, FL + 1, FA - 7, FL + 13, FA + 7, FL + 13].join(','), fill: '#ffa040' }, s);
              label(api, s, FA + 11, FL + 14, 'hinge', { color: '#ffa040', size: 13 });
            }
            // the wind's push on the middle of the sail (only with the fans on): a longer arrow is a bigger push
            if (fansOn && grow > 0) {
              const ax2 = sailL - 6, len = flen(t.push) * grow;
              api.draw.arrow(s, ax2 - len, sailY, ax2, sailY, GREEN, '');
              if (grow >= 1) label(api, s, ax2, sailY - 12, 'push', { anchor: 'end', color: GREEN, size: 13 });
            }
            // how high the push is above the balance point (red), and how far back the balance point is (blue)
            api.svg('circle', { cx: mastX, cy: sailY, r: 4, fill: RED }, s);
            [[mastX, sailY], [cgX, cgY]].forEach(function (p) { api.svg('line', { x1: p[0], y1: p[1], x2: LX + 6, y2: p[1], stroke: RED, 'stroke-width': 1.5, 'stroke-dasharray': '2,4', opacity: 0.8 }, s); });
            api.svg('line', { x1: LX, y1: cgY, x2: LX, y2: sailY, stroke: RED, 'stroke-width': 3 }, s);
            label(api, s, LX + 7, (cgY + sailY) / 2 + 5, 'how high', { color: RED, size: 13 });
            // the weight pulls down at the balance point: on the push arrow's scale, so the two lengths can be compared
            const wl = flen(t.weight);
            api.draw.arrow(s, cgX, cgY, cgX, cgY + wl, BLUE, '', { width: 3 });
            label(api, s, cgX - 8, Math.max(FL + 18, cgY + wl / 2 + 5), 'weight', { anchor: 'end', color: BLUE, size: 13 });
            api.svg('line', { x1: cgX, y1: BY, x2: FA, y2: BY, stroke: BLUE, 'stroke-width': 3 }, s);
            [cgX, FA].forEach(function (x) { api.svg('line', { x1: x, y1: BY - 7, x2: x, y2: BY + 7, stroke: BLUE, 'stroke-width': 2 }, s); });
            label(api, s, FA + 11, BY + 6, 'how far back', { color: BLUE, size: 13 });
            api.svg('circle', { cx: cgX, cy: cgY, r: 6, fill: '#00a8ff', stroke: '#fff', 'stroke-width': 1.5 }, s);
            // the tug-of-war
            const BX = wide ? 344 : 14, BW = wide ? W - 358 : W - 28, y0 = wide ? 0 : sceneH;
            label(api, s, BX, y0 + (wide ? 34 : 18), 'Tug-of-war');
            tugBars(api, s, BX, y0 + (wide ? 70 : 44), BW, t, MAX2, fansOn ? grow : 0, wide ? 62 : 54);
            const vy = y0 + (wide ? 206 : 156);
            if (!fansOn) {
              label(api, s, BX, vy, 'FANS OFF', { color: MUTED, size: 20 });
              label(api, s, BX, vy + 24, 'no wind yet', { bold: false, size: 13 });
            } else if (grow >= 1) {
              label(api, s, BX, vy, flips ? 'IT FLIPS!' : 'IT STAYS DOWN', { color: flips ? RED : GREEN, size: 20 });
              label(api, s, BX, vy + 24, flips ? 'tipping wins' : 'holding down wins', { bold: false, size: 13 });
            }
          }
          function explain() {
            const t = turns(car()), flips = t.tip > t.hold;
            if (!fansOn) { say(api, out, ['The fans are off. Make your prediction. Then press ', ['▶ Turn on the fans'], '.']); return; }
            // a push that is NOT bigger than the weight can still flip the car: that is the surprise worth saying out loud
            const tug = compare(t, MAX2), surprise = flips && kid.bigger(t.push, t.weight) !== 'bigger';
            say(api, out, ['🔴 ', ['Tipping:'], ' the wind pushes high on the sail. ',
              '🔵 ', ['Holding down:'], ' the car’s weight pulls down at the balance point. ', pushVsWeight(t) + ' ',
              [surprise && !isTie(t) ? 'But ' + tug.charAt(0).toLowerCase() + tug.slice(1) : tug],
              (surprise ? ' A push up high has lots of turning power.' : '') + ' ' + verdict(t)]);
          }
          function finish() {
            if (raf) cancelAnimationFrame(raf);
            raf = null; grow = 1;
            const t = turns(car());
            tilt = t.tip > t.hold ? 1 : 0;
            paint(); explain();
            go.disabled = pr.get() == null;
            go.textContent = '▶ Test again';
            sliders.forEach(function (c) { c.input.disabled = false; });
            lock.hidden = true;
            how.hidden = false; tryIt.hidden = false;
            if (pending) {
              pending = false;
              const j = flipJudge(t, pr.get());
              pr.reveal(j.text, j.right, j.why);
            }
          }
          // the fans spin up: the tipping bar grows (0.9 s), then a car that flips tips over (0.5 s)
          go.addEventListener('click', function () {
            if (pr.get() == null) return;
            if (raf) cancelAnimationFrame(raf);
            if (pending) pr.clear();                          // a new answer is coming; otherwise the last one (same car) stays
            fansOn = true; grow = 0; tilt = 0;
            go.disabled = true;
            say(api, out, ['🌬️ The fans are on…']);
            const t0 = performance.now(), t = turns(car()), flips = t.tip > t.hold;
            function frame(now) {
              if (!s.isConnected) { raf = null; return; }
              const k = (now - t0) / 1000;
              if (k >= 1.4) { finish(); return; }
              grow = Math.min(1, k / 0.9);
              tilt = flips ? Math.max(0, Math.min(1, (k - 0.9) / 0.5)) : 0;
              paint();
              raf = requestAnimationFrame(frame);
            }
            raf = requestAnimationFrame(frame);
          });
          // after the test the sliders change the car live (the old answer goes: it was about a different car;
          // the prediction was already judged, so "Test again" shows only the plain result)
          function slid() {
            if (raf) { cancelAnimationFrame(raf); raf = null; }
            const t = turns(car());
            grow = 1; tilt = t.tip > t.hold ? 1 : 0;
            pr.clear();
            go.disabled = pr.get() == null;
            paint(); explain();
          }
          api.onLeave(function () { if (raf) cancelAnimationFrame(raf); raf = null; });
          keepFitted(api, el, paint);
          paint(); explain();
          // the sliders' "try this" appears with the sliders (after the first test), like "How tipping works"
          const tryIt = api.ui.note(el, 'tip', '💡 <strong>Try this:</strong> Set the gap under the sail to 0 in. Slide the balance point back. Make the sail smaller. ' +
            'Which one grows the blue bar? On a real car, weight at the back moves the balance point back. So does a longer chassis.');
          tryIt.hidden = true;
        }
      },
      {
        title: 'Hallway challenge: tame the big sail',
        html:
          '<p>This car has a big <strong>' + BIG_TXT + '</strong> sail on a tall mast. A big sail catches lots of wind. ' +
          'At the start line, the wind can flip it!</p>' +
          '<p>To make the car <strong>stable</strong>, ' + (ALL_THREE ? 'this sail needs <strong>all three</strong> fixes.' : 'this sail needs <strong>more than one</strong> fix.') +
          ' Watch the tug-of-war bars as you try each one. But add only the weight you need. Extra weight means extra friction.</p>',
        challenge: 'Get the big-sail car ' + GOAL3_SHORT + ' without flipping.',
        todo: ['Keep “Sail size” at ' + BIG_TXT + '.', 'Pick a lower “Gap under the sail”.', 'Pick a longer “Chassis length”.', 'Add “Nickels at the back”. Press ▶ Run.'],
        render: function (el, api) {
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          let sim = null;
          const side = api.ui.choice(row, { label: 'Sail size', value: BIG_START.side, options: SIDES.map(function (v) { return { value: v, label: kid.by(v, v) }; }), onChange: info });
          const gap = api.ui.choice(row, { label: 'Gap under the sail', value: BIG_START.gap, options: [{ value: GAPS[0], label: 'None (low)' }, { value: GAPS[1], label: kid.lenIn(GAPS[1]) }, { value: GAPS[2], label: kid.lenIn(GAPS[2]) + ' (tall)' }], onChange: info });
          const wb = api.ui.choice(row, { label: 'Chassis length', value: BIG_START.wb, options: [{ value: BASES[0], label: 'Short ' + kid.lenIn(BASES[0]) }, { value: BASES[1], label: 'Normal ' + kid.lenIn(BASES[1]) }, { value: BASES[2], label: 'Long ' + kid.lenIn(BASES[2]) }], onChange: info });
          const coins = api.ui.slider(row, { label: 'Nickels at the back', min: 0, max: 4, step: 1, value: BIG_START.n, format: nickels, onInput: info });
          const bs = newBoard(api, el, 'The tug-of-war for this car at the start line: tipping against holding down');
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const HINT = '💡 Check the tug-of-war bars before you run.';
          const fb = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite', text: HINT });
          function car() { return makeCar(side.get(), gap.get(), wb.get(), coins.get()); }
          function bars() {
            const W = boardWidth(el), t = turns(car());
            startBoard(api, bs, W, 112);
            tugBars(api, bs, 14, 24, W - 28, t, MAX3, 1, 50);
            bs.setAttribute('aria-label', 'The tug-of-war for this car at the start line. ' + compare(t, MAX3));
          }
          // any change to the car clears the old run, so a run of a different car can't pass the challenge
          function info() {
            const c = car(), t = turns(c);
            bars();
            say(api, out, ['⚖️ This car weighs ', [kid.grams(c.mass)], '. ' + compare(t, MAX3) + ' ', t.tip > t.hold ? ['It will flip! 🤸'] : ['It stays down ✓'],
              isTie(t) ? ' But only just!' : '']);
            fb.textContent = HINT;
            if (sim) sim.reset();
          }
          info();
          keepFitted(api, el, bars);
          sim = api.ui.trackSim(el, car, {
            scaleM: HALL.length,                              // the whole hallway, start line to far end, the same view every run
            onResult: function (r) {
              const d = kid.dist(r.distance), end = r.reason === 'reached the end of the hall', big = r.car.sailArea >= BIG_AREA - 1e-6;
              // a car that reached the end was still rolling: how far it would have gone in a longer hall
              const farTxt = 'about ' + kid.dist(end ? longer(r.car, r.opts) : r.distance);
              if (r.reason === 'tipped over') {
                const three = ALL_THREE && big;
                say(api, fb, ['🤸 ', ['Flipped!'], ' Tipping beat holding down. Lower the sail, use a longer chassis' + (three ? ' and' : ' or') + ' add nickels at the back.' +
                  (three ? ' This big sail needs all three fixes.' : '')]);
              }
              else if (!big) say(api, fb, end
                ? ['No flip, and it reached the end. But it has a smaller sail. This challenge is to tame the BIG sail. Put the ' + BIG_TXT + ' sail back and fix the balance.']
                : ['No flip, but it stopped at ', [d], '. A smaller sail catches less wind. Keep the ' + BIG_TXT + ' sail and fix the balance instead.']);
              else if (tamed(r)) {
                const need = fewestNickels(side.get(), gap.get(), wb.get()), fewer = need != null && coins.get() > need;
                const lightFar = fewer ? longer(makeCar(side.get(), gap.get(), wb.get(), need), r.opts) : 0;
                say(api, fb, ['🏆 ', [end ? 'All the way to the end of the hall' : d], ', and no flip!']
                  .concat(end ? [' It was still rolling. In a longer hall, it would have gone ', [farTxt], '.'] : [])
                  .concat(fewer ? [' Just ' + need + ' nickel' + (need === 1 ? '' : 's') + ' would stop the flip. A lighter car rolls farther' +
                    (end ? ': about ' + kid.dist(lightFar) + ' in that longer hall.' : '.') + ' But your extra weight gives you room to spare.'] : [])
                  .concat(isTie(turns(r.car)) ? [' Careful: it only just stays down. On race day, a little more weight is safer.'] : []));
                api.done((end ? 'It reached the end of the ' + kid.dist(HALL.length) + ' hall without flipping! In a longer hall, it would have gone ' + farTxt + '. '
                              : 'It rolled ' + d + ' without flipping! ') +
                  'A low sail and a long chassis keep a big sail stable. So does a little weight at the back.');
              } else say(api, fb, ['No flip. Nice! But it stopped at ', [d], GOAL_IS_END ? ', short of the end of the hall.' : ', short of ' + GOAL3_TXT + '.',
                ' Every nickel adds weight, and weight adds friction. Can you stop the flip with less weight?']);
            }
          });
          api.onLeave(sim.stop);
          el.appendChild(fb);
        }
      },
      {
        title: 'Drive straight: square axles',
        html:
          '<p>Here is your car from above. Its front axle is turned just ' + deg(START_DEG) + ' off square. Can you even see it?</p>' +
          '<p>Our hall is ' + kid.dist(HALL_W) + ' wide. Your car starts in the middle. So it has about ' + kid.dist(ROOM) + ' of room on each side.</p>' +
          '<p>The map below shows the whole ' + kid.dist(HALL.length) + ' hall from above. It is squeezed to fit. So the hall looks shorter and wider than it really is.</p>',
        challenge: 'Make the car roll at least ' + kid.dist(GOAL_FT / kid.FT_PER_M) + ' without hitting a wall.',
        todo: ['Answer the “Predict first” question.', 'Press ▶ Roll and watch the car.', 'Slide “Front axle turned off square” to 0°.', 'Answer again. Press ▶ Roll.'],
        render: function (el, api) {
          wordFirst(api, el, 'square axle', 'an axle that sits straight across the car. It makes a perfect corner (90°), like the corner of a sheet of paper.');
          const top = newBoard(api, el, 'Your car seen from above, with its two axles');
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          // a prediction is about ONE axle angle: a new angle needs a new prediction
          let picked = START_DEG;
          const ang = api.ui.slider(row, { label: 'Front axle turned off square', min: 0, max: 5, step: 0.25, value: START_DEG, format: deg,
            onInput: function () {
              stop();
              if (ang.get() !== picked) { picked = ang.get(); pr.reset(); }
              carTop(); hall([], null); explain(null);
            } });
          const pr = api.ui.predict(el, { question: AXLE_PREDICT.question, choices: AXLE_PREDICT.choices });
          const go = api.h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: '▶ Roll' });
          el.appendChild(api.h('div', { class: 'sl-ctrl' }, [go]));
          pr.gate(go);
          const hs = newBoard(api, el, 'Map of the whole hallway seen from above, with your car’s path');
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const ghosts = [];
          let raf = null, lastPts = [], lastRes = null;
          function axle(x, yc, half, ww, wh, rot, color, W) {
            const g = api.svg('g', { transform: 'rotate(' + rot + ',' + x + ',' + yc + ')' }, top);
            [yc - half, yc + half].forEach(function (y) {
              api.svg('line', { x1: x + ww / 2 + 2, y1: y, x2: W + 40, y2: y, stroke: color, 'stroke-width': 2, 'stroke-dasharray': '6,6' }, g);   // the way this wheel rolls
              api.svg('rect', { x: x - ww / 2, y: y - wh / 2, width: ww, height: wh, rx: 3, fill: '#222', stroke: '#888', 'stroke-width': 1.5 }, g);
            });
            api.svg('line', { x1: x, y1: yc - half, x2: x, y2: yc + half, stroke: '#c8a060', 'stroke-width': 3 }, g);
          }
          function carTop() {
            const W = boardWidth(el), wide = W >= 520, a = ang.get();
            const TH = wide ? 164 : 212, yc = wide ? 75 : 134, half = wide ? 52 : 46, ww = wide ? 36 : 28, wh = wide ? 12 : 10;
            const kc = wide ? 12 : Math.min(12, (W - 120) / 16), bx = wide ? 222 : 40, fx = bx + 16 * kc;   // px per cm: back and front axles, 16 cm apart
            startBoard(api, top, W, TH);
            const ly = wide ? [32, 64, 92] : [22, 44, 64];
            label(api, top, 14, ly[0], 'Your car from above');
            label(api, top, 14, ly[1], 'back axle: square', { color: BLUE, bold: false, size: 13 });
            label(api, top, 14, ly[2], a ? 'front axle: ' + deg(a) + ' off' : 'front axle: square', { color: a ? RED : GREEN, bold: false, size: 13 });
            [-1, 0, 1].forEach(function (k) { api.svg('rect', { x: bx - 14, y: yc - wh / 2 + k * (wh + 2), width: fx - bx + 28, height: wh, rx: 5, fill: '#d8b070', stroke: '#a07830' }, top); });
            axle(bx, yc, half, ww, wh, 0, BLUE, W);
            axle(fx, yc, half, ww, wh, -a, a ? RED : GREEN, W);
            label(api, top, W - 12, TH - 8, 'dashes = the way each wheel rolls', { anchor: 'end', bold: false, color: MUTED, size: 13 });
          }
          // the map's size for this screen width; simulate()'s trace: x = metres down the hall from the start line,
          // lateral = metres sideways from the middle
          function geo() {
            const W = boardWidth(el), wide = W >= 520;
            const X0 = wide ? 30 : 22, EX = W - (wide ? 27 : 14), HALF = wide ? 96 : 64, WT = wide ? 46 : 32;   // fan face · far end · half the hall's width in px · top wall
            const YC = WT + HALF, WB = YC + HALF, KX = (EX - X0) / (MAP_M + START), KY = HALF / (HALL_W / 2);
            return { W: W, wide: wide, X0: X0, EX: EX, HALF: HALF, WT: WT, YC: YC, WB: WB, KX: KX, KY: KY, SX: X0 + START * KX, HH: WB + (wide ? 44 : 36), fs: wide ? 16 : 13 };
          }
          function pt(m, p) { return [m.X0 + (START + p.x) * m.KX, m.YC - p.lateral * m.KY]; }
          function line(m, pts, color, w, op) {
            api.svg('polyline', { points: pts.map(function (p) { return pt(m, p).join(','); }).join(' '), fill: 'none', stroke: color, 'stroke-width': w, opacity: op, 'stroke-linejoin': 'round' }, hs);
          }
          function hall(pts, res) {
            lastPts = pts; lastRes = res;
            const m = geo(), W = m.W;
            startBoard(api, hs, W, m.HH);
            // the two side walls and the far end of the hall
            [m.WT - 3, m.WB + 3].forEach(function (y) { api.svg('line', { x1: 0, y1: y, x2: m.EX + 6, y2: y, stroke: '#6a5a8a', 'stroke-width': 6 }, hs); });
            api.svg('line', { x1: m.EX + 3, y1: m.WT - 6, x2: m.EX + 3, y2: m.WB + 6, stroke: '#6a5a8a', 'stroke-width': 6 }, hs);
            label(api, hs, m.EX, m.WT - 14, (m.wide ? 'wall: ' : '') + 'the hall is ' + kid.dist(HALL_W) + ' wide', { anchor: 'end', bold: false, color: MUTED, size: m.fs });
            label(api, hs, m.EX - 8, m.WB - 12, 'end of the hall', { anchor: 'end', bold: false, color: MUTED, size: m.fs });   // lower half: paths only ever drift up
            label(api, hs, m.SX + 2, m.WT - 14, 'start', { anchor: 'middle', color: '#f0c040', size: m.fs });
            api.svg('line', { x1: m.SX, y1: m.WT, x2: m.SX, y2: m.WB, stroke: '#f0c040', 'stroke-width': 1.5, 'stroke-dasharray': '4,4', opacity: 0.6 }, hs);
            api.svg('line', { x1: m.SX, y1: m.YC, x2: m.EX, y2: m.YC, stroke: '#4a3a6a', 'stroke-width': 2, 'stroke-dasharray': '6,8' }, hs);
            // two box fans side by side, about 20 in wide each, facing down the hall
            const FW = 0.5 * m.KY;
            [m.YC - FW - 1, m.YC + 1].forEach(function (y) { api.svg('rect', { x: m.X0 - 14, y: y, width: 14, height: FW, rx: 3, fill: '#3a2a5a', stroke: MUTED, 'stroke-width': 2 }, hs); });
            label(api, hs, m.SX + 8, m.YC + 24, '← 2 fans', { bold: false, color: MUTED, size: m.fs });   // lower half: paths only ever drift up
            // foot marks: a tick every 5 ft, a label every 10 or 20 ft (whichever fits), none crowding the end wall
            const pxFt = m.KX / kid.FT_PER_M, lab = [10, 20, 50].filter(function (f) { return f * pxFt >= (m.wide ? 50 : 44); })[0] || 50;
            for (let f = 5; f / kid.FT_PER_M < MAP_M; f += 5) {
              const x = m.SX + f / kid.FT_PER_M * m.KX;
              if (m.EX - x < 10) break;
              api.svg('line', { x1: x, y1: m.WB + 6, x2: x, y2: m.WB + (f % lab ? 11 : 15), stroke: '#6a5a8a', 'stroke-width': 1.5 }, hs);
              if (f % lab === 0 && m.EX - x > 26) label(api, hs, x, m.WB + (m.wide ? 34 : 29), f + ' ft', { anchor: 'middle', bold: false, color: MUTED, size: m.wide ? 15 : 13 });
            }
            ghosts.forEach(function (gh) {
              line(m, gh.pts, MUTED, 2, 0.55);
              const e = pt(m, gh.pts[gh.pts.length - 1]);
              label(api, hs, Math.min(e[0] + 8, W - 44), e[1] + 6, deg(gh.deg), { bold: false, color: MUTED, size: 13 });
            });
            if (!pts.length) return;
            line(m, pts, '#f0c040', 3, 1);
            const e = pt(m, pts[pts.length - 1]), q = pt(m, pts[Math.max(0, pts.length - 3)]), hd = Math.atan2(e[1] - q[1], e[0] - q[0]) * 180 / Math.PI;
            api.svg('rect', { x: e[0] - 7, y: e[1] - 4.5, width: 14, height: 9, rx: 2, fill: '#b44fff', stroke: '#fff', 'stroke-width': 1, transform: 'rotate(' + hd + ',' + e[0] + ',' + e[1] + ')' }, hs);
            if (res) {
              const crash = res.reason === 'hit the wall', right = e[0] > W * 0.55;
              label(api, hs, right ? Math.min(e[0], W - 6) : Math.max(6, e[0] - 10), e[1] < m.YC - 20 ? e[1] + 26 : e[1] - 14, kid.dist(res.distance) + (crash ? ' — crash!' : ''),
                { anchor: right ? 'end' : 'start', color: crash ? RED : GREEN, size: m.wide ? 16 : 14 });
            }
          }
          function explain(r) {
            const a = r ? r.car.veerDeg : ang.get();
            if (!r) {
              const next = pr.get() == null ? ' Make a prediction first ↑ Then press ▶ Roll.' : ' Press ▶ Roll to test it.';
              say(api, out, a ? ['Front axle: ', [deg(a)], ' off square.' + next] : ['Both axles are ', ['square'], '.' + next]);
              return;
            }
            say(api, out, r.reason === 'hit the wall'
              ? [deg(a) + ' off: it went ', [kid.dist(r.distance)], ' down the hall. It drifted ' + kid.dist(r.trace[r.trace.length - 1].lateral) + ' sideways. Then it hit the wall! 🧱']
              : [(a ? deg(a) + ' off' : 'Square axles') + ': it rolled ', [kid.dist(r.distance)], ' straight down the hall. 🏁']);
          }
          function stop() { if (raf) cancelAnimationFrame(raf); raf = null; go.disabled = pr.get() == null; }
          go.addEventListener('click', function () {
            if (pr.get() == null) return;
            stop();
            pr.clear();
            const r = P.simulate({ veerDeg: ang.get() }), tr = r.trace, t0 = performance.now();
            const speedUp = Math.max(2, r.time / 8);         // long runs play faster, like the hallway simulator
            let i = 0;
            go.disabled = true;
            function frame(now) {
              if (!hs.isConnected) { raf = null; return; }
              const tt = (now - t0) / 1000 * speedUp;
              while (i < tr.length - 1 && tr[i + 1].t <= tt) i++;
              const done = i >= tr.length - 1;
              hall(tr.slice(0, i + 1), done ? r : null);
              if (!done) { raf = requestAnimationFrame(frame); return; }
              raf = null; go.disabled = pr.get() == null;
              ghosts.push({ deg: r.car.veerDeg, pts: tr });
              if (ghosts.length > 3) ghosts.shift();
              explain(r);
              const j = axleJudge(r, pr.get());
              pr.reveal(j.text, j.right, j.why);
              if (straightOK(r)) api.done('Square axles roll straight! At ' + deg(r.car.veerDeg) + ', your car rolled ' + kid.dist(r.distance) + '. ' +
                'Just 1° off hits the wall after about ' + kid.dist(WALL_AT(1)) + '. Even 0.5° off hits it after about ' + kid.dist(WALL_AT(0.5)) + '. ' +
                'So square your axles with a ruler.');
            }
            raf = requestAnimationFrame(frame);
          });
          // a pick (or a new angle wiping it) updates the "what to do next" line, unless a roll's result is showing
          pr.onChange(function () { if (!raf && !lastRes) explain(null); });
          api.onLeave(stop);
          keepFitted(api, el, function () { carTop(); hall(lastPts, lastRes); });
          carTop(); hall([], null); explain(null);
        }
      },
      {
        title: 'Real build: stable and straight',
        html:
          '<p>Five tricks for your real car:</p>' +
          '<ul><li><strong>Mount the sail low.</strong> Tape the bottom of the sail close to the chassis. Leave no big gap under it.</li>' +
          '<li><strong>Brace a tall mast.</strong> Twist pipe cleaners from the top of the mast to the back corners. They stop the mast from bending forward.</li>' +
          '<li><strong>Make the chassis longer.</strong> Hot-glue two popsicle sticks end to end, overlapping about 1 inch. ' +
          'Now the balance point is farther behind the front wheels.</li>' +
          '<li><strong>Add weight at the back, only if you need it.</strong> Tape a coin over the back axle. Every gram adds friction, so add just enough.</li>' +
          '<li><strong>Square the axles.</strong> Line up each straw with a ruler or the corner of a sheet of paper. Do it before the glue sets.</li></ul>' +
          '<p><strong>Test it:</strong></p>' +
          '<ol><li><strong>Finger test:</strong> balance the car on one finger. Mark that spot. It is the balance point. The farther back it is, the harder the car is to flip.</li>' +
          '<li><strong>Flip test:</strong> set the car at the start line. Turn both fans on high. Watch from the side, at floor level. ' +
          'Do the back wheels lift? Then lower the sail, use a longer chassis or add a coin at the back.</li>' +
          '<li><strong>Straight test:</strong> stick a long strip of tape on the floor. Give the car a gentle push along it. ' +
          'Does it curve away? Then an axle is crooked, or a wheel rubs. Fix it and test again.</li></ol>' +
          '<p><strong>Race day:</strong> start in the middle of the hall, in front of both fans. Point the car straight down the hall.</p>',
        job: 'Build your real car. Then do the 3 tests.',
        todo: ['Use the 5 tricks below on your car.', 'Do the finger test. Mark the balance point.', 'Do the flip test with both fans on.', 'Do the straight test along a tape line.'],
        render: function (el, api) {
          api.ui.note(el, 'build', '🛠️ <strong>Your materials:</strong> popsicle sticks, straws, paper and cardstock. Also pipe cleaners, plastic wheels, skewers or dowels, tape and hot glue. ' +
            'Add a few coins for weight. A nickel is 5 g. <strong>Change one thing at a time</strong>, then test again. That way you know which fix worked.');
        }
      }
    ],
    quiz: [
      // The options in each question are about the same length, so "pick the longest" is no clue: the right
      // answer is the single longest option in at most 3 of the 10 (and the single shortest in at most 3).
      { q: 'What is a car’s balance point?', options: ['The spot where it balances on a finger', 'The spot where the wind and weight balance', 'The spot where the wind pushes the sail', 'The heaviest part of the whole car'], answer: 0,
        why: 'At the balance point, the car balances on one finger. The car acts as if all its weight were right there.' },
      { q: 'You tape 3 nickels over the back axle. Where does the balance point go?', options: ['Up high, toward the top of the mast', 'Toward the front, to balance the nickels', 'Toward the back, closer to the nickels', 'It stays put, because coins are so small'], answer: 2,
        why: 'The balance point moves toward the heavy part. Weight at the back moves it back.' },
      { q: 'When the fans flip a sail car, which way does it go?', options: ['Backward, toward the fans', 'Forward, onto its nose', 'Up off the floor, like a kite', 'Left or right, onto one side'], answer: 1,
        why: 'The wind pushes high on the sail, away from the fans. So the car tips forward over its front wheels.' },
      { q: 'Why does a sail high on a tall mast make a car flip more easily?', options: ['A high sail makes the fans blow harder', 'A push up high has more turning power', 'A tall mast makes the car lighter', 'A high sail adds friction to the wheels'], answer: 1,
        why: 'The front wheels act like a hinge. Like a door, a push far from the hinge has more turning power.' },
      { q: 'Car A’s balance point is 2 in behind its front wheels. Car B’s is 4 in behind. Same sail, same weight. Which is harder to flip?',
        options: ['Car A, because its weight is up front', 'Car B, because its weight sits farther back', 'They tie, because both cars weigh the same', 'It depends on how hard the fans blow'], answer: 1,
        why: 'The farther back the balance point is, the better the weight holds the back down. So Car B is harder to flip.' },
      { q: 'Your car flips every time the fans turn on. Which change helps?', options: ['Tape a few coins on the very front', 'Move the sail higher up on the mast', 'Mount the sail lower, near the chassis', 'Use a shorter chassis, so it is lighter'], answer: 2,
        why: 'A lower sail has less turning power, so it tips the car less. The other changes make flipping worse.' },
      { q: 'Car A stopped flipping with 4 nickels on the back. Car B has the same sail. It stopped flipping with a lower sail instead. Which will probably roll farther?',
        options: ['Car A, because heavier cars keep rolling farther', 'Car B, because less weight means less friction', 'They tie, because both stay on their wheels', 'They tie, because weight does not matter'], answer: 1,
        why: 'Both cars stay on their wheels, but Car A is heavier. More weight means more friction, so Car B rolls farther.' },
      { q: 'In the simulator, a car’s front axle is turned 3° off square. What happens?', options: ['Nothing changes, since the turn is tiny', 'It turns once, then rolls straight', 'It curves away and hits a side wall', 'It zig-zags, so it rolls even farther'], answer: 2,
        why: 'It hits the wall after only about ' + kid.dist(WALL_AT(3)) + '. With square axles, the same car rolls about ' + kid.dist(STRAIGHT_RUN) + '.' },
      { q: 'What is the best way to make your axles square?', options: ['Time how long each wheel spins', 'Line each axle up with a paper corner', 'Look closely and line them up by eye', 'Glue each wheel on extra tight'], answer: 1,
        why: 'The corner of a sheet of paper is a perfect square corner. Line up each axle with it, then test with a gentle push.' },
      { q: 'At the start line, the back wheels of your car lift a little. What does that mean?', options: ['The car is starting to tip forward', 'The back wheels have too much friction', 'The front axle is crooked, so it tilts', 'The fans are blowing the car backward'], answer: 0,
        why: 'Tipping is beating holding down. Lower the sail, use a longer chassis or add weight at the back.' }
    ],
    // for the check script only: the module's own car builder, tug-of-war and challenge rules
    _calc: { makeCar: makeCar, turns: turns, fewestNickels: fewestNickels, compare: compare, verdict: verdict, isTie: isTie,
             TUG_MIN: TUG_MIN, tugScale: tugScale, pushScale: pushScale, pushVsWeight: pushVsWeight, F2MAX: F2MAX, MAXW2: MAXW2,
             fingerTest: fingerTest, FINGER_START: FINGER_START, CG0: CG0, BAL_TOL: BAL_TOL,
             flipCar: flipCar, FLIP_START: FLIP_START, FLIP_PREDICT: FLIP_PREDICT, flipJudge: flipJudge, MAX2: MAX2, MAXPUSH: MAXPUSH,
             tamed: tamed, longer: longer, BIG_START: BIG_START, HALL_GOAL: HALL_GOAL, GOAL_IS_END: GOAL_IS_END, GOAL3_TXT: GOAL3_TXT,
             BIG_BEST: BIG_BEST, BIG_WINNERS: BIG_WINNERS, ALL_THREE: ALL_THREE, MAX3: MAX3, SIDES: SIDES, GAPS: GAPS, BASES: BASES,
             GOAL_FT: GOAL_FT, START_DEG: START_DEG, straightOK: straightOK, AXLE_PREDICT: AXLE_PREDICT, axleJudge: axleJudge,
             WALL_AT: WALL_AT, STRAIGHT_RUN: STRAIGHT_RUN, MAP_M: MAP_M, ROOM: ROOM, HALL_W: HALL_W,
             SAIL_IN: SAIL_IN, CHASSIS_IN: CHASSIS_IN, CHASSIS_CM: CHASSIS_CM, MAX_SIDE_CM: MAX_SIDE_CM, S2: S2, FINGER: FINGER, BIG: BIG, BIG_TXT: BIG_TXT,
             pushPx: pushPx }
  });
})();
