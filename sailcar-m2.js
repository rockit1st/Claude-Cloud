// Sail Car Lab — Module 2: Thrust
// How the wind from the two box fans pushes on the sail: sail AREA, wind SPEED (and how it fades
// down the hallway), sail SHAPE and sail ANGLE. Every number comes from SailLab.physics
// (airForce, windAt, rollingFriction, simulate) — the same model the hallway and Design Studio use.
(function () {
  'use strict';
  const P = SailLab.physics;
  const START = 0.3;                                    // the start line: 30 cm from the fans (simulate's default startX)
  const PAPER = 0.08;                                   // printer paper weighs about 80 g per square metre
  const FRAME = P.DEFAULT_CAR.mass - P.DEFAULT_CAR.sailArea * PAPER;   // the default car without its 20 × 20 cm paper sail
  const FLAT = 1.2, CUPPED = 1.4;                       // drag coefficients ("catch numbers") of a flat and a cupped sail
  const FT = 3.281;                                     // feet in a metre
  // The real hallway lives in ONE place (SailLab.physics.HALL, 70 ft × 11 ft today); everything here reads it from there.
  const HALL_M = P.HALL.length;                         // metres a car can roll from the start line before it reaches the far end
  const HALL_FT = Math.round(HALL_M * FT);              // …in feet (70)
  const END_X = START + HALL_M;                         // the far end of the hall, measured from the fans (simulate() starts cars at START)
  // Numbers the text quotes, worked out from the wind model so they always match it:
  const HALF_X = P.FAN.L;                               // wind(x) = v0 / (1 + x / L) is half of v0 at x = L
  const ONE_X = P.FAN.L * (P.FAN.v0 - 1);               // …and down to 1 m/s here
  const TYPICAL_RUN = P.simulate({});                   // the typical 70 g car with a 20 × 20 cm sail…
  const TYPICAL = TYPICAL_RUN.distance;                 // …rolls this far (16 m) and coasts to a stop, short of the end of the hall
  const GOAL = 15;                                      // hallway challenge, metres (about 50 ft: twice a paper sled's 25 ft; M1 asks 12 m)
  const FAR_TEST = Math.floor(HALL_M / 5) * 5;          // the farthest "feel the fade" spot that is still inside the hall (20 m)
  function m(v) { return String(Math.round(v * 10) / 10); }
  const HALL_TXT = m(HALL_M) + ' m (' + HALL_FT + ' ft)';   // "21.3 m (70 ft)"
  // A w × h cm paper sail mounted low on the mast: its middle sits 3 cm + half its height above the floor.
  function sailCar(w, h, cd, ang) {
    const area = w * h / 10000;
    return { sailArea: area, sailCd: cd, sailAngle: ang || 0, sailHeight: 0.03 + h / 200, mass: FRAME + area * PAPER };
  }
  // push on a sail sitting still x metres from the fans
  function push(x, area, cd, ang) { return P.airForce(P.windAt(x), area, cd, ang || 0); }
  function nice(v) { return String(Math.round(v * 100) / 100); }
  // a force in newtons with 3 significant figures (0.353 N, 0.0882 N), so a weak push is easy to tell apart from friction
  function newtons(api, v) { return (v < 0.1 ? api.fmt(v, 4) : api.fmt(v, 3)) + ' N'; }
  // write a readout from plain strings and ['bold'] pieces — never innerHTML
  function say(api, box, parts) {
    box.textContent = '';
    parts.forEach(function (p) { box.appendChild(typeof p === 'string' ? document.createTextNode(p) : api.h('strong', { text: p[0] })); });
  }
  // a 560-wide drawing, shown no wider than 620 px so a Chromebook screen fits the picture AND its sliders
  function board(api, el, hgt, aria) {
    return api.svg('svg', { viewBox: '0 0 560 ' + hgt, width: 620, role: 'img', 'aria-label': aria }, el);
  }
  function clear(api, s, hgt) { s.textContent = ''; api.svg('rect', { x: 0, y: 0, width: 560, height: hgt, rx: 12, fill: '#120826' }, s); }
  function label(api, s, x, y, text, o) {
    o = o || {};
    return api.svg('text', { x: x, y: y, 'text-anchor': o.anchor || 'start', fill: o.color || '#c8b8ea', 'font-size': o.size || 16,
      'font-weight': o.bold === false ? null : 700, class: 'sl-lbl', transform: o.rotate ? 'rotate(' + o.rotate + ',' + x + ',' + y + ')' : null }, s, text);
  }

  SailLab.register({
    id: 'thrust',
    num: 2,
    title: 'Thrust',
    icon: '💨',
    blurb: 'Catch the wind! How sail size, wind speed, shape and angle change the push.',
    minutes: 15,
    steps: [
      {
        title: 'Catch more air: sail area',
        html:
          '<p>Our two box fans sit side by side at the start of the hallway and blow a wide stream of air down the hall. When that air hits your sail, it pushes. ' +
          'That push is called <span class="key">thrust</span>. It’s the force that moves your car forward!</p>' +
          '<p>Secret #1: <strong>a bigger sail catches more air.</strong> The size of the sail’s face is its <span class="key">area</span>: ' +
          'width × height, measured in square centimetres (cm²). Twice the area = twice the push.</p>' +
          '<p>Build a sail below. The push is measured at the <strong>start line</strong>, 30 cm in front of the fans.</p>',
        challenge: 'Start with the 10 cm × 10 cm sail. Change the width and height until your sail gets exactly 4 times the push (× 4).',
        render: function (el, api) {
          const s = board(api, el, 270, 'Your sail on a grid, and the push it gets compared with a 10 by 10 centimetre sail');
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const cm = function (v) { return v + ' cm'; };
          const wS = api.ui.slider(row, { label: 'Sail width', min: 10, max: 40, step: 5, value: 10, format: cm, onInput: draw });
          const hS = api.ui.slider(row, { label: 'Sail height', min: 10, max: 40, step: 5, value: 10, format: cm, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          api.ui.note(el, 'warn', '⚠️ <strong>Bigger isn’t free.</strong> A big sail is heavier, and its push sits high above the wheels, so it can tip your car. ' +
            'You’ll bump into that in the hallway challenge, and learn to fix it in Modules 5 and 6.');
          const ref = push(START, 0.01, FLAT);                       // the 10 × 10 cm sail
          const big = push(START, 0.16, FLAT), SC = 170 / big;       // px per newton: the biggest sail fills the bar
          const K = 4.4, SX = 56, SY = 232;                          // px per cm, bottom-left corner of the sail
          function draw() {
            const w = wS.get(), hh = hS.get(), p = push(START, w * hh / 10000, FLAT);
            clear(api, s, 270);
            // left: the sail as the fan sees it, on a grid of 5 cm squares
            label(api, s, SX, 30, 'Your sail', { color: '#f0e6ff', size: 18 });
            api.svg('rect', { x: SX, y: SY - hh * K, width: w * K, height: hh * K, fill: '#f0e6ff', opacity: 0.92, stroke: '#9080b0', 'stroke-width': 2 }, s);
            for (let i = 5; i < w; i += 5) api.svg('line', { x1: SX + i * K, y1: SY - hh * K, x2: SX + i * K, y2: SY, stroke: '#b0a0d0', 'stroke-width': 1 }, s);
            for (let j = 5; j < hh; j += 5) api.svg('line', { x1: SX, y1: SY - j * K, x2: SX + w * K, y2: SY - j * K, stroke: '#b0a0d0', 'stroke-width': 1 }, s);
            api.svg('rect', { x: SX, y: SY - 10 * K, width: 10 * K, height: 10 * K, fill: 'none', stroke: '#f0c040', 'stroke-width': 3, 'stroke-dasharray': '6,4' }, s);
            label(api, s, SX + w * K / 2, SY + 24, w + ' cm', { anchor: 'middle' });
            label(api, s, SX - 16, SY - hh * K / 2, hh + ' cm', { anchor: 'middle', rotate: -90 });
            // right: push bars
            const BX = 296;
            label(api, s, BX, 30, 'Push at the start line', { color: '#f0e6ff', size: 18 });
            [[ref, 70, '10 × 10 cm sail', '#f0c040'], [p, 136, 'Your sail', '#40e080']].forEach(function (b) {
              label(api, s, BX, b[1], b[2], { color: b[3], size: 17 });
              api.svg('rect', { x: BX, y: b[1] + 8, width: b[0] * SC, height: 22, rx: 3, fill: b[3] }, s);
              label(api, s, BX + b[0] * SC + 8, b[1] + 25, api.fmt(b[0], 3) + ' N', { bold: false, size: 17 });
            });
            label(api, s, 418, 226, '× ' + nice(p / ref), { anchor: 'middle', color: '#40e080', size: 40 });
            label(api, s, 418, 254, 'the push of 10 × 10', { anchor: 'middle', size: 17, bold: false });
            say(api, out, ['📐 Area = ' + w + ' cm × ' + hh + ' cm = ', [w * hh + ' cm²'], ' (' + (w * hh / 25) + ' little squares of 5 × 5 cm). Push at the start line: ',
              [api.fmt(p, 3) + ' N'], ' — that’s ', ['× ' + nice(p / ref)], ' the push on the 10 × 10 cm sail (the yellow dashed square).']);
            if (w * hh === 400) api.done(w + ' × ' + hh + ' = 400 cm², which is 4 × the area of the 100 cm² sail, so it gets 4 × the push. ' +
              (w === hh ? 'Doubling the width AND the height (2 × 2) does exactly that!' : 'Making one side 4 times as long works too: 1 × 4 = 4.'));
          }
          draw();
        }
      },
      {
        title: 'Wind speed — and how it fades',
        html:
          '<p>Secret #2: <strong>faster wind pushes MUCH harder.</strong> When the wind goes twice as fast, each bit of air hits the sail harder, ' +
          '<em>and</em> twice as much air hits it every second. So the push grows 2 × 2 = <strong>4 times</strong>.</p>' +
          '<p style="text-align:center;font-size:1.1rem"><strong>push grows with wind speed × wind speed</strong></p>' +
          '<p>Here’s the catch: the wind <span class="key">fades</span>. The moving air spreads out and slows down the farther it gets from the fans. ' +
          'Our two box fans on high blow about ' + P.FAN.v0 + ' metres per second (m/s) right at the grilles. ' +
          'Side by side, they make a wide stream of air, and a wide stream fades slowly — but it does fade. Farther away:</p>' +
          '<p style="text-align:center"><strong>wind = ' + P.FAN.v0 + ' m/s ÷ (1 + distance ÷ ' + P.FAN.L + ' m)</strong></p>' +
          '<p>Slide the wind gauge (the yellow dot) down our ' + HALL_TXT + ' hallway. Watch the wind speed and the push on a 20 cm × 20 cm sail.</p>',
        challenge: 'Find the spot where the wind is HALF as fast as right at the fans (50%). Then look at what happened to the push.',
        render: function (el, api) {
          const s = board(api, el, 316, 'Graph of wind speed getting weaker with distance from the fans, along the ' + m(HALL_M) + ' metre hallway');
          // step 0.4 m lands exactly on the half-speed spot (L = 4.8 m); the gauge stops at the last step inside the hall
          const d = api.ui.slider(el, { label: 'Distance from the fans', min: 0, max: END_X, step: 0.4, value: 0, format: function (v) { return v.toFixed(1) + ' m'; }, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const AREA = 0.04, V0 = P.FAN.v0, p0 = push(0, AREA, FLAT), fr = P.rollingFriction(P.DEFAULT_CAR.mass, P.DEFAULT_CAR.crr);
          // where the push on a 20 × 20 cm sail sitting still drops to friction: wind² = friction ÷ (½ × air × 1.2 × area)
          const STILL_X = P.FAN.L * (V0 / Math.sqrt(fr / (0.5 * P.AIR * FLAT * AREA)) - 1);
          api.ui.note(el, 'good', '🏁 <strong>This is why your car stops.</strong> Far down the hall the wind is weak: past ' + m(ONE_X) + ' m it’s under 1 m/s, ' +
            'and past about ' + Math.round(STILL_X) + ' m its push on a 20 × 20 cm sail is smaller than friction (the gauge tells you). ' +
            'A rolling car feels even less push, because it’s moving along with the air (more about that in Module 3). ' +
            'So the car slowly loses speed and stops: a typical car stops around ' + Math.round(TYPICAL) + ' m (about ' + Math.round(TYPICAL * FT) + ' ft)' +
            (TYPICAL_RUN.reason === 'reached the end of the hall' ? ', right at the end of our ' + HALL_FT + ' ft hallway. '
              : ', with about ' + Math.round((HALL_M - TYPICAL) * FT) + ' ft of our ' + HALL_FT + ' ft hallway still ahead of it. ') +
            'It also means the <strong>start line matters</strong>: closer to the fans = faster wind = much more push.');
          // the graph's distance axis is exactly the hallway: from the fans to the far end (start line + the hall), nothing past it
          const X0 = 70, X1 = 532, Y0 = 196, YT = 50, VMAX = 4, MMAX = END_X, PSC = 370 / p0;
          function gx(mm) { return X0 + mm / MMAX * (X1 - X0); }
          function gy(v) { return Y0 - v / VMAX * (Y0 - YT); }
          function draw() {
            const x = d.get(), v = P.windAt(x), p = push(x, AREA, FLAT);
            clear(api, s, 316);
            label(api, s, 14, 28, 'wind speed (m/s)', { color: '#7ad7ff', size: 17 });
            for (let mm = 5; mm < MMAX; mm += 5) api.svg('line', { x1: gx(mm), y1: YT, x2: gx(mm), y2: Y0, stroke: '#2a1a4a', 'stroke-width': 1 }, s);
            for (let vv = 0; vv <= VMAX; vv++) {
              api.svg('line', { x1: X0, y1: gy(vv), x2: X1, y2: gy(vv), stroke: vv ? '#2a1a4a' : '#4a3a6a', 'stroke-width': vv ? 1 : 2 }, s);
              label(api, s, X0 - 12, gy(vv) + 6, String(vv), { anchor: 'end', color: '#a090c0', bold: false, size: 17 });
            }
            for (let mm = 0; mm <= MMAX; mm += 5) label(api, s, gx(mm), Y0 + 22, mm + ' m', { anchor: 'middle', color: '#a090c0', bold: false, size: 17 });
            label(api, s, gx(MMAX / 2), Y0 + 45, 'distance from the fans', { anchor: 'middle', color: '#a090c0', bold: false, size: 17 });
            // the far end of the hallway is the right edge of the graph
            api.svg('line', { x1: X1, y1: YT - 10, x2: X1, y2: Y0, stroke: '#c8b8ea', 'stroke-width': 2, 'stroke-dasharray': '6,4' }, s);
            label(api, s, X1 - 6, YT - 16, 'end of the hall (' + HALL_FT + ' ft)', { anchor: 'end', color: '#c8b8ea', bold: false, size: 17 });
            const pts = [];
            for (let i = 0; i <= MMAX * 10; i++) pts.push(gx(i / 10).toFixed(1) + ',' + gy(P.windAt(i / 10)).toFixed(1));
            api.svg('polygon', { points: gx(0) + ',' + Y0 + ' ' + pts.join(' ') + ' ' + gx(MMAX) + ',' + Y0, fill: '#7ad7ff', opacity: 0.1 }, s);
            api.svg('polyline', { points: pts.join(' '), fill: 'none', stroke: '#7ad7ff', 'stroke-width': 3 }, s);
            // the meter
            api.svg('line', { x1: gx(x), y1: Y0, x2: gx(x), y2: gy(v), stroke: '#f0c040', 'stroke-width': 2, 'stroke-dasharray': '5,4' }, s);
            api.svg('circle', { cx: gx(x), cy: gy(v), r: 7, fill: '#f0c040' }, s);
            const right = gx(x) < X1 - 100;                 // keep the speed label inside the picture near the far end
            label(api, s, gx(x) + (right ? 14 : -14), gy(v) - 12, api.fmt(v, 2) + ' m/s', { anchor: right ? 'start' : 'end', color: '#f0c040', size: 19 });
            // push bar, with friction marked
            label(api, s, 14, 280, 'push', { color: '#40e080', size: 17 });
            api.svg('rect', { x: X0, y: 262, width: Math.max(1, p * PSC), height: 24, rx: 3, fill: '#40e080' }, s);
            label(api, s, X0 + Math.max(p, fr) * PSC + 9, 280, newtons(api, p), { bold: false, size: 17 });
            api.svg('line', { x1: X0 + fr * PSC, y1: 256, x2: X0 + fr * PSC, y2: 292, stroke: '#ffa040', 'stroke-width': 3 }, s);
            label(api, s, X0 + fr * PSC, 311, 'friction', { anchor: 'middle', color: '#ffa040', size: 16 });
            const pct = Math.round(v / V0 * 100);
            const parts = ['📍 ' + x.toFixed(1) + ' m from the fans: wind ', [api.fmt(v, 2) + ' m/s'], ' (' + pct + '% of the wind at the fans). Push on a 20 × 20 cm sail: ',
              [newtons(api, p)], ' (' + Math.round(p / p0 * 100) + '% of the push at the fans).'];
            if (p < fr) parts.push(' That’s less than friction (' + newtons(api, fr) + '), so the wind can’t keep a car rolling here.');
            say(api, out, parts);
            // exactly what the readout shows: 50%
            if (pct === 50) api.done('At ' + x.toFixed(1) + ' m the wind is half as fast (' + api.fmt(v, 2) + ' m/s), but the push is only ' + Math.round(p / p0 * 100) + '% — about ¼! ' +
              'Half the speed → ½ × ½ = ¼ the push.');
          }
          draw();
        }
      },
      {
        title: 'Shape and angle',
        html:
          '<p>Two more things change the push: the sail’s <strong>shape</strong> and its <strong>angle</strong>.</p>' +
          '<p><strong>Shape:</strong> a <span class="key">cupped</span> sail curves like a cupped hand, with the hollow side facing the fans. ' +
          'It catches the air and turns it back toward the fans, instead of letting it slide off the edges. ' +
          'The more a sail turns the air around, the harder the air pushes on it — so a cupped sail gets about ⅙ more push than a flat one. ' +
          '(Scientists give a flat sail a “catch number” of 1.2 and a cupped sail 1.4. It’s called the <span class="key">drag coefficient</span>.)</p>' +
          '<p><strong>Angle:</strong> a sail turned away from the fans catches less. Two things happen: the fans “see” a narrower sail, so less air hits it. ' +
          'And the air that does hit it glances off at a slant instead of smacking it head-on. Both shrink the push.</p>',
        challenge: 'Turn the FLAT sail until it catches exactly half (50%) of its full push.',
        render: function (el, api) {
          const s = board(api, el, 290, 'A sail seen from above, turned at an angle to the wind from the two fans');
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const shape = api.ui.choice(row, { label: 'Sail shape', value: FLAT, options: [{ value: FLAT, label: 'Flat' }, { value: CUPPED, label: 'Cupped' }], onChange: draw });
          const ang = api.ui.slider(row, { label: 'Angle away from the fans', min: 0, max: 90, step: 5, value: 0, format: function (v) { return v + '°'; }, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const AREA = 0.04, full = push(START, AREA, FLAT, 0);
          const CX = 300, CY = 130, L = 80, BSC = 300 / 120;          // sail centre, half the sail's width in px, px per % of push
          function draw() {
            const cd = shape.get(), a = ang.get(), rad = a * Math.PI / 180, c = Math.cos(rad), sn = Math.sin(rad);
            const p = push(START, AREA, cd, a), pct = p / full * 100;
            clear(api, s, 290);
            label(api, s, 546, 26, 'seen from above', { anchor: 'end', color: '#9080b0', bold: false });
            // the two box fans side by side, seen from above
            [40, 132].forEach(function (y) { api.svg('rect', { x: 22, y: y, width: 24, height: 88, rx: 4, fill: '#3a2a5a', stroke: '#9080b0', 'stroke-width': 2 }, s); });
            label(api, s, 12, 242, '2 FANS', { color: '#9080b0' });
            // where the sail would be if it faced the fan square-on
            api.svg('line', { x1: CX, y1: CY - L - 6, x2: CX, y2: CY + L + 6, stroke: '#6a5a8a', 'stroke-width': 1.5, 'stroke-dasharray': '4,4' }, s);
            // wind: rows that hit the sail stop at it; the rest blow past
            const miss = api.svg('g', { opacity: 0.28 }, s), BUL = cd === CUPPED ? 26 : 0;
            for (let y = 46; y <= 214; y += 14) {
              const off = y - CY, t = (off / (L * c) + 1) / 2;     // t: where along the sail this row lands (0 = top end, 1 = bottom end)
              if (Math.abs(off) < L * c - 2) api.draw.arrow(s, 58, y, CX + off * sn / c + 2 * t * (1 - t) * BUL * c - 4, y, '#7ad7ff', '', { width: 2, head: 5 });
              else api.draw.arrow(miss, 58, y, 540, y, '#7ad7ff', '', { width: 2, head: 5 });
            }
            // the sail (a cupped sail bulges away from the fan) and its mast
            const ax = CX - L * sn, ay = CY - L * c, bx = CX + L * sn, by = CY + L * c;
            if (cd === CUPPED) api.svg('path', { d: 'M ' + ax + ',' + ay + ' Q ' + (CX + BUL * c) + ',' + (CY - BUL * sn) + ' ' + bx + ',' + by, fill: 'none', stroke: '#f0e6ff', 'stroke-width': 6, 'stroke-linecap': 'round' }, s);
            else api.svg('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: '#f0e6ff', 'stroke-width': 6, 'stroke-linecap': 'round' }, s);
            api.svg('circle', { cx: CX, cy: CY, r: 5, fill: '#c8a060' }, s);
            label(api, s, CX + 10, CY - L - 8, a + '°', { color: '#f0c040', size: 19 });
            // how wide the sail looks from the fan
            const half = L * c;
            if (half > 1) {
              api.svg('line', { x1: 462, y1: CY - half, x2: 462, y2: CY + half, stroke: '#f0c040', 'stroke-width': 2.5 }, s);
              [CY - half, CY + half].forEach(function (yy) { api.svg('line', { x1: 455, y1: yy, x2: 469, y2: yy, stroke: '#f0c040', 'stroke-width': 2.5 }, s); });
            }
            label(api, s, 474, CY - 6, 'fans see', { color: '#f0c040', size: 17, bold: false });
            label(api, s, 474, CY + 16, Math.round(c * 100) + '%', { color: '#f0c040', size: 19 });
            // push bar
            label(api, s, 14, 270, 'push', { color: '#40e080', size: 17 });
            api.svg('rect', { x: 70, y: 252, width: Math.max(1, pct * BSC), height: 24, rx: 3, fill: '#40e080' }, s);
            label(api, s, 70 + pct * BSC + 8, 270, Math.round(pct) + '%', { size: 18 });
            const cp = Math.round(c * 100) + '%';
            const parts = ['Push: ', [api.fmt(p, 3) + ' N'], ' = ', [Math.round(pct) + '%'], ' of a flat sail facing the fans. '];
            if (a === 0) parts.push('Square to the fans: the whole sail catches the wind head-on.');
            else if (a === 90) parts.push('Turned completely sideways: the fans only see the thin edge, so it catches nothing.');
            else parts.push('Turned ' + a + '°: the fans see ' + cp + ' of the sail’s width, and that air hits at a slant, so it pushes only ' + cp + ' as hard. ' +
              cp + ' × ' + cp + ' ≈ ' + Math.round(c * c * 100) + '%.');
            if (cd === CUPPED && a < 90) parts.push(' The cupped shape adds about ⅙ more (1.4 instead of 1.2).');
            say(api, out, parts);
            if (cd === FLAT && Math.round(pct) === 50) api.done('At 45° the fans see 71% of the sail, and the air hits 71% as hard: 71% × 71% = 50%. Keep your real sail square to the fans!');
          }
          draw();
        }
      },
      {
        title: 'Hallway challenge: catch the wind',
        html:
          '<p>Time to put it all together! Choose your sail’s size, shape and angle, then send the car down the hallway. ' +
          'It starts at the start line, 30 cm from the two fans.</p>' +
          '<p>A bigger sail catches more wind… but watch out. Right at the start line, two fans push hard, and the wind pushes on the middle of the sail, high above the wheels. ' +
          'Too much push up there can flip the car onto its nose.</p>' +
          '<p>Your goal is ' + GOAL + ' m — about ' + Math.round(GOAL * FT / 10) * 10 + ' ft. That’s twice as far as the paper sleds from past years usually slid (about 25 ft), ' +
          'and most of the way down our ' + HALL_TXT + ' hallway.</p>',
        challenge: 'Get the car to roll at least ' + GOAL + ' metres (about ' + Math.round(GOAL * FT / 10) * 10 + ' ft) without tipping over.',
        render: function (el, api) {
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const size = api.ui.slider(row, { label: 'Sail size (square)', min: 10, max: 40, step: 5, value: 15, format: function (v) { return v + ' × ' + v + ' cm'; }, onInput: info });
          const shape = api.ui.choice(row, { label: 'Sail shape', value: FLAT, options: [{ value: FLAT, label: 'Flat' }, { value: CUPPED, label: 'Cupped' }], onChange: info });
          const ang = api.ui.slider(row, { label: 'Angle away from the fans', min: 0, max: 60, step: 15, value: 30, format: function (v) { return v + '°'; }, onInput: info });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          let sim = null;
          function car() { return sailCar(size.get(), size.get(), shape.get(), ang.get()); }
          function info() {
            const c = car();
            say(api, out, ['⛵ Sail area ', [Math.round(c.sailArea * 10000) + ' cm²'], ' · car mass ', [Math.round(c.mass * 1000) + ' g'],
              ' · push at the start line ', [api.fmt(push(START, c.sailArea, c.sailCd, c.sailAngle), 2) + ' N']]);
            if (sim) sim.reset();                               // redraw the car with its new sail, ready for the next run
          }
          info();
          sim = api.ui.trackSim(el, car, {
            scaleM: HALL_M,                                     // the whole hallway, the same view every run, so runs are easy to compare
            onResult: function (r) {
              if (r.reason === 'tipped over' || r.distance < GOAL) return;
              api.done((r.reason === 'reached the end of the hall'
                ? 'It rolled all the way to the end of the ' + HALL_TXT + ' hallway without tipping — the most any car can do in our hall! '
                : 'It rolled ' + api.fmt(r.distance, 1) + ' m (about ' + Math.round(r.distance * FT) + ' ft) without tipping! ') +
                'A bigger sail catches more wind and goes farther — until the push gets so strong, so high up, that it flips the car.');
            }
          });
          api.onLeave(sim.stop);
          api.ui.note(el, 'warn', '⚖️ Notice the car mass going up as the sail grows? A big sail adds <strong>weight</strong>, and a tall sail puts the push <strong>high above the wheels</strong>. ' +
            'Modules 5 and 6 show you how weight and balance let a big sail push hard without flipping your car.');
        }
      },
      {
        title: 'Real build: make a sail that catches the wind',
        html:
          '<p>Here’s how to turn what you learned into a real sail:</p>' +
          '<ul><li><strong>Paper or cardstock?</strong> Paper is light, but floppy: it bends back in the wind and spills air. ' +
          'Cardstock keeps its shape, but it’s two to three times as heavy. A good trick: a paper sail with straws or pipe cleaners taped along the edges as a frame.</li>' +
          '<li><strong>Size:</strong> about 20 cm on each side is a good start. Bigger catches more wind, but adds weight, and with two strong fans it can tip the car onto its nose. ' +
          'A sheet of printer paper is about 21 × 28 cm, so a 20 × 20 cm sail fits on one sheet. For a bigger sail, tape two sheets together — and use Modules 5 and 6 to keep the car from tipping.</li>' +
          '<li><strong>Make it cupped:</strong> gently roll cardstock around a water bottle so it curves. Or tape a pipe cleaner along the top and bottom edges and bend them into a shallow curve. ' +
          'The hollow side faces the fans. Keep the curve gentle — a deep curl makes the sail narrower, so the fans see less of it.</li>' +
          '<li><strong>Mast:</strong> hot-glue a skewer or thin dowel straight up in the middle of the chassis. Tape the sail to it at the top, middle and bottom so it can’t twist or slide.</li>' +
          '<li><strong>No flapping:</strong> a flapping sail wastes wind. Tape a popsicle stick or straw across the bottom edge to hold it steady.</li>' +
          '<li><strong>Square to the fans:</strong> crouch down right next to the fans and look down the hall at your car. You should see the whole face of the sail, not its edge.</li></ul>' +
          '<p><strong>Test it in the hallway:</strong></p>' +
          '<ol><li><strong>Feel the fade:</strong> hold a strip of paper in front of the fans at 1 m, 5 m, 10 m and ' + FAR_TEST + ' m ' +
          '(about 3, 16, 33 and ' + Math.round(FAR_TEST * FT) + ' ft — the hallway is ' + HALL_FT + ' ft long). Watch it flutter less and less as you move away.</li>' +
          '<li><strong>Sail swap test:</strong> run your car with two different sails (for example 15 cm and 20 cm). Same start line, same fan setting. ' +
          'Do 3 runs each and measure with a tape measure. Change only ONE thing at a time, so you know what made the difference.</li>' +
          '<li><strong>Angle test:</strong> run once with the sail square to the fans, and once turned about 45°. How much shorter is the turned run? ' +
          '(A turned sail also pushes the car a little sideways, so watch whether it drifts toward a wall.)</li>' +
          '<li><strong>Tip check:</strong> watch from the side as the car starts. If the back wheels lift off the floor, the push is too high or too strong. ' +
          'Move the sail lower on the mast, or make it a little shorter.</li></ol>',
        render: function (el, api) {
          api.ui.note(el, 'build', '🛠️ <strong>Your materials:</strong> paper or cardstock for the sail, a skewer or thin dowel for the mast, straws or pipe cleaners for a frame, ' +
            'popsicle sticks for a crossbar, and tape and hot glue to hold it all together.');
        }
      }
    ],
    quiz: [
      { q: 'You double BOTH the width and the height of your sail. What happens to the push from the fans?', options: ['It stays the same', 'It doubles', 'It becomes 4 times as big', 'It becomes 8 times as big'], answer: 2,
        why: 'Doubling both sides makes 2 × 2 = 4 times the area, and the push grows with the area.' },
      { q: 'A sail is 20 cm wide and 15 cm tall. What is its area?', options: ['35 cm²', '70 cm²', '300 cm²', '3,000 cm²'], answer: 2,
        why: 'Area = width × height = 20 × 15 = 300 cm². (70 cm is the distance around the edge, not the area.)' },
      { q: 'Imagine fans that blow twice as fast as our two box fans. You test the same sail at the same spot in front of each. How does the push from the faster fans compare with ours?', options: ['The same', 'Twice as much', 'Four times as much', 'Half as much'], answer: 2,
        why: 'Push grows with wind speed × wind speed. Twice the speed: each bit of air hits harder AND twice as much air hits every second, so 2 × 2 = 4 times the push.' },
      { q: 'About ' + m(HALF_X) + ' m from our two box fans, the wind is half as fast as right at the fans. How much push does a sail get there, compared with right at the fans?', options: ['The same push', 'Half the push', 'A quarter of the push', 'Twice the push'], answer: 2,
        why: 'Half the speed gives ½ × ½ = ¼ of the push, because push grows with speed × speed.' },
      { q: 'Where in the hallway does your sail get the biggest push from the fans?', options: ['Close to the fans, where the wind is fastest', 'Far from the fans, where the wind has spread out', 'In the middle of the hallway', 'It’s the same everywhere'], answer: 0,
        why: 'The wind from the fans spreads out and fades with distance, so the push is biggest right near the fans.' },
      { q: 'Your car speeds off the start line but slows down and stops about ' + Math.round(TYPICAL) + ' m (' + Math.round(TYPICAL * FT) + ' ft) down the hall, even though the fans are still on. Why?', options: ['The sail gets heavier as the car rolls', 'Far from the fans the wind is weak, so its push drops below friction', 'The wind turns around and blows the car back', 'A car can only roll for 4 seconds'], answer: 1,
        why: 'The wind fades with distance. Past about ' + m(ONE_X) + ' m it’s under 1 m/s. That weak wind can’t push the rolling car harder than friction any more, so the car slowly loses speed and stops.' },
      { q: 'Which sail catches a little MORE wind, if the size is the same?', options: ['A flat sail', 'A cupped sail with the hollow side facing the fans', 'A sail with holes cut in it', 'A sail turned sideways to the fans'], answer: 1,
        why: 'A cupped sail holds the air like a cupped hand, so it gets about ⅙ more push than a flat one (1.4 instead of 1.2).' },
      { q: 'You turn your sail 45° away from facing the fans. About how much of the push does it still get?', options: ['All of it — angle doesn’t matter', 'About three-quarters', 'About half', 'None at all'], answer: 2,
        why: 'At 45° the fans see about 71% of the sail and the air hits at a slant (71% as hard): 71% × 71% ≈ 50%.' },
      { q: 'Your paper sail bends back and flaps in the wind. What is the best fix?', options: ['Cut holes in it so the wind goes through', 'Frame the edges with straws or pipe cleaners, or use cardstock', 'Turn it so its edge points at the fans', 'Make the mast wobblier'], answer: 1,
        why: 'A frame or stiffer cardstock keeps the sail’s shape, so it keeps catching the wind instead of spilling it.' },
      { q: 'You build a giant sail 40 cm tall. On the test run in front of the two fans, the car flips onto its nose. Why?', options: ['The sail is too light', 'The wind is too weak to move it', 'The big push high up on the tall sail tips the car forward', 'The wheels spin too freely'], answer: 2,
        why: 'The push acts on the middle of the sail, high above the wheels. A big, tall sail can tip the car forward. Modules 5 and 6 show how to fix that.' }
    ]
  });
})();
