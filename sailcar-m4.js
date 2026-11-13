// Sail Car Lab — Module 4: Friction (wheels and axles)
// Rolling friction = crr × weight; it takes a bit more push to START rolling than to keep rolling
// (SailLab.physics.STICKY); and what makes crr big or small on a real student car. Every number comes
// from SailLab.physics (rollingFriction, airForce, windAt, simulate) — the same model as the hallway.
(function () {
  'use strict';
  const P = SailLab.physics, C = P.DEFAULT_CAR;
  const WHEELS = { smooth: 0.012, ok: C.crr, rub: 0.07 };              // step 1: three simple "stickiness" levels
  // Axle builder (steps 3–4): the same crr numbers the Design Studio uses for these parts
  const BEARING = { straw: 0.012, taped: 0.022, hole: 0.03 }, WOBBLY = 0.012, RUBBING = 0.03;
  const BEARING_NAME = { straw: 'straw bearing', taped: 'taped skewer', hole: 'cardstock hole' };
  const BEARING_OPTS = [{ value: 'straw', label: 'Skewer spins in a straw' }, { value: 'taped', label: 'Skewer taped down' }, { value: 'hole', label: 'Skewer in a cardstock hole' }];
  const FIT_OPTS = [{ value: 'snug', label: 'Snug & centred' }, { value: 'wobbly', label: 'Wobbly' }];
  const GAP_OPTS = [{ value: 'spacer', label: 'Straw spacer (small gap)' }, { value: 'rub', label: 'Rubs the chassis' }];
  function axleCrr(b, fit, gap) { return BEARING[b] + (fit === 'wobbly' ? WOBBLY : 0) + (gap === 'rub' ? RUBBING : 0); }
  // how far a bare chassis coasts after a push of v m/s if only friction slows it: v² ÷ (2 × crr × 9.81)
  function coast(v, crr) { return v * v / (2 * crr * P.G); }
  // the wind's push on the standard car sitting still x metres from the fan (sail + body, as simulate() starts it)
  function pushAt(x) { const w = P.windAt(x); return P.airForce(w, C.sailArea, C.sailCd, 0) + P.airForce(w, C.bodyArea, C.bodyCd, 0); }
  function N(f) { return f.toFixed(3) + ' N'; }
  // write a readout from plain strings and ['bold'] pieces — never innerHTML
  function say(api, box, parts) {
    box.textContent = '';
    parts.forEach(function (p) { box.appendChild(typeof p === 'string' ? document.createTextNode(p) : api.h('strong', { text: p[0] })); });
  }
  // a 560-wide drawing, shown no wider than 620 px so a Chromebook screen fits the picture AND its controls
  function board(api, el, hgt, aria) { return api.svg('svg', { viewBox: '0 0 560 ' + hgt, width: 620, role: 'img', 'aria-label': aria }, el); }
  function clear(api, s, hgt) { s.textContent = ''; api.svg('rect', { x: 0, y: 0, width: 560, height: hgt, rx: 12, fill: '#120826' }, s); }
  function label(api, s, x, y, text, o) {
    o = o || {};
    return api.svg('text', { x: x, y: y, 'text-anchor': o.anchor || 'start', fill: o.color || '#c8b8ea', 'font-size': o.size || 17,
      'font-weight': o.bold === false ? null : 700, class: o.plain ? null : 'sl-lbl' }, s, text);
  }
  function rect(api, s, x, y, w, hh, fill, extra) { return api.svg('rect', Object.assign({ x: x, y: y, width: w, height: hh, fill: fill }, extra || {}), s); }
  // a bar that stops at the edge of its chart, with a note inside when the real value is bigger
  function bar(api, s, x, y, val, max, px, fill) {
    rect(api, s, x, y, Math.max(2, Math.min(val, max) / max * px), 22, fill, { rx: 3 });
    if (val > max) label(api, s, x + px - 6, y + 17, 'off the chart →', { anchor: 'end', color: '#120826', size: 15, plain: true });
  }

  const TESTS_HTML =
    '<p><strong>Test the friction in the hallway:</strong></p>' +
    '<ol><li><strong>Flick test:</strong> hold the car up and flick each wheel. It should spin for <strong>3 seconds or more</strong>. If it stops fast, find what rubs and fix it.</li>' +
    '<li><strong>Push test (before the sail goes on):</strong> make a ramp by leaning a binder or a piece of cardstock on a book. Let the chassis roll down from the same mark every time, and measure how far it coasts. ' +
    'Fix one thing, then test again. Farther = less friction.</li>' +
    '<li><strong>Start test:</strong> with the sail on, set the car in front of the fan, then 50 cm farther back each time. Find the farthest spot where it still starts by itself. ' +
    'Less friction = it can start farther from the fan.</li></ol>';

  SailLab.register({
    id: 'friction',
    num: 4,
    title: 'Friction',
    icon: '🛞',
    blurb: 'Why wheels slow down — and how to build axles that spin and spin.',
    minutes: 15,
    steps: [
      {
        title: 'Friction holds your car back',
        html:
          '<p>Flick a wheel on a toy car. It spins, slows down and stops. Something fights the spin: <span class="key">friction</span>. ' +
          'On a sail car it comes mostly from the <strong>axles</strong> rubbing where they turn. We call it <span class="key">rolling friction</span>.</p>' +
          '<p>Rolling friction depends on two things:</p>' +
          '<ul><li><strong>Weight</strong>: how hard the car presses down. In newtons, weight = mass in kg × 9.81. ' +
          'A 70 g car (0.07 kg) weighs 0.07 × 9.81 ≈ 0.69 N. A heavier car presses harder, so it has more friction.</li>' +
          '<li><strong>Stickiness</strong>: how easily the wheels and axles turn. Scientists call this number <span class="key">crr</span> ' +
          '(the “coefficient of rolling resistance”). Free-spinning wheels: about 0.012. Wheels that rub: 0.07 or more.</li></ul>' +
          '<p style="text-align:center;font-size:1.1rem"><strong>friction = crr × weight</strong></p>' +
          '<p>The starting car below is 70 g with OK wheels: 0.025 × 0.69 N ≈ 0.017 N. That’s about the weight of two paper clips. Tiny! ' +
          'But far from the fan, the wind’s push is tiny too.</p>',
        challenge: 'Build a car that weighs at least 100 g but has LESS friction than the starting car (70 g with OK wheels).',
        render: function (el, api) {
          const s = board(api, el, 260, 'A sail car with its weight pressing down and friction holding it back, and its friction compared with the starting car');
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const mass = api.ui.slider(row, { label: 'Car mass', min: 40, max: 200, step: 10, value: 70, format: function (v) { return v + ' g'; }, onInput: draw });
          const wh = api.ui.choice(row, { label: 'Wheels', value: 'ok', options: [{ value: 'smooth', label: 'Spin freely' }, { value: 'ok', label: 'OK' }, { value: 'rub', label: 'Rubbing' }], onChange: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const ref = P.rollingFriction(C.mass, C.crr), BX = 290, MAXF = 0.08, BW = 252;      // bars show 0 to 0.08 N
          function draw() {
            const m = mass.get() / 1000, crr = WHEELS[wh.get()], wt = m * P.G, fr = P.rollingFriction(m, crr);
            clear(api, s, 260);
            // left: the car — weight presses down on the deck, friction holds it back at the wheels
            api.svg('line', { x1: 12, y1: 196, x2: 266, y2: 196, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            api.draw.car(s, 26, 196, { scale: 3.2, length: 34 });
            api.draw.arrow(s, 112, 168 - wt * 55, 112, 170, '#7ad7ff', '', { width: 5 });
            label(api, s, 124, 110, 'weight', { color: '#7ad7ff', size: 18 });
            label(api, s, 124, 132, wt.toFixed(2) + ' N', { color: '#7ad7ff', size: 18 });
            api.draw.arrow(s, 120, 214, 120 - Math.min(105, fr * 1500), 214, '#ffa040', '', { width: 4, head: 5 });
            label(api, s, 130, 220, 'friction', { color: '#ffa040' });
            label(api, s, 16, 250, 'rolling →', { color: '#9080b0', size: 16, bold: false });
            // right: the rule with your numbers, and bars against the starting car
            [['stickiness (crr)', crr.toFixed(3), '#00f5ff', 38], ['× weight', wt.toFixed(2) + ' N', '#7ad7ff', 72], ['= friction', N(fr), '#ffa040', 116]].forEach(function (r) {
              label(api, s, BX, r[3], r[0], { color: r[2], bold: false });
              label(api, s, 546, r[3], r[1], { anchor: 'end', color: r[2], size: 22 });
            });
            api.svg('line', { x1: BX, y1: 88, x2: 546, y2: 88, stroke: '#6a5a8a', 'stroke-width': 2 }, s);
            label(api, s, BX, 156, 'Your car: ' + N(fr), { color: '#ffa040' });
            bar(api, s, BX, 164, fr, MAXF, BW, '#ffa040');
            label(api, s, BX, 212, 'Starting car: ' + N(ref));
            bar(api, s, BX, 220, ref, MAXF, BW, '#9080b0');
            api.svg('line', { x1: BX + ref / MAXF * BW, y1: 160, x2: BX + ref / MAXF * BW, y2: 192, stroke: '#f0e6ff', 'stroke-width': 1.5, 'stroke-dasharray': '4,3' }, s);   // the starting car's friction, marked on your bar
            const parts = ['⚖️ Weight = ' + m.toFixed(2) + ' kg × 9.81 = ', [wt.toFixed(2) + ' N'], '. Friction = ' + crr.toFixed(3) + ' × ' + wt.toFixed(2) + ' N = ', [N(fr)],
              ' — that’s ', ['× ' + (fr / ref).toFixed(2)], ' the starting car’s friction.'];
            if (m >= 0.1 && fr >= ref) parts.push(' A heavier car has more friction… can you make up for it with the wheels?');
            say(api, out, parts);
            if (m >= 0.1 && fr < ref) api.done('Friction = stickiness × weight. Your heavier car still has less friction, because free-spinning wheels cut the stickiness by more than half. Weight matters — but stickiness is the part you can fix!');
          }
          draw();
        }
      },
      {
        title: 'Starting is harder than rolling',
        html:
          '<p>Push a heavy box across the floor. Getting it to <strong>start</strong> moving takes a big shove. Once it slides, it’s easier to keep it going.</p>' +
          '<p>Wheels and axles do the same thing. When parts sit still, they settle in and grip each other a little more. ' +
          'In our hallway model, it takes about <strong>1.3 times</strong> as much push (30% more) to START rolling as to KEEP rolling:</p>' +
          '<ul><li>To <strong>start</strong>: the push must be bigger than friction × 1.3.</li>' +
          '<li>To <strong>keep rolling</strong>: the push must be bigger than friction.</li></ul>' +
          '<p>The fan’s wind fades as it spreads out, so the push gets smaller the farther you go. Set the starting car (70 g, OK wheels) down at different spots and compare.</p>',
        challenge: 'Find a spot where the wind could KEEP a rolling car going, but is too weak to START a car that’s sitting still.',
        render: function (el, api) {
          const H = 280, s = board(api, el, H, 'A hallway with the fan and your car, and a bar comparing the wind push with the push needed to start and to keep rolling');
          const d = api.ui.slider(el, { label: 'Where you set the car down (distance from the fan)', min: 0.3, max: 6, step: 0.1, value: 1, format: function (v) { return v.toFixed(1) + ' m'; }, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const fr = P.rollingFriction(C.mass, C.crr), st = fr * P.STICKY;
          const FL = 116, BX = 30, MAXP = 0.04, BW = 500;               // floor; push bar: 0 to 0.04 N across 500 px
          function px(m) { return 60 + m * 77; }
          function draw() {
            const x = d.get(), w = P.windAt(x), p = pushAt(x);
            clear(api, s, H);
            // the hallway: fan, metre marks, fading wind, the car
            api.svg('line', { x1: 10, y1: FL, x2: 550, y2: FL, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            api.draw.fan(s, 30, FL, 72);
            for (let m = 1; m <= 6; m++) {
              api.svg('line', { x1: px(m), y1: FL, x2: px(m), y2: FL + 7, stroke: '#6a5a8a', 'stroke-width': 1.5 }, s);
              label(api, s, px(m), FL + 25, m + ' m', { anchor: 'middle', color: '#9080b0', size: 16, bold: false });
            }
            for (let m = 0.15; m < 6; m += 0.3) {
              const ww = P.windAt(m);
              [62, 86].forEach(function (y, i) {
                api.svg('line', { x1: px(m) + i * 10, y1: FL - y, x2: px(m) + i * 10 + ww * 8, y2: FL - y, stroke: '#7ad7ff', 'stroke-width': 1.5, opacity: Math.min(0.6, ww / P.FAN.v0 * 0.7).toFixed(2), 'stroke-linecap': 'round' }, s);
              });
            }
            api.draw.car(s, px(x) - 6, FL, { scale: 1.5, length: 26 });
            label(api, s, Math.max(120, Math.min(460, px(x) + 14)), 24, 'wind ' + w.toFixed(2) + ' m/s', { anchor: 'middle', color: '#7ad7ff', size: 18 });
            // push bar against two lines: keep rolling (friction) and start (friction × 1.3)
            label(api, s, BX, 168, 'Wind push on the car: ' + N(p), { color: '#40e080', size: 18 });
            bar(api, s, BX, 178, p, MAXP, BW, '#40e080');
            [[fr, '#ffa040', 'keep rolling: ' + N(fr), 'end', -6], [st, '#f0c040', 'start: ' + N(st), 'start', 6]].forEach(function (b) {
              const lx = BX + b[0] / MAXP * BW;
              api.svg('line', { x1: lx, y1: 172, x2: lx, y2: 210, stroke: b[1], 'stroke-width': 3 }, s);
              label(api, s, lx + b[4], 230, b[2], { anchor: b[3], color: b[1] });
            });
            const starts = p > st, keeps = p > fr;
            label(api, s, BX, 266, starts ? 'It STARTS rolling here.' : keeps ? 'It could KEEP rolling, but can’t START here!' : 'Too weak to even keep a car rolling.',
              { color: starts ? '#40e080' : keeps ? '#f0c040' : '#ff8060', size: 19 });
            const parts = ['📍 ' + x.toFixed(1) + ' m from the fan: wind ' + w.toFixed(2) + ' m/s, push ', [N(p)], '. To keep rolling it needs more than ', [N(fr)],
              ' (the friction). To start, it needs more than ', [N(st)], ' (friction × 1.3).'];
            if (!starts && keeps) parts.push(' A car rolling in from the start line cruises right through here — but a car set down here never moves.');
            say(api, out, parts);
            if (keeps && !starts) api.done('From about 3.8 m to 4.4 m from the fan, a rolling car keeps going, but a car set down there never starts. Starting takes about 30% more push than rolling!');
          }
          draw();
        }
      },
      {
        title: 'Build a better axle',
        html:
          '<p>Almost all of a sail car’s friction is at the <strong>axles</strong>, the skewers the wheels turn on. Three things decide how sticky they are:</p>' +
          '<ul><li><strong>The bearing</strong> (the part that holds the turning axle). A skewer spinning inside a <strong>straw</strong> glued to the chassis turns easily. ' +
          'A skewer pushed through a tight hole in cardstock or a popsicle stick scrapes as it turns. If you tape the skewer down so it can’t turn, the wheels have to spin on it, and their holes rub.</li>' +
          '<li><strong>Wheel fit.</strong> If a wheel’s hole isn’t centred, or a blob of glue sticks to it, the wheel <strong>wobbles</strong>. It bumps and scrubs as it rolls. A bent axle does the same.</li>' +
          '<li><strong>The gap.</strong> A wheel rubbing the chassis (or a piece of tape, or glue) is like dragging your foot. ' +
          'A short piece of straw on the axle, called a <span class="key">spacer</span>, keeps a small gap.</li></ul>' +
          '<p>Build an axle below. Then do a <strong>push test</strong>: push the bare chassis (no sail yet) gently across the floor at 1 m/s and see how far it coasts. ' +
          'Less stickiness = it coasts farther. (In real life, a little air drag makes it stop a bit sooner.)</p>',
        challenge: 'Fix the axle so the bare chassis coasts at least 2 metres in the push test.',
        render: function (el, api) {
          const H = 336, s = board(api, el, H, 'Front view of an axle with two wheels, and how far the chassis coasts in a push test');
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const br = api.ui.choice(row, { label: 'Bearing (what the axle turns in)', value: 'hole', options: BEARING_OPTS, onChange: draw });
          const fit = api.ui.choice(row, { label: 'Wheel fit', value: 'wobbly', options: FIT_OPTS, onChange: draw });
          const gap = api.ui.choice(row, { label: 'Wheel gap', value: 'rub', options: GAP_OPTS, onChange: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const FL = 176, AY = 124, WR = 52;                                       // floor, axle height, wheel radius
          function track(m) { return 40 + m * 96; }                                // push test: metres → px
          function draw() {
            const b = br.get(), wob = fit.get() === 'wobbly', rub = gap.get() === 'rub', crr = axleCrr(b, fit.get(), gap.get()), dist = coast(1, crr);
            clear(api, s, H);
            label(api, s, 546, 24, 'front view of one axle', { anchor: 'end', color: '#9080b0', size: 15, bold: false });
            api.svg('line', { x1: 20, y1: FL, x2: 540, y2: FL, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            rect(api, s, 150, 62, 260, 18, '#d8b070', { rx: 3, stroke: '#a07830' });
            label(api, s, 280, 52, 'chassis', { anchor: 'middle', color: '#d8b070' });
            api.svg('line', { x1: 56, y1: AY, x2: 504, y2: AY, stroke: '#c8a060', 'stroke-width': 5, 'stroke-linecap': 'round' }, s);
            // the bearing
            if (b === 'straw') {
              rect(api, s, 150, AY - 14, 260, 28, '#dff3ff', { rx: 14, opacity: 0.55, stroke: '#9fd8ff' });
              [200, 360].forEach(function (gx) { api.svg('ellipse', { cx: gx, cy: 95, rx: 10, ry: 13, fill: '#fff2a0', opacity: 0.85 }, s); });   // glue dabs
            } else if (b === 'hole') {
              [150, 396].forEach(function (tx) {
                rect(api, s, tx, 80, 14, 60, '#efe3c8', { stroke: '#a07830' });
                api.svg('circle', { cx: tx + 7, cy: AY, r: 9, fill: 'none', stroke: '#ff5050', 'stroke-width': 2.5 }, s);
              });
            } else {
              [196, 346].forEach(function (tx) { rect(api, s, tx, 72, 18, 66, '#b8b8c8', { opacity: 0.85 }); });   // tape bands
            }
            label(api, s, 280, 166, { straw: 'straw bearing: spins freely', taped: 'taped skewer: wheels rub on it', hole: 'tight hole: scrapes as it turns' }[b],
              { anchor: 'middle', color: b === 'straw' ? '#40e080' : '#ff8060' });
            // the wheels (seen edge-on), with spacers or rubbing
            [[rub ? 140 : 110, -1], [rub ? 420 : 450, 1]].forEach(function (wv) {
              const cx = wv[0], side = wv[1], edge = side < 0 ? 150 : 410, k = -5 * side;
              if (!rub) rect(api, s, side < 0 ? cx + 13 : 413, AY - 8, 24, 16, '#dff3ff', { rx: 3, opacity: 0.8 });
              if (wob) rect(api, s, cx - 10, AY - WR, 20, WR * 2, 'none', { rx: 5, stroke: '#ff5050', 'stroke-dasharray': '4,3', transform: 'rotate(' + (-9 * side) + ',' + cx + ',' + AY + ')' });
              const g = api.svg('g', { transform: wob ? 'rotate(' + (9 * side) + ',' + cx + ',' + AY + ')' : null }, s);
              rect(api, g, cx - 10, AY - WR, 20, WR * 2, '#222', { rx: 5, stroke: '#888', 'stroke-width': 1.5 });
              rect(api, g, cx - 10, AY - 7, 20, 14, '#555');
              if (b === 'taped') api.svg('circle', { cx: cx, cy: AY, r: 10, fill: 'none', stroke: '#ff5050', 'stroke-width': 2.5 }, s);
              // red scrape marks where the wheel touches the chassis
              if (rub) api.svg('polyline', { points: [edge, 64, edge + k, 70, edge, 76, edge + k, 82, edge, 88].join(' '), fill: 'none', stroke: '#ff5050', 'stroke-width': 2.5 }, s);
            });
            if (rub) label(api, s, 112, 52, 'rubs!', { anchor: 'middle', color: '#ff5050', size: 18 });
            else {
              label(api, s, 112, 52, 'spacer', { anchor: 'middle', color: '#9fd8ff' });
              api.svg('line', { x1: 118, y1: 58, x2: 134, y2: AY - 10, stroke: '#9fd8ff', 'stroke-width': 1.5 }, s);
            }
            if (wob) label(api, s, 474, 52, 'wobbles', { anchor: 'middle', color: '#ff5050', size: 18 });
            const terms = [BEARING[b]].concat(wob ? [WOBBLY] : []).concat(rub ? [RUBBING] : []).map(function (t) { return t.toFixed(3); });
            label(api, s, 280, 204, 'stickiness crr = ' + (terms.length > 1 ? terms.join(' + ') + ' = ' : '') + crr.toFixed(3), { anchor: 'middle', color: '#00f5ff', size: 19 });
            // push test
            label(api, s, 20, 236, 'Push test: bare chassis, gentle 1 m/s push', { bold: false });
            api.svg('line', { x1: 30, y1: 300, x2: 540, y2: 300, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            for (let m = 0; m <= 5; m++) {
              api.svg('line', { x1: track(m), y1: 300, x2: track(m), y2: 306, stroke: '#6a5a8a', 'stroke-width': 1.5 }, s);
              label(api, s, track(m), 324, m + ' m', { anchor: 'middle', color: m === 2 ? '#f0c040' : '#9080b0', size: 16, bold: m === 2 });
            }
            api.svg('line', { x1: track(2), y1: 246, x2: track(2), y2: 300, stroke: '#f0c040', 'stroke-width': 1.5, 'stroke-dasharray': '4,4' }, s);
            const ex = track(Math.min(5, dist));
            rect(api, s, track(0), 291, ex - track(0), 4, '#ffa040', { opacity: 0.5 });
            rect(api, s, ex - 26, 282, 28, 6, '#d8b070', { rx: 1 });
            [ex - 20, ex - 4].forEach(function (cx) { api.svg('circle', { cx: cx, cy: 294, r: 6, fill: '#222', stroke: '#888' }, s); });
            label(api, s, ex - 12, 272, dist.toFixed(2) + ' m', { anchor: 'middle', color: '#f0c040', size: 18 });
            const why = { straw: '', taped: ' The wheels’ holes rub on the taped-down skewer.', hole: ' The skewer scrapes in the tight cardstock hole.' }[b] +
              (wob ? ' The wobbly wheels bump and scrub.' : '') + (rub ? ' The wheels rub the chassis.' : '');
            say(api, out, ['🛞 Stickiness ', ['crr = ' + crr.toFixed(3)], '. Push test: coast ≈ 1 × 1 ÷ (2 × ' + crr.toFixed(3) + ' × 9.81) ≈ ', [dist.toFixed(2) + ' m'], '.',
              why || ' Nothing rubs or wobbles — the wheels spin and spin!']);
            if (dist >= 2) api.done('Your chassis coasts ' + dist.toFixed(2) + ' m on the same gentle push. Less stickiness = it rolls much farther. Next: see what that does in the hallway!');
          }
          draw();
        }
      },
      {
        title: 'Hallway challenge: fix the axles',
        html:
          '<p>Here’s the standard lab car: a 20 × 20 cm paper sail, 70 g, starting 30 cm from the fan. ' +
          'But this one has <strong>terrible axles</strong>: skewers in tight cardstock holes, wobbly wheels, and wheels rubbing the chassis.</p>' +
          '<p>You can only change the axles. Fix <strong>one thing at a time</strong> and run the car after each fix. Then you’ll know which fix helped the most.</p>',
        challenge: 'Fix the axles so the car rolls at least 6 metres.',
        render: function (el, api) {
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const br = api.ui.choice(row, { label: 'Bearing', value: 'hole', options: BEARING_OPTS, onChange: info });
          const fit = api.ui.choice(row, { label: 'Wheel fit', value: 'wobbly', options: FIT_OPTS, onChange: info });
          const gap = api.ui.choice(row, { label: 'Wheel gap', value: 'rub', options: GAP_OPTS, onChange: info });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          function crr() { return axleCrr(br.get(), fit.get(), gap.get()); }
          function info() {
            say(api, out, ['🛞 Stickiness ', ['crr = ' + crr().toFixed(3)], ' · friction ', [N(P.rollingFriction(C.mass, crr()))], ' · wind push at the start line ', [N(pushAt(0.3))]]);
          }
          info();
          const runs = [], log = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite', text: '📋 Your runs will be listed here, newest first.' });
          const sim = api.ui.trackSim(el, function () { return { crr: crr() }; }, {
            scaleM: 8, playSpeed: 3,
            onResult: function (r) {
              runs.unshift(BEARING_NAME[br.get()] + ' · ' + fit.get() + ' · ' + (gap.get() === 'rub' ? 'rubbing' : 'spacer') + ' (crr ' + r.car.crr.toFixed(3) + ') → ' + api.fmt(r.distance, 2) + ' m');
              log.textContent = '';
              log.appendChild(api.h('strong', { text: '📋 Your runs (newest first)' }));
              runs.slice(0, 6).forEach(function (t, i) { log.appendChild(api.h('div', { text: (runs.length - i) + '. ' + t })); });
              if (r.distance >= 6) api.done('It rolled ' + api.fmt(r.distance, 2) + ' m — over three times as far as with the terrible axles! Same sail, same fan: only the friction changed.');
            }
          });
          api.onLeave(sim.stop);
          el.appendChild(log);
          api.ui.note(el, 'good', '🏁 <strong>Friction is the biggest factor</strong> in how far a sail car goes. Same sail, same fan: stickiness 0.012 → about 7 m, ' +
            '0.025 → about 4.3 m, 0.07 → about 2 m. The wind fades down the hallway, so a car with less friction can keep rolling where the wind is weak.');
        }
      },
      {
        title: 'Real build: wheels that spin and spin',
        html:
          '<p><strong>Build your axles like this:</strong></p>' +
          '<ol><li><strong>Straw bearings:</strong> cut two pieces of straw a little wider than your chassis. Hot-glue them <strong>across</strong> the chassis, one near the front and one near the back.</li>' +
          '<li><strong>Parallel axles:</strong> before the glue cools, measure the distance between the straws at both ends with a ruler. Same number = parallel. Crooked axles make the car curve into the wall.</li>' +
          '<li><strong>Straight skewers:</strong> roll each skewer or dowel on the table. If it wobbles, it’s bent — use another one. Snip off the sharp tip.</li>' +
          '<li><strong>Spacers:</strong> slide the skewer through the straw, then add a short piece of straw (about 5 mm) on each end.</li>' +
          '<li><strong>Wheels:</strong> push a wheel onto each end and glue it to the skewer, so the whole axle turns inside the straw. Leave a 1–2 mm gap so nothing squeezes. ' +
          'Check that each wheel is centred and straight. (Or let the wheels spin on the skewer, with a tiny dab of glue on the very end so they can’t fall off.)</li>' +
          '<li><strong>Careful with glue and tape:</strong> use small dabs of hot glue. Glue that drips onto a straw end, a spacer or a wheel will lock it. Keep tape away from anything that turns.</li></ol>',
        render: function (el, api) {
          const s = board(api, el, 304, 'Top view of a chassis with straw bearings, skewer axles, spacers and wheels');
          clear(api, s, 304);
          label(api, s, 14, 26, 'seen from above', { color: '#9080b0', size: 15, bold: false });
          label(api, s, 548, 168, 'front →', { anchor: 'end', color: '#9080b0', size: 16, bold: false });
          [112, 172].forEach(function (y) { rect(api, s, 120, y, 320, 16, '#d8b070', { rx: 8, stroke: '#a07830' }); });   // popsicle-stick rails
          [166, 394].forEach(function (ax) {
            api.svg('line', { x1: ax, y1: 40, x2: ax, y2: 260, stroke: '#c8a060', 'stroke-width': 4 }, s);   // skewer
            rect(api, s, ax - 9, 84, 18, 132, '#dff3ff', { rx: 4, opacity: 0.7, stroke: '#9fd8ff' });         // straw bearing
            [68, 220].forEach(function (y) { rect(api, s, ax - 7, y, 14, 12, '#dff3ff', { rx: 3, opacity: 0.85 }); });   // spacers
            [46, 236].forEach(function (y) { rect(api, s, ax - 23, y, 46, 18, '#222', { rx: 4, stroke: '#888', 'stroke-width': 1.5 }); });   // wheels
            [120, 180].forEach(function (y) { api.svg('circle', { cx: ax, cy: y, r: 5, fill: '#fff2a0' }, s); });   // glue dabs
          });
          label(api, s, 196, 68, '← 1–2 mm gap', { color: '#f0c040', size: 16 });
          label(api, s, 186, 88, 'spacer', { color: '#9fd8ff', size: 16 });
          label(api, s, 186, 107, 'straw bearing', { color: '#9fd8ff', size: 16 });
          label(api, s, 186, 156, 'small glue dabs', { color: '#fff2a0', size: 16 });
          label(api, s, 424, 61, 'wheel', { color: '#c8b8ea', size: 16 });
          label(api, s, 424, 38, 'skewer axle', { color: '#c8a060', size: 16 });
          // ruler check: the same distance at both ends = parallel axles
          [[28, 'same distance here…', 18], [278, '…and here = parallel', 298]].forEach(function (r) {
            api.svg('line', { x1: 166, y1: r[0], x2: 394, y2: r[0], stroke: '#f0c040', 'stroke-width': 2, 'stroke-dasharray': '6,4' }, s);
            [166, 394].forEach(function (x) { api.svg('line', { x1: x, y1: r[0] - 6, x2: x, y2: r[0] + 6, stroke: '#f0c040', 'stroke-width': 2 }, s); });
            label(api, s, 280, r[2], r[1], { anchor: 'middle', color: '#f0c040', size: 16 });
          });
          el.appendChild(api.h('div', { html: TESTS_HTML }));
          api.ui.note(el, 'build', '🛠️ <strong>Your materials:</strong> popsicle sticks or cardstock for the chassis, straws for bearings and spacers, skewers or thin dowels for axles, ' +
            'plastic wheels, and hot glue and tape — kept well away from anything that turns.');
        }
      }
    ],
    quiz: [
      { q: 'Your car weighs 1 N. Its wheels and axles have a stickiness (crr) of 0.02. How big is the rolling friction?', options: ['0.2 N', '0.02 N', '1.02 N', '50 N'], answer: 1,
        why: 'Rolling friction = crr × weight = 0.02 × 1 N = 0.02 N.' },
      { q: 'You tape three pennies onto your car to make it heavier. What happens to the rolling friction?', options: ['It gets smaller, because the car is steadier', 'It stays the same — weight doesn’t matter', 'It gets bigger, because the wheels press down harder', 'It disappears once the car starts rolling'], answer: 2,
        why: 'Friction = crr × weight. More weight makes the wheels and axles press harder, so there is more friction.' },
      { q: 'A rolling car has 0.020 N of friction. In our hallway model, about how much push does it need to START rolling from a stop?', options: ['0.010 N', '0.020 N', '0.026 N', '0.200 N'], answer: 2,
        why: 'Starting takes about 1.3 times the rolling friction: 0.020 N × 1.3 = 0.026 N.' },
      { q: 'Far down the hallway, the wind could keep a ROLLING car going, but a car set down there never moves. Why?', options: ['The wind only pushes on cars that are already moving', 'A car standing still has no friction at all', 'Gravity is stronger on a car that isn’t moving', 'It takes more push to start rolling than to keep rolling'], answer: 3,
        why: 'Parts that sit still grip each other a little more. It takes about 30% more push to START rolling than to KEEP rolling.' },
      { q: 'Which axle setup has the LEAST friction?', options: ['A straight skewer spinning freely inside a straw glued to the chassis', 'A skewer pushed through a tight hole in cardstock', 'Wheels pressed tight against the side of the chassis', 'Tape wrapped around the skewer right where the wheels turn'], answer: 0,
        why: 'A straw makes a smooth bearing, so the skewer spins easily inside it. Tight holes, rubbing wheels and tape all add friction.' },
      { q: 'You flick one of your car’s wheels and it stops after half a second. What does that tell you?', options: ['The sail is too small — make it bigger', 'Something is rubbing or too tight — check the axle hole, glue, tape and the gap', 'The car is too light — add pennies', 'Nothing — wheels always stop that fast'], answer: 1,
        why: 'A good wheel spins for 3 seconds or more. If it stops fast, something is rubbing. Find it and fix it.' },
      { q: 'What is the short piece of straw on the axle, between the wheel and the chassis, for?', options: ['It makes the wheel spin faster in the wind', 'It adds weight to hold the car down', 'It locks the wheel so it can’t turn', 'It’s a spacer: it keeps a small gap so the wheel can’t rub the chassis'], answer: 3,
        why: 'A spacer stops the wheel from rubbing the side of the chassis. Rubbing is one of the biggest causes of friction.' },
      { q: 'Same sail, same fan: a car with rubbing, sticky axles (crr 0.07) rolls about 2 m. About how far does it roll once its wheels spin freely (crr 0.012)?', options: ['Still about 2 m — axles don’t matter much', 'About 2.5 m', 'About 7 m', 'All 30 m to the end of the hallway'], answer: 2,
        why: 'Friction is the biggest factor in how far a sail car goes. Smooth axles roll about 7 m, more than three times as far as rubbing ones.' },
      { q: 'One wheel wobbles from side to side as it spins. What is the most likely cause?', options: ['The sail is too big', 'Its hole is off-centre, a glue blob is stuck on it, or the axle is bent', 'The fan is too strong', 'The chassis is too long'], answer: 1,
        why: 'Off-centre holes, glue blobs and bent axles make wheels wobble. A wobbly wheel bumps and scrubs as it rolls, which adds friction.' },
      { q: 'You hot-glue the wheels tightly onto the ends of a skewer. How should that skewer be held on the chassis?', options: ['Loose inside a straw glued across the chassis, so the whole axle can turn', 'Hot-glued to the chassis so it can’t move', 'Taped down tight so it can’t turn', 'Pushed through a tight hole so it can’t slip'], answer: 0,
        why: 'If the wheels are glued to the skewer, the skewer has to turn too. A straw bearing lets it spin freely.' }
    ]
  });
})();
