// Sail Car Lab — Module 3: Drag (written for 6th graders)
// Air pushes back on anything that moves through it. The big idea: the sail only feels how much faster the
// wind is than the car. If the car is FASTER than the wind, the air hits the sail from the front and the sail
// becomes a parachute. Every force here comes from SailLab.physics.airForce and every run from simulate(),
// the same model the hallway and Design Studio use. Students never see a force as a number: a force is an arrow
// or bar whose LENGTH shows its size (draw.forceScale: ONE honest scale per picture, so a bigger force is never
// drawn shorter), and the words COMPARE two forces with the lab's shared vocabulary (kid.compare). A sentence
// states a ratio only when both forces are drawn to scale beside it. Distances are feet then metres (kid.dist);
// speeds are ft per second or words (kid.ftPerSec / kid.speed).
(function () {
  'use strict';
  const P = SailLab.physics, KID = SailLab.kid, HALL = P.HALL, C = P.DEFAULT_CAR;
  const FT = KID.FT_PER_M;
  function fps(f) { return f / FT; }                           // whole ft per second → the model's units
  // car bodies seen from the front (cd = how hard the shape hits the air). The lab's default body is the flat box.
  const SHAPES = [
    { name: 'Flat box front', cd: C.bodyCd, kind: 'flat' },
    { name: 'Pointed wedge', cd: 0.6, kind: 'wedge' },
    { name: 'Rounded nose', cd: 0.5, kind: 'round' }
  ];
  const FRONTS = [0.0015, 0.003, 0.006];                        // step 2's front sizes: 15, 30 and 60 square cm
  // The hallway's size lives ONLY in sailcar-core.js (SailLab.physics.HALL). Every hallway number and every
  // simulator result quoted below is worked out from it and from simulate().
  const END = 'reached the end of the hall';                    // simulate()'s reason when a car rolls the whole hallway
  // wheels: Rubbing, OK (the standard car) and Spin freely mean the SAME stickiness (crr) in Modules 1, 3 and 4
  const CRR = { rub: 0.07, ok: C.crr, free: 0.012 };
  const WHEEL_NAME = { rub: 'rubbing wheels', ok: 'OK wheels', free: 'wheels that spin freely' };
  const HALL_TXT = KID.dist(HALL.length);                       // "70 ft (21 m)"
  function longRun(car, opts) { return P.simulate(car, Object.assign({}, opts, { hallLength: 1000 })); }
  const STD = P.simulate({});                                   // the typical 70 g car: 53 ft, then it coasts to a stop
  const START = STD.opts.startX;                                // simulate() starts every car 30 cm in front of the fans
  const FREE = P.simulate({ crr: CRR.free });                   // …the same car with wheels that spin freely
  const FREE_TXT = FREE.reason === END
    ? 'Wheels that spin freely matter much more. They carry the same car to the end of our ' + HALL_TXT + ' hall!'
    : 'Wheels that spin freely matter much more. They carry the same car about ' + KID.dist(FREE.distance - STD.distance) + ' farther!';
  // the most any body shape and front size from step 2 changes the typical car's run, rounded UP to whole feet
  const BODY_FT = (function () {
    let worst = 0;
    SHAPES.forEach(function (sh) { FRONTS.forEach(function (a) { worst = Math.max(worst, Math.abs(P.simulate({ bodyArea: a, bodyCd: sh.cd }).distance - STD.distance)); }); });
    return Math.ceil(worst * FT);
  })();
  const BODY_TXT = 'A typical car rolls ' + KID.dist(STD.distance) + '. Changing its body’s shape or size changes that by less than ' + KID.dist(BODY_FT / FT) + '.';
  const SMALL_SAIL = P.simulate({ sailArea: 0.01 });           // the typical car with a 10 × 10 cm sail
  // step 4's cars, and the fastest any of them goes (step 2 runs its bodies at about that speed)
  const MASS = { 50: 0.05, 70: 0.07, 100: 0.1 };
  const FASTEST = (function () {
    let top = 0;
    Object.keys(MASS).forEach(function (g) { Object.keys(CRR).forEach(function (w) { top = Math.max(top, P.simulate({ mass: MASS[g], crr: CRR[w] }).topSpeed); }); });
    return top;
  })();
  const BODY_F = 6;                                             // step 2: every body moves at 6 ft per second
  // "faster than the wind" means the same thing on the graph, for the challenge and in the hallway readout
  const EPS = 0.03;
  // where a run was faster than the wind (the last trace point is the "stopped" marker, so it never counts)
  function zone(r) {
    let from = null, to = null, chute = 0;
    r.trace.forEach(function (p, i, tr) {
      if (i < tr.length - 1 && p.v - p.wind > EPS) { if (from == null) from = p.x; to = p.x; chute = Math.min(chute, p.thrust); }
    });
    return { outran: from != null, from: from, to: to, chute: -chute };
  }
  // how force a compares with force b, in the lab's shared words, with "as" or "than" and the noun
  function cmp(a, b, noun, o) { return KID.compare(a, b, Object.assign({ noun: noun }, o)); }
  // step 5: the body's drag and the sail's drag at the fastest car's top speed (the same ratio at any speed)
  const BODY_TOP = -P.airForce(-FASTEST, C.bodyArea, C.bodyCd, 0), SAIL_TOP = -P.airForce(-FASTEST, C.sailArea, C.sailCd, 0);
  // write a readout from plain strings and ['bold'] pieces — never innerHTML
  function say(api, box, parts) {
    box.textContent = '';
    parts.forEach(function (p) { box.appendChild(typeof p === 'string' ? document.createTextNode(p) : api.h('strong', { text: p[0] })); });
  }
  // Drawings are made at their real on-screen width (280–560 px) and shown 1 : 1, so a 14 px label is 14 px on a phone too.
  function boardWidth(el) { return Math.max(280, Math.min(560, Math.round(el.clientWidth || 560))); }
  function startBoard(api, s, W, H) {
    s.textContent = '';
    s.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    s.setAttribute('width', W);
    s.setAttribute('height', H);
    api.svg('rect', { x: 0, y: 0, width: W, height: H, rx: 12, fill: '#120826' }, s);
  }
  // redraw when the window (or a turned phone) changes width; stops when the student leaves the step
  function keepFitted(api, el, paint) {
    if (typeof window.addEventListener !== 'function') return;
    let w = boardWidth(el);
    function onResize() { const n = boardWidth(el); if (n !== w) { w = n; paint(); } }
    window.addEventListener('resize', onResize);
    api.onLeave(function () { window.removeEventListener('resize', onResize); });
  }
  function label(api, s, x, y, text, o) {
    o = o || {};
    return api.svg('text', { x: x, y: y, 'text-anchor': o.anchor || 'start', fill: o.color || '#c8b8ea', 'font-size': o.size || 15,
      'font-weight': o.bold === false ? 400 : 700, class: 'sl-lbl' }, s, text);
  }
  // move a box the step just added (a "Word to know") so it sits right after the step's first paragraph
  function afterFirst(el, box) {
    if (el.insertBefore && el.children && el.children.length > 1 && el.children[0] !== box) el.insertBefore(box, el.children[1]);
  }
  // a car drawn at scale s with its back wheel at x: where its mast, sail and front are
  function carGeo(x, floor, s) {
    const mastX = x + 30 * s * 0.45, mastTop = floor - 7 * s - 30 * s;
    return { mastX: mastX, mastTop: mastTop, sailMid: mastTop + 10 * s, sailBack: mastX - 20 * s * 0.45, front: x + 30 * s };
  }

  SailLab.register({
    id: 'drag',
    num: 3,
    title: 'Drag',
    icon: '🌬️',
    blurb: 'Air pushes back! Find out when your sail turns into a parachute.',
    minutes: 12,
    steps: [
      {
        title: 'Drag: the air pushes back',
        html:
          '<p>Think of your hand out the window of a moving car. The faster the car goes, the harder the air pushes your hand back.</p>' +
          '<p>Here the fans are <strong>off</strong>. Your car rolls through still air. Change its speed. Watch the red drag arrow. ' +
          'The yellow arrow shows the drag at 3 ft per second, so you can compare.</p>',
        challenge: 'Find the speed that gives 4 times the drag of 3 ft per second.',
        render: function (el, api) {
          const K = api.kid, REF = 3;
          afterFirst(el, api.ui.word(el, 'drag', 'the air pushing back on something that moves through it. Drag is also called air resistance.'));
          // still air: the wind is 0, so the air comes at the car from the front and pushes it back
          function drag(f) { const v = fps(f); return -P.airForce(-v, C.sailArea, C.sailCd, 0) - P.airForce(-v, C.bodyArea, C.bodyCd, 0); }
          const ref = drag(REF);
          const s = api.svg('svg', { role: 'img', 'aria-label': 'A sail car rolling through still air, with a red arrow for the drag on it and a yellow arrow for the drag at 3 feet per second' }, el);
          const sp = api.ui.slider(el, { label: 'Car speed', min: 0, max: 12, step: 1, value: REF, format: function (f) { return K.ftPerSec(fps(f)); }, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          api.ui.note(el, 'tip', '💡 Almost all of the drag is on the sail. A big, flat sail is great for catching wind. But it also catches air when the car moves.');
          function draw() {
            const f = sp.get(), d = drag(f);
            const W = boardWidth(el), H = 210, FL = 184, narrow = W < 430, sc = narrow ? 2.4 : 3;
            const x = narrow ? W * 0.5 - 18 : W * 0.46 - 45, g = carGeo(x, FL, sc);
            startBoard(api, s, W, H);
            api.svg('line', { x1: 12, y1: FL, x2: W - 12, y2: FL, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            // the still air rushing at the front of the car, the way the car "sees" it
            if (f > 0) [g.mastTop + 14, g.mastTop + 38, g.mastTop + 62, FL - 20].forEach(function (y, i) {
              const x1 = W - 14 - (i % 2) * 14, len = Math.min(x1 - g.front - 8, 10 + f * 4);
              if (len > 6) api.draw.arrow(s, x1, y, x1 - len, y, '#7ad7ff', '', { width: 2, head: 4 });
            });
            api.draw.car(s, x, FL, { scale: sc, length: 30, sailW: 20, sailH: 20, mastH: 30 });
            // which way the car moves, and how fast in words
            label(api, s, W - 16, 30, f > 0 ? K.speed(fps(f)) + ' →' : 'standing still', { anchor: 'end', color: '#d8a8ff' });
            // The drag now (red) and the drag at 3 ft per second (yellow) on ONE honest scale, both backward from the
            // back of the sail. Speeds up to `top` are drawn to scale (the fastest that fits on this screen with the
            // 3 ft per second arrow still to scale: 7 to 10 ft per second); faster ones still grow, a little.
            const x0 = g.sailBack - 2, room = x0 - 14;
            function scaleFor(t) { return api.draw.forceScale(drag(t), room * 0.85, { min: 8, over: room * 0.15 }); }
            let top = 12;
            while (top > 6 && !scaleFor(top).toScale(ref)) top--;
            const len = scaleFor(top), fair = len.toScale(d) && len.toScale(ref);
            if (d > 0) {
              api.draw.arrow(s, x0, g.sailMid, x0 - len(d), g.sailMid, '#ff5050', '', { width: 4, head: Math.max(4, Math.min(7, len(d) / 3)) });
              label(api, s, x0 - 2, g.sailMid - 14, 'drag', { anchor: 'end', color: '#ff7070', size: 15 });
            }
            api.draw.arrow(s, x0, g.sailMid + 20, x0 - len(ref), g.sailMid + 20, '#f0c040', '', { width: 3, head: 5 });
            label(api, s, x0 - 2, g.sailMid + 40, 'at ' + REF + ' ft per second', { anchor: 'end', color: '#f0c040', size: 14 });
            if (f === 0) say(api, out, ['🛑 The car is standing still in still air. No air rushes past, so there is ', ['no drag'], ' at all.']);
            else if (f === REF) say(api, out, ['🌬️ ' + K.ftPerSec(fps(f)) + ' is ' + K.speed(fps(f)) + '. The red drag arrow matches the yellow one. This is our starting speed.']);
            else say(api, out, ['🌬️ ' + K.ftPerSec(fps(f)) + ' is ' + K.speed(fps(f)) + '. The drag is ', [cmp(d, ref, 'at ' + REF + ' ft per second', { exact: true, times: fair })], '.']);
            if (Math.abs(d / ref - 4) < 1e-9) api.done('Yes! At ' + K.ftPerSec(fps(f)) + ', the drag is about 4 times as strong. ' +
              'Twice as fast means about 4 times the drag, not 2 times. Faster air hits harder, and more of it hits each second.');
          }
          draw();
          keepFitted(api, el, draw);
        }
      },
      {
        title: 'Front size and shape',
        html:
          '<p>The front of your car matters too. A flat front slams into the air. A pointed or rounded front lets the air slide around it.</p>' +
          '<p>A bigger front hits more air. Twice the front size means about 2 times the drag.</p>' +
          '<p>Here every car body moves at ' + KID.ftPerSec(fps(BODY_F)) + '. That’s about as fast as the fastest cars go in our hall.</p>',
        render: function (el, api) {
          const K = api.kid, v = fps(BODY_F), HALF = { 15: 11, 30: 16, 60: 22 };
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const size = api.ui.choice(row, { label: 'Front size', value: 30, onChange: draw,
            options: [{ value: 15, label: 'Slim (15 square cm)' }, { value: 30, label: 'Normal (30 square cm)' }, { value: 60, label: 'Bulky (60 square cm)' }] });
          const cmpWith = api.ui.choice(row, { label: 'Compare with', value: 'body', onChange: draw,
            options: [{ value: 'body', label: 'Car bodies only' }, { value: 'sail', label: '+ the sail' }] });
          const s = api.svg('svg', { role: 'img', 'aria-label': 'Bars comparing the drag on three car fronts, and on the sail, at the same speed' }, el);
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          function shape(kind, x0, x1, cy, hh) {
            const c = { fill: '#d8b070', stroke: '#a07830', 'stroke-width': 1.5 };
            if (kind === 'flat') api.svg('rect', Object.assign({ x: x0, y: cy - hh, width: x1 - x0, height: hh * 2 }, c), s);
            else if (kind === 'wedge') api.svg('polygon', Object.assign({ points: [x0, cy - hh, x1 - 34, cy - hh, x1, cy, x1 - 34, cy + hh, x0, cy + hh].join(',') }, c), s);
            else if (kind === 'round') api.svg('path', Object.assign({ d: 'M' + x0 + ',' + (cy - hh) + ' L' + (x1 - hh) + ',' + (cy - hh) + ' A' + hh + ',' + hh + ' 0 0 1 ' + (x1 - hh) + ',' + (cy + hh) + ' L' + x0 + ',' + (cy + hh) + ' Z' }, c), s);
            else {   // the sail, seen from the side: a tall thin sheet on a mast
              api.svg('line', { x1: x1 - 4, y1: cy + 26, x2: x1 - 4, y2: cy - 26, stroke: '#c8a060', 'stroke-width': 3 }, s);
              api.svg('rect', { x: x1 - 12, y: cy - 24, width: 7, height: 46, rx: 2, fill: '#f0e6ff', stroke: '#9080b0' }, s);
            }
            // the wake: a flat front leaves more swirls behind it
            const swirls = { flat: 3, wedge: 2, round: 1, sail: 4 }[kind], wx = kind === 'sail' ? x1 - 14 : x0;   // the wake starts right behind the back edge
            for (let i = 0; i < swirls; i++) api.svg('path', { d: 'M' + (wx - 2 - i * 3) + ',' + (cy - 14 + i * 9) + ' a4,4 0 1 0 -5,3', fill: 'none', stroke: '#7ad7ff', 'stroke-width': 1.5, opacity: 0.7 }, s);
          }
          function draw() {
            const area = size.get() / 10000, hh = HALF[size.get()], W = boardWidth(el);
            const rows = SHAPES.map(function (sh) { return { label: sh.name, kind: sh.kind, f: -P.airForce(-v, area, sh.cd, 0) }; });
            const withSail = cmpWith.get() === 'sail', sailDrag = -P.airForce(-v, C.sailArea, C.sailCd, 0);
            if (withSail) rows.push({ label: 'Sail (20 × 20 cm)', kind: 'sail', f: sailDrag });
            // the drag bars share ONE honest scale, fixed for each view, so a bigger front draws a longer bar from one
            // choice to the next: bodies only → the bulky flat front fills the row; + the sail → the sail fills it
            // (then a tiny body drag is drawn a bit long)
            const RH = 78, TOP = 30, H = TOP + rows.length * RH + 10, BX = 104;
            const len = api.draw.forceScale(withSail ? sailDrag : -P.airForce(-v, FRONTS[2], SHAPES[0].cd, 0), W - BX - 16, { min: 3, over: 0 });
            startBoard(api, s, W, H);
            label(api, s, 16, 22, 'The red bars show the drag', { color: '#ff7070', size: 14 });
            rows.forEach(function (r, i) {
              const y0 = TOP + i * RH, cy = y0 + 52;
              label(api, s, 16, y0 + 22, r.label, { color: '#e0d0ff', size: 15 });
              shape(r.kind, 26, 88, cy, r.kind === 'sail' ? 24 : Math.min(hh, 22));
              api.svg('rect', { x: BX, y: cy - 9, width: len(r.f), height: 18, rx: 3, fill: '#ff5050' }, s);
            });
            const flat = rows[0].f, round = rows[2].f, normal = -P.airForce(-v, FRONTS[1], SHAPES[0].cd, 0);
            if (withSail) say(api, out, ['⛵ The sail’s drag is ', [cmp(rows[3].f, flat, 'even the flat box’s', { times: len.toScale(rows[3].f) && len.toScale(flat) })],
              '. On a sail car, the sail makes most of the drag. ', BODY_TXT + ' ' + FREE_TXT]);
            else {
              const parts = ['🚀 The rounded nose’s drag is ', [cmp(round, flat, 'the flat front’s', { times: len.toScale(round) && len.toScale(flat) })], '. '];
              // a slim or bulky front next to the normal one (the bar a normal flat front draws on this same scale)
              if (size.get() !== 30) parts.push('The ' + (size.get() < 30 ? 'slim' : 'bulky') + ' flat front’s drag is ',
                [cmp(flat, normal, 'a normal one’s', { times: len.toScale(flat) && len.toScale(normal) })], '. ');
              parts.push('But all three are tiny next to the sail. Tap “+ the sail” to compare.');
              say(api, out, parts);
            }
          }
          draw();
          keepFitted(api, el, draw);
        }
      },
      {
        title: 'The wind the sail feels',
        html:
          '<p>Ride a bike with the wind at your back. If you go as fast as the wind, you feel no wind at all!</p>' +
          '<p>A sail works the same way. It only feels how much faster the wind is than the car. ' +
          'If the wind is faster, air hits the sail from behind. It pushes the car forward.</p>' +
          '<p>Ride along with the car below. The blue streaks show the air the way the sail feels it.</p>',
        challenge: 'Find two settings. In one, the sail feels no wind at all (with the fans on). In the other, the sail turns into a parachute (a red arrow).',
        render: function (el, api) {
          const K = api.kid, H = 250, FLOOR = 214, PX = 40;    // PX = screen px per metre in the animation
          const guess = api.ui.predict(el, {
            question: 'What if the car goes FASTER than the wind? What will the air do to the sail?',
            choices: [{ value: 'fwd', label: 'Push the car forward' }, { value: 'none', label: 'Not push at all' }, { value: 'back', label: 'Push the car backward' }],
            hint: 'Pick one. Any guess is OK! Then use the sliders to test it.'
          });
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const speedTxt = function (f) { return K.ftPerSec(fps(f)); };
          const wind = api.ui.slider(row, { label: '🌀 Wind from the fans', min: 0, max: 12, step: 1, value: 8, format: speedTxt, onInput: update });
          const car = api.ui.slider(row, { label: '🚗 Car speed', min: 0, max: 12, step: 1, value: 2, format: speedTxt, onInput: update });
          [wind.input, car.input].forEach(function (b) { if (b) guess.gate(b); });   // commit to a guess first
          const s = api.svg('svg', { role: 'img', 'aria-label': 'Riding along with the sail car: the air the sail feels and the force on it' }, el);
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          const hint = api.h('div', { class: 'sl-muted' });
          el.appendChild(out); el.appendChild(hint);
          let moving = null, front = null, W = 0, carX = 0;
          // air streaks (fractions of the board's width and height); they drift by at the speed the sail feels
          const STREAKS = [[0, 0.06], [0.16, 0.5], [0.3, 0.2], [0.46, 0.8], [0.59, 0.1], [0.75, 0.42], [0.89, 0.66], [0.07, 0.3], [0.39, 0.56], [0.68, 0.9], [0.84, 0.24], [0.23, 0.94]];
          const still = !(typeof requestAnimationFrame === 'function') || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
          let airOff = 0, groundOff = 0, last = null, raf = null, seenZero = false, seenChute = false, shownFor = null;
          function rel() { return wind.get() - car.get(); }   // whole ft per second
          function moveAir() {     // in the car's view, the air drifts by at the speed the sail feels and the floor slides backward
            if (!moving) return;
            moving.textContent = '';
            STREAKS.forEach(function (p) {
              const x = ((p[0] * (W + 40) + airOff) % (W + 40) + (W + 40)) % (W + 40) - 20;
              const y = 96 + p[1] * (FLOOR - 112);
              if (x > 8 && x < W - 34) api.svg('line', { x1: x, y1: y, x2: x + 24, y2: y, stroke: '#7ad7ff', 'stroke-width': 2, opacity: 0.5, 'stroke-linecap': 'round' }, moving);
            });
            for (let k = 0; k < 16; k++) {
              const x = ((k * 40 - groundOff) % 640 + 640) % 640 - 20;
              if (x > 10 && x < W - 26) api.svg('line', { x1: x, y1: FLOOR + 8, x2: x + 16, y2: FLOOR + 8, stroke: '#6a5a8a', 'stroke-width': 3 }, moving);
            }
          }
          function isChute() { return rel() < 0 && car.get() > 0; }
          function showAnswer() {
            if (guess.get() == null || !isChute()) return;
            shownFor = guess.get();
            guess.reveal('The car is faster than the wind. So the sail runs into the air.', guess.get() === 'back',
              'The air hits the sail from the front, like your hand out a car window. It pushes the car back. That’s drag. The sail is now a parachute!');
          }
          guess.onChange(function (v) { shownFor = null; if (v != null) showAnswer(); });
          function update() {
            const w = wind.get(), c = car.get(), r = rel(), f = P.airForce(fps(r), C.sailArea, C.sailCd, 0);
            W = boardWidth(el);
            const narrow = W < 430, sc = narrow ? 2.4 : 3;
            carX = W / 2 - 15 * sc - 6;
            const g = carGeo(carX, FLOOR, sc);
            startBoard(api, s, W, H);
            moving = api.svg('g', null, s); front = api.svg('g', null, s);
            api.svg('line', { x1: 10, y1: FLOOR, x2: W - 10, y2: FLOOR, stroke: '#4a3a6a', 'stroke-width': 3 }, front);
            label(api, front, 14, 26, 'Wind ' + speedTxt(w) + ' →', { color: '#7ad7ff', size: 15 });
            label(api, front, narrow ? 14 : W - 14, narrow ? 48 : 26, 'Car ' + speedTxt(c) + ' →', { color: '#d8a8ff', size: 15, anchor: narrow ? 'start' : 'end' });
            const feel = r > 0 ? 'Sail feels wind from behind' : r < 0 ? 'Sail feels wind from the front' : 'Sail feels NO wind';
            label(api, front, W / 2, narrow ? 76 : 60, feel, { anchor: 'middle', color: r > 0 ? '#40e080' : r < 0 ? '#ff5050' : '#f0c040', size: narrow ? 15 : 18 });
            api.draw.car(front, carX, FLOOR, { scale: sc, length: 30, sailW: 20, sailH: 20, mastH: 30 });
            // the force on the sail: a push (forward) or a drag (backward) on ONE honest scale, so the same size of
            // force always draws the same length either way. The biggest (12 ft per second apart) fills the room on the
            // shorter side; a tiny force is drawn a bit long, so the colour always matches the words. Word labels only.
            const maxF = P.airForce(fps(12), C.sailArea, C.sailCd, 0);
            const len = api.draw.forceScale(maxF, Math.min(W - 16 - (g.mastX + 6), g.sailBack - 4 - 14), { min: 14, over: 0 });
            if (f > 0) {
              api.draw.arrow(front, g.mastX + 6, g.sailMid, g.mastX + 6 + len(f), g.sailMid, '#40e080');
              // the word sits right above its arrow (as in step 1), not in a corner of the picture
              label(api, front, g.mastX + 8, g.sailMid - 14, 'wind push', { color: '#40e080', size: 15 });
            }
            if (f < 0) {
              api.draw.arrow(front, g.sailBack - 4, g.sailMid, g.sailBack - 4 - len(f), g.sailMid, '#ff5050');
              label(api, front, g.sailBack - 6, g.sailMid - 14, 'drag', { anchor: 'end', color: '#ff7070', size: 15 });
            }
            if (r > 0) say(api, out, ['🟢 The wind is ' + speedTxt(r) + ' faster than the car. So the air hits the sail from behind. It ', ['pushes'], ' the car forward.']);
            else if (r < 0) say(api, out, ['🔴 The car is ' + speedTxt(-r) + ' faster than the wind. It runs into the air, so the air hits the sail from the front. It ', ['drags'],
              ' the car back. The sail is a parachute! 🪂']);
            else if (w === 0) say(api, out, ['🟡 The fans are off and the car is still. Nothing pushes at all. Turn the fans on!']);
            else say(api, out, ['🟡 The car moves exactly as fast as the air. The sail feels ', ['no wind'], ', so there is no push at all.']);
            if (w >= 1 && r === 0) seenZero = true;
            if (isChute()) { seenChute = true; if (shownFor == null) showAnswer(); }
            hint.textContent = seenZero && !seenChute ? '✔ You found the no-wind setting. Now make the car faster than the wind.'
              : seenChute && !seenZero ? '✔ Parachute found! Now find a setting where the sail feels no wind at all (with the fans on).' : '';
            if (seenZero && seenChute) api.done('Same speed as the wind means no push. Faster than the wind means the air hits the sail from the front. ' +
              'It drags the car back. The same sail became a parachute!');
            moveAir();
          }
          function frame(now) {
            const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000);
            last = now;
            airOff += fps(rel()) * PX * dt; groundOff += fps(car.get()) * PX * dt;
            moveAir();
            raf = requestAnimationFrame(frame);
          }
          update();
          if (!still) raf = requestAnimationFrame(frame);
          api.onLeave(function () { if (raf) cancelAnimationFrame(raf); raf = null; });
          keepFitted(api, el, update);
        }
      },
      {
        title: 'Spot the parachute in the hallway',
        html:
          '<p>Back to our ' + HALL_TXT + ' hallway. At the start line, the wind moves at ' + KID.speed(P.windAt(START)) + ' (about ' + KID.ftPerSec(P.windAt(START)) + '). ' +
          'It fades as it spreads down the hall. At the far end, it is only ' + KID.speed(P.windAt(START + HALL.length)) + ' (about ' + KID.ftPerSec(P.windAt(START + HALL.length)) + ').</p>' +
          '<p>A car speeds up near the fans. Then it rolls into weaker wind. Can it end up <strong>faster than the wind</strong>? If it does, its sail is a parachute.</p>' +
          '<p>The graph under the hallway shows speeds. The <span style="color:#7ad7ff">blue line</span> is the wind. ' +
          'The <span style="color:#f0c040">yellow line</span> is your car. Where yellow climbs above blue, the graph turns <span style="color:#ff5050">red</span>.</p>',
        challenge: 'Make a car outrun the wind (a red zone shows on the graph). Then answer the question about the red zone.',
        render: function (el, api) {
          const K = api.kid;
          // 50 g is the lightest choice on purpose: a car under 40 g with this sail tips forward in the two fans' strong start push
          let outran = false;    // did the run now on screen outrun the wind?
          const guess = api.ui.predict(el, {
            question: 'Which car do you think can go faster than the wind?',
            choices: [{ value: 'light', label: 'A light car with wheels that spin freely' }, { value: 'heavy', label: 'A heavy car with rubbing wheels' },
              { value: 'none', label: 'No car can, because the wind is always faster' }],
            hint: 'Pick one. Any guess is OK! Then pick a car below and run it.',
            judge: function (r, v) {
              const z = zone(r), car = r.car, free = car.crr <= CRR.free, light = car.mass <= MASS[70];
              if (r.reason === 'tipped over') return { text: 'This car tipped over at the start.', right: null, why: 'Try another car.' };
              if (z.outran) {
                const text = 'The car outran the wind from ' + K.dist(z.from) + ' to ' + K.dist(z.to) + '.';
                if (v === 'light') return { text: text, right: true, why: 'It isn’t heavy and it rolls easily. So it keeps its speed while the wind fades.' };
                if (v === 'heavy') return { text: text, right: false, why: 'It was a light car with wheels that spin freely. It keeps its speed while the wind fades.' };
                return { text: text, right: false, why: 'A car can be faster than the wind! It speeds up near the fans. Then it rolls on into the weaker wind.' };
              }
              const text = 'The car never got faster than the wind.';
              if (v === 'heavy' && !light && car.crr >= CRR.rub) return { text: text, right: false, why: 'Friction slows a heavy car with rubbing wheels too much. It never catches up with the fading wind.' };
              if (v === 'light') return { text: text, right: null, why: (free ? 'This car is heavy.' : 'This car’s wheels don’t spin freely.') + ' Now test your guess: try a light car with wheels that spin freely.' };
              if (v === 'heavy') return { text: text, right: null, why: 'Now test your guess: try the 100 g car with rubbing wheels.' };
              return { text: text, right: null, why: 'So far, the wind was always faster. Keep testing other cars before you decide!' };
            }
          });
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const wt = api.ui.choice(row, { label: 'Car weight', value: 70, onChange: changed, options: [{ value: 50, label: '50 g (light)' }, { value: 70, label: '70 g' }, { value: 100, label: '100 g (heavy)' }] });
          const wh = api.ui.choice(row, { label: 'Wheels', value: 'ok', onChange: changed, options: [{ value: 'rub', label: 'Rubbing' }, { value: 'ok', label: 'OK' }, { value: 'free', label: 'Spin freely' }] });
          // The hallway picture and the graph both always show the whole hallway (start line to far end), so they
          // line up and runs are easy to compare. Long runs play faster automatically (about 9 seconds to watch).
          const sim = api.ui.trackSim(el, function () { return { mass: MASS[wt.get()], crr: CRR[wh.get()] }; },
            { scaleM: HALL.length, needPrediction: guess, onResult: function (r) { plot(r); judge(r); } });
          api.onLeave(sim.stop);
          const g = api.svg('svg', { role: 'img', 'aria-label': 'Graph of the wind’s speed and the car’s speed along the whole hallway, from the start line to the far end' }, el);
          const TIP = '💡 The run plays sped up. Watch the readout: it says “faster than the wind!” when the car outruns the wind. ' +
            'When the run ends, the graph shows the whole trip.';
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite', text: TIP });
          const ask = api.h('div', { style: 'display:none' });
          el.appendChild(out); el.appendChild(ask);
          const VMAX = 12, FS = 14;           // ft per second at the top of the graph; label size in real on-screen px
          const HALL_FT = HALL.length * FT;
          let shownRun = null, shownMsg = null, shownW = 0;   // what the graph shows now (redrawn when the screen width changes)
          function fast(p, i, tr) { return i < tr.length - 1 && p.v - p.wind > EPS; }
          function text(x, y, str, color, o) {
            o = o || {};
            return api.svg('text', { x: x, y: y, 'text-anchor': o.anchor || 'start', fill: color, 'font-size': o.size || FS, 'font-weight': o.bold ? 700 : 400, class: o.bold ? 'sl-lbl' : null }, g, str);
          }
          function plot(r, msg) {
            shownRun = r; shownMsg = msg;
            // drawn at its real width; on a phone the legend takes two rows so nothing overlaps
            const W = shownW = boardWidth(el), narrow = W < 430;
            const L = 40, R = W - 16, T = narrow ? 90 : 66, B = T + 150, H = B + 54;
            function X(m) { return L + Math.min(m, HALL.length) / HALL.length * (R - L); }
            function Y(mps) { return B - Math.min(mps * FT, VMAX) / VMAX * (B - T); }   // a speed from the model
            function YF(f) { return Y(fps(f)); }                                              // a speed in ft per second
            g.textContent = '';
            g.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
            g.setAttribute('width', W);
            g.setAttribute('height', H);
            api.svg('rect', { x: 0, y: 0, width: W, height: H, rx: 12, fill: '#120826' }, g);
            if (r) {     // red zones: wherever the car is faster than the wind
              let from = null;
              r.trace.forEach(function (p, i, tr) {
                const f = fast(p, i, tr);
                if (f && from == null) from = p.x;
                if (!f && from != null) {
                  const zw = X(p.x) - X(from);
                  api.svg('rect', { x: X(from), y: T, width: Math.max(2, zw), height: B - T, fill: '#ff5050', opacity: 0.25 }, g);
                  // the label sits between the 8 and 10 ft per second lines (no car in our hall is that fast)
                  if (zw > 24) text((X(from) + X(p.x)) / 2, YF(9) + 5, zw > 136 ? '🪂 parachute zone' : '🪂', '#ffb0b0', { anchor: 'middle', bold: true });
                  from = null;
                }
              });
            }
            for (let v = 0; v <= VMAX; v += 2) {
              api.svg('line', { x1: L, y1: YF(v), x2: R, y2: YF(v), stroke: '#2e2050', 'stroke-width': 1 }, g);
              text(L - 8, YF(v) + 5, String(v), '#a090c0', { anchor: 'end' });
            }
            text(12, T - 12, 'speed (ft per second)', '#a090c0');
            const step = (X(10 / FT) - X(0)) >= 40 ? 10 : 20;
            for (let f = 0; f <= HALL_FT - 4; f += step) text(X(f / FT), B + 20, String(f), '#a090c0', { anchor: 'middle' });
            text((L + R) / 2, B + 42, 'feet down the hall', '#a090c0', { anchor: 'middle' });
            // the far end of the hallway is the right edge of the graph
            api.svg('line', { x1: R, y1: T - 6, x2: R, y2: B, stroke: '#c8b8ea', 'stroke-width': 1.5, 'stroke-dasharray': '5,4' }, g);
            text(R - 5, T + 14, 'end of hall · ' + K.ft(HALL.length) + ' ft', '#c8b8ea', { anchor: 'end', bold: true });
            const wpts = [];
            for (let i = 0; i <= 100; i++) { const m = HALL.length * i / 100; wpts.push(X(m).toFixed(1) + ',' + Y(P.windAt(START + m)).toFixed(1)); }
            api.svg('polyline', { points: wpts.join(' '), fill: 'none', stroke: '#7ad7ff', 'stroke-width': 3 }, g);
            // legend
            [['wind', '#7ad7ff', 16], ['car', '#f0c040', 106]].forEach(function (lg) {
              api.svg('line', { x1: lg[2], y1: 21, x2: lg[2] + 24, y2: 21, stroke: lg[1], 'stroke-width': 4 }, g);
              text(lg[2] + 30, 26, lg[0], lg[1], { size: 15, bold: true });
            });
            const rx = narrow ? 16 : 182, ry = narrow ? 50 : 26;
            api.svg('rect', { x: rx, y: ry - 14, width: 18, height: 18, fill: '#ff5050', opacity: 0.5 }, g);
            text(rx + 24, ry, 'car faster than wind', '#ff8080', { size: 15, bold: true });
            if (!r) {     // a short message in the empty middle of the graph, clear of the wind line
              const cx = (X(20 / FT) + R) / 2;      // from 20 ft on, the wind is slower than 5 ft per second
              (msg || 'Press ▶ Run to draw\nyour car’s speed').split('\n').forEach(function (line, k) { text(cx, YF(8) + k * 20, line, '#c8b8ea', { anchor: 'middle', size: 15 }); });
              return;
            }
            api.svg('polyline', { points: r.trace.map(function (p) { return X(p.x).toFixed(1) + ',' + Y(p.v).toFixed(1); }).join(' '), fill: 'none', stroke: '#f0c040', 'stroke-width': 3 }, g);
          }
          function onResize() { if (boardWidth(el) !== shownW) plot(shownRun, shownMsg); }   // a turned phone or a resized window
          if (typeof window.addEventListener === 'function') {
            window.addEventListener('resize', onResize);
            api.onLeave(function () { window.removeEventListener('resize', onResize); });
          }
          function judge(r) {
            const z = zone(r);
            // a car that reaches the end of the hall was still rolling: the same run in a longer hall tells the cars apart
            const endTxt = r.reason === END ? ' It reached the end of the hall. In a longer hall, it would have rolled about ' + K.dist(longRun(r.car, r.opts).distance) + '.' : '';
            outran = z.outran;
            if (outran) {
              out.className = 'sl-note sl-note-good';
              say(api, out, ['🪂 See the red zone? There the air hit the sail from the front and pushed it back. That push was tiny: ',
                [cmp(z.chute, r.friction, 'friction', { times: false })], '. But it helped friction slow the car down.' + endTxt]);
              ask.style.display = 'block';
            } else {
              out.className = 'sl-note sl-note-tip';
              out.textContent = r.reason === 'tipped over' ? '🤸 The car tipped over at the start, so it never got going.'
                : '🔵 The yellow line stayed under the blue line. The wind was faster the whole way, so it pushed the car the whole time.' +
                  (r.reason === END ? endTxt
                    : ' Soon the push got smaller than friction. Then the car slowed down bit by bit and finally stopped. To outrun the wind, a car must keep its speed as the wind fades. ' +
                      (r.car.crr <= CRR.free ? 'Try a lighter car.' : 'Try wheels that spin freely.'));
            }
          }
          ask.appendChild(api.h('p', { html: '<strong>Now think:</strong> in the red zone, which way does the air push on the sail?' }));
          const reply = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite', style: 'display:none' });
          const answer = api.ui.choice(ask, { label: 'Your answer:', value: null,
            options: [{ value: 'fwd', label: 'Forward ➡️' }, { value: 'none', label: 'Not at all' }, { value: 'back', label: '⬅️ Backward' }],
            onChange: function (v) {
              reply.style.display = 'block';
              reply.className = 'sl-note ' + (v === 'back' ? 'sl-note-good' : 'sl-note-warn');
              reply.textContent = v === 'back' ? '✅ Yes! The car is faster than the wind, so the sail runs into the air. The air pushes it backward and slows the car down.'
                : v === 'fwd' ? 'Not quite. The air pushes forward only while the wind is faster than the car. In the red zone, the car is faster.'
                  : 'Not quite. “No push” happens only where the two lines cross. There the car and the wind have the same speed. In the red zone, the car is faster.';
              if (v === 'back' && outran) api.done('Yes! Your car was faster than the wind. So the air hit the sail from the front and pushed it back. Your sail became a parachute!');
            } });
          ask.appendChild(reply);
          // a new run, Reset, or a new weight/wheel choice clears the old graph and question,
          // so an old run can't be mixed up with the car on screen
          function clearRun(msg) {
            outran = false;
            plot(null, msg);
            out.className = 'sl-note sl-note-tip'; out.textContent = TIP;
            ask.style.display = 'none'; reply.style.display = 'none'; answer.set(null);
          }
          function changed() { sim.reset(); clearRun(); }
          const btns = el.querySelectorAll ? el.querySelectorAll('.sl-track-bar .sl-btn') : [];
          if (btns[0]) btns[0].addEventListener('click', function () { clearRun('Running… the graph\ncomes when the run ends'); });
          if (btns[1]) btns[1].addEventListener('click', function () { clearRun(); });
          plot(null);
        }
      },
      {
        title: 'Real build: beat the drag',
        html:
          '<p>Here’s the truth about drag on <strong>your</strong> car.</p>' +
          '<ul><li>Near the fans, the wind is faster than your car. So the air pushes it forward. Drag only slows your car where the car is faster than the wind.</li>' +
          '<li>The <strong>body’s</strong> drag is tiny. At the same speed, the sail’s drag is ' + KID.compare(SAIL_TOP, BODY_TOP) + '. ' + BODY_TXT + '</li>' +
          '<li>The <strong>sail</strong> makes the most drag. But it’s also your engine! <strong>Don’t shrink it.</strong> ' +
          'In the simulator, a 20 × 20 cm sail rolls ' + KID.dist(STD.distance) + '. A 10 × 10 cm sail rolls only ' + KID.dist(SMALL_SAIL.distance) + '.</li></ul>' +
          '<p><strong>Tidy up</strong> (small wins that also save weight):</p>' +
          '<ol><li>Trim cardstock edges. Tape down loose flaps and corners.</li>' +
          '<li>Cut axle ends short. Leave about 5 mm of skewer past each wheel.</li>' +
          '<li>Nothing sticking out: no wide bumper, no pipe-cleaner antennas, no long tape tails.</li>' +
          '<li>Make the sail tight, not floppy. Tape it to a frame of straws or skewers. A flapping sail wastes the wind.</li></ol>' +
          '<p><strong>Test drag in the hall:</strong></p>' +
          '<ol><li><strong>Ramp test (fans off):</strong> Make a small ramp with a binder. Let your car roll down it and measure how far it goes. ' +
          'Then turn the sail edge-on and try again. The difference shows the sail’s drag.</li>' +
          '<li><strong>Wind strip (fans on):</strong> Tape a thin paper strip to the top of the mast. Make it about 5 cm long. Walk beside your car. ' +
          'Near the fans, the strip blows forward. If it goes limp, your car has caught up with the wind!</li>' +
          '<li><strong>Flutter check:</strong> Hold your car in front of the fans. Look at the sail from the side. If it flaps, tighten it.</li></ol>',
        render: function (el, api) {
          api.ui.note(el, 'build', '🛠️ <strong>Remember the order:</strong> a tight sail and wheels that spin freely matter most. ' +
            'A smooth body matters much less. Tidy the body last.');
        }
      }
    ],
    quiz: [
      // The options in each question are about the same length, so "pick the longest" is no clue: the right
      // answer is the single longest option in at most 3 of the 10 (the check script counts it).
      { q: 'What is drag?', options: ['The air pushing back on things moving through it', 'The wind from the fans pushing the car forward', 'The wheels rubbing on their axles as they turn', 'Gravity pulling the car down to the floor'], answer: 0,
        why: 'Anything moving through air has to push the air aside. The air pushes back, and that push is drag.' },
      { q: 'Your car rolls through still air. Then it goes twice as fast. What happens to the drag?', options: ['It stays the same in still air', 'It gets about 2 times as strong', 'It gets about 4 times as strong', 'It gets about half as strong'], answer: 2,
        why: 'Faster air hits harder, and more of it hits each second. So twice as fast means about 4 times the drag.' },
      { q: 'Three car bodies are the same size and go the same speed. Which one has the MOST drag?', options: ['The one with a rounded nose', 'The one with a flat box front', 'The one with a pointed wedge front', 'They all have the same drag'], answer: 1,
        why: 'A flat front slams into the air. Pointed and rounded fronts let the air slide around them.' },
      { q: 'Your car rolls exactly as fast as the wind around it. How hard does the wind push the sail?', options: ['Just as hard as it did at the start line', 'Not at all, since no air rushes past the sail', 'Harder, because the car is going so fast', 'It pushes the car backward like a brake'], answer: 1,
        why: 'The car moves along with the air, so the sail feels no wind and gets no push.' },
      { q: 'Your car is going faster than the wind around it. What does the air do to the sail?', options: ['It pushes the car forward even harder', 'Nothing, since the car is ahead of the wind', 'It hits from the front and slows the car', 'It pulls the car along from behind'], answer: 2,
        why: 'The sail runs into the air, like your hand out a car window. The sail acts like a parachute.' },
      { q: 'Where in the hall can a car get going faster than the wind?', options: ['Right by the fans, where the wind is strongest', 'Farther down the hall, where the wind fades', 'Nowhere, since a car can never beat the wind', 'Anywhere, as long as the car is heavy'], answer: 1,
        why: 'Near the fans the wind is strong. A car that keeps its speed can pass the fading wind.' },
      { q: 'Which car is most likely to outrun the wind?', options: ['A heavy car with wheels that spin freely', 'A light car with wheels that rub the axles', 'A light car with wheels that spin freely', 'A car with a tiny sail to cut its drag'], answer: 2,
        why: 'A light car with wheels that spin freely keeps its speed best. So it can roll faster than the fading wind.' },
      { q: 'Which part of a sail car makes the most drag?', options: ['The sail', 'The body', 'The wheels', 'The mast'], answer: 0,
        why: 'The big sail catches the most air. The body’s drag is tiny next to the sail’s.' },
      { q: 'Which change cuts extra drag on the car’s body?', options: ['Glue on a big flat shield to block the air', 'Make the body heavier so the air can’t push it', 'Tape down loose flaps and trim axle ends', 'Leave flaps loose so the air slips past them'], answer: 2,
        why: 'Loose flaps and long axle ends catch the air. Trimming them cuts drag and saves weight too.' },
      { q: 'A classmate wants a much smaller sail to cut drag. Is that a good idea?', options: ['Yes, because the smallest sail always wins', 'No, because the sail is the car’s engine', 'Yes, because the car will roll much farther', 'It won’t matter, since all sails push the same'], answer: 1,
        why: 'In the simulator, a 20 × 20 cm sail rolls about ' + KID.ft(STD.distance) + ' ft. A 10 × 10 cm sail rolls only about ' + KID.ft(SMALL_SAIL.distance) + ' ft.' }
    ],
    // the wheel table and computed sentences, for the node check script (not used by the page)
    _model: { CRR: CRR, FREE_TXT: FREE_TXT, BODY_TXT: BODY_TXT, BODY_FT: BODY_FT, FASTEST: FASTEST, EPS: EPS, MASS: MASS, zone: zone, BODY_F: BODY_F }
  });
})();
