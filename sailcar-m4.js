// Sail Car Lab — Module 4: Friction (wheels and axles)
// Rolling friction = crr × weight; last year's sliding sleds (SailLab.physics.SLED_FRICTION) against wheels;
// it takes a bit more push to START rolling than to keep rolling (SailLab.physics.STICKY); and what makes crr
// big or small on a real student car. Every number comes from SailLab.physics (rollingFriction, airForce,
// windAt, simulate) — the same two-box-fan model as the hallway — and is worked out when the page loads.
(function () {
  'use strict';
  const P = SailLab.physics, C = P.DEFAULT_CAR, FT = 3.28084;
  const WHEELS = { smooth: 0.012, ok: C.crr, rub: 0.07 };              // three simple "stickiness" levels (steps 1–2)
  const WHEEL_OPTS = [{ value: 'smooth', label: 'Spin freely' }, { value: 'ok', label: 'OK' }, { value: 'rub', label: 'Rubbing' }];
  const WHEEL_NAME = { smooth: 'free-spinning wheels', ok: 'OK wheels', rub: 'rubbing wheels' };
  // Last year's paper-sail SLED: no wheels, so it SLIDES (stickiness = SLED_FRICTION ≈ 0.3). About 20 g with a
  // 20 cm × 22 cm tent-shaped sail sitting low (its middle 7 cm up) and its weight spread forward, so the strong
  // two-fan push at the start line can't tip it over.
  const SLED = { mass: 0.02, crr: P.SLED_FRICTION, sailArea: 0.044, sailHeight: 0.07, cgToFront: 0.10 };
  // Axle builder (steps 4–5): the same crr numbers the Design Studio uses for these parts
  const BEARING = { straw: 0.012, taped: 0.022, hole: 0.03 }, WOBBLY = 0.012, RUBBING = 0.03;
  const BEARING_NAME = { straw: 'straw bearing', taped: 'taped skewer', hole: 'cardstock hole' };
  const BEARING_OPTS = [{ value: 'straw', label: 'Skewer spins in a straw' }, { value: 'taped', label: 'Skewer taped down' }, { value: 'hole', label: 'Skewer in a cardstock hole' }];
  const FIT_OPTS = [{ value: 'snug', label: 'Snug & centred' }, { value: 'wobbly', label: 'Wobbly' }];
  const GAP_OPTS = [{ value: 'spacer', label: 'Straw spacer (small gap)' }, { value: 'rub', label: 'Rubs the chassis' }];
  function axleCrr(b, fit, gap) { return BEARING[b] + (fit === 'wobbly' ? WOBBLY : 0) + (gap === 'rub' ? RUBBING : 0); }
  // how far a bare chassis coasts after a push of v m/s if only friction slows it: v² ÷ (2 × crr × 9.81)
  function coast(v, crr) { return v * v / (2 * crr * P.G); }
  // the wind's push on the standard car sitting still x metres from the fans (sail + body, as simulate() starts it)
  function pushAt(x) { const w = P.windAt(x); return P.airForce(w, C.sailArea, C.sailCd, 0) + P.airForce(w, C.bodyArea, C.bodyCd, 0); }
  // the farthest spot (metres from the fans) where a 70 g car with this stickiness still STARTS by itself
  function farStart(crr) {
    const need = P.rollingFriction(C.mass, crr) * P.STICKY;
    let lo = 0.3, hi = 200;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (pushAt(m) > need) lo = m; else hi = m; }
    return lo;
  }
  function N(f) { return f.toFixed(3) + ' N'; }
  function ft(m) { return Math.round(m * FT); }
  function dist(m) { return m.toFixed(2) + ' m (' + ft(m) + ' ft)'; }
  function dist1(m) { return m.toFixed(1) + ' m (' + ft(m) + ' ft)'; }

  // ── the hallway: its size lives ONLY in SailLab.physics.HALL (sailcar-core.js); nothing below hard-codes it ──
  const HALL = P.HALL;
  const HALL_TXT = Number(HALL.length.toFixed(1)) + ' m (' + ft(HALL.length) + ' ft)';     // "21.3 m (70 ft)"
  const WIDE_TXT = Number(HALL.width.toFixed(1)) + ' m (' + ft(HALL.width) + ' ft)';       // "3.4 m (11 ft)"
  const LONG_HALL = 1000;                    // "a longer hall": room for any car to coast to a stop
  // one run in the real hallway; a car that reaches the end is run again in a longer hall to say how far it WOULD go
  function roll(car) {
    const r = P.simulate(car);
    r.end = r.reason === 'reached the end of the hall';
    r.longer = r.end ? P.simulate(car, { hallLength: LONG_HALL }).distance : r.distance;
    return r;
  }
  function rollText(r) {
    return r.end ? 'all the way to the end of the ' + HALL_TXT + ' hallway — in a longer hall, about ' + dist1(r.longer)
                 : 'about ' + dist1(r.distance);
  }

  // ── numbers worked out from the model (so every sentence below stays true) ──
  const FR = P.rollingFriction(C.mass, C.crr);                          // the starting car: 70 g, OK wheels
  const START_RUN = P.simulate({});
  const STOP_X = START_RUN.opts.startX + START_RUN.distance;            // where it stops, rolling in from the start line (m from the fans)
  const END_X = START_RUN.opts.startX + HALL.length;                    // the end of the hallway, in metres from the fans
  const SLED_RUN = P.simulate(SLED);
  const RUN = { smooth: roll({ crr: WHEELS.smooth }), ok: roll({ crr: WHEELS.ok }), rub: roll({ crr: WHEELS.rub }) };
  const TERRIBLE = axleCrr('hole', 'wobbly', 'rub'), TERRIBLE_D = P.simulate({ crr: TERRIBLE }).distance;
  // Step 5's goal: all the way to the END of the hallway — only axles with all three fixes get there. (If the hall is
  // ever made longer than even that car can roll, the goal becomes the whole metres that car can still reach.)
  const BEST_AXLE = roll({ crr: axleCrr('straw', 'snug', 'spacer') });
  const HALL_GOAL = Math.min(HALL.length, Math.floor(BEST_AXLE.longer));
  const GOAL_IS_END = HALL_GOAL >= HALL.length;
  const VEER = P.simulate({ veerDeg: 1.5 });
  const SPOT_MAX = Math.min(20, Math.floor(END_X));                     // step 3's slider and picture: metres from the fans, inside the hall

  // ── the challenge rules: the steps call these before api.done(), and the node check script tests them ──
  // where the starting car is set down (x m from the fans): 'start' it starts by itself; 'keep' it can't start, but the
  // same car rolling in from the start line goes right past; 'crawl' a still car gets a hair more push than friction,
  // but the rolling car has already stopped; 'weak' too weak even to keep a car rolling
  function spot(x) {
    const p = pushAt(x);
    if (p > FR * P.STICKY) return 'start';
    if (x < STOP_X) return 'keep';
    return p > FR ? 'crawl' : 'weak';
  }
  const checks = {
    lighter: function (grams, crr) { return grams >= 100 && P.rollingFriction(grams / 1000, crr) < FR; },
    race: function (sledDist, carDist) { return carDist >= 2 * sledDist; },
    spot: function (x) { return spot(x) === 'keep'; },
    pushTest: function (crr) { return coast(1, crr) >= 2; },
    hall: function (distance) { return distance >= HALL_GOAL - 1e-9; }      // a car that reaches the end has rolled exactly HALL.length
  };
  // true when only the fully fixed axle (straw bearing, snug wheels, spacers) meets step 5's goal
  const ONLY_FULL_FIX = Object.keys(BEARING).every(function (b) {
    return ['snug', 'wobbly'].every(function (f) {
      return ['spacer', 'rub'].every(function (g) {
        return (b === 'straw' && f === 'snug' && g === 'spacer') || !checks.hall(P.simulate({ crr: axleCrr(b, f, g) }).distance);
      });
    });
  });
  // the "keep" zone on the step-3 slider (0.1 m steps), for the message when it's found
  let ZONE_LO = null;
  for (let i = 3; i <= 200; i++) if (spot(i / 10) === 'keep') { ZONE_LO = i / 10; break; }

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
  // the box fans, with a label big enough to read on a phone (or no label)
  function fans(api, s, x, floorY, size, withLabel) {
    const g = api.draw.fan(s, x, floorY, size), t = g.querySelector('text');
    if (t && withLabel) { t.setAttribute('font-size', 16); t.setAttribute('font-weight', 700); t.setAttribute('y', floorY + 20); t.setAttribute('class', 'sl-lbl'); }
    else if (t) t.remove();
  }
  // wind streaks: shorter and fainter where the wind is weaker. m → px is given; x = metres from the fans
  function streaks(api, s, toPx, from, to, stepM, floorY, heights) {
    for (let m = from; m < to; m += stepM) {
      const ww = P.windAt(m);
      heights.forEach(function (y, i) {
        api.svg('line', { x1: toPx(m) + i * 10, y1: floorY - y, x2: toPx(m) + i * 10 + ww * 8, y2: floorY - y, stroke: '#7ad7ff', 'stroke-width': 1.5,
          opacity: Math.min(0.6, ww / P.FAN.v0 * 0.7).toFixed(2), 'stroke-linecap': 'round' }, s);
      });
    }
  }

  const TESTS_HTML =
    '<p><strong>Test the friction in the hallway:</strong></p>' +
    '<ol><li><strong>Flick test:</strong> hold the car up and flick each wheel. It should spin for <strong>3 seconds or more</strong>. If it stops fast, find what rubs and fix it.</li>' +
    '<li><strong>Push test (before the sail goes on):</strong> make a ramp by leaning a binder or a piece of cardstock on a book. Let the chassis roll down from the same mark every time, and measure how far it coasts. ' +
    'Fix one thing, then test again. Farther = less friction.</li>' +
    '<li><strong>Start test:</strong> with the sail on, set the car down 2\u00a0m (about 6½\u00a0ft) in front of the fans, then 2\u00a0m farther away each time. Find the farthest spot where it still starts rolling by itself. ' +
    'Less friction = it can start farther from the fans. (In our model, the lab car with OK wheels ' + startsUpTo(WHEELS.ok) + ', and with free-spinning wheels it ' + startsUpTo(WHEELS.smooth) + '.)</li></ol>';
  // the start test's answer in words: a spot in the hallway, or "anywhere" once that spot is past the end of the hall
  function startsUpTo(crr) {
    const f = farStart(crr);
    return f >= END_X ? 'starts anywhere in our ' + ft(HALL.length) + ' ft hallway' : 'starts up to about ' + Math.round(f) + ' m (' + ft(f) + ' ft) away';
  }

  SailLab.register({
    id: 'friction',
    num: 4,
    title: 'Friction',
    icon: '🛞',
    blurb: 'Why wheels beat last year’s sleds, what slows them down, and how to build axles that spin and spin.',
    minutes: 18,
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
          '(the “coefficient of rolling resistance”). Free-spinning wheels: about 0.012. Wheels that rub: 0.07 or more. ' +
          'A sled with no wheels, sliding on the floor: about ' + P.SLED_FRICTION + '!</li></ul>' +
          '<p style="text-align:center;font-size:1.1rem"><strong>friction = crr × weight</strong></p>' +
          '<p>The starting car below is 70 g with OK wheels: 0.025 × 0.69 N ≈ 0.017 N. That’s about the weight of two paper clips. Tiny! ' +
          'But far down the hall, the wind’s push is tiny too: about 15 m from the fans, it pushes this car with only about ' + N(pushAt(15)) + '.</p>',
        challenge: 'Build a car that weighs at least 100 g but has LESS friction than the starting car (70 g with OK wheels).',
        render: function (el, api) {
          const s = board(api, el, 260, 'A sail car with its weight pressing down and friction holding it back, and its friction compared with the starting car');
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const mass = api.ui.slider(row, { label: 'Car mass', min: 40, max: 200, step: 10, value: 70, format: function (v) { return v + ' g'; }, onInput: draw });
          const wh = api.ui.choice(row, { label: 'Wheels', value: 'ok', options: WHEEL_OPTS, onChange: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const BX = 290, MAXF = 0.08, BW = 252;      // bars show 0 to 0.08 N
          function draw() {
            const g = mass.get(), m = g / 1000, crr = WHEELS[wh.get()], wt = m * P.G, fr = P.rollingFriction(m, crr);
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
            label(api, s, BX, 212, 'Starting car: ' + N(FR));
            bar(api, s, BX, 220, FR, MAXF, BW, '#9080b0');
            api.svg('line', { x1: BX + FR / MAXF * BW, y1: 160, x2: BX + FR / MAXF * BW, y2: 192, stroke: '#f0e6ff', 'stroke-width': 1.5, 'stroke-dasharray': '4,3' }, s);   // the starting car's friction, marked on your bar
            const parts = ['⚖️ Weight = ' + m.toFixed(2) + ' kg × 9.81 = ', [wt.toFixed(2) + ' N'], '. Friction = ' + crr.toFixed(3) + ' × ' + wt.toFixed(2) + ' N = ', [N(fr)],
              ' — that’s ', ['× ' + (fr / FR).toFixed(2)], ' the starting car’s friction.'];
            if (g >= 100 && fr >= FR) parts.push(' A heavier car has more friction… can you make up for it with the wheels?');
            say(api, out, parts);
            if (checks.lighter(g, crr)) api.done('Friction = stickiness × weight. Your heavier car still has less friction, because free-spinning wheels cut the stickiness by more than half. Weight matters — but stickiness is the part you can fix!');
          }
          draw();
        }
      },
      {
        title: 'Sleds slide, wheels roll',
        html:
          '<p>Last year’s classes built paper-sail <strong>sleds</strong> with no wheels. In front of the same two box fans, most slid about <strong>25 ft (7.6 m)</strong>, ' +
          'and the best went about <strong>30 ft (9.1 m)</strong>.</p>' +
          '<p>A sled <strong>slides</strong>: its whole bottom scrapes along the floor. Its friction is about <strong>' + P.SLED_FRICTION + ' × its weight</strong>. ' +
          'Wheels <strong>roll</strong> instead. Even OK wheels (stickiness 0.025) have more than <strong>ten times less</strong> friction for the same weight, and wheels that spin freely in straw bearings (0.012) have even less. ' +
          'That’s why a wheeled car can roll much farther with the same fans.</p>' +
          '<p>Race our model sled against the 70 g lab car. The sled weighs only 20 g, and its tent-shaped sail sits low so the fans can’t tip it over.</p>',
        challenge: 'Race the sled against a car that rolls at least TWICE as far as the sled.',
        render: function (el, api) {
          // two lanes, the whole hallway: the start line at X0, the end wall at XE. The sled and the car are drawn with
          // their FRONT at the distance they have gone, so a car that reaches the end touches the wall.
          const H = 312, LS = 120, LC = 248, X0 = 106, XE = 540, SC = HALL.length, CAR_W = 44, SLED_W = 42;
          const s = board(api, el, H, 'Two lanes of the ' + HALL_TXT + ' hallway in front of the same two fans: last year’s sled and this year’s wheeled car race');
          function hx(m) { return X0 + m / SC * (XE - X0); }
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const wh = api.ui.choice(row, { label: 'The car’s wheels', value: 'rub', options: WHEEL_OPTS.slice().reverse(), onChange: reset });
          const go = api.h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: '▶ Race!' });
          const again = api.h('button', { type: 'button', class: 'sl-btn', text: '↺ Reset' });
          el.appendChild(api.h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 8px' }, [go, again]));
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          let raf = null;
          function stop() { if (raf) cancelAnimationFrame(raf); raf = null; go.disabled = false; }
          api.onLeave(stop);
          function sled(x, fy) {
            rect(api, s, x, fy - 5, 42, 5, '#e8dcc0', { stroke: '#a07830', 'stroke-width': 0.8 });                // cardstock base
            api.svg('polygon', { points: [x + 3, fy - 5, x + 21, fy - 36, x + 39, fy - 5].join(','), fill: '#f0e6ff', stroke: '#9080b0', 'stroke-width': 1, opacity: 0.92 }, s);   // tent sail
          }
          function scene(ds, dc, sDone, cDone) {
            clear(api, s, H);
            // last year's sleds: most about 25 ft (7.6 m), the best about 30 ft (9.1 m)
            rect(api, s, hx(7.6), LS - 58, hx(9.1) - hx(7.6), 58, '#f0c040', { opacity: 0.28 });
            [7.6, 9.1].forEach(function (m) { api.svg('line', { x1: hx(m), y1: LS - 58, x2: hx(m), y2: LS, stroke: '#f0c040', 'stroke-width': 1.5 }, s); });
            label(api, s, (hx(7.6) + hx(9.1)) / 2, LS - 64, 'last year: 25–30 ft', { anchor: 'middle', color: '#f0c040', size: 16 });
            [LS, LC].forEach(function (fy, lane) {
              api.svg('line', { x1: 10, y1: fy, x2: XE, y2: fy, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
              fans(api, s, 40, fy, 56, lane === 0);
              for (let m = 0; m <= SC; m += 5) api.svg('line', { x1: hx(m), y1: fy, x2: hx(m), y2: fy + 7, stroke: '#6a5a8a', 'stroke-width': 1.5 }, s);
              streaks(api, s, function (m) { return hx(m - 0.3); }, 0.8, SC, 1.5, fy, [36, 56]);
              rect(api, s, XE, fy - 54, 8, 60, '#6a5a8a', { rx: 2 });                  // the wall at the end of the hallway
            });
            for (let m = 0; m <= SC; m += 5) label(api, s, hx(m), LC + 25, m ? m + ' m' : '0', { anchor: 'middle', color: '#9080b0', size: 16, bold: false });
            label(api, s, 548, H - 10, 'end of the hallway: ' + HALL_TXT + ' ▲', { anchor: 'end', color: '#c8b8ea', size: 16, bold: false });
            label(api, s, X0 + 10, 28, 'Last year’s SLED (20 g)', { color: '#f0e6ff' });
            label(api, s, X0 + 10, 158, 'This year’s CAR (70 g)', { color: '#f0e6ff' });
            [[ds, sDone, 28, LS], [dc, cDone, 158, LC]].forEach(function (r) {
              if (r[0] == null) return;
              label(api, s, 546, r[2], r[1] ? dist(r[0]) : r[0].toFixed(1) + ' m', { anchor: 'end', color: r[1] ? '#f0c040' : '#c8b8ea' });
              if (r[1]) api.svg('line', { x1: hx(r[0]), y1: r[3] - 60, x2: hx(r[0]), y2: r[3], stroke: '#f0c040', 'stroke-dasharray': '4,4', 'stroke-width': 1.5 }, s);
            });
            sled(hx(ds || 0) - SLED_W, LS);
            api.draw.car(s, hx(dc || 0) - CAR_W, LC, { scale: 1.7, length: 26 });
          }
          function reset() {
            stop();
            scene(null, null, false, false);
            const crr = WHEELS[wh.get()], sw = SLED.mass * P.G, cw = C.mass * P.G;
            say(api, out, ['🛷 Sled friction: ' + P.SLED_FRICTION + ' × ' + sw.toFixed(3) + ' N = ', [N(P.rollingFriction(SLED.mass, SLED.crr))],
              '. 🚗 Car friction: ' + crr.toFixed(3) + ' × ' + cw.toFixed(3) + ' N = ', [N(P.rollingFriction(C.mass, crr))],
              '. The sled weighs less than a third as much as the car, but its friction is bigger! Press ▶ Race!']);
          }
          function race() {
            stop();
            const kind = wh.get(), rs = P.simulate(SLED), rc = P.simulate({ crr: WHEELS[kind] });
            const end = Math.max(rs.time, rc.time), speed = Math.max(2, end / 8), t0 = performance.now();
            let is = 0, ic = 0;
            go.disabled = true;
            function frame(now) {
              const t = (now - t0) / 1000 * speed;
              while (is < rs.trace.length - 1 && rs.trace[is + 1].t <= t) is++;
              while (ic < rc.trace.length - 1 && rc.trace[ic + 1].t <= t) ic++;
              const sDone = t >= rs.time, cDone = t >= rc.time;
              scene(sDone ? rs.distance : rs.trace[is].x, cDone ? rc.distance : rc.trace[ic].x, sDone, cDone);
              if (!(sDone && cDone)) {
                say(api, out, ['⏱ ' + Math.min(t, end).toFixed(0) + ' s · 🛷 sled ' + (sDone ? rs.distance : rs.trace[is].x).toFixed(1) + ' m · 🚗 car ' + rc.trace[ic].x.toFixed(1) + ' m']);
                raf = requestAnimationFrame(frame);
                return;
              }
              raf = null; go.disabled = false;
              const ratio = rc.distance / rs.distance, win = checks.race(rs.distance, rc.distance), atEnd = rc.reason === 'reached the end of the hall';
              // a car that reaches the end of the hallway would have gone even farther: say how far, from a run in a longer hall
              const longer = atEnd ? P.simulate(rc.car, { hallLength: LONG_HALL }).distance : rc.distance;
              say(api, out, ['🛷 Sled: ', [dist(rs.distance)], ' · 🚗 Car with ' + WHEEL_NAME[kind] + ': ', [atEnd ? 'the end of the hallway, ' + dist(rc.distance) : dist(rc.distance)], ' → ', [ratio.toFixed(1) + ' times'], ' as far as the sled. ',
                atEnd ? 'It ran out of hallway! In a longer hall it would roll about ' + dist1(longer) + ', ' + (longer / rs.distance).toFixed(1) + ' times as far as the sled. Rolling beats sliding!'
                  : win ? 'Rolling beats sliding!' : 'Rubbing wheels on a heavier car: its friction (' + N(rc.friction) + ') is almost as big as the sled’s (' + N(rs.friction) + '), so it only just wins. Try better wheels!']);
              if (win) api.done('With ' + WHEEL_NAME[kind] + ', the car rolled ' + (atEnd ? 'all the way to the end of the ' + HALL_TXT + ' hallway' : dist(rc.distance)) + ' — ' + ratio.toFixed(1) + ' times as far as the sled' +
                (atEnd ? ', and it was still rolling' : '') + ', with the same two fans. Rolling beats sliding!');
            }
            raf = requestAnimationFrame(frame);
          }
          go.addEventListener('click', race);
          again.addEventListener('click', reset);
          reset();
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
          '<p>The wind from the two fans fades as it spreads out: about ' + P.FAN.L.toFixed(1) + ' m from the fans it’s half as strong, and about ' + (3 * P.FAN.L).toFixed(1) + ' m away only a quarter. ' +
          'So the push gets smaller the farther you go. Set the starting car (70 g, OK wheels) down at different spots and compare.</p>',
        challenge: 'Find a spot where the wind is too weak to START the car sitting still, but the same car rolling in from the start line keeps going right past it.',
        render: function (el, api) {
          const H = 290, s = board(api, el, H, 'A hallway with the fans and your car, and a bar comparing the wind push with the push needed to start and to keep rolling');
          const d = api.ui.slider(el, { label: 'Where you set the car down (distance from the fans)', min: 0.3, max: SPOT_MAX, step: 0.1, value: 2, format: function (v) { return v.toFixed(1) + ' m'; }, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const st = FR * P.STICKY;
          const FL = 116, BX = 30, MAXP = 0.04, BW = 500;               // floor; push bar: 0 to 0.04 N across 500 px
          function px(m) { return 60 + m / SPOT_MAX * 480; }             // 0–SPOT_MAX m (20 m, inside the hallway) across 480 px
          function draw() {
            const x = d.get(), w = P.windAt(x), p = pushAt(x), where = spot(x);
            clear(api, s, H);
            // the hallway: fans, metre marks, fading wind, where the rolling car stops, the car
            api.svg('line', { x1: 10, y1: FL, x2: 550, y2: FL, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            fans(api, s, 30, FL, 72, true);
            for (let m = 2; m <= SPOT_MAX; m += 2) {
              api.svg('line', { x1: px(m), y1: FL, x2: px(m), y2: FL + 7, stroke: '#6a5a8a', 'stroke-width': 1.5 }, s);
              label(api, s, px(m), FL + 25, m + ' m', { anchor: 'middle', color: '#9080b0', size: 16, bold: false });
            }
            streaks(api, s, px, 0.15, SPOT_MAX, 1, FL, [62, 86]);
            api.svg('line', { x1: px(STOP_X), y1: 30, x2: px(STOP_X), y2: FL, stroke: '#f0c040', 'stroke-width': 2, 'stroke-dasharray': '5,4' }, s);
            label(api, s, px(STOP_X) + 6, 22, 'rolling in from the start line, the car stops at ' + STOP_X.toFixed(1) + ' m', { anchor: 'end', color: '#f0c040', size: 16, bold: false });
            api.draw.car(s, px(x) - 6, FL, { scale: 1.5, length: 26 });
            // push bar against two lines: keep rolling (friction) and start (friction × 1.3)
            label(api, s, BX, 168, 'Wind ' + w.toFixed(2) + ' m/s → push on the car: ' + N(p), { color: '#40e080', size: 18 });
            bar(api, s, BX, 178, p, MAXP, BW, '#40e080');
            [[FR, '#ffa040', 'keep rolling: ' + N(FR), 'end', -6], [st, '#f0c040', 'start: ' + N(st), 'start', 6]].forEach(function (b) {
              const lx = BX + b[0] / MAXP * BW;
              api.svg('line', { x1: lx, y1: 172, x2: lx, y2: 210, stroke: b[1], 'stroke-width': 3 }, s);
              label(api, s, lx + b[4], 230, b[2], { anchor: b[3], color: b[1] });
            });
            label(api, s, BX, 266, { start: 'It STARTS rolling here.', keep: 'Can’t START here, but a rolling car keeps going!', crawl: 'The rolling car has already stopped before here.', weak: 'Too weak to even keep a car rolling.' }[where],
              { color: { start: '#40e080', keep: '#f0c040', crawl: '#ff8060', weak: '#ff8060' }[where], size: 19 });
            const parts = ['📍 ' + x.toFixed(1) + ' m from the fans: wind ' + w.toFixed(2) + ' m/s, push ', [N(p)], '. To keep rolling it needs more than ', [N(FR)],
              ' (the friction). To start, it needs more than ', [N(st)], ' (friction × 1.3).'];
            if (where === 'keep') parts.push(' The car rolling in from the start line goes right past this spot (it stops at ' + STOP_X.toFixed(1) + ' m) — but set down here, it never moves!');
            if (where === 'crawl') parts.push(' A car sitting here gets just a hair more push than friction. But a moving car feels a little less wind (it’s moving along with the wind), so the car from the start line slowed to a crawl and stopped at ' + STOP_X.toFixed(1) + ' m.');
            say(api, out, parts);
            if (checks.spot(x)) api.done('From about ' + ZONE_LO.toFixed(1) + ' m to ' + STOP_X.toFixed(1) + ' m from the fans, the car rolling in from the start line keeps going, but the same car set down there never starts. Starting takes about 30% more push than rolling!');
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
          'Less stickiness = it coasts farther. (In real life, a little air drag makes it stop a bit sooner. A sliding sled pushed the same way would stop after only about ' +
          Math.round(coast(1, SLED.crr) * 100) + ' cm!)</p>',
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
            const b = br.get(), wob = fit.get() === 'wobbly', rub = gap.get() === 'rub', crr = axleCrr(b, fit.get(), gap.get()), dst = coast(1, crr);
            clear(api, s, H);
            label(api, s, 546, 24, 'front view of one axle', { anchor: 'end', color: '#9080b0', size: 16, bold: false });
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
            const ex = track(Math.min(5, dst));
            rect(api, s, track(0), 291, ex - track(0), 4, '#ffa040', { opacity: 0.5 });
            rect(api, s, ex - 26, 282, 28, 6, '#d8b070', { rx: 1 });
            [ex - 20, ex - 4].forEach(function (cx) { api.svg('circle', { cx: cx, cy: 294, r: 6, fill: '#222', stroke: '#888' }, s); });
            label(api, s, ex - 12, 272, dst.toFixed(2) + ' m', { anchor: 'middle', color: '#f0c040', size: 18 });
            const why = { straw: '', taped: ' The wheels’ holes rub on the taped-down skewer.', hole: ' The skewer scrapes in the tight cardstock hole.' }[b] +
              (wob ? ' The wobbly wheels bump and scrub.' : '') + (rub ? ' The wheels rub the chassis.' : '');
            say(api, out, ['🛞 Stickiness ', ['crr = ' + crr.toFixed(3)], '. Push test: coast ≈ 1 × 1 ÷ (2 × ' + crr.toFixed(3) + ' × 9.81) ≈ ', [dst.toFixed(2) + ' m'], '.',
              why || ' Nothing rubs or wobbles — the wheels spin and spin!']);
            if (checks.pushTest(crr)) api.done('Your chassis coasts ' + dst.toFixed(2) + ' m on the same gentle push. Less stickiness = it rolls much farther. Next: see what that does in the hallway!');
          }
          draw();
        }
      },
      {
        title: 'Hallway challenge: fix the axles',
        html:
          '<p>Here’s the standard lab car: a 20 × 20 cm paper sail, 70 g, starting 30 cm from the two box fans. ' +
          'But this one has <strong>terrible axles</strong>: skewers in tight cardstock holes, wobbly wheels, and wheels rubbing the chassis. ' +
          'It rolls only about ' + dist1(TERRIBLE_D) + ' of our ' + HALL_TXT + ' hallway — no better than last year’s sleds!</p>' +
          '<p>You can only change the axles. Fix <strong>one thing at a time</strong> and run the car after each fix. Then you’ll know which fix helped the most.</p>',
        challenge: GOAL_IS_END ? 'Fix the axles so the car rolls all the way to the end of the hallway: ' + HALL_TXT + '.'
                               : 'Fix the axles so the car rolls at least ' + HALL_GOAL + ' metres (about ' + ft(HALL_GOAL) + ' ft).',
        render: function (el, api) {
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          let sim = null;
          // changing an axle stops the run on screen, so an old run can't count for the new axles
          function changed() { if (sim) sim.reset(); info(); }
          const br = api.ui.choice(row, { label: 'Bearing', value: 'hole', options: BEARING_OPTS, onChange: changed });
          const fit = api.ui.choice(row, { label: 'Wheel fit', value: 'wobbly', options: FIT_OPTS, onChange: changed });
          const gap = api.ui.choice(row, { label: 'Wheel gap', value: 'rub', options: GAP_OPTS, onChange: changed });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          function crr() { return axleCrr(br.get(), fit.get(), gap.get()); }
          function info() {
            say(api, out, ['🛞 Stickiness ', ['crr = ' + crr().toFixed(3)], ' · friction ', [N(P.rollingFriction(C.mass, crr()))], ' · wind push at the start line ', [N(pushAt(0.3))]]);
          }
          info();
          const runs = [], log = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite', text: '📋 Your runs will be listed here, newest first.' });
          sim = api.ui.trackSim(el, function () { return { crr: crr() }; }, {
            scaleM: HALL.length,                                             // the whole hallway, start line to end wall
            onResult: function (r) {
              if (Math.abs(r.car.crr - crr()) > 1e-9) return;                // not the axles on screen now
              const end = r.reason === 'reached the end of the hall';
              runs.unshift(BEARING_NAME[br.get()] + ' · ' + fit.get() + ' · ' + (gap.get() === 'rub' ? 'rubbing' : 'spacer') + ' (crr ' + r.car.crr.toFixed(3) + ') → ' + dist(r.distance) + (end ? ' 🏁 the end of the hallway!' : ''));
              log.textContent = '';
              log.appendChild(api.h('strong', { text: '📋 Your runs (newest first)' }));
              runs.slice(0, 6).forEach(function (t, i) { log.appendChild(api.h('div', { text: (runs.length - i) + '. ' + t })); });
              if (!checks.hall(r.distance)) return;
              if (end) {
                // it ran out of hallway: how far would it have gone? (the same car in a longer hall)
                const longer = P.simulate(r.car, { hallLength: LONG_HALL }).distance;
                api.done('It made it all the way to the end of the ' + HALL_TXT + ' hallway, still rolling! In a longer hall it would roll about ' + dist1(longer) + ' — ' +
                  (longer / TERRIBLE_D).toFixed(1) + ' times as far as with the terrible axles. Same sail, same fans: only the friction changed.' + (ONLY_FULL_FIX ? ' It took all three fixes to get here.' : ''));
              } else api.done('It rolled ' + dist(r.distance) + ' — ' + (r.distance / TERRIBLE_D).toFixed(1) + ' times as far as with the terrible axles! Same sail, same fans: only the friction changed.');
            }
          });
          api.onLeave(sim.stop);
          el.appendChild(log);
          api.ui.note(el, 'good', '🏁 <strong>Friction is one of the biggest factors</strong> in how far a sail car goes. Same sail, same fans: stickiness 0.012 → ' + rollText(RUN.smooth) + '; ' +
            '0.025 → ' + rollText(RUN.ok) + '; 0.07 → ' + rollText(RUN.rub) + '. The wind fades down the hallway, so a car with less friction can keep rolling where the wind is weak.');
        }
      },
      {
        title: 'Real build: wheels that spin and spin',
        html:
          '<p><strong>Build your axles like this:</strong></p>' +
          '<ol><li><strong>Straw bearings:</strong> cut two pieces of straw a little wider than your chassis. Hot-glue them <strong>across</strong> the chassis, one near the front and one near the back.</li>' +
          '<li><strong>Parallel axles:</strong> before the glue cools, measure the distance between the straws at both ends with a ruler. Same number = parallel. Crooked axles make the car curve into the wall. ' +
          '(In our model of the ' + WIDE_TXT + ' wide hallway, a front axle just 1.5° off square ' +
          (VEER.reason === 'hit the wall' ? 'hits the wall after only about ' + dist1(VEER.distance) + '.)</li>' : 'curves ' + (VEER.trace[VEER.trace.length - 1].lateral * 100).toFixed(0) + ' cm sideways.)</li>') +
          '<li><strong>Straight skewers:</strong> roll each skewer or dowel on the table. If it wobbles, it’s bent — use another one. Snip off the sharp tip.</li>' +
          '<li><strong>Spacers:</strong> slide the skewer through the straw, then add a short piece of straw (about 5 mm) on each end.</li>' +
          '<li><strong>Wheels:</strong> push a wheel onto each end and glue it to the skewer, so the whole axle turns inside the straw. Leave a 1–2 mm gap so nothing squeezes. ' +
          'Check that each wheel is centred and straight. (Or let the wheels spin on the skewer, with a tiny dab of glue on the very end so they can’t fall off.)</li>' +
          '<li><strong>Careful with glue and tape:</strong> use small dabs of hot glue. Glue that drips onto a straw end, a spacer or a wheel will lock it. Keep tape away from anything that turns.</li></ol>',
        render: function (el, api) {
          const s = board(api, el, 304, 'Top view of a chassis with straw bearings, skewer axles, spacers and wheels');
          clear(api, s, 304);
          label(api, s, 14, 26, 'seen from above', { color: '#9080b0', size: 16, bold: false });
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
      { q: 'Far down the hallway from the two box fans, the wind can’t start a car that is set down there, but the same car rolling in from the start line keeps going right past. Why?', options: ['The wind only pushes on cars that are already moving', 'A car standing still has no friction at all', 'Gravity is stronger on a car that isn’t moving', 'It takes more push to start rolling than to keep rolling'], answer: 3,
        why: 'Parts that sit still grip each other a little more. It takes about 30% more push to START rolling than to KEEP rolling.' },
      { q: 'Which axle setup has the LEAST friction?', options: ['A straight skewer spinning freely inside a straw glued to the chassis', 'A skewer pushed through a tight hole in cardstock', 'Wheels pressed tight against the side of the chassis', 'Tape wrapped around the skewer right where the wheels turn'], answer: 0,
        why: 'A straw makes a smooth bearing, so the skewer spins easily inside it. Tight holes, rubbing wheels and tape all add friction.' },
      { q: 'You flick one of your car’s wheels and it stops after half a second. What does that tell you?', options: ['The sail is too small — make it bigger', 'Something is rubbing or too tight — check the axle hole, glue, tape and the gap', 'The car is too light — add pennies', 'Nothing — wheels always stop that fast'], answer: 1,
        why: 'A good wheel spins for 3 seconds or more. If it stops fast, something is rubbing. Find it and fix it.' },
      { q: 'What is the short piece of straw on the axle, between the wheel and the chassis, for?', options: ['It makes the wheel spin faster in the wind', 'It adds weight to hold the car down', 'It locks the wheel so it can’t turn', 'It’s a spacer: it keeps a small gap so the wheel can’t rub the chassis'], answer: 3,
        why: 'A spacer stops the wheel from rubbing the side of the chassis. Rubbing is one of the biggest causes of friction.' },
      { q: 'In front of the two box fans, the lab car with rubbing, sticky axles (crr 0.07) rolls about ' + Math.round(RUN.rub.distance) + ' m. About how far does the same car roll once its wheels spin freely (crr 0.012)?',
        options: ['Still about ' + Math.round(RUN.rub.distance) + ' m — axles don’t matter much', 'About ' + (Math.round(RUN.rub.distance) + 1) + ' m — just a little farther',
          (RUN.smooth.end ? 'All the way to the end of our ' + ft(HALL.length) + ' ft hallway' : 'About ' + Math.round(RUN.smooth.distance) + ' m') + ' — about ' + Math.round(RUN.smooth.distance / RUN.rub.distance) + ' times as far',
          'It won’t move at all — free-spinning wheels can’t grip the floor'], answer: 2,
        why: 'Less friction lets the car keep rolling where the wind is weak. In our model, free-spinning wheels roll ' + rollText(RUN.smooth) + '. That’s about ' +
          Math.round(RUN.smooth.longer / RUN.rub.distance) + ' times as far as rubbing ones.' },
      { q: 'Last year’s paper-sail sleds (no wheels) slid about 25 ft in front of the same two box fans. What is the main reason a wheeled car can roll much farther?', options: ['Rolling wheels have many times less friction than a sled sliding on its bottom', 'Wheeled cars are lighter than sleds', 'The fans blow harder on a car with wheels', 'Wheels add weight, and heavier things always go farther'], answer: 0,
        why: 'A sliding sled’s friction is about ' + P.SLED_FRICTION + ' × its weight. Wheels are about 0.025 (OK) or 0.012 (spinning freely) — more than ten times less. In our model the sled slides about ' + dist1(SLED_RUN.distance) + ', and the 70 g car with OK wheels rolls ' + rollText(RUN.ok) + ', even though it is heavier.' },
      { q: 'You hot-glue the wheels tightly onto the ends of a skewer. How should that skewer be held on the chassis?', options: ['Loose inside a straw glued across the chassis, so the whole axle can turn', 'Hot-glued to the chassis so it can’t move', 'Taped down tight so it can’t turn', 'Pushed through a tight hole so it can’t slip'], answer: 0,
        why: 'If the wheels are glued to the skewer, the skewer has to turn too. A straw bearing lets it spin freely.' }
    ],
    // the model's numbers and the challenge rules, for the node check script (not used by the page)
    _model: { WHEELS: WHEELS, SLED: SLED, BEARING: BEARING, WOBBLY: WOBBLY, RUBBING: RUBBING, axleCrr: axleCrr, coast: coast, pushAt: pushAt, farStart: farStart,
              spot: spot, STOP_X: STOP_X, ZONE_LO: ZONE_LO, HALL_GOAL: HALL_GOAL, GOAL_IS_END: GOAL_IS_END, ONLY_FULL_FIX: ONLY_FULL_FIX, TERRIBLE: TERRIBLE,
              RUN: RUN, END_X: END_X, SPOT_MAX: SPOT_MAX, LONG_HALL: LONG_HALL, checks: checks }
  });
})();
