// Sail Car Lab — Module 1: Forces & Motion
// The reference module: every other module follows this shape.
//   steps: lesson pages. A step can have static `html`, a `render(el, api)` function, or both.
//          A step with `challenge` keeps the Next button locked until the step calls api.done().
//   quiz:  a pool of questions; the lab draws 5 of them each try (4 right = 80% to pass).
//          `answer` is the index of the right option in `options`; `why` explains it.
// Written for 6th graders: short sentences, distances in FEET only (SailLab.kid.dist / kid.feet; inches under a foot), no formulas.
// Forces are NEVER numbers here: each force is an arrow whose LENGTH shows its size (one honest scale per
// picture, SailLab.draw.forceScale), with a word label, and the words COMPARE forces (SailLab.kid.compare).
// Every distance and every comparison a student reads is worked out from simulate().
(function () {
  'use strict';
  const P = SailLab.physics, kid = SailLab.kid;
  // The hallway's size lives ONLY in sailcar-core.js (SailLab.physics.HALL); every hallway number
  // below is worked out from it, so measuring the real hallway again needs no edit here.
  const HALL = P.HALL;
  // The hallway challenge: roll at least 40 ft. It is checked on the distance as the student sees it
  // (kid.ft rounds to whole feet), so "40 ft" on the readout always counts. That is 39.5 ft or more:
  const GOAL_FT = 40, GOAL_M = (GOAL_FT - 0.5) / kid.FT_PER_M;
  function reachesGoal(distM) { return kid.ft(distM) >= GOAL_FT; }
  // Fan speeds for the hallway step, in the physics' own units (High = the real fans, SailLab.physics.FAN.v0 at the grilles).
  // Students never see these numbers: the fan is Low, Medium or High.
  const FAN_V = { low: 1.8, med: 2.6, high: P.FAN.v0 };
  const FAN_OPTS = [{ value: 'low', label: 'Low' }, { value: 'med', label: 'Medium' }, { value: 'high', label: 'High' }];
  // Wheel stickiness (crr). Rubbing / OK / Spin freely mean the SAME numbers in Modules 1, 3 and 4
  // (OK = the lab's standard car, DEFAULT_CAR.crr), so a "Rubbing" car rolls the same distance everywhere.
  // Jammed is an extra, worse choice only here: on the Low fan its push is a little smaller than the most
  // its stuck wheels can hold back (STICKY × rolling friction), so the car never starts — friction matches
  // the push exactly: the "balanced, nothing moves" demo.
  const WHEELS = { jam: 0.13, rub: 0.07, ok: P.DEFAULT_CAR.crr, free: 0.012 };
  const WHEEL_OPTS = [{ value: 'jam', label: 'Jammed (rubbing hard)' }, { value: 'rub', label: 'Rubbing' }, { value: 'ok', label: 'OK' }, { value: 'free', label: 'Spin freely' }];
  // The hallway step starts on its first test: Low fan + Jammed wheels (0 ft: it never moves).
  const START = { fan: 'low', wheels: 'jam' };
  function hallOpts(fan) { return { fan: { v0: FAN_V[fan], L: P.FAN.L } }; }
  // Can any car on the hallway step catch up with the fading wind? (High fan + Spin freely does, from about 20 to 36 ft.)
  // The step's text says so only when simulate() agrees. The trace's last point is the "stopped" marker, so it is skipped.
  // DRAG_MAX = the biggest push back (drag) any of those runs ever feels: step 1 draws drag's dashed arrow that big.
  let CATCHES_UP = false, DRAG_MAX = 0;
  Object.keys(FAN_V).forEach(function (f) {
    Object.keys(WHEELS).forEach(function (w) {
      const tr = P.simulate({ crr: WHEELS[w] }, hallOpts(f)).trace;
      tr.forEach(function (p, i) {
        if (i >= tr.length - 1) return;
        if (p.v > p.wind) CATCHES_UP = true;
        DRAG_MAX = Math.max(DRAG_MAX, -(p.thrust + p.body));
      });
    });
  });
  // A typical car (DEFAULT_CAR), for step 1's picture: its weight (gravity), and the wind's push and friction at the fans.
  const TYPICAL = P.simulate({}, {});
  const WEIGHT_N = P.DEFAULT_CAR.mass * P.G;
  // the colours every force has in this module (the hallway simulator uses the same green and orange)
  const GREEN = '#40e080', ORANGE = '#ffa040', RED = '#ff5050', BLUE = '#7ad7ff', PURPLE = '#c0a0ff';

  // Step 2 (balanced or unbalanced?): two force sliders in STEPS equal steps, from none to the biggest.
  // The challenge: the two arrows the same length, with the push slider at least halfway (so 0 = 0 never counts).
  const STEPS = 10, HALF = STEPS / 2;
  const BAL_START = { push: 8, friction: 2 };          // the teacher's picture: a long push arrow, a short friction arrow
  function balanceDone(p, b) { return p === b && p >= HALF; }

  // PREDICT FIRST (hallway step): what will the car do with the fan and wheels picked?
  const PREDICT = {
    question: 'What will your car do with this fan and these wheels?',
    choices: [{ value: 'still', label: 'It won’t move at all' },
              { value: 'short', label: 'It will roll, but less than ' + GOAL_FT + ' ft' },
              { value: 'far', label: 'It will roll ' + GOAL_FT + ' ft or more' }]
  };
  function outcome(r) { return r.reason === 'never moved' ? 'still' : reachesGoal(r.distance) ? 'far' : 'short'; }
  // Which fan and wheels a run used (the run keeps its car and options). A "far" answer names BOTH causes:
  // OK wheels go far only on the High fan (53 ft) — on Medium (35 ft) friction wins — so the fan gets the credit too.
  function fanOf(r) { return Object.keys(FAN_V).find(function (f) { return FAN_V[f] === r.opts.fan.v0; }); }
  function wheelsOf(r) { return Object.keys(WHEELS).find(function (w) { return WHEELS[w] === r.car.crr; }); }
  const FAN_PUSH = { high: 'The High fan gave a strong push.', med: 'The Medium fan gave a good push.', low: 'The Low fan gave a gentle push.' };
  const WHEEL_FRICTION = { free: 'These wheels spin freely, so friction is very small.', ok: 'These wheels have some friction, but not much.' };
  // the answer shown after a run: { text, right, why } — every distance and comparison comes from this run.
  // A still car: the wind's push vs the most its wheels can hold back (STICKY × rolling friction), in kid.compare
  // words (Low + Jammed: "a little smaller"). No ratio: the run draws no arrows to check it against.
  function judge(r, v) {
    const got = outcome(r), end = r.reason === 'reached the end of the hall';
    const text = got === 'still' ? 'The car did not move.'
               : end ? 'The car rolled all ' + kid.dist(r.distance) + ' to the end of the hall!'
               : 'The car rolled ' + kid.dist(r.distance) + '.';
    const why = got === 'still'
      ? 'The push was ' + kid.compare(r.startPush, r.friction * P.STICKY, { noun: 'what these wheels can hold back', times: false }) + '. ' +
        'So friction pushed back just as hard as the wind. The forces were balanced, so the car stayed still.'
      : got === 'short'
      ? 'The push beat friction near the fans, so the car sped up. Down the hall the wind faded. ' +
        'Friction won, so the car slowed down and stopped.'
      : (FAN_PUSH[fanOf(r)] || 'The fan gave a strong push.') + ' It beat friction near the fans, so the car sped up. ' +
        (WHEEL_FRICTION[wheelsOf(r)] ? WHEEL_FRICTION[wheelsOf(r)] + ' ' : '') +
        'So the car slowed down only a little at a time.' + (end ? ' It was still rolling at the end!' : ' It rolled a long way.');
    return { text: text, right: got === v, why: why };
  }

  // The pictures are drawn at their real on-screen width (260–560 px) and shown 1 : 1, so a 13 px
  // label is 13 px on a phone too (a fixed 560-wide drawing shrank the labels to about 6 px there).
  function boardWidth(el) { return Math.max(260, Math.min(560, Math.round(el.clientWidth || 560))); }
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
  function label(api, s, x, y, str, color, o) {
    o = o || {};
    return api.svg('text', { x: x, y: y, 'text-anchor': o.anchor || 'middle', fill: color, 'font-size': o.size || 15,
                             'font-weight': o.light ? 400 : 700, class: 'sl-lbl' }, s, str);
  }
  // a label's width on screen (measured; a rough guess if the browser can't measure it yet)
  function textW(t) {
    try { const w = t.getComputedTextLength(); if (w > 0) return w; } catch (e) { /* not measurable */ }
    return t.textContent.length * (parseFloat(t.getAttribute('font-size')) || 15) * 0.62;
  }
  function place(t, x, y) { t.setAttribute('x', Math.round(x)); t.setAttribute('y', Math.round(y)); return t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  // repaint once the page's font has loaded (labels are measured, and the font changes their width)
  function afterFonts(el, paint) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (el.isConnected) paint(); });
  }
  // a "Word to know" box at the very top of the step (above the step's html)
  function wordFirst(api, el, term, meaningHtml) {
    const box = api.ui.word(el, term, meaningHtml);
    el.insertBefore(box, el.firstChild);
    return box;
  }

  SailLab.register({
    id: 'forces',
    num: 1,
    title: 'Forces & Motion',
    icon: '⚖️',
    blurb: 'Pushes and pulls. Why does a car speed up, slow down or stay still?',
    minutes: 10,
    steps: [
      {
        title: 'Forces are pushes and pulls',
        job: 'Find the four forces on the sail car.',
        todo: ['Look at the arrows on the car.', 'Find THRUST, FRICTION, GRAVITY and FLOOR.', 'Find the short dashed DRAG arrow.',
               'Remember: a longer arrow means a bigger force.'],
        html:
          '<p>Scientists measure force in units called <strong>newtons</strong>. ' +
          'In this lab we compare forces with arrows: <strong>a longer arrow means a bigger force</strong>.</p>' +
          '<p>In front of the fans, <strong>four forces</strong> act on your car at once. ' +
          'A fifth one joins in only if the car goes faster than the wind.</p>',
        render: function (el, api) {
          wordFirst(api, el, 'force', 'a push or a pull.');
          // ONE honest scale for every arrow here (draw.forceScale): gravity, the biggest force, is the longest arrow,
          // and the floor's push is exactly as long. The wind's push (about half of gravity) is to scale. Friction and
          // the tiny drag are drawn a little too LONG so they can be seen (never too short), so no ratio with them is
          // claimed anywhere on this step ("much bigger than friction").
          const s = api.svg('svg', { role: 'img', 'aria-label': 'A sail car in front of two box fans, with an arrow for each force. A longer arrow is a bigger force. ' +
            'Gravity pulls down and the floor pushes up. Their arrows are the same length. ' +
            'The wind’s push on the sail is ' + kid.compare(TYPICAL.startPush, WEIGHT_N, { noun: 'gravity' }) + '. ' +
            'It is ' + kid.compare(TYPICAL.startPush, TYPICAL.friction, { noun: 'friction', times: false }) + ' at the wheels. ' +
            'A short dashed arrow shows drag. It pushes back only if the car is faster than the wind.' }, el);
          function paint() {
            const W = boardWidth(el), tiny = W < 290, narrow = W < 440;
            const sc = tiny ? 2.3 : narrow ? 2.6 : 3.6, len = 30 * sc, r = 3 * sc, SAIL = 20, MAST = 30;
            const fanSize = tiny ? 80 : 96, fanR = 10 + fanSize * 0.32;
            const flen = api.draw.forceScale(WEIGHT_N, 100, { min: 18 });
            const gL = flen(WEIGHT_N), tL = flen(TYPICAL.startPush), frL = flen(TYPICAL.friction), dL = flen(Math.max(DRAG_MAX, 1e-6));
            // gravity's arrow (or the mast) is the tallest thing; the floor's arrow hangs below the floor
            const deckY = Math.round(12 + Math.max(gL, MAST * sc)), FL = deckY + 2 * r + sc, H = Math.round(FL + 5 + gL + 12);
            startBoard(api, s, W, H);
            api.svg('line', { x1: 12, y1: FL, x2: W - 12, y2: FL, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            const fan = api.draw.fan(s, 10, FL, fanSize);
            const fanTxt = fan.querySelector('text');
            if (fanTxt) { fanTxt.setAttribute('font-size', 13); fanTxt.setAttribute('y', FL + 18); }
            // the words first: they are measured, so the car goes where every word fits (one word per arrow, no numbers)
            const tT = label(api, s, 0, 0, 'THRUST', GREEN, { size: tiny ? 14 : 16 });
            const dT = label(api, s, 0, 0, 'DRAG', RED, { size: 16, anchor: 'start' });
            const dLines = (narrow ? ['only if the car', 'outruns the wind'] : ['only if the car outruns the wind'])
              .map(function (str) { return label(api, s, 0, 0, str, '#ff8080', { size: 13, light: true, anchor: 'start' }); });
            const gT = label(api, s, 0, 0, 'GRAVITY', BLUE, { size: tiny ? 13 : 15, anchor: 'start' });
            const fT = label(api, s, 0, 0, 'FRICTION', ORANGE, { size: tiny ? 13 : 15 });
            const flT = label(api, s, 0, 0, 'FLOOR', PURPLE, { anchor: 'start' });
            const fl2T = label(api, s, 0, 0, 'pushes up', PURPLE, { size: 13, light: true, anchor: 'start' });
            const wT = textW(tT), wD = Math.max.apply(null, [dT].concat(dLines).map(textW));
            // the car: THRUST's arrow and word fit between the fans and the sail; the drag words fit right of the car
            const sailOff = len * 0.45 - SAIL * sc * 0.45;          // the car's back end → the sail's back edge
            const carMin = fanR + Math.max(wT + 8, tL + 9) - sailOff, carMax = W - 8 - wD - len;
            const carX = Math.round(Math.max(carMin, Math.min(W * 0.36, carMax)));
            const front = carX + len, mastX = carX + len * 0.45, sailL = mastX - SAIL * sc * 0.45, midY = Math.round(deckY - 18 * sc);
            // the fans' wind on its way to the sail: faint dashed streaks (not forces: no arrowheads)
            const tail = sailL - 3 - tL;
            [[midY, fanR + 8, tail - 8], [midY + 16, fanR + 8, sailL - 6], [midY + 32, fanR + 8, sailL - 6]].forEach(function (w) {
              if (w[2] - w[1] >= 14) api.svg('line', { x1: w[1], y1: w[0], x2: w[2], y2: w[0], stroke: '#9fb4d8', 'stroke-width': 1.5, opacity: 0.45, 'stroke-dasharray': '10 6', 'stroke-linecap': 'round' }, s);
            });
            api.draw.car(s, carX, FL, { scale: sc, length: 30, sailW: SAIL, sailH: 20, mastH: MAST });
            // THRUST: the fans' wind pushes the sail forward
            api.draw.arrow(s, tail, midY, sailL - 3, midY, GREEN, '');
            place(tT, clamp(sailL - 3 - tL / 2, fanR + 4 + wT / 2, sailL - 4 - wT / 2), midY - 12);
            // GRAVITY pulls down on the car; the FLOOR pushes up just as hard: the same length, the other way
            const gx = Math.round(carX + len * 0.8);
            api.draw.arrow(s, gx, deckY - gL, gx, deckY, BLUE, '');
            place(gT, gx + 9, deckY - gL + 14);
            api.draw.arrow(s, gx, FL + 5 + gL, gx, FL + 5, PURPLE, '');
            place(flT, gx + 10, FL + 5 + gL / 2);
            place(fl2T, gx + 10, FL + 5 + gL / 2 + 17);
            // FRICTION at the wheels pushes back (its word sits under the floor, clear of the fans' word)
            api.draw.arrow(s, carX - 3, FL - 6, carX - 3 - frL, FL - 6, ORANGE, '');
            const fanWordEnd = fanTxt ? 10 + fanSize * 0.16 + textW(fanTxt) / 2 : fanR;
            place(fT, Math.max(carX - 3 - frL / 2, fanWordEnd + 8 + textW(fT) / 2), FL + 21);
            // DRAG (dashed and short): the air pushes back only if the car outruns the wind, and then only a tiny bit
            const dTip = front + r * 0.4 + 2, dY = Math.round(deckY + sc);
            const drag = api.draw.arrow(s, dTip + dL, dY, dTip, dY, RED, '', { head: 6, width: 3 });
            const dl = drag.querySelector('line');
            if (dl) dl.setAttribute('stroke-dasharray', '4 3');
            let y = deckY - 12;
            for (let i = dLines.length - 1; i >= 0; i--) { place(dLines[i], front + 2, y); y -= 16; }
            place(dT, front + 2, y);
            // the words on top of every line and arrow
            [tT, dT, gT, fT, flT, fl2T].concat(dLines).forEach(function (t) { s.appendChild(t); });
          }
          paint();
          keepFitted(api, el, paint);
          afterFonts(el, paint);
          // one short line per force (Module 3 covers outrunning the wind)
          api.ui.note(el, 'tip',
            '<ul style="margin:0 0 0 18px">' +
            '<li>🟢 <strong>Thrust:</strong> the wind pushes the sail forward. Near the fans, the push is ' +
              kid.compare(TYPICAL.startPush, TYPICAL.friction, { noun: 'friction', times: false }) + '.</li>' +
            '<li>🟠 <strong>Friction:</strong> rubbing at the wheels holds the car back.</li>' +
            '<li>🔵 <strong>Gravity</strong> pulls down. That pull is the car’s <strong>weight</strong>. ' +
              '🟣 The <strong>floor</strong> pushes up just as hard. ' +
              'Their arrows are the same length, so they cancel out.</li>' +
            '<li>🔴 <strong>Drag:</strong> air pushing <em>back</em>, only if the car outruns the wind.</li></ul>');
        }
      },
      {
        title: 'Balanced or unbalanced?',
        html:
          '<p>Forces that point opposite ways work against each other. It is like a tug of war!</p>' +
          '<p><strong>Balanced:</strong> the motion stays the same. A still car stays still. A rolling car keeps the same speed.</p>' +
          '<p><strong>Unbalanced:</strong> one force is bigger, so it wins. The car speeds up or slows down.</p>',
        // the challenge says what balanceDone() checks: equal arrows (p === b), both sliders at least halfway (p >= HALF)
        challenge: 'Make both arrows the same length, with sliders halfway or more.',
        todo: ['Slide Friction (pushes back) to the right.', 'Watch the friction arrow get longer.', 'Stop when both arrows are the same length.'],
        render: function (el, api) {
          wordFirst(api, el, 'balanced forces', 'forces that are the same size but push opposite ways. They cancel out. ' +
            'If one force is bigger, the forces are <strong>unbalanced</strong>.');
          const s = api.svg('svg', { role: 'img', 'aria-label': 'Tug of war between the wind’s push and friction' }, el);
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          // FORCE sliders: no numbers. Each shows a little arrow (ui.slider's bar) and words at its two ends.
          // STEPS equal steps, so the two arrows can be made exactly the same length.
          const push = api.ui.slider(row, { label: 'Wind’s push (thrust)', min: 0, max: STEPS, step: 1, value: BAL_START.push,
            bar: { color: GREEN }, ends: ['no push', 'big push'], valueText: function (v) { return amount(v, 'push'); }, onInput: draw });
          const back = api.ui.slider(row, { label: 'Friction (pushes back)', min: 0, max: STEPS, step: 1, value: BAL_START.friction,
            bar: { color: ORANGE }, ends: ['no friction', 'lots of friction'], valueText: function (v) { return amount(v, 'friction'); }, onInput: draw });
          // friction pushes BACK: its slider arrow points left, like the friction arrow in the picture (only turned: same length)
          const backBar = back.input.parentNode.querySelector('.sl-vbar');
          if (backBar) backBar.style.transform = 'scaleX(-1)';
          el.appendChild(out);
          api.ui.note(el, 'tip', '📜 Isaac Newton figured this out over 300 years ago. We call it <strong>Newton’s First Law</strong>. ' +
            'Things keep doing what they are doing until an unbalanced force acts on them.');
          // the sliders' little arrows use this rule (the same one ui.slider uses), so a ratio is said only when
          // the picture AND both slider arrows show it to scale (a 1-step arrow is drawn a bit too long)
          const barLen = api.draw.forceScale(STEPS, 110, { min: 10, over: 0 });
          function draw() {
            const p = push.get(), b = back.get(), net = p - b;
            const W = boardWidth(el), H = 190, FL = 160, mid = W / 2;
            startBoard(api, s, W, H);
            api.svg('line', { x1: 12, y1: FL, x2: W - 12, y2: FL, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            const sc = W < 440 ? 2.2 : 3, len = 26 * sc, carX = Math.round(mid - len / 2), front = carX + len;
            api.draw.car(s, carX, FL, { scale: sc, length: 26, sailW: 18, sailH: 18, mastH: 26 });
            // ONE honest scale for the push, friction and "wins" arrows: the biggest setting just fits beside the car
            const flen = api.draw.forceScale(STEPS, carX - 18, { min: 6, over: 0 });
            const sailL = carX + len * 0.45 - 18 * sc * 0.45, sailY = Math.round(FL - 22 * sc);
            if (p > 0) {
              api.draw.arrow(s, sailL - 2 - flen(p), sailY, sailL - 2, sailY, GREEN, '');
              const t = label(api, s, 0, 0, 'push', GREEN);
              place(t, Math.min(sailL - 2 - flen(p) / 2, sailL - 6 - textW(t) / 2), sailY - 11);   // a short arrow's word stays clear of the sail
            }
            if (b > 0) api.draw.arrow(s, front + 2 + flen(b), FL - 10, front + 2, FL - 10, ORANGE, 'friction', { size: 15, dy: 24 });
            if (net !== 0) {
              const color = net > 0 ? GREEN : ORANGE, end = mid + (net > 0 ? 1 : -1) * flen(Math.abs(net));
              const t = label(api, s, 0, 0, net > 0 ? 'push wins' : 'friction wins', color), half = textW(t) / 2 + 4;
              api.draw.arrow(s, mid, 42, end, 42, color, '');
              place(t, clamp((mid + end) / 2, half, W - half), 30);   // the word stays inside the picture
            } else label(api, s, mid, 46, 'balanced ⚖️', '#f0c040', { size: 16 });
            // the words: which force wins, and how the two compare (kid.compare: exact, so "the same" only when equal)
            const times = flen.toScale(p) && flen.toScale(b) && barLen.toScale(p) && barLen.toScale(b);
            const hint = p < HALF ? ' <em>For the challenge, keep the push slider at least halfway across.</em>' : '';
            out.innerHTML = net === 0
              ? '⚖️ <strong>Balanced!</strong> ' + (p === 0 ? 'There are no forces at all, so nothing changes.'
                  : 'The two arrows are the same length. The car keeps doing what it was doing. If it was still, it stays still.') + hint
              : net > 0
              ? '➡️ <strong>Unbalanced!</strong> ' + (b === 0 ? 'There is no friction at all.'
                  : 'The push is ' + kid.compare(p, b, { exact: true, noun: 'friction', times: times }) + '.') +
                ' The push wins, so the car <strong>speeds up</strong>.'
              : '⬅️ <strong>Unbalanced!</strong> ' + (p === 0 ? 'There is no push at all.'
                  : 'Friction is ' + kid.compare(b, p, { exact: true, noun: 'the push', times: times }) + '.') +
                ' Friction wins. A rolling car <strong>slows down</strong>. A still car just stays still. (Friction can’t push a car backward.)';
            s.setAttribute('aria-label', 'Tug of war between the wind’s push and friction. ' +
              (net === 0 ? (p === 0 ? 'There are no arrows.' : 'The two arrows are the same length.')
                         : net > 0 ? 'The push arrow is longer.' : 'The friction arrow is longer.'));
            if (balanceDone(p, b)) api.done('Balanced forces! The arrows are the same length, so the motion does not change. That is Newton’s First Law.');
          }
          // what a screen reader says for a slider (no numbers): none, a little, some, a lot, the most
          function amount(v, noun) {
            return v <= 0 ? 'no ' + noun : v >= STEPS ? 'the most ' + noun : v < 4 ? 'a little ' + noun : v < 7 ? 'some ' + noun : 'a lot of ' + noun;
          }
          draw();
          keepFitted(api, el, draw);
          afterFonts(el, draw);
        }
      },
      {
        title: 'Try it in the hallway',
        html:
          '<p>This hallway is ' + kid.dist(HALL.length) + ' long, like ours. Two box fans sit side by side at the start.</p>' +
          '<p>The car starts rolling only if the wind’s push beats friction. The wind fades as it spreads down the hall. ' +
          'When friction wins, the car slows down and stops.</p>' +
          '<p>Your first test is set up: the <strong>Low</strong> fan and <strong>Jammed</strong> wheels.</p>',
        // the challenge says what onResult checks: the run went at least GOAL_FT (reachesGoal); the start (Low + Jammed) never moves
        challenge: 'Make the car roll at least ' + kid.feet(GOAL_FT) + '.',
        todo: ['Pick a Fan speed and Wheels.', 'Answer the Predict first question.', 'Press ▶ Run and watch the car.',
               'Try new settings until it rolls ' + kid.feet(GOAL_FT) + '.'],
        render: function (el, api) {
          // the lab's first "Predict first" card: the word is taught at the top of the step, before the step text
          // uses it ("Make a prediction"), like steps 1 and 2 (the Studio only reminds)
          wordFirst(api, el, 'prediction', 'your best guess about what will happen. You make it <em>before</em> you test.');
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const fan = api.ui.choice(row, { label: 'Fan speed', value: START.fan, options: FAN_OPTS, onChange: changed });
          const fric = api.ui.choice(row, { label: 'Wheels', value: START.wheels, options: WHEEL_OPTS, onChange: changed });
          const guess = api.ui.predict(el, { question: PREDICT.question, choices: PREDICT.choices, judge: judge });
          // a guess is about ONE fan + wheels: new settings need a new guess
          let picked = START.fan + '+' + START.wheels;
          function changed() {
            const now = fan.get() + '+' + fric.get();
            if (now !== picked) { picked = now; guess.reset(); }
          }
          const sim = api.ui.trackSim(el, function () { return { crr: WHEELS[fric.get()] }; }, {
            getOpts: function () { return hallOpts(fan.get()); },
            scaleM: HALL.length,
            needPrediction: guess,
            onResult: function (r) {
              if (!reachesGoal(r.distance)) return;
              if (r.reason === 'reached the end of the hall') {
                // it was still rolling: the same run in a much longer hall shows how far it would have gone
                const longer = P.simulate(r.car, Object.assign({}, r.opts, { hallLength: 1000 })).distance;
                api.done('It reached the end of the hall and was still rolling! In a longer hall it would go about ' + kid.dist(longer) + '. ' +
                  'A stronger push and less friction let the wind carry the car much farther.');
              } else {
                api.done('It rolled ' + kid.dist(r.distance) + '! A stronger push and less friction let the wind carry the car much farther.');
              }
            }
          });
          api.onLeave(sim.stop);
          // (the hallway's arrows share one honest scale: a longer arrow is always the bigger force. Far from the fans
          // both are short, and friction wins by only a little: the check script measures both on every run.)
          api.ui.note(el, 'tip', '👀 Watch the arrows on the car. <span style="color:#40e080">Green</span> is the wind’s push. ' +
            '<span style="color:#ffa040">Orange</span> is friction. When green is longer, the car speeds up. When orange is longer, it slows down. ' +
            'Far from the fans, both arrows are short. So the car slows down only a little at a time.' +
            // (no promise about a drag arrow: whether the core's hallway scale draws a drag this tiny is the core's choice. The words under the hallway are
            // the core's own readout, which says "faster than the wind!" only while the air pushes back: the check script
            // replays every run and watches the real readout.)
            (CATCHES_UP ? ' Sometimes the car rolls faster than the wind. Then the words under the hallway say <em>faster than the wind!</em> ' +
                          'Now the air pushes back on the car. That push back is drag.' : ''));
        }
      },
      {
        title: 'Real build: test your forces',
        job: 'Test your real car. Do the 3 tests.',
        todo: ['Do the Push test on the hallway floor.', 'Do the Blow test on the sail.', 'Do the Hold test by the fans.'],
        html:
          '<p>You can feel these forces with your real car before race day.</p>' +
          '<ol><li><strong>Push test (friction):</strong> give the car a gentle push on the hallway floor. Let go. ' +
          'The farther it rolls, the less friction it has. If it stops fast, check the wheels. They should spin freely and not rub.</li>' +
          '<li><strong>Blow test (thrust):</strong> blow gently on the sail from behind. Does the car start rolling? ' +
          'Then it will start easily in front of the fans.</li>' +
          '<li><strong>Hold test (balance):</strong> hold the car lightly in front of the fans. Feel which way it wants to go. ' +
          'Does the front dip? Does it pull to one side?</li></ol>',
        render: function (el, api) {
          // wheels that spin freely vs a sled sliding on the tile, for the same car (crr vs SLED_FRICTION): "much smaller"
          api.ui.note(el, 'good', '🏁 Last year’s sail sleds slid about ' + kid.feet(25) + '. The best one went ' + kid.feet(30) + '. ' +
            'With wheels that spin freely, friction is ' + kid.compare(WHEELS.free, P.SLED_FRICTION, { noun: 'when a sled slides', times: false }) + '. ' +
            'So your car can beat that!');
          api.ui.note(el, 'build', '🛠️ <strong>Your materials:</strong> popsicle sticks, straws, paper, pipe cleaners and cardstock. ' +
            'Also plastic wheels, skewers or thin dowels, tape and hot glue. Every module ends with tips for using them well.');
        }
      }
    ],
    quiz: [
      // The options in each question are about the same length, so "pick the longest" is no clue: the right
      // answer is the single longest option in at most 3 of the 10 (the check script counts it).
      { q: 'What is a force?', options: ['A push or a pull on something', 'How fast something is moving', 'How big something is', 'The energy that moving air has'], answer: 0,
        why: 'A force is any push or pull.',
        whyNot: ['', 'Speed tells how fast it moves. A force is a push or a pull.', 'Size tells how big it is. A force is a push or a pull.', 'Moving air can make a force. But a force itself is a push or a pull.'] },
      { q: 'Your car’s push arrow is much longer than its friction arrow. What does the car do?', options: ['It keeps speeding up', 'It slows down bit by bit', 'It keeps the same speed', 'It stops right away'], answer: 0,
        why: 'The push is bigger than friction, so the forces are unbalanced. The car speeds up.',
        whyNot: ['', 'Slowing down needs friction to be bigger than the push. Here the push is bigger.', 'Keeping the same speed needs balanced forces. Here the push is bigger.', 'The car does not stop. A bigger push makes it go faster.'] },
      { q: 'The forces on a rolling car are balanced. What happens?', options: ['It keeps speeding up', 'It slows down bit by bit', 'It keeps the same speed', 'It stops right away'], answer: 2,
        why: 'Balanced forces cancel out. The car keeps doing what it was doing.',
        whyNot: ['Speeding up needs a bigger push. Balanced forces cancel out.', 'Slowing down needs friction to be bigger. Balanced forces cancel out.', '', 'Balanced forces do not stop a car. It keeps doing what it was doing.'] },
      { q: 'The fans are on, but the car does not move at all. What is the most likely reason?', options: ['Gravity pulls harder than the floor pushes', 'The wind’s push can’t beat friction', 'The wind only pushes rolling cars', 'The forces on it are unbalanced'], answer: 1,
        why: 'A car only starts rolling when the push beats friction. Weak wind or jammed wheels mean no motion.',
        whyNot: ['Gravity and the floor are balanced, so that would not stop the car.', '', 'The wind pushes a still car too. The push just is not big enough.', 'If the push were bigger than friction, the car would move. This car is not moving.'] },
      { q: 'A car sits still on the floor. Which two forces are balanced?', options: ['Thrust and the air that pushes back', 'The wind’s push and friction', 'Gravity and the floor pushing up', 'Drag and friction at the wheels'], answer: 2,
        why: 'Gravity pulls the car down. The floor pushes up just as hard.',
        whyNot: ['A still car is not rolling, so no air pushes back on it.', 'Those only matter when wind is pushing. A car sitting on the floor always has gravity and the floor balanced.', '', 'Drag is air pushing back on a fast car. A still car has no drag.'] },
      { q: 'A car is rolling when the fans turn off. What happens next?', options: ['It stops the moment the fans turn off', 'It slows down bit by bit, then stops', 'It keeps rolling forever at the same speed', 'It rolls back toward the fans'], answer: 1,
        why: 'Friction and air drag push back on the moving car. They slow it down bit by bit.',
        whyNot: ['Friction slows the car bit by bit. It does not stop it right away.', '', 'Friction and drag keep pushing back. The car cannot keep going forever.', 'Friction only slows the car down. It never pulls it back toward the fans.'] },
      { q: 'Newton’s First Law says a moving thing keeps the same speed…', options: ['forever, no matter what happens to it', 'until an unbalanced force acts on it', 'only if it is very big and heavy', 'only while it is being pushed'], answer: 1,
        why: 'Motion only changes when an unbalanced force acts. For a rolling car, that force is usually friction.',
        whyNot: ['An unbalanced force can change the speed. So it does not last forever.', '', 'Size and weight do not matter. Any moving thing keeps its speed.', 'A moving thing keeps going with no push. It only changes if a force acts.'] },
      { q: 'In this lab’s force pictures, what does a longer arrow mean?', options: ['It shows a faster car', 'It shows a bigger force', 'The push lasts longer', 'It shows a heavier car'], answer: 1,
        why: 'An arrow’s length shows how big the force is. A longer arrow means a bigger force.',
        whyNot: ['Arrow length shows force size. It does not show how fast the car goes.', '', 'Arrow length shows how big a force is. It does not show time.', 'Arrow length shows the force. It does not show how heavy the car is.'] },
      { q: 'The fans stay on, but far down the hall your car slows down and stops. Why?', options: ['The wind fades, so friction wins', 'Gravity is stronger at the far end', 'The car gets heavier the farther it goes', 'Moving things always stop on their own'], answer: 0,
        why: 'The wind is strongest near the fans and fades down the hall. Once its push is smaller than friction, the car slows down.',
        whyNot: ['', 'Gravity is the same all down the hall. The wind fading is what changes.', 'The car does not get heavier. It stays the same all the way.', 'Things only stop when a force like friction slows them. Friction wins here.'] },
      { q: 'Which change would most likely make your car roll farther?', options: ['More push and wheels that spin freely', 'A weaker fan and wheels that rub badly', 'Wheels that rub, so they grip the floor', 'Nothing, because all cars roll the same'], answer: 0,
        why: 'More push makes the car speed up more. Less friction lets the wind keep it rolling longer.',
        whyNot: ['', 'A weaker fan means less push. Bad wheels mean more friction. The car stops sooner.', 'Rubbing wheels have more friction. That slows the car and stops it sooner.', 'Cars do not all roll the same. Push and friction change how far they go.'] }
    ],
    // the steps' settings, for the node check script (not used by the page)
    _model: { GOAL_FT: GOAL_FT, GOAL_M: GOAL_M, FAN_V: FAN_V, WHEELS: WHEELS, START: START, CATCHES_UP: CATCHES_UP,
              PREDICT: PREDICT, judge: judge, outcome: outcome, reachesGoal: reachesGoal, fanOf: fanOf, wheelsOf: wheelsOf,
              TYPICAL: TYPICAL, WEIGHT_N: WEIGHT_N, DRAG_MAX: DRAG_MAX,
              BALANCE: { STEPS: STEPS, HALF: HALF, START: BAL_START, done: balanceDone } }
  });
})();
