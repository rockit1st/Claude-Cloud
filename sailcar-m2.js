// Sail Car Lab — Module 2: Thrust (written for 6th graders)
// How the wind from the two box fans pushes on the sail: sail AREA, how the wind FADES down the hallway
// (and why faster wind pushes much harder), sail SHAPE and sail ANGLE. Every force comes from
// SailLab.physics (airForce, windAt, rollingFriction, simulate), the same model the hallway and Design
// Studio use. Students never see a force as a number: a force is an arrow or bar whose LENGTH shows its size
// (draw.forceScale / ui.forceBars: ONE honest scale per picture, so a bigger force is never drawn shorter), and
// the words COMPARE two forces with the lab's shared vocabulary (kid.compare / kid.times). A sentence states a
// ratio ("about 4 times as strong") only when both arrows beside it are drawn to scale. Distances: kid.dist.
(function () {
  'use strict';
  const P = SailLab.physics, KID = SailLab.kid;
  const START = 0.3;                                    // the start line: 30 cm from the fans (simulate's default startX)
  const PAPER = 0.08;                                   // printer paper weighs about 80 g per square metre
  const FRAME = P.DEFAULT_CAR.mass - P.DEFAULT_CAR.sailArea * PAPER;   // the default car without its 20 × 20 cm paper sail
  const FLAT = 1.2, CUPPED = 1.4;                       // how well a flat and a cupped sail catch the wind (sailCd)
  // The real hallway lives in ONE place (SailLab.physics.HALL, 70 ft × 11 ft today); everything here reads it from there.
  const HALL_M = P.HALL.length;                         // metres a car can roll from the start line before it reaches the far end
  const HALL_TXT = KID.dist(HALL_M);                    // "70 ft (21 m)"
  function ftToM(f) { return f / KID.FT_PER_M; }
  // A w × h cm paper sail mounted low on the mast: its middle sits 3 cm + half its height above the floor.
  function sailCar(w, h, cd, ang) {
    const area = w * h / 10000;
    return { sailArea: area, sailCd: cd, sailAngle: ang || 0, sailHeight: 0.03 + h / 200, mass: FRAME + area * PAPER };
  }
  // push on a sail sitting still x metres from the fans
  function push(x, area, cd, ang) { return P.airForce(P.windAt(x), area, cd, ang || 0); }
  // Step 4's readout: the wind's push on the WHOLE car at the start line (sail + body), the same force as
  // simulate(car).startPush (the force Modules 1, 4 and 5 draw for the standard 20 × 20 cm car)
  function carPush(c) { return push(START, c.sailArea, c.sailCd, c.sailAngle) + push(START, P.DEFAULT_CAR.bodyArea, P.DEFAULT_CAR.bodyCd, 0); }
  // Step 2's wind meter: whole feet from the fans, 0 to 70 ft (the hall). Where a still 20 × 20 cm sail's push
  // first drops below the typical car's friction, in those same whole feet (56 ft today).
  const GAUGE_FT = Math.round(HALL_M * KID.FT_PER_M);
  const FRICTION = P.rollingFriction(P.DEFAULT_CAR.mass, P.DEFAULT_CAR.crr);
  let WEAK_FT = null;
  for (let f = 0; f <= GAUGE_FT && WEAK_FT == null; f++) if (push(ftToM(f), 0.04, FLAT) < FRICTION) WEAK_FT = f;
  const TYPICAL_RUN = P.simulate({});                   // the typical 70 g car with a 20 × 20 cm sail coasts to a stop at 53 ft
  // Step 4: the goal in feet, judged on the SAME rounded feet the hallway readout shows
  const GOAL_FT = 50;                                   // twice a paper sled's typical 25 ft
  const GOAL_TXT = KID.dist(ftToM(GOAL_FT));            // "50 ft (15 m)"
  // Step 4's sail-size slider, and the biggest square sail on it that doesn't flip the car, flat OR cupped (20 cm today)
  const SIZES = { min: 10, max: 40, step: 5, start: 15 };
  let BIGGEST_SAFE = 0;
  for (let s = SIZES.min; s <= SIZES.max; s += SIZES.step) {
    if ([FLAT, CUPPED].every(function (cd) { return P.simulate(sailCar(s, s, cd, 0)).reason !== 'tipped over'; })) BIGGEST_SAFE = s;
  }
  // Step 4's prediction: which band a run lands in (the same rounded feet the readout shows)
  function band(r) { if (r.reason === 'tipped over') return 'tip'; const f = KID.ft(r.distance); return f < 30 ? 'short' : f < GOAL_FT ? 'mid' : 'far'; }
  // Step 4's arrows: your car's start push next to a car with a small 10 × 10 cm sail. The arrows fill at the
  // first sail size that tips (25 × 25 cm, cupped), so every sail that rolls is drawn to scale; bigger sails grow a little more.
  const SMALL_PUSH = carPush(sailCar(10, 10, FLAT, 0));
  const BAR_MAX = carPush(sailCar(BIGGEST_SAFE + SIZES.step, BIGGEST_SAFE + SIZES.step, CUPPED, 0));
  // how force a compares with force b, in the lab's shared words, with "as" or "than" and the noun
  function cmp(a, b, noun, o) { return KID.compare(a, b, Object.assign({ noun: noun }, o)); }
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
  // a force arrow (the same shape as ui.forceBars): starts at x, points right, exactly len px long
  function forceArrow(api, s, x, y, len, color) {
    if (!(len > 0)) return;
    const H = 18, t = H * 0.22, head = Math.min(10, len * 0.6);
    api.svg('polygon', { points: [x, y + t, x + len - head, y + t, x + len - head, y, x + len, y + H / 2, x + len - head, y + H, x + len - head, y + H - t, x, y + H - t].join(','), fill: color }, s);
  }
  function label(api, s, x, y, text, o) {
    o = o || {};
    return api.svg('text', { x: x, y: y, 'text-anchor': o.anchor || 'start', fill: o.color || '#c8b8ea', 'font-size': o.size || 15,
      'font-weight': o.bold === false ? 400 : 700, class: 'sl-lbl', transform: o.rotate ? 'rotate(' + o.rotate + ',' + x + ',' + y + ')' : null }, s, text);
  }
  // move a box the step just added (a "Word to know") so it sits right after the step's first paragraph
  function afterFirst(el, box) {
    if (el.insertBefore && el.children && el.children.length > 1 && el.children[0] !== box) el.insertBefore(box, el.children[1]);
  }

  SailLab.register({
    id: 'thrust',
    num: 2,
    title: 'Thrust',
    icon: '💨',
    blurb: 'Catch the wind! See how sail size, wind and shape change the push.',
    minutes: 15,
    steps: [
      {
        title: 'Catch more air: sail size',
        html:
          '<p>The two fans blow air down the hall. When the air hits your sail, it pushes the car forward.</p>' +
          '<p><strong>Secret #1: a bigger sail catches more air.</strong> The size of the sail’s face is its <span class="key">area</span>. ' +
          'For a rectangle, area = width × height. A 10 cm by 10 cm sail has an area of 100 square cm.</p>' +
          '<p>We check the push at the start line, ' + KID.dist(START) + ' from the fans.</p>',
        challenge: 'Make a sail that is not a square. Give it the same push as the 20 × 20 cm sail. Hint: it needs the same area, 400 square cm.',
        render: function (el, api) {
          const K = api.kid;
          afterFirst(el, api.ui.word(el, 'thrust', 'the push that moves your car forward. For a sail car, thrust is the wind’s push on the sail.'));
          const ref = push(START, 0.01, FLAT), p20 = push(START, 0.04, FLAT);      // the 10 × 10 and 20 × 20 cm sails
          const guess = api.ui.predict(el, {
            question: 'Start with a 10 × 10 cm sail. Now make it twice as wide AND twice as tall (20 × 20 cm). ' +
              'How much push will it get, compared with the 10 × 10 cm sail?',
            choices: [{ value: 1, label: 'The same push' }, { value: 2, label: '2 times the push' }, { value: 4, label: '4 times the push' }, { value: 8, label: '8 times the push' }],
            hint: 'Pick one. Any guess is OK! Then test it below.'
          });
          function reveal() {
            guess.reveal('Look at the arrows. The 20 × 20 cm sail gets about ' + K.times(p20, ref) + ' times as much push!',
              guess.get() === 4, 'It is twice as wide and twice as tall. So it holds 4 squares of 10 × 10 cm. It has 4 times the area, so it catches 4 times the air.');
          }
          const s = api.svg('svg', { role: 'img', 'aria-label': 'Your sail on a grid, and arrows that compare its push with the push on a 10 by 10 and a 20 by 20 centimetre sail' }, el);
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const cm = function (v) { return v + ' cm'; };
          const wS = api.ui.slider(row, { label: 'Sail width', min: 10, max: 40, step: 5, value: 10, format: cm, onInput: changed });
          const hS = api.ui.slider(row, { label: 'Sail height', min: 10, max: 40, step: 5, value: 10, format: cm, onInput: changed });
          const test = api.h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: '🧪 Test it: make a 20 × 20 cm sail' });
          el.appendChild(test);
          [wS.input, hS.input, test].forEach(function (b) { if (b) guess.gate(b); });   // commit to a guess first
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          api.ui.note(el, 'warn', '⚠️ <strong>Bigger isn’t free.</strong> A big sail is heavier. Its push is also high above the wheels, so it can tip the car. ' +
            'You will see this in the hallway challenge.');
          let was20 = false;
          function changed() {
            draw();
            const is20 = wS.get() === 20 && hS.get() === 20;
            if (is20 && !was20) reveal();                    // sliding to 20 × 20 by hand answers the question too
            was20 = is20;
          }
          if (test.addEventListener) test.addEventListener('click', function () { wS.set(20); hS.set(20); was20 = false; changed(); });
          function draw() {
            const w = wS.get(), hh = hS.get(), p = push(START, w * hh / 10000, FLAT);
            const W = boardWidth(el), wide = W >= 470, CM = 4.4;           // 4.4 px per cm: a 40 cm sail is 176 px
            const SX = wide ? 40 : 36, SY = 40 + 40 * CM;                   // bottom-left corner of the sail
            const BX = wide ? 262 : 14, BY = wide ? 0 : SY + 34;            // where the push arrows start
            const RH = 50, H = wide ? 252 : BY + 40 + 3 * RH + 10;
            startBoard(api, s, W, H);
            // the sail as the fans see it, on a grid: thin lines every 5 cm, thick lines every 10 cm
            label(api, s, SX, 26, 'Your sail', { color: '#f0e6ff', size: 16 });
            // faint graph paper: the room the sail can grow into (up to 40 × 40 cm), in 5 cm squares
            for (let i = 0; i <= 40; i += 5) {
              api.svg('line', { x1: SX + i * CM, y1: SY - 40 * CM, x2: SX + i * CM, y2: SY, stroke: '#2e2050', 'stroke-width': 1 }, s);
              api.svg('line', { x1: SX, y1: SY - i * CM, x2: SX + 40 * CM, y2: SY - i * CM, stroke: '#2e2050', 'stroke-width': 1 }, s);
            }
            api.svg('rect', { x: SX, y: SY - hh * CM, width: w * CM, height: hh * CM, fill: '#f0e6ff', opacity: 0.92, stroke: '#9080b0', 'stroke-width': 2 }, s);
            for (let i = 5; i < w; i += 5) api.svg('line', { x1: SX + i * CM, y1: SY - hh * CM, x2: SX + i * CM, y2: SY, stroke: '#9a88c4', 'stroke-width': i % 10 ? 1 : 2 }, s);
            for (let j = 5; j < hh; j += 5) api.svg('line', { x1: SX, y1: SY - j * CM, x2: SX + w * CM, y2: SY - j * CM, stroke: '#9a88c4', 'stroke-width': j % 10 ? 1 : 2 }, s);
            api.svg('rect', { x: SX, y: SY - 10 * CM, width: 10 * CM, height: 10 * CM, fill: 'none', stroke: '#f0c040', 'stroke-width': 3, 'stroke-dasharray': '6,4' }, s);
            label(api, s, SX + w * CM / 2, SY + 20, w + ' cm', { anchor: 'middle' });
            label(api, s, SX - 14, SY - hh * CM / 2, hh + ' cm', { anchor: 'middle', rotate: -90 });
            // the push arrows: the 10 × 10 cm sail, the 20 × 20 cm sail and yours, on ONE honest scale. The biggest
            // sail (40 × 40 cm) fills the row, and even the 10 × 10 cm arrow is drawn to scale, so "about 4 times" is true on screen too.
            const len = api.draw.forceScale(push(START, 0.16, FLAT), W - BX - 16, { min: 5, over: 0 });
            label(api, s, BX, BY + 28, 'Push at the start line', { color: '#f0e6ff', size: 16 });
            [[ref, '10 × 10 cm sail', '#f0c040'], [p20, '20 × 20 cm sail', '#c8a0ff'], [p, 'Your sail', '#40e080']].forEach(function (b, i) {
              const y = BY + 56 + i * RH;
              label(api, s, BX, y, b[1], { color: b[2] });
              forceArrow(api, s, BX, y + 7, len(b[0]), b[2]);
            });
            const fair = len.toScale(p) && len.toScale(ref) && len.toScale(p20);
            const parts = ['📐 Area: ' + w + ' cm × ' + hh + ' cm = ', [w * hh + ' square cm'], '. '];
            if (w === 10 && hh === 10) parts.push('This is the 10 × 10 cm sail: the yellow dashed square. ');
            else parts.push('Your sail’s push is ', [cmp(p, ref, 'the 10 × 10 cm sail’s', { exact: true, times: fair })], '. ');
            if (w === 20 && hh === 20) parts.push('This is the 20 × 20 cm sail.');
            else parts.push(w === 10 && hh === 10 ? 'Its push is ' : 'It is ', [cmp(p, p20, 'the 20 × 20 cm sail’s', { exact: true, times: fair })], '.');
            say(api, out, parts);
            if (w * hh === 400 && w !== hh) api.done('Yes! ' + w + ' × ' + hh + ' = 400 square cm. That’s the same area as 20 × 20. Same area, same push! ' +
              'The shape doesn’t change the push. The area does.');
          }
          draw();
          keepFitted(api, el, draw);
        }
      },
      {
        title: 'The wind fades down the hall',
        html:
          '<p><strong>Secret #2: the wind fades.</strong> The moving air spreads out as it goes down the hall. ' +
          'So it slows down the farther it gets from the fans.</p>' +
          '<p>Slide the wind meter (the yellow line) down our ' + HALL_TXT + ' hall. Watch the wind speed and the push on a 20 × 20 cm sail.</p>',
        challenge: 'Find the spot where the wind is half as fast as at the fans (50%). Then look at the push.',
        render: function (el, api) {
          const K = api.kid;
          const s = api.svg('svg', { role: 'img', 'aria-label': 'The hallway seen from the side, with the wind from the two fans getting weaker down the hall, and bars for the wind speed and the push on the sail' }, el);
          const d = api.ui.slider(el, { label: 'Distance from the fans', min: 0, max: GAUGE_FT, step: 1, value: 0, format: function (f) { return K.dist(ftToM(f)); }, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const AREA = 0.04, V0 = P.FAN.v0, p0 = push(0, AREA, FLAT);   // the biggest push in the hall: right at the fans
          api.ui.note(el, 'good', '🏁 <strong>This is why your car stops.</strong> Far down the hall, the wind is weak. ' +
            'Past about ' + K.dist(ftToM(WEAK_FT)) + ', its push on the sail is smaller than friction. ' +
            'A rolling car feels even less push, because it moves along with the air. ' +
            'So a typical car slows down and stops at about ' + K.dist(TYPICAL_RUN.distance) + '.');
          api.ui.note(el, 'tip', '💡 <strong>The start line matters.</strong> Close to the fans, the wind is fast. Fast wind pushes much harder. ' +
            'Wind twice as fast gives about 4 times the push!');
          function draw() {
            const f = d.get(), x = ftToM(f), v = P.windAt(x), p = push(x, AREA, FLAT);
            const pct = Math.round(v / V0 * 100);
            const W = boardWidth(el), FL = 134, X0 = 50, X1 = W - 20, H = FL + 150;
            function gx(ft) { return X0 + ft / GAUGE_FT * (X1 - X0); }
            startBoard(api, s, W, H);
            // the hallway floor, with a foot mark every 10 ft (labels every 10 or 20 ft, whatever fits)
            api.svg('line', { x1: 10, y1: FL, x2: W - 10, y2: FL, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            const every = gx(10) - gx(0) >= 46 ? 10 : 20;
            for (let m = 0; m <= GAUGE_FT; m += 10) {
              api.svg('line', { x1: gx(m), y1: FL, x2: gx(m), y2: FL + 7, stroke: '#6a5a8a', 'stroke-width': 1.5 }, s);
              if (m % every === 0) label(api, s, gx(m), FL + 34, m + ' ft', { anchor: 'middle', color: '#a090c0', bold: false, size: 13 });
            }
            api.draw.fan(s, 12, FL, 76);                                    // at 12 px its "2 FANS" label stays inside the board
            // wind arrows: shorter and fainter where the wind is slower
            const gap = gx(5) - gx(0) >= 30 ? 5 : 10, maxLen = Math.min(40, gx(gap) - gx(0) - 4);
            for (let m = 0; m < GAUGE_FT; m += gap) {
              const k = P.windAt(ftToM(m)) / V0, g = api.svg('g', { opacity: (0.3 + 0.7 * k).toFixed(2) }, s);
              [FL - 24, FL - 46, FL - 68].forEach(function (y, i) {
                api.draw.arrow(g, gx(m) + (i % 2) * 4, y, gx(m) + (i % 2) * 4 + Math.max(6, maxLen * k), y, '#7ad7ff', '', { width: 2, head: 4 });
              });
            }
            // the wind meter
            const mx = gx(f);
            api.svg('line', { x1: mx, y1: FL - 104, x2: mx, y2: FL, stroke: '#f0c040', 'stroke-width': 3, 'stroke-dasharray': '6,4' }, s);
            api.svg('circle', { cx: mx, cy: FL - 104, r: 7, fill: '#f0c040' }, s);
            const anchor = mx < 70 ? 'start' : mx > W - 70 ? 'end' : 'middle';
            label(api, s, mx + (anchor === 'start' ? -6 : anchor === 'end' ? 6 : 0), FL - 116, 'wind ' + pct + '%', { anchor: anchor, color: '#f0c040', size: 16 });
            // bars: the wind speed, and the push on the sail with the typical car's friction marked on it. The push bar
            // and the friction mark share ONE honest scale (the push right at the fans fills the bar).
            const BX = 14, BW = W - 28, y1 = FL + 62, y2 = FL + 112;
            const len = api.draw.forceScale(p0, BW, { min: 3, over: 0 });
            label(api, s, BX, y1 - 6, 'Wind: ' + pct + '% as fast as at the fans', { color: '#7ad7ff', size: 14 });
            api.svg('rect', { x: BX, y: y1, width: BW, height: 14, rx: 3, fill: '#2a1a4a' }, s);
            api.svg('rect', { x: BX, y: y1, width: Math.max(2, BW * v / V0), height: 14, rx: 3, fill: '#7ad7ff' }, s);
            label(api, s, BX, y2 - 6, 'Push on the sail', { color: '#40e080', size: 14 });
            api.svg('rect', { x: BX, y: y2, width: BW, height: 14, rx: 3, fill: '#2a1a4a' }, s);
            api.svg('rect', { x: BX, y: y2, width: len(p), height: 14, rx: 3, fill: '#40e080' }, s);
            const fx = BX + len(FRICTION);
            api.svg('line', { x1: fx, y1: y2 - 4, x2: fx, y2: y2 + 18, stroke: '#ffa040', 'stroke-width': 3 }, s);
            label(api, s, fx - 4, y2 + 32, 'friction', { color: '#ffa040', size: 13 });
            const vsFriction = cmp(p, FRICTION, 'friction', { exact: true, times: len.toScale(p) && len.toScale(FRICTION) });
            const parts = f === 0
              ? ['📍 Right at the fans, the wind moves at ' + K.speed(v) + '. This is the fastest wind in the hall. So the push is biggest here. It is ', [vsFriction], '.']
              : ['📍 ' + K.dist(x) + ' from the fans, the wind moves at ' + K.speed(v) + '. That’s ', [pct + '% as fast'], ' as at the fans. At the fans, the push is ',
                 [cmp(p0, p, 'it is here', { times: len.toScale(p0) && len.toScale(p) })], '. Here, the push is ' + (p > FRICTION ? 'still ' : ''), [vsFriction], '.'];
            if (p < FRICTION) parts.push(' So the wind can’t keep a car rolling here.');
            say(api, out, parts);
            // exactly what the readout shows: 50%
            if (pct === 50) api.done('At ' + K.dist(x) + ', the wind is half as fast. But the push at the fans is ' + K.compare(p0, p, { noun: 'it is here' }) + '! ' +
              'Slow air hits the sail more gently. And less air hits it each second. So the push drops a lot.');
          }
          draw();
          keepFitted(api, el, draw);
        }
      },
      {
        title: 'Shape and angle',
        html:
          '<p>Two more things change the push: the sail’s <strong>shape</strong> and its <strong>angle</strong>.</p>' +
          '<p><strong>Shape:</strong> A <span class="key">cupped</span> sail curves like a cupped hand. The hollow side faces the fans. ' +
          'It holds the air, so less air slides off the edges. A cupped sail gets a little more push than a flat one.</p>' +
          '<p><strong>Angle:</strong> A sail turned away from the fans catches less wind. The fans see a thinner sail, so less air hits it. ' +
          'And that air hits at a slant, so it slides off.</p>',
        challenge: 'Turn the FLAT sail until it gets half the push it gets at 0°. Its arrow will end at the “half” mark.',
        render: function (el, api) {
          const K = api.kid;
          const s = api.svg('svg', { role: 'img', 'aria-label': 'A sail seen from above, turned at an angle to the wind from the two fans' }, el);
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const shape = api.ui.choice(row, { label: 'Sail shape', value: FLAT, options: [{ value: FLAT, label: 'Flat' }, { value: CUPPED, label: 'Cupped' }], onChange: draw });
          const ang = api.ui.slider(row, { label: 'Angle away from the fans', min: 0, max: 90, step: 5, value: 0, format: function (v) { return v + '°'; }, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const AREA = 0.04, full = push(START, AREA, FLAT, 0);
          function draw() {
            const cd = shape.get(), a = ang.get(), rad = a * Math.PI / 180, c = Math.cos(rad), sn = Math.sin(rad);
            const p = push(START, AREA, cd, a);
            const W = boardWidth(el), BXR = W - 84;                          // the "fans see" bracket
            const L = Math.min(80, Math.floor((BXR - 52) / 2 - 24));         // half the sail's width in px
            const CX = Math.round((52 + BXR) / 2), CY = 40 + L, BY = CY + L + 56, RH = 48, H = BY + 2 * RH + 22;   // BY: the arrows' first label, clear of "2 fans"
            startBoard(api, s, W, H);
            label(api, s, 12, 22, 'Seen from above', { color: '#9080b0', bold: false, size: 13 });
            // the two box fans side by side, seen from above
            [CY - L - 8, CY + 4].forEach(function (y) { api.svg('rect', { x: 14, y: y, width: 22, height: L + 4, rx: 4, fill: '#3a2a5a', stroke: '#9080b0', 'stroke-width': 2 }, s); });
            label(api, s, 12, CY + L + 26, '2 fans', { color: '#9080b0', size: 13 });
            // where the sail would be if it faced the fans square-on
            api.svg('line', { x1: CX, y1: CY - L - 6, x2: CX, y2: CY + L + 6, stroke: '#6a5a8a', 'stroke-width': 1.5, 'stroke-dasharray': '4,4' }, s);
            // wind: rows that hit the sail stop at it; the rest blow past
            const miss = api.svg('g', { opacity: 0.28 }, s), BUL = cd === CUPPED ? L * 0.32 : 0;
            for (let y = CY - L - 2; y <= CY + L + 2; y += Math.max(12, Math.round(L / 6))) {
              const off = y - CY, t = (off / (L * c) + 1) / 2;     // t: where along the sail this row lands (0 = top end, 1 = bottom end)
              if (Math.abs(off) < L * c - 2) api.draw.arrow(s, 44, y, CX + off * sn / c + 2 * t * (1 - t) * BUL * c - 4, y, '#7ad7ff', '', { width: 2, head: 5 });
              else api.draw.arrow(miss, 44, y, BXR - 8, y, '#7ad7ff', '', { width: 2, head: 5 });
            }
            // the sail (a cupped sail bulges away from the fans) and its mast
            const ax = CX - L * sn, ay = CY - L * c, bx = CX + L * sn, by = CY + L * c;
            if (cd === CUPPED) api.svg('path', { d: 'M ' + ax + ',' + ay + ' Q ' + (CX + BUL * c) + ',' + (CY - BUL * sn) + ' ' + bx + ',' + by, fill: 'none', stroke: '#f0e6ff', 'stroke-width': 6, 'stroke-linecap': 'round' }, s);
            else api.svg('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: '#f0e6ff', 'stroke-width': 6, 'stroke-linecap': 'round' }, s);
            api.svg('circle', { cx: CX, cy: CY, r: 5, fill: '#c8a060' }, s);
            label(api, s, CX + 10, CY - L - 10, a + '°', { color: '#f0c040', size: 18 });
            // how wide the sail looks from the fans
            const half = L * c;
            if (half > 1) {
              api.svg('line', { x1: BXR, y1: CY - half, x2: BXR, y2: CY + half, stroke: '#f0c040', 'stroke-width': 2.5 }, s);
              [CY - half, CY + half].forEach(function (yy) { api.svg('line', { x1: BXR - 7, y1: yy, x2: BXR + 7, y2: yy, stroke: '#f0c040', 'stroke-width': 2.5 }, s); });
            }
            label(api, s, BXR + 12, CY - 6, 'fans see', { color: '#f0c040', bold: false });
            label(api, s, BXR + 12, CY + 16, Math.round(c * 100) + '%', { color: '#f0c040', size: 18 });
            // push arrows on ONE honest scale (the biggest push here, a cupped sail at 0°, fills the row): a flat sail
            // at 0° and yours, with a mark where half of the flat sail's push ends
            const len = api.draw.forceScale(push(START, AREA, CUPPED, 0), W - 32, { min: 7, over: 0 });
            [[full, 'flat sail at 0°', '#f0c040'], [p, 'your sail', '#40e080']].forEach(function (b, i) {
              const y = BY + i * RH;
              label(api, s, 12, y, b[1], { color: b[2] });
              forceArrow(api, s, 12, y + 7, len(b[0]), b[2]);
            });
            const hx = 12 + len(full / 2), hy = BY + RH;
            api.svg('line', { x1: hx, y1: hy + 1, x2: hx, y2: hy + 31, stroke: '#f0c040', 'stroke-width': 2, 'stroke-dasharray': '4,3' }, s);
            label(api, s, hx, hy + 46, 'half', { anchor: 'middle', color: '#f0c040', size: 14 });
            const cp = Math.round(c * 100) + '%';
            const parts = a === 90 ? ['Your sail gets ', ['no push'], '. ']
              : ['Your sail’s push is ', [cmp(p, full, 'a flat sail’s push at 0°', { exact: true, times: len.toScale(p) && len.toScale(full) })], '. '];
            if (a === 0) parts.push('The sail faces the fans, so the whole sail catches the wind.');
            else if (a === 90) parts.push('The sail is turned all the way sideways. The fans only see its thin edge, so it catches nothing.');
            else parts.push('Turned ' + a + '°: the fans see ' + cp + ' of the sail’s width. And that air hits at a slant, so it slides off.');
            if (cd === CUPPED && a < 90) parts.push(' The cupped shape adds a little extra push.');
            say(api, out, parts);
            if (cd === FLAT && Math.abs(p / full - 0.5) < 0.005) api.done('At ' + a + '°, the sail gets only half the push! Keep your real sail facing straight at the fans.');
          }
          draw();
          keepFitted(api, el, draw);
        }
      },
      {
        title: 'Hallway challenge: catch the wind',
        html:
          '<p>Time to put it all together! Pick your sail’s size and shape. Then send the car down the hall. The sail faces straight at the fans.</p>' +
          '<p>A bigger sail catches more wind. But watch out! The wind pushes high on the sail, above the wheels. ' +
          'Too much push up there can flip the car onto its nose.</p>' +
          '<p>Your goal is ' + GOAL_TXT + '. That’s twice as far as last year’s paper sleds usually went (about 25 ft).</p>',
        challenge: 'Roll at least ' + GOAL_TXT + ' without tipping over.',
        render: function (el, api) {
          const K = api.kid;
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const size = api.ui.slider(row, { label: 'Sail size (square)', min: SIZES.min, max: SIZES.max, step: SIZES.step, value: SIZES.start, format: function (v) { return v + ' × ' + v + ' cm'; }, onInput: info });
          const shape = api.ui.choice(row, { label: 'Sail shape', value: FLAT, options: [{ value: FLAT, label: 'Flat' }, { value: CUPPED, label: 'Cupped' }], onChange: info });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          // your car's start push next to a car with a small 10 × 10 cm sail, as arrows on one fixed scale (so a
          // bigger sail always draws a longer arrow than a smaller one, from one setting to the next)
          const bars = api.ui.forceBars(el, [], { max: BAR_MAX });
          // A prediction is judged once, by the first run after it is picked (as in Module 6, step 2). Then it is spent:
          // once the sail changes, later runs show only the plain result in the hallway readout, so a student is never
          // told "You predicted … Surprise!" about a car they changed after predicting. Running the SAME car again
          // (judgedKey: the sail size and shape that were judged) shows the same answer again. A new pick (even the same
          // choice again) is judged by the next run that STARTS after it (pickedAfter: a run already playing when the
          // student picks does not judge that pick).
          let pending = false, judgedKey = null, pickedAfter = null, sim = null, again = null;
          // no angle control here: a real sail is built facing the fans (Step 3 is where the angle lesson lives)
          function car() { return sailCar(size.get(), size.get(), shape.get(), 0); }
          function key() { return size.get() + '|' + shape.get(); }
          // after a judged guess, a new sail gets a nudge in the card: pick again to have the new sail judged
          function nudge() {
            if (!again) return;
            const on = !pending && judgedKey != null && judgedKey !== key();
            const txt = on ? '🔁 New sail? Pick again to test a new guess.' : '';
            if (again.textContent !== txt) again.textContent = txt;   // only on a change, so the slider doesn't repeat it aloud
            again.hidden = !on;
          }
          function info() {
            const c = car(), p = carPush(c);
            bars.update([{ label: 'your car’s push', value: p, color: '#40e080' }, { label: 'push with a 10 × 10 cm sail', value: SMALL_PUSH, color: '#f0c040' }]);
            say(api, out, ['⛵ Sail area: ', [Math.round(c.sailArea * 10000) + ' square cm'], '. The car weighs ', [K.grams(c.mass)],
              '. Your start-line push is ', [cmp(p, SMALL_PUSH, 'with a 10 × 10 cm sail', { exact: true, times: bars.len.toScale(p) && bars.len.toScale(SMALL_PUSH) })], '.']);
            if (sim) sim.reset();                               // redraw the car with its new sail, ready for the next run
            nudge();
          }
          info();
          const WHY = {
            tip: 'This big sail gets a huge push high above the wheels. That push flipped the car forward.',
            short: 'A small sail catches only a little wind. Down the hall, the weak wind soon loses to friction.',
            mid: 'This sail catches more wind than a small 10 × 10 cm sail. So it rolls farther. ' +
              'But the fading wind still loses to friction before ' + GOAL_FT + ' ft.',
            far: 'This big sail catches more wind than a smaller one. So the push beats friction for longer, and the car rolls ' + GOAL_FT + ' ft or more.'
          };
          const guess = api.ui.predict(el, {
            question: 'Pick your sail first. How far do you think your car will roll?',
            choices: [{ value: 'short', label: 'Less than 30 ft' }, { value: 'mid', label: '30 to ' + (GOAL_FT - 1) + ' ft' },
                      { value: 'far', label: GOAL_FT + ' ft or more' }, { value: 'tip', label: 'It will tip over' }],
            judge: function (r, v) {
              if (pending && r === pickedAfter) return null;   // picked while this run was playing: the next run judges it
              if (!pending && judgedKey !== key()) return null; // the sail changed since this pick was judged: just the plain result
              pending = false; judgedKey = key();
              nudge();
              const got = band(r);
              return { text: got === 'tip' ? 'The car tipped over at the start!' : 'The car rolled ' + K.dist(r.distance) + '.', right: got === v, why: WHY[got] };
            }
          });
          again = api.h('div', { class: 'sl-predict-hint', style: 'color:#ffd080', 'aria-live': 'polite', hidden: true });
          if (guess.el) guess.el.appendChild(again);
          guess.onChange(function (v) {
            pending = v != null;
            pickedAfter = sim ? sim.last() : null;            // the run playing now (or the last one): it started before this pick
            nudge();
          });
          sim = api.ui.trackSim(el, car, {
            scaleM: HALL_M,                                     // the whole hallway, the same view every run, so runs are easy to compare
            needPrediction: guess,
            onResult: function (r) {
              if (r.reason === 'tipped over' || K.ft(r.distance) < GOAL_FT) return;
              api.done((r.reason === 'reached the end of the hall'
                ? 'It rolled all the way to the end of the ' + HALL_TXT + ' hall without tipping! '
                : 'It rolled ' + K.dist(r.distance) + ' without tipping! ') +
                'A bigger sail catches more wind, so it goes farther. But a sail bigger than ' + BIGGEST_SAFE + ' × ' + BIGGEST_SAFE + ' cm flips the car. Its push is too big and too high up. ' +
                'Modules 5 and 6 show how to fix that.');
            }
          });
          api.onLeave(sim.stop);
          api.ui.note(el, 'warn', '⚖️ See the car’s weight go up as the sail grows? A big sail adds weight. ' +
            'A tall sail also puts the push high above the wheels. Modules 5 and 6 show how to handle a big sail.');
        }
      },
      {
        title: 'Real build: make a sail that catches the wind',
        html:
          '<p><strong>Build tips:</strong></p>' +
          '<ul><li><strong>Paper or cardstock?</strong> Paper is light but floppy. It bends back and spills air. ' +
          'Cardstock keeps its shape, but it is 2 to 3 times as heavy. A good trick: tape straws or pipe cleaners along the edges of a paper sail.</li>' +
          '<li><strong>Size:</strong> About 20 cm on each side is a good start. It fits on one sheet of printer paper (about 21 × 28 cm). ' +
          'A bigger sail can tip the car. Modules 5 and 6 help with that.</li>' +
          '<li><strong>Make it cupped:</strong> Gently roll cardstock around a water bottle so it curves. The hollow side faces the fans. Keep the curve gentle.</li>' +
          '<li><strong>Mast:</strong> Hot-glue a skewer straight up in the middle of the car. Tape the sail to it at the top, middle and bottom.</li>' +
          '<li><strong>No flapping:</strong> Tape a popsicle stick or straw across the bottom edge of the sail.</li>' +
          '<li><strong>Face the fans:</strong> Crouch next to the fans and look at your car. You should see the whole sail, not its edge.</li></ul>' +
          '<p><strong>Test it in the hall:</strong></p>' +
          '<ol><li><strong>Feel the fade:</strong> Hold a strip of paper ' + KID.dist(ftToM(3)) + ' from the fans. ' +
          'Then try ' + [15, 30].map(function (f) { return KID.dist(ftToM(f)); }).join(', ') + ' and ' + KID.dist(ftToM(60)) + '. Watch it flutter less and less.</li>' +
          '<li><strong>Sail swap:</strong> Run your car with two sails, like 15 cm and 20 cm. Do 3 runs with each. Change only ONE thing at a time.</li>' +
          '<li><strong>Tip check:</strong> Watch from the side as the car starts. Do the back wheels lift? Then move the sail lower, or make it shorter.</li></ol>',
        render: function (el, api) {
          api.ui.note(el, 'build', '🛠️ <strong>Your materials:</strong> Use paper or cardstock for the sail. Use a skewer or thin dowel for the mast. ' +
            'Straws or pipe cleaners make a frame. Hold it all together with popsicle sticks, tape and hot glue.');
        }
      }
    ],
    quiz: [
      // The options in each question are about the same length, so "pick the longest" is no clue: the right
      // answer is the single longest option in at most 3 of the 10, and the single shortest in at most 3.
      // The wrong options are ideas a 6th grader might really hold. (The quiz shuffles the options.)
      { q: 'What is thrust?', options: ['The push that moves the car forward', 'The rubbing that slows the car down', 'How fast the car rolls down the hall', 'The weight that holds the car down'], answer: 0,
        why: 'Thrust is the push that moves the car forward. For a sail car, it is the wind pushing on the sail.' },
      { q: 'You make your sail twice as wide AND twice as tall. How much push does it get now?', options: ['The same push as before', '2 times as much push', '4 times as much push', '8 times as much push'], answer: 2,
        why: 'The new sail holds 4 of the old sails (2 × 2). So it has 4 times the area and gets 4 times the push.' },
      { q: 'Sail A is 20 cm × 20 cm. Sail B is 10 cm × 40 cm. Both face the fans. Which gets more push?', options: ['Sail A, because it is a square', 'Sail B, because it is taller', 'The same, because the areas match', 'It depends on how strong the wind is'], answer: 2,
        why: 'Both sails have an area of 400 square cm. Same area, same push.' },
      { q: 'Where in the hall does your sail get the biggest push?', options: ['Near the fans, at the start line', 'Far down the hall, near the end', 'In the middle, once it gets going', 'The same everywhere in the hall'], answer: 0,
        why: 'The wind spreads out and fades down the hall. So the push is biggest close to the fans.' },
      { q: 'Wind A blows twice as fast as Wind B. How does Wind A’s push on the same sail compare?', options: ['About the same as Wind B', 'About 2 times as strong', 'About 4 times as strong', 'About 8 times as strong'], answer: 2,
        why: 'Faster air hits harder, and more of it hits each second. So wind twice as fast gives about 4 times the push.' },
      { q: 'Your car slows down and stops about ' + KID.ft(TYPICAL_RUN.distance) + ' ft down the hall. The fans are still on. Why?', options: ['Gravity pulls harder at the far end', 'The wind is weak there, so friction wins', 'The car gets heavier the farther it rolls', 'The wind turns around and blows back'], answer: 1,
        why: 'The wind fades down the hall. Far away, its push is smaller than friction, so the car slows down and stops.' },
      { q: 'Two sails are the same size. Which one gets a little MORE push?', options: ['A flat sail, held stiff and straight', 'A cupped sail, hollow side to the fans', 'A cupped sail, bulging side to the fans', 'A sail with holes to let the air through'], answer: 1,
        why: 'The hollow side holds the air like a cupped hand. So it gets a little more push than a flat sail.' },
      { q: 'Which way should your sail face?', options: ['Straight toward the two fans', 'Turned halfway to the side', 'With its thin edge toward the fans', 'It doesn’t matter which way'], answer: 0,
        why: 'When it faces straight at the fans, the whole sail catches the wind. A turned sail catches less.' },
      { q: 'Your paper sail bends back and flaps in the wind. What is the best fix?', options: ['Use thin, light paper instead', 'Tape straws along the sail’s edges', 'Turn its edge toward the fans', 'Tape it to the mast only at the top'], answer: 1,
        why: 'The straws make a frame that keeps the sail stiff. Then it keeps catching the wind instead of spilling it.' },
      { q: 'You build a giant sail, 40 cm tall. At the start, the car flips onto its nose. Why?', options: ['The heavy sail pulls the front down', 'The wind gets under the car and lifts it', 'Its big push up high tips the car forward', 'The wheels roll too fast at the start'], answer: 2,
        why: 'The wind pushes high above the wheels. A big, tall sail gets so much push that it flips the car.' }
    ]
  });
})();
