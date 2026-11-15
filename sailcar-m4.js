// Sail Car Lab — Module 4: Friction (wheels and axles)
// Written for 6th graders: short sentences, forces in paper clips (SailLab.kid.force), distances in feet
// first (SailLab.kid.dist), no formulas. Behind the scenes it is the same two-box-fan model as the hallway:
// rolling friction = crr × weight (SailLab.physics.rollingFriction), last year's sliding sleds
// (SLED_FRICTION), the extra push it takes to START rolling (STICKY), and simulate(). Every number a
// student reads is worked out from the model when the page loads.
(function () {
  'use strict';
  const P = SailLab.physics, kid = SailLab.kid, C = P.DEFAULT_CAR, FT = kid.FT_PER_M;
  // Wheel stickiness (crr). Rubbing / OK / Spin freely mean the SAME numbers in Modules 1, 3 and 4.
  const WHEELS = { smooth: 0.012, ok: C.crr, rub: 0.07 };
  const WHEEL_OPTS = [{ value: 'smooth', label: 'Spin freely' }, { value: 'ok', label: 'OK' }, { value: 'rub', label: 'Rubbing' }];
  const WHEEL_NAME = { smooth: 'wheels that spin freely', ok: 'OK wheels', rub: 'rubbing wheels' };
  // Last year's paper-sail SLED: no wheels, so it SLIDES (stickiness = SLED_FRICTION ≈ 0.3). About 20 g with a
  // 20 cm × 22 cm tent-shaped sail sitting low (its middle 7 cm up) and its weight spread forward, so the strong
  // two-fan push at the start line can't tip it over.
  const SLED = { mass: 0.02, crr: P.SLED_FRICTION, sailArea: 0.044, sailHeight: 0.07, cgToFront: 0.10 };
  // Axle builder (steps 4–5): the same crr numbers the Design Studio uses for these parts
  const BEARING = { straw: 0.012, taped: 0.022, hole: 0.03 }, WOBBLY = 0.012, RUBBING = 0.03;
  const BEARING_NAME = { straw: 'straw bearing', taped: 'taped skewer', hole: 'cardstock hole' };
  const BEARING_OPTS = [{ value: 'straw', label: 'Skewer spins in a straw' }, { value: 'taped', label: 'Skewer taped down' }, { value: 'hole', label: 'Skewer in a cardstock hole' }];
  const FIT_OPTS = [{ value: 'snug', label: 'Snug & centered' }, { value: 'wobbly', label: 'Wobbly' }];
  const GAP_OPTS = [{ value: 'spacer', label: 'Straw spacer (small gap)' }, { value: 'rub', label: 'Rubs the chassis' }];
  function axleCrr(b, fit, gap) { return BEARING[b] + (fit === 'wobbly' ? WOBBLY : 0) + (gap === 'rub' ? RUBBING : 0); }
  // how far a bare chassis coasts after a push of v m/s if only friction slows it: v² ÷ (2 × crr × 9.81)
  function coast(v, crr) { return v * v / (2 * crr * P.G); }
  const PUSH_V = 1;                          // the push test's gentle push: 1 m/s (kid.speed: 'walking speed')
  // the wind's push on the standard car sitting still x metres from the fans (sail + body, as simulate() starts it)
  function pushAt(x) { const w = P.windAt(x); return P.airForce(w, C.sailArea, C.sailCd, 0) + P.airForce(w, C.bodyArea, C.bodyCd, 0); }
  // the farthest spot (metres from the fans) where a 70 g car with this stickiness still STARTS by itself
  function farStart(crr) {
    const need = P.rollingFriction(C.mass, crr) * P.STICKY;
    let lo = 0.3, hi = 200;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (pushAt(m) > need) lo = m; else hi = m; }
    return lo;
  }
  function ftToM(f) { return f / FT; }
  function clips(n) { return n + (n === 1 ? ' paper clip' : ' paper clips'); }

  // ── the hallway: its size lives ONLY in SailLab.physics.HALL (sailcar-core.js); nothing below hard-codes it ──
  const HALL = P.HALL;
  const HALL_TXT = kid.dist(HALL.length);                                 // "70 ft (21 m)"
  const LONG_HALL = 1000;                    // "a longer hall": room for any car to coast to a stop
  // one run in the real hallway; a car that reaches the end is run again in a longer hall to say how far it WOULD go
  function roll(car) {
    const r = P.simulate(car);
    r.end = r.reason === 'reached the end of the hall';
    r.longer = r.end ? P.simulate(car, { hallLength: LONG_HALL }).distance : r.distance;
    return r;
  }
  function rollText(r) { return r.end ? 'reached the end of the ' + HALL_TXT + ' hall' : 'rolled ' + kid.dist(r.distance); }

  // ── numbers worked out from the model (so every sentence below stays true) ──
  const WEIGHT = C.mass * P.G;                                          // the starting car weighs 70 paper clips
  const FR = P.rollingFriction(C.mass, C.crr);                          // the starting car: 70 g, OK wheels
  const ST = FR * P.STICKY;                                             // …and the push it needs to START rolling
  const FAR_FT = 50, FAR_PUSH = pushAt(ftToM(FAR_FT));                  // step 1: the wind's push 50 ft from the fans
  const START_RUN = P.simulate({});
  const STOP_X = START_RUN.opts.startX + START_RUN.distance;            // where it stops, rolling in from the start line (m from the fans)
  const END_X = START_RUN.opts.startX + HALL.length;                    // the end of the hallway, in metres from the fans
  const SLED_RUN = P.simulate(SLED);
  const SLED_FR = P.rollingFriction(SLED.mass, SLED.crr);
  const RUN = { smooth: roll({ crr: WHEELS.smooth }), ok: roll({ crr: WHEELS.ok }), rub: roll({ crr: WHEELS.rub }) };
  const TERRIBLE = axleCrr('hole', 'wobbly', 'rub'), TERRIBLE_D = P.simulate({ crr: TERRIBLE }).distance;
  // Step 5's goal: all the way to the END of the hallway — only axles with all three fixes get there. (If the hall is
  // ever made longer than even that car can roll, the goal becomes the whole metres that car can still reach.)
  const BEST_AXLE = roll({ crr: axleCrr('straw', 'snug', 'spacer') });
  const HALL_GOAL = Math.min(HALL.length, Math.floor(BEST_AXLE.longer));
  const GOAL_IS_END = HALL_GOAL >= HALL.length;
  const VEER = P.simulate({ veerDeg: 1.5 });
  // Step 3's slider: feet from the fans, 1 ft to 65 ft (inside the hallway)
  const SPOT_MAX_FT = Math.min(65, Math.floor(END_X * FT));
  // Step 4's push test goal: the bare chassis coasts at least 6 ft (as the student sees it: kid.ft rounds)
  const PUSH_GOAL_FT = 6;
  // the start test (step 6): the farthest whole foot where the car still starts; "anywhere" past the end of the hall
  function startsUpTo(crr) {
    const f = farStart(crr);
    return f >= END_X ? 'starts anywhere in our ' + kid.ft(HALL.length) + ' ft hall' : 'starts up to about ' + Math.floor(f * FT) + ' ft away';
  }

  // ── the challenge rules: the steps call these before api.done(), and the node check script tests them ──
  // where the starting car is set down (x m from the fans): 'start' it starts by itself; 'keep' it can't start, but the
  // same car rolling in from the start line goes right past; 'crawl' a still car gets a hair more push than friction,
  // but the rolling car has already stopped; 'weak' too weak even to keep a car rolling
  function spot(x) {
    const p = pushAt(x);
    if (p > ST) return 'start';
    if (x < STOP_X) return 'keep';
    return p > FR ? 'crawl' : 'weak';
  }
  const checks = {
    lighter: function (grams, crr) { return grams >= 100 && P.rollingFriction(grams / 1000, crr) < FR; },
    race: function (sledDist, carDist) { return carDist >= 2 * sledDist; },
    spot: function (x) { return spot(x) === 'keep'; },
    pushTest: function (crr) { return kid.ft(coast(PUSH_V, crr)) >= PUSH_GOAL_FT; },
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
  // the "keep" zone on the step-3 slider (whole feet from the fans), for the message when it's found
  const ZONE = [];
  for (let f = 1; f <= SPOT_MAX_FT; f++) if (spot(ftToM(f)) === 'keep') ZONE.push(f);

  // ── PREDICT FIRST #1 (step 2): the sled against the car, with the wheels picked ──
  const RACE_PREDICT = {
    question: 'How far will the car go, compared with the sled?',
    choices: [{ value: 'sled', label: 'Less far than the sled' },
              { value: 'bit', label: 'Farther, but not twice as far' },
              { value: 'far', label: 'At least twice as far' }]
  };
  function raceOutcome(sledD, carD) { return carD < sledD ? 'sled' : checks.race(sledD, carD) ? 'far' : 'bit'; }
  // "about 3 times as far" in words (ratio = car ÷ sled)
  function timesAsFar(ratio) {
    return ratio < 1 ? 'less far than' : ratio < 1.3 ? 'a little farther than' : ratio < 2 ? 'farther than, but not twice as far as'
         : ratio < 2.5 ? 'more than twice as far as' : 'about ' + Math.round(ratio) + ' times as far as';
  }
  function raceJudge(rs, rc, kind, v) {
    const got = raceOutcome(rs.distance, rc.distance), end = rc.reason === 'reached the end of the hall';
    const text = 'The sled slid ' + kid.dist(rs.distance) + '. The car ' + (end ? 'reached the end of the ' + HALL_TXT + ' hall.' : 'rolled ' + kid.dist(rc.distance) + '.');
    const why = got === 'far'
      ? 'Rolling has much less friction than sliding. So the fading wind kept the car going much longer.' + (end ? ' It was still rolling at the end!' : '')
      : got === 'bit'
      ? 'With ' + WHEEL_NAME[kind] + ', the car’s friction is ' + kid.force(rc.friction) + '. That is almost as much as the sled’s ' + kid.force(rs.friction) + '. So the car only won by a little.'
      : 'This car had more friction than the sled, so the sled went farther.';
    return { text: text, right: got === v, why: why };
  }

  // ── PREDICT FIRST #2 (step 5): which ONE fix helps the terrible axles the most? ──
  const TERRIBLE_SET = { b: 'hole', fit: 'wobbly', gap: 'rub' };
  const FIX_PREDICT = {
    question: 'Which ONE fix do you think will help the most?',
    choices: [{ value: 'straw', label: 'A straw bearing' },
              { value: 'snug', label: 'Snug, centered wheels' },
              { value: 'spacer', label: 'Spacers, so nothing rubs' }]
  };
  const FIX_NAME = { straw: 'a straw bearing', snug: 'snug wheels', spacer: 'spacers' };
  const FIX_SET = { straw: { b: 'straw', fit: 'wobbly', gap: 'rub' }, snug: { b: 'hole', fit: 'snug', gap: 'rub' }, spacer: { b: 'hole', fit: 'wobbly', gap: 'spacer' } };
  const FIX_D = {};                                  // each fix ON ITS OWN, from the terrible car
  Object.keys(FIX_SET).forEach(function (k) { const s = FIX_SET[k]; FIX_D[k] = P.simulate({ crr: axleCrr(s.b, s.fit, s.gap) }).distance; });
  const FIX_ORDER = Object.keys(FIX_D).sort(function (a, b) { return FIX_D[b] - FIX_D[a]; });
  const BEST_FIX = FIX_ORDER[0];
  // which of the three single fixes a setting is (null: no fix, a taped skewer, or two or more changes)
  function fixesOf(set) { return (set.b !== TERRIBLE_SET.b ? 1 : 0) + (set.fit !== TERRIBLE_SET.fit ? 1 : 0) + (set.gap !== TERRIBLE_SET.gap ? 1 : 0); }
  function singleFix(set) {
    if (fixesOf(set) !== 1) return null;
    return set.b === 'straw' ? 'straw' : set.fit === 'snug' ? 'snug' : set.gap === 'spacer' ? 'spacer' : null;
  }
  // the answer after a run. tried = the single fixes tested so far ({ key: distance }); it is filled in here.
  function fixJudge(r, set, tried, v) {
    const n = fixesOf(set), one = singleFix(set), end = r.reason === 'reached the end of the hall';
    if (one) tried[one] = r.distance;
    const how = end ? 'reached the end of the hall!' : 'rolled ' + kid.dist(r.distance) + '.';
    const text = n === 0 ? 'No fixes yet: the car ' + how
               : one ? 'With only ' + FIX_NAME[one] + ', the car ' + how
               : n === 1 ? 'With only a taped skewer, the car ' + how
               : n === 3 && set.b === 'straw' ? 'With all three fixes, the car ' + how
               : 'With ' + n + ' changes, the car ' + how;
    const left = FIX_ORDER.filter(function (k) { return tried[k] == null; });
    if (left.length) {
      return { text: text, right: null,
        why: 'To check your guess, test each fix on its own. Start from the terrible car and change only ONE thing. Still to test: ' +
             left.map(function (k) { return FIX_NAME[k]; }).join(', ') + '.' };
    }
    return { text: text, right: v === BEST_FIX,
      why: 'On their own: ' + FIX_ORDER.map(function (k) { return FIX_NAME[k] + ' ' + kid.ft(tried[k]) + ' ft'; }).join(', ') + '. ' +
           (BEST_FIX === 'spacer' ? 'A wheel rubbing the chassis made the most friction.' : 'That fix took away the most friction.') };
  }

  // ── drawings: drawn at their real on-screen width (260–560 px) and shown 1 : 1, so a 13 px label is 13 px
  //    on a phone too. Pictures that have to shrink are scaled; their labels are not. ──
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
    return api.svg('text', { x: x, y: y, 'text-anchor': o.anchor || 'start', fill: color || '#c8b8ea', 'font-size': o.size || 15,
                             'font-weight': o.light ? 400 : 700, class: o.plain ? null : 'sl-lbl' }, s, str);
  }
  function rect(api, s, x, y, w, hh, fill, extra) { return api.svg('rect', Object.assign({ x: x, y: y, width: w, height: hh, fill: fill }, extra || {}), s); }
  function line(api, s, x1, y1, x2, y2, color, extra) { return api.svg('line', Object.assign({ x1: x1, y1: y1, x2: x2, y2: y2, stroke: color, 'stroke-width': 1.5 }, extra || {}), s); }
  // a bar that stops at the edge of its chart, with a note inside when the real value is bigger
  function bar(api, s, x, y, val, max, px, fill, hh) {
    hh = hh || 20;
    rect(api, s, x, y, Math.max(2, Math.min(val, max) / max * px), hh, fill, { rx: 3 });
    if (val > max) label(api, s, x + px - 6, y + hh - 5, 'off the chart →', '#120826', { anchor: 'end', size: 13, plain: true });
  }
  // the box fans, with a 13 px label (or none)
  function fans(api, s, x, floorY, size, withLabel) {
    const g = api.draw.fan(s, x, floorY, size), t = g.querySelector('text');
    if (t && withLabel) { t.setAttribute('font-size', 13); t.setAttribute('font-weight', 700); t.setAttribute('y', floorY + 17); }
    else if (t) t.remove();
  }
  // wind streaks: shorter and fainter where the wind is weaker. toPx(metres from the fans) → px
  function streaks(api, s, toPx, from, to, stepM, floorY, heights) {
    for (let m = from; m < to; m += stepM) {
      const ww = P.windAt(m);
      heights.forEach(function (y, i) {
        line(api, s, toPx(m) + i * 8, floorY - y, toPx(m) + i * 8 + ww * 7, floorY - y, '#7ad7ff',
          { opacity: Math.min(0.6, ww / P.FAN.v0 * 0.7).toFixed(2), 'stroke-linecap': 'round' });
      });
    }
  }
  // foot marks along a floor: a label every 10 ft (or 20 ft when 10 ft is too narrow); skips a label too close to `endPx`
  function footMarks(api, s, toPx, maxFt, floorY, endPx) {
    const step = (toPx(ftToM(10)) - toPx(0)) >= 44 ? 10 : 20;
    for (let f = 0; f <= maxFt + 0.01; f += step) {
      const x = toPx(ftToM(f));
      line(api, s, x, floorY, x, floorY + 7, '#6a5a8a');
      if (endPx == null || Math.abs(endPx - x) >= 42) label(api, s, x, floorY + 22, f ? f + ' ft' : '0', '#9080b0', { anchor: 'middle', size: 13, light: true });
    }
  }
  // write a readout from plain strings and ['bold'] pieces — never innerHTML
  function say(api, box, parts) {
    box.textContent = '';
    parts.forEach(function (p) { box.appendChild(typeof p === 'string' ? document.createTextNode(p) : api.h('strong', { text: p[0] })); });
  }
  // a "Word to know" box at the very top of the step (above the step's html)
  function wordFirst(api, el, term, meaningHtml) {
    const box = api.ui.word(el, term, meaningHtml);
    el.insertBefore(box, el.firstChild);
    return box;
  }
  // "less than" / "more than", with "just barely" when the two rounded numbers would look the same
  function compare(a, b) {
    const same = kid.clips(a) === kid.clips(b);
    return a < b ? (same ? 'just barely less than' : 'less than') : (same ? 'just barely more than' : 'more than');
  }

  const TESTS_HTML =
    '<p><strong>Test your friction.</strong></p>' +
    '<ol><li><strong>Flick test:</strong> hold the car up and flick each wheel. It should spin for <strong>3 seconds or more</strong>. If it stops fast, find what rubs and fix it.</li>' +
    '<li><strong>Push test (no sail yet):</strong> lean a binder on a book to make a ramp. Let the chassis roll down from the same mark each time. ' +
    'Measure how far it coasts. Fix one thing, then test again. Farther means less friction.</li>' +
    '<li><strong>Start test:</strong> put the sail on. Set the car down 5 ft in front of the fans. Move it 5 ft farther away each time. ' +
    'Find the farthest spot where it still starts by itself. Less friction means it can start farther away. ' +
    '(In our model, the car with OK wheels ' + startsUpTo(WHEELS.ok) + '. With wheels that spin freely, it ' + startsUpTo(WHEELS.smooth) + '.)</li></ol>';

  SailLab.register({
    id: 'friction',
    num: 4,
    title: 'Friction',
    icon: '🛞',
    blurb: 'Why wheels beat last year’s sleds, and how to build axles that spin and spin.',
    minutes: 20,
    steps: [
      {
        title: 'Friction holds your car back',
        html:
          '<p>Flick a wheel on a toy car. It spins, slows down and stops. Friction slows it. ' +
          'On a sail car, most friction comes from the <strong>axles</strong>. Those are the sticks the wheels turn on.</p>' +
          '<p>Two things change how much friction a car has:</p>' +
          '<ul><li><strong>Weight.</strong> A heavier car presses down harder. Twice as heavy means about twice the friction.</li>' +
          '<li><strong>The wheels.</strong> Wheels that spin freely have about half the friction of OK wheels. Rubbing wheels have about 3 times as much.</li></ul>' +
          '<p>The starting car weighs ' + kid.force(WEIGHT) + '. Its friction is only ' + kid.force(FR) + '. That is tiny! ' +
          'But far down the hall, the wind is weak too. ' + FAR_FT + ' ft from the fans, it pushes with only ' + kid.force(FAR_PUSH) + '.</p>',
        challenge: 'Build a car that weighs at least 100 g. It must have less friction than the starting car (70 g, OK wheels).',
        render: function (el, api) {
          wordFirst(api, el, 'friction', 'a force that rubs against motion and slows things down.');
          const s = api.svg('svg', { role: 'img', 'aria-label': 'A sail car with its weight pressing down and friction holding it back, and bars comparing its friction with the starting car' }, el);
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const mass = api.ui.slider(row, { label: 'Car mass', min: 40, max: 200, step: 10, value: 70, format: function (v) { return v + ' g'; }, onInput: draw });
          const wh = api.ui.choice(row, { label: 'Wheels', value: 'ok', options: WHEEL_OPTS, onChange: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const MAXC = 8;                            // the bars show 0 to 8 paper clips
          function draw() {
            const g = mass.get(), m = g / 1000, kind = wh.get(), crr = WHEELS[kind], wt = m * P.G, fr = P.rollingFriction(m, crr);
            const W = boardWidth(el), FL = 150, H = 292;
            startBoard(api, s, W, H);
            // the car: weight presses down, friction holds it back at the wheels
            const sc = W < 440 ? 2.6 : 3.2, len = 34 * sc, carX = Math.round(W * 0.36), deckY = FL - 7 * sc;
            line(api, s, 12, FL, W - 12, FL, '#4a3a6a', { 'stroke-width': 3 });
            api.draw.car(s, carX, FL, { scale: sc, length: 34 });
            const ax = carX + len * 0.8, wl = 20 + kid.clips(wt) * 0.45;
            api.draw.arrow(s, ax, deckY - wl, ax, deckY - 2, '#7ad7ff', '', { width: 5 });
            label(api, s, ax + 10, deckY - wl / 2 - 4, 'weight', '#7ad7ff');
            label(api, s, ax + 10, deckY - wl / 2 + 14, kid.forceShort(wt), '#7ad7ff');
            const fl = Math.min(carX - 16, kid.clips(fr) * 12);
            if (fl >= 3) api.draw.arrow(s, carX + 6, FL + 12, carX + 6 - fl, FL + 12, '#ffa040', '', { width: 4, head: 5 });
            label(api, s, carX + 14, FL + 18, 'friction', '#ffa040');
            label(api, s, W - 14, FL + 18, 'rolling →', '#9080b0', { anchor: 'end', size: 13, light: true });
            // bars: your car's friction against the starting car's
            const BX = 16, BW = W - 32, frX = BX + FR / (MAXC * kid.CLIP_N) * BW;
            label(api, s, BX, FL + 52, 'Your car’s friction: ' + kid.forceShort(fr), '#ffa040');
            bar(api, s, BX, FL + 60, kid.clips(fr), MAXC, BW, '#ffa040');
            label(api, s, BX, FL + 106, 'Starting car’s friction: ' + kid.forceShort(FR), '#c8b8ea');
            bar(api, s, BX, FL + 114, kid.clips(FR), MAXC, BW, '#9080b0');
            line(api, s, frX, FL + 56, frX, FL + 84, '#f0e6ff', { 'stroke-dasharray': '4,3' });   // the starting car's friction, marked on your bar
            // the readout, in words
            const ratio = fr / FR, same = kid.clips(fr) === kid.clips(FR);
            const cmp = Math.abs(fr - FR) < 1e-12 ? 'That is the same as the starting car.'
                      : same ? 'That is ' + compare(fr, FR) + ' the starting car.'
                      : fr < FR ? 'That is less than the starting car (' + kid.force(FR) + ').'
                      : ratio < 1.75 ? 'That is more than the starting car (' + kid.force(FR) + ').'
                      : 'That is about ' + Math.round(ratio) + ' times the starting car’s friction.';
            const parts = ['⚖️ Your car weighs ', [kid.force(wt)], ' (' + g + ' g). With ' + WHEEL_NAME[kind] + ', its friction is ', [kid.force(fr)], '. ' + cmp];
            if (g >= 100 && fr >= FR) parts.push(' A heavier car has more friction. Can you make up for it with the wheels?');
            say(api, out, parts);
            if (checks.lighter(g, crr)) api.done('Your heavier car has less friction! Wheels that spin freely have about half the friction of OK wheels. Weight matters, but the wheels are the part you can fix.');
          }
          draw();
          keepFitted(api, el, draw);
        }
      },
      {
        title: 'Sleds slide, wheels roll',
        html:
          '<p>Last year’s classes built paper-sail <strong>sleds</strong> with no wheels. In front of the same two box fans, most slid about <strong>' + kid.dist(ftToM(25)) + '</strong>. ' +
          'The best went about <strong>' + kid.dist(ftToM(30)) + '</strong>.</p>' +
          '<p>A sled <strong>slides</strong>. Its whole bottom scrapes along the floor. Wheels <strong>roll</strong> instead. ' +
          'With the same weight, a sled has over 10 times the friction of OK wheels.</p>' +
          '<p>Race our model sled against the 70 g lab car. The sled weighs only 20 g. Its low, tent-shaped sail keeps it from tipping over.</p>',
        challenge: 'Pick wheels so the car rolls at least twice as far as the sled.',
        render: function (el, api) {
          const s = api.svg('svg', { role: 'img', 'aria-label': 'Two lanes of the ' + HALL_TXT + ' hallway in front of the same two fans: last year’s sled and this year’s wheeled car race' }, el);
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const wh = api.ui.choice(row, { label: 'The car’s wheels', value: 'rub', options: WHEEL_OPTS.slice().reverse(), onChange: changed });
          const guess = api.ui.predict(el, { question: RACE_PREDICT.question, choices: RACE_PREDICT.choices });
          const go = api.h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: '▶ Race!' });
          const again = api.h('button', { type: 'button', class: 'sl-btn', text: '↺ Reset' });
          el.appendChild(api.h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 8px' }, [go, again]));
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          let raf = null, idle = true, shown = { ds: null, dc: null, sDone: false, cDone: false };
          // a guess is about ONE set of wheels: new wheels need a new guess
          let picked = 'rub';
          function changed() { if (wh.get() !== picked) { picked = wh.get(); guess.reset(); } reset(); }
          function updateGo() {
            const need = guess.get() == null;
            go.disabled = !!raf || need;
            go.title = need ? 'Make a prediction first ↑' : '';
          }
          guess.onChange(function () { updateGo(); if (idle) intro(); });
          function stop() { if (raf) cancelAnimationFrame(raf); raf = null; updateGo(); }
          api.onLeave(stop);
          function sled(x, fy) {
            rect(api, s, x, fy - 5, 42, 5, '#e8dcc0', { stroke: '#a07830', 'stroke-width': 0.8 });                // cardstock base
            api.svg('polygon', { points: [x + 3, fy - 5, x + 21, fy - 36, x + 39, fy - 5].join(','), fill: '#f0e6ff', stroke: '#9080b0', 'stroke-width': 1, opacity: 0.92 }, s);   // tent sail
          }
          // two lanes, the whole hallway: the start line at X0, the end wall at XE. The sled and the car are drawn with
          // their FRONT at the distance they have gone, so a car that reaches the end touches the wall.
          function scene() {
            const W = boardWidth(el), H = 296, LS = 128, LC = 250, X0 = 82, XE = W - 16, SC = HALL.length;
            function hx(m) { return X0 + m / SC * (XE - X0); }
            startBoard(api, s, W, H);
            // last year's sleds: most about 25 ft, the best about 30 ft
            const b1 = hx(ftToM(25)), b2 = hx(ftToM(30));
            rect(api, s, b1, LS - 58, b2 - b1, 58, '#f0c040', { opacity: 0.28 });
            [b1, b2].forEach(function (x) { line(api, s, x, LS - 58, x, LS, '#f0c040'); });
            label(api, s, Math.max(110, (b1 + b2) / 2), LS - 64, 'last year: 25–30 ft', '#f0c040', { anchor: 'middle', size: 13 });
            [LS, LC].forEach(function (fy, lane) {
              line(api, s, 10, fy, XE, fy, '#4a3a6a', { 'stroke-width': 3 });
              fans(api, s, 14, fy, 56, lane === 1);
              streaks(api, s, function (m) { return hx(m - 0.3); }, 0.8, SC, 1.5, fy, [36, 52]);
              rect(api, s, XE, fy - 54, 6, 60, '#6a5a8a', { rx: 2 });                  // the wall at the end of the hallway
            });
            footMarks(api, s, function (m) { return hx(m); }, HALL.length * FT - 1, LC, XE);
            label(api, s, XE + 3, LC + 22, kid.ft(HALL.length) + ' ft', '#9080b0', { anchor: 'end', size: 13, light: true });
            // the lane titles, with each one's friction, and how far it has gone
            [['Last year’s SLED (20 g)', SLED_FR, shown.ds, shown.sDone, 22], ['This year’s CAR (70 g)', P.rollingFriction(C.mass, WHEELS[wh.get()]), shown.dc, shown.cDone, 154]].forEach(function (r) {
              label(api, s, 14, r[4], r[0], '#f0e6ff');
              label(api, s, 14, r[4] + 20, 'friction: ' + kid.forceShort(r[1]), '#ffa040', { size: 14, light: true });
              if (r[2] != null) label(api, s, W - 14, r[4] + 20, r[3] ? kid.dist(r[2]) : kid.ft(r[2]) + ' ft', r[3] ? '#f0c040' : '#c8b8ea', { anchor: 'end' });
            });
            [[shown.ds, shown.sDone, LS], [shown.dc, shown.cDone, LC]].forEach(function (r) {
              if (r[1]) line(api, s, hx(r[0]), r[2] - 60, hx(r[0]), r[2], '#f0c040', { 'stroke-dasharray': '4,4' });
            });
            sled(hx(shown.ds || 0) - 42, LS);
            api.draw.car(s, hx(shown.dc || 0) - 44, LC, { scale: 1.7, length: 26 });
          }
          function intro() {
            const kind = wh.get();
            say(api, out, ['🛷 The sled’s friction: ', [kid.force(SLED_FR)], '. 🚗 The car’s friction with ' + WHEEL_NAME[kind] + ': ', [kid.force(P.rollingFriction(C.mass, WHEELS[kind]))],
              '. The sled is much lighter, but sliding makes lots of friction! ' + (guess.get() == null ? 'Make a prediction first ↑' : 'Press ▶ Race!')]);
          }
          function reset() {
            stop();
            idle = true;
            shown = { ds: null, dc: null, sDone: false, cDone: false };
            guess.clear();
            scene();
            intro();
          }
          function race() {
            if (guess.get() == null) { updateGo(); return; }        // commit to a guess first
            stop();
            guess.clear();
            idle = false;
            const kind = wh.get(), rs = P.simulate(SLED), rc = P.simulate({ crr: WHEELS[kind] });
            const end = Math.max(rs.time, rc.time), speed = Math.max(2, end / 8), t0 = performance.now();
            let is = 0, ic = 0;
            function frame(now) {
              if (!s.isConnected) { raf = null; return; }           // the step was closed mid-race
              const t = (now - t0) / 1000 * speed;
              while (is < rs.trace.length - 1 && rs.trace[is + 1].t <= t) is++;
              while (ic < rc.trace.length - 1 && rc.trace[ic + 1].t <= t) ic++;
              const sDone = t >= rs.time, cDone = t >= rc.time;
              shown = { ds: sDone ? rs.distance : rs.trace[is].x, dc: cDone ? rc.distance : rc.trace[ic].x, sDone: sDone, cDone: cDone };
              scene();
              if (!(sDone && cDone)) {
                say(api, out, ['⏱ ' + Math.max(1, Math.round(Math.min(t, end))) + ' seconds · 🛷 sled ' + kid.ft(shown.ds) + ' ft · 🚗 car ' + kid.ft(shown.dc) + ' ft']);
                raf = requestAnimationFrame(frame);
                return;
              }
              raf = null; updateGo();
              const ratio = rc.distance / rs.distance, win = checks.race(rs.distance, rc.distance), atEnd = rc.reason === 'reached the end of the hall';
              const words = timesAsFar(ratio);
              say(api, out, ['🛷 Sled: ', [kid.dist(rs.distance)], '. 🚗 Car with ' + WHEEL_NAME[kind] + ': ', [atEnd ? 'the end of the hall, ' + kid.dist(rc.distance) : kid.dist(rc.distance)], '. ',
                'The car went ' + words + ' the sled.' + (atEnd ? ' It was still rolling at the end!' : win ? ' Rolling beats sliding!' : ' Try better wheels!')]);
              const j = raceJudge(rs, rc, kind, guess.get());
              guess.reveal(j.text, j.right, j.why);
              if (win) api.done('With ' + WHEEL_NAME[kind] + ', the car went ' + words + ' the sled. Same fans, same hallway. Rolling beats sliding!');
            }
            raf = requestAnimationFrame(frame);
            updateGo();
          }
          go.addEventListener('click', race);
          again.addEventListener('click', reset);
          reset();
          keepFitted(api, el, scene);
        }
      },
      {
        title: 'Starting is harder than rolling',
        html:
          '<p>Push a heavy box across the floor. Getting it to start takes a big shove. Once it slides, it is easier to keep it going.</p>' +
          '<p>Wheels work the same way. Parts that sit still grip each other a little more. ' +
          'So it takes more push to <strong>start</strong> rolling than to <strong>keep</strong> rolling.</p>' +
          '<p>The starting car has ' + kid.force(FR) + ' of friction. To keep rolling, the wind must push harder than that. ' +
          'To start from still, it must push harder than ' + kid.force(ST) + '. Set the car down at different spots and compare.</p>',
        challenge: 'Find a spot where a still car can’t start. But the same car, rolling in from the start line, rolls right past.',
        render: function (el, api) {
          const s = api.svg('svg', { role: 'img', 'aria-label': 'A hallway with the fans and your car, and a bar comparing the wind’s push with the push needed to keep rolling and to start' }, el);
          const d = api.ui.slider(el, { label: 'Where you set the car down (from the fans):', min: 1, max: SPOT_MAX_FT, step: 1, value: 5,
            format: function (v) { return kid.dist(ftToM(v)); }, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const MAXP = 4;                                                  // the push bar: 0 to 4 paper clips
          function draw() {
            const f = d.get(), x = ftToM(f), p = pushAt(x), where = spot(x);
            const W = boardWidth(el), H = 300, FL = 112, X0 = 60, small = W < 360 ? 13 : 14;
            function px(ft) { return X0 + ft / SPOT_MAX_FT * (W - 20 - X0); }
            startBoard(api, s, W, H);
            // the hallway: fans, foot marks, fading wind, where the rolling car stops, the car
            line(api, s, 10, FL, W - 10, FL, '#4a3a6a', { 'stroke-width': 3 });
            fans(api, s, 16, FL, 64, true);
            footMarks(api, s, function (m) { return px(m * FT); }, SPOT_MAX_FT, FL, null);
            streaks(api, s, function (m) { return px(m * FT); }, 0.3, ftToM(SPOT_MAX_FT), 1.2, FL, [56, 78]);
            const sx = px(STOP_X * FT);
            line(api, s, sx, 34, sx, FL, '#f0c040', { 'stroke-width': 2, 'stroke-dasharray': '5,4' });
            label(api, s, sx - 4, 26, 'a rolling car stops here', '#f0c040', { anchor: 'end', size: 13, light: true });
            api.draw.car(s, px(f) - 6, FL, { scale: 1.5, length: 26 });
            // the push here, against two lines: keep rolling (friction) and start (a bit more)
            const BX = 16, BW = W - 32;
            label(api, s, BX, 150, 'Wind’s push here: ' + kid.forceShort(p), '#40e080');
            bar(api, s, BX, 160, kid.clips(p), MAXP, BW, '#40e080', 22);
            [[FR, '#ffa040'], [ST, '#f0c040']].forEach(function (b) {
              const lx = BX + kid.clips(b[0]) / MAXP * BW;
              line(api, s, lx, 154, lx, 190, b[1], { 'stroke-width': 3 });
            });
            label(api, s, BX, 214, (p > FR ? '✔' : '✘') + ' Keep rolling (over ' + kid.forceShort(FR) + ')', '#ffa040', { size: small });
            label(api, s, BX, 238, (p > ST ? '✔' : '✘') + ' Start (over ' + kid.forceShort(ST) + ')', '#f0c040', { size: small });
            const verdict = { start: ['It starts by itself here!', ''], keep: ['A still car won’t start here…', '…but a rolling car keeps going!'],
                              crawl: ['A still car won’t start here.', 'A rolling car stops before here.'], weak: ['Too weak to keep a car rolling.', ''] }[where];
            const vc = { start: '#40e080', keep: '#f0c040', crawl: '#ff8060', weak: '#ff8060' }[where];
            label(api, s, BX, 268, verdict[0], vc, { size: small });
            if (verdict[1]) label(api, s, BX, 288, verdict[1], vc, { size: small });
            // the readout: the push in paper clips, compared in words
            const here = '📍 ' + kid.dist(x) + ' from the fans, the wind pushes with ' + kid.force(p) + '. ';
            const stopTxt = kid.dist(STOP_X);
            const txt = {
              start: here + 'That is ' + compare(p, ST) + ' the ' + kid.forceShort(ST) + ' it takes to start. The car starts rolling by itself.',
              keep: here + 'That is ' + compare(p, ST) + ' the ' + kid.forceShort(ST) + ' it takes to START. So a still car never moves. ' +
                    'But a rolling car only needs more than ' + kid.forceShort(FR) + '. The car from the start line rolls right past. It stops at ' + stopTxt + '.',
              crawl: here + 'That is ' + compare(p, FR) + ' friction, but ' + compare(p, ST) + ' the starting push. ' +
                     'The car from the start line moves with the wind. So it feels a little less push. It slowed to a creep and stopped at ' + stopTxt + '. ' +
                     'A creeping car needs the starting push again.',
              weak: here + 'That is ' + compare(p, FR) + ' friction (' + kid.forceShort(FR) + '). It can’t even keep a car rolling.'
            }[where];
            say(api, out, [txt]);
            if (checks.spot(x)) api.done('From ' + ZONE[0] + ' ft to ' + ZONE[ZONE.length - 1] + ' ft from the fans, a still car never starts. But a rolling car keeps going. Starting takes more push than rolling!');
          }
          draw();
          keepFitted(api, el, draw);
        }
      },
      {
        title: 'Build a better axle',
        html:
          '<p>Almost all of a sail car’s friction is at the axles. Three things matter:</p>' +
          '<ul><li><strong>The bearing.</strong> A skewer spinning in a straw turns easily. A skewer in a tight hole scrapes as it turns.</li>' +
          '<li><strong>Wheel fit.</strong> A wheel that is off-center, or has a blob of glue, wobbles. It bumps and scrubs as it rolls.</li>' +
          '<li><strong>The gap.</strong> A wheel rubbing the chassis is like dragging your foot. A short piece of straw on the axle keeps a gap. It is called a <strong>spacer</strong>.</li></ul>' +
          '<p>Build an axle below. Then do a <strong>push test</strong> on the bare chassis, with no sail yet. Give it the same gentle push each time, about ' + kid.speed(PUSH_V) + '. ' +
          'Less friction means it coasts farther. A sliding sled would stop in less than 1 ft!</p>',
        challenge: 'Fix the axle. In the push test, the chassis must coast at least ' + kid.dist(ftToM(PUSH_GOAL_FT)) + '.',
        render: function (el, api) {
          wordFirst(api, el, 'bearing', 'the part that holds a turning axle. A straw that a skewer spins in is a good bearing.');
          const s = api.svg('svg', { role: 'img', 'aria-label': 'Front view of an axle with two wheels, the friction from each part, and how far the chassis coasts in a push test' }, el);
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const br = api.ui.choice(row, { label: 'Bearing (what the axle turns in)', value: 'hole', options: BEARING_OPTS, onChange: draw });
          const fit = api.ui.choice(row, { label: 'Wheel fit', value: 'wobbly', options: FIT_OPTS, onChange: draw });
          const gap = api.ui.choice(row, { label: 'Wheel gap', value: 'rub', options: GAP_OPTS, onChange: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const TRACK_FT = 15, MAX_CRR = axleCrr('hole', 'wobbly', 'rub');
          function draw() {
            const b = br.get(), wob = fit.get() === 'wobbly', rub = gap.get() === 'rub', crr = axleCrr(b, fit.get(), gap.get()), dst = coast(PUSH_V, crr);
            const W = boardWidth(el), k = W / 560, TOP = 24;
            // the front view is drawn on a 560-wide plan and scaled to fit; its labels are placed by hand at full size
            function X(v) { return v * k; }
            function Y(v) { return TOP + v * k; }
            const y0 = Y(184) + 20, yT = y0 + 96, floor = yT + 64, H = floor + 32;
            startBoard(api, s, W, H);
            label(api, s, 14, 17, 'Front view of one axle', '#9080b0', { size: 13, light: true });
            const pic = api.svg('g', { transform: 'translate(0,' + TOP + ') scale(' + k + ')' }, s);
            const FL = 176, AY = 124, WR = 52;                                     // floor, axle height, wheel radius (plan units)
            line(api, pic, 20, FL, 540, FL, '#4a3a6a', { 'stroke-width': 3 });
            rect(api, pic, 150, 62, 260, 18, '#d8b070', { rx: 3, stroke: '#a07830' });
            line(api, pic, 56, AY, 504, AY, '#c8a060', { 'stroke-width': 5, 'stroke-linecap': 'round' });
            // the bearing
            if (b === 'straw') {
              rect(api, pic, 150, AY - 14, 260, 28, '#dff3ff', { rx: 14, opacity: 0.55, stroke: '#9fd8ff' });
              [200, 360].forEach(function (gx) { api.svg('ellipse', { cx: gx, cy: 95, rx: 10, ry: 13, fill: '#fff2a0', opacity: 0.85 }, pic); });   // glue dabs
            } else if (b === 'hole') {
              [150, 396].forEach(function (tx) {
                rect(api, pic, tx, 80, 14, 60, '#efe3c8', { stroke: '#a07830' });
                api.svg('circle', { cx: tx + 7, cy: AY, r: 9, fill: 'none', stroke: '#ff5050', 'stroke-width': 2.5 }, pic);
              });
            } else {
              [196, 346].forEach(function (tx) { rect(api, pic, tx, 72, 18, 66, '#b8b8c8', { opacity: 0.85 }); });   // tape bands
            }
            // the wheels (seen edge-on), with spacers or rubbing
            [[rub ? 140 : 110, -1], [rub ? 420 : 450, 1]].forEach(function (wv) {
              const cx = wv[0], side = wv[1], edge = side < 0 ? 150 : 410, kk = -5 * side;
              if (!rub) rect(api, pic, side < 0 ? cx + 13 : 413, AY - 8, 24, 16, '#dff3ff', { rx: 3, opacity: 0.8 });
              if (wob) rect(api, pic, cx - 10, AY - WR, 20, WR * 2, 'none', { rx: 5, stroke: '#ff5050', 'stroke-dasharray': '4,3', transform: 'rotate(' + (-9 * side) + ',' + cx + ',' + AY + ')' });
              const g = api.svg('g', { transform: wob ? 'rotate(' + (9 * side) + ',' + cx + ',' + AY + ')' : null }, pic);
              rect(api, g, cx - 10, AY - WR, 20, WR * 2, '#222', { rx: 5, stroke: '#888', 'stroke-width': 1.5 });
              rect(api, g, cx - 10, AY - 7, 20, 14, '#555');
              if (b === 'taped') api.svg('circle', { cx: cx, cy: AY, r: 10, fill: 'none', stroke: '#ff5050', 'stroke-width': 2.5 }, pic);
              // red scrape marks where the wheel touches the chassis
              if (rub) api.svg('polyline', { points: [edge, 64, edge + kk, 70, edge, 76, edge + kk, 82, edge, 88].join(' '), fill: 'none', stroke: '#ff5050', 'stroke-width': 2.5 }, pic);
            });
            if (!rub) line(api, pic, 118, 58, 134, AY - 10, '#9fd8ff');
            // labels at full size
            label(api, s, X(280), Y(52), 'chassis', '#d8b070', { anchor: 'middle', size: 14 });
            label(api, s, X(112), Y(52), rub ? 'rubs!' : 'spacer', rub ? '#ff5050' : '#9fd8ff', { anchor: 'middle', size: 14 });
            if (wob) label(api, s, Math.min(W - 30, X(474)), Y(52), 'wobbles', '#ff5050', { anchor: 'middle', size: 14 });
            label(api, s, W / 2, y0, { straw: 'Straw bearing: spins freely', taped: 'Taped skewer: wheels rub on it', hole: 'Tight hole: scrapes as it turns' }[b],
              b === 'straw' ? '#40e080' : '#ff8060', { anchor: 'middle', size: 14 });
            // the friction, built from its parts (no numbers: just how big each part is)
            const BX = 16, BW = W - 32;
            label(api, s, BX, y0 + 28, 'Friction from each part:', '#c8b8ea', { size: 14, light: true });
            let fx = BX;
            [[BEARING[b], b === 'straw' ? '#40e080' : '#ffa040'], [wob ? WOBBLY : 0, '#ff7090'], [rub ? RUBBING : 0, '#ff3030']].forEach(function (part) {
              if (!part[0]) return;
              const w = part[0] / MAX_CRR * BW;
              rect(api, s, fx, y0 + 36, Math.max(2, w - 2), 18, part[1], { rx: 3 });
              fx += w;
            });
            let lx = BX;
            [['bearing', b === 'straw' ? '#40e080' : '#ffa040', true], ['wobble', '#ff7090', wob], ['rubbing', '#ff3030', rub]].forEach(function (lg) {
              if (!lg[2]) return;
              rect(api, s, lx, y0 + 63, 11, 11, lg[1], { rx: 2 });
              label(api, s, lx + 15, y0 + 73, lg[0], lg[1], { size: 13, light: true });
              lx += 30 + lg[0].length * 7.2;
            });
            // the push test, in feet
            label(api, s, BX, yT, 'Push test: the bare chassis coasts…', '#c8b8ea', { size: 14, light: true });
            function tx(f) { return 24 + f / TRACK_FT * (W - 48); }
            line(api, s, 16, floor, W - 16, floor, '#4a3a6a', { 'stroke-width': 3 });
            for (let f = 0; f <= TRACK_FT; f += 5) {
              line(api, s, tx(f), floor, tx(f), floor + 6, '#6a5a8a');
              label(api, s, tx(f), floor + 21, f ? f + ' ft' : '0', '#9080b0', { anchor: 'middle', size: 13, light: true });
            }
            line(api, s, tx(PUSH_GOAL_FT), yT + 10, tx(PUSH_GOAL_FT), floor, '#f0c040', { 'stroke-dasharray': '4,4' });
            label(api, s, tx(PUSH_GOAL_FT) + 5, yT + 22, 'goal', '#f0c040', { size: 13 });
            const dFt = Math.min(TRACK_FT, dst * FT), ex = tx(dFt);
            rect(api, s, tx(0), floor - 8, ex - tx(0), 4, '#ffa040', { opacity: 0.5 });
            rect(api, s, ex - 26, floor - 18, 28, 6, '#d8b070', { rx: 1 });
            [ex - 20, ex - 4].forEach(function (cx) { api.svg('circle', { cx: cx, cy: floor - 6, r: 6, fill: '#222', stroke: '#888' }, s); });
            label(api, s, Math.max(30, Math.min(W - 40, ex - 12)), floor - 24, kid.ft(dst) + ' ft', '#f0c040', { anchor: 'middle' });
            const why = { straw: '', taped: ' The wheels’ holes rub on the taped-down skewer.', hole: ' The skewer scrapes in the tight hole.' }[b] +
              (wob ? ' The wobbly wheels bump and scrub.' : '') + (rub ? ' The wheels rub the chassis.' : '');
            say(api, out, ['🛞 Push test: the bare chassis coasts ', [kid.dist(dst)], '.', why || ' Nothing rubs or wobbles. The wheels spin and spin!']);
            if (checks.pushTest(crr)) api.done('Your chassis coasts ' + kid.dist(dst) + ' on the same gentle push. Less friction means it rolls much farther. Next: see what that does in the hallway!');
          }
          draw();
          keepFitted(api, el, draw);
        }
      },
      {
        title: 'Hallway challenge: fix the axles',
        html:
          '<p>Here is the lab car with <strong>terrible axles</strong>. The skewers sit in tight cardstock holes. The wheels wobble and rub the chassis.</p>' +
          '<p>It rolls only about ' + kid.dist(TERRIBLE_D) + '. That is no better than last year’s sleds!</p>' +
          '<p>You can only change the axles. Fix <strong>one thing at a time</strong>, and run the car after each fix. Then you will know which fix helped the most.</p>',
        challenge: GOAL_IS_END ? 'Fix the axles. Make the car roll all the way to the end of the ' + HALL_TXT + ' hallway.'
                               : 'Fix the axles. Make the car roll at least ' + kid.dist(HALL_GOAL) + '.',
        render: function (el, api) {
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          let sim = null;
          // changing an axle stops the run on screen, so an old run can't count for the new axles
          function changed() { if (sim) sim.reset(); info(); }
          const br = api.ui.choice(row, { label: 'Bearing', value: TERRIBLE_SET.b, options: BEARING_OPTS, onChange: changed });
          const fit = api.ui.choice(row, { label: 'Wheel fit', value: TERRIBLE_SET.fit, options: FIT_OPTS, onChange: changed });
          const gap = api.ui.choice(row, { label: 'Wheel gap', value: TERRIBLE_SET.gap, options: GAP_OPTS, onChange: changed });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          function set() { return { b: br.get(), fit: fit.get(), gap: gap.get() }; }
          function crr() { return axleCrr(br.get(), fit.get(), gap.get()); }
          function info() {
            say(api, out, ['🛞 Friction: ', [kid.force(P.rollingFriction(C.mass, crr()))], ' · the wind’s push at the start line: ', [kid.force(pushAt(START_RUN.opts.startX))]]);
          }
          info();
          const tried = {};
          const guess = api.ui.predict(el, { question: FIX_PREDICT.question, choices: FIX_PREDICT.choices,
            judge: function (r, v) {
              const now = set();
              if (Math.abs(r.car.crr - axleCrr(now.b, now.fit, now.gap)) > 1e-9) return null;   // not the axles on screen now
              return fixJudge(r, now, tried, v);
            } });
          const runs = [], log = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite', text: '📋 Your runs will be listed here, newest first.' });
          sim = api.ui.trackSim(el, function () { return { crr: crr() }; }, {
            scaleM: HALL.length,                                             // the whole hallway, start line to end wall
            needPrediction: guess,
            onResult: function (r) {
              if (Math.abs(r.car.crr - crr()) > 1e-9) return;                // not the axles on screen now
              const end = r.reason === 'reached the end of the hall';
              runs.unshift(BEARING_NAME[br.get()] + ' · ' + fit.get() + ' · ' + (gap.get() === 'rub' ? 'rubbing' : 'spacers') + ' → ' + kid.dist(r.distance) + (end ? ' 🏁 the end of the hall!' : ''));
              log.textContent = '';
              log.appendChild(api.h('strong', { text: '📋 Your runs (newest first)' }));
              runs.slice(0, 6).forEach(function (t, i) { log.appendChild(api.h('div', { text: (runs.length - i) + '. ' + t })); });
              if (!checks.hall(r.distance)) return;
              if (end) {
                // it ran out of hallway: how far would it have gone? (the same car in a longer hall)
                const longer = P.simulate(r.car, { hallLength: LONG_HALL }).distance;
                api.done('It made it to the end of the ' + HALL_TXT + ' hall, still rolling! In a longer hall it would roll about ' + kid.dist(longer) + '. ' +
                  'That is about ' + Math.round(longer / TERRIBLE_D) + ' times as far as with the terrible axles. Same sail, same fans: only the friction changed.' + (ONLY_FULL_FIX ? ' It took all three fixes.' : ''));
              } else api.done('It rolled ' + kid.dist(r.distance) + '! Same sail, same fans: only the friction changed.');
            }
          });
          api.onLeave(sim.stop);
          el.appendChild(log);
          api.ui.note(el, 'good', '🏁 <strong>Friction is one of the biggest things</strong> that decides how far a sail car goes. Same sail, same fans, different wheels.' +
            '<ul style="margin:6px 0 0 18px"><li>Wheels that spin freely: the car ' + rollText(RUN.smooth) + '.</li><li>OK wheels: it ' + rollText(RUN.ok) + '.</li>' +
            '<li>Rubbing wheels: it ' + rollText(RUN.rub) + '.</li></ul>');
        }
      },
      {
        title: 'Real build: wheels that spin and spin',
        html:
          '<p><strong>Build your axles like this.</strong></p>' +
          '<ol><li><strong>Straw bearings:</strong> cut two pieces of straw a little wider than your chassis. Hot-glue them across the chassis, one near the front and one near the back.</li>' +
          '<li><strong>Parallel axles:</strong> before the glue cools, measure the gap between the straws at both ends. The same number means they are parallel. ' +
          'Crooked axles make the car curve into the wall. ' +
          (VEER.reason === 'hit the wall' ? 'Our model shows it. An axle turned just 1.5 degrees hits the wall after about ' + kid.dist(VEER.distance) + '.' : '') + '</li>' +
          '<li><strong>Straight skewers:</strong> roll each skewer on the table. If it wobbles, it is bent. Use another one. Snip off the sharp tip.</li>' +
          '<li><strong>Spacers:</strong> slide the skewer through the straw. Add a short piece of straw (about 5 mm) on each end.</li>' +
          '<li><strong>Wheels:</strong> push a wheel onto each end and glue it to the skewer. Then the whole axle turns inside the straw. ' +
          'Leave a tiny gap, about as thick as a coin. Check that each wheel is centered and straight.</li>' +
          '<li><strong>Careful with glue and tape:</strong> use small dabs of hot glue. A drip on a straw end, a spacer or a wheel will lock it. Keep tape away from anything that turns.</li></ol>',
        render: function (el, api) {
          const s = api.svg('svg', { role: 'img', 'aria-label': 'Top view of a chassis with straw bearings, skewer axles, spacers, wheels and small glue dabs, and a ruler check that the axles are parallel' }, el);
          const key = api.h('div', { class: 'sl-note sl-note-tip', html: '<strong>Seen from above:</strong> ① straw bearing · ② spacer (keeps a tiny gap) · ③ wheel · ④ skewer axle · ⑤ small glue dabs.' });
          el.appendChild(key);
          function paint() {
            // left–right positions shrink with the screen; up–down positions stay the same
            const W = boardWidth(el), H = 344, k = W / 560;
            function X(v) { return v * k; }
            startBoard(api, s, W, H);
            label(api, s, W - 10, 172, 'front →', '#9080b0', { anchor: 'end', size: 13, light: true });
            [128, 188].forEach(function (y) { rect(api, s, X(120), y, X(320), 16, '#d8b070', { rx: 8, stroke: '#a07830' }); });   // popsicle-stick rails
            const axles = [X(166), X(394)];
            axles.forEach(function (ax) {
              line(api, s, ax, 56, ax, 276, '#c8a060', { 'stroke-width': 4 });                       // skewer
              rect(api, s, ax - 9, 100, 18, 132, '#dff3ff', { rx: 4, opacity: 0.7, stroke: '#9fd8ff' });  // straw bearing
              [84, 236].forEach(function (y) { rect(api, s, ax - 7, y, 14, 12, '#dff3ff', { rx: 3, opacity: 0.85 }); });   // spacers
              [62, 252].forEach(function (y) { rect(api, s, ax - 21, y, 42, 18, '#222', { rx: 4, stroke: '#888', 'stroke-width': 1.5 }); });   // wheels
              [136, 196].forEach(function (y) { api.svg('circle', { cx: ax, cy: y, r: 5, fill: '#fff2a0' }, s); });   // glue dabs
            });
            // numbered callouts (the key under the picture says what each one is)
            [[1, axles[0] - 26, 166], [2, axles[0] + 30, 98], [3, axles[1] + 36, 71], [4, axles[1] + 16, 44], [5, axles[0] + 26, 166]].forEach(function (c) {
              api.svg('circle', { cx: c[1], cy: c[2], r: 10, fill: '#2a1048', stroke: '#f0c040', 'stroke-width': 1.5 }, s);
              label(api, s, c[1], c[2] + 5, String(c[0]), '#f0c040', { anchor: 'middle', size: 13, plain: true });
            });
            // ruler check: the same distance at both ends = parallel axles
            [[26, 'same distance here…', 18], [314, '…and here = parallel', 336]].forEach(function (r) {
              line(api, s, axles[0], r[0], axles[1], r[0], '#f0c040', { 'stroke-width': 2, 'stroke-dasharray': '6,4' });
              axles.forEach(function (x) { line(api, s, x, r[0] - 6, x, r[0] + 6, '#f0c040', { 'stroke-width': 2 }); });
              label(api, s, (axles[0] + axles[1]) / 2, r[2], r[1], '#f0c040', { anchor: 'middle', size: 13 });
            });
          }
          paint();
          keepFitted(api, el, paint);
          el.appendChild(api.h('div', { html: TESTS_HTML }));
          api.ui.note(el, 'build', '🛠️ <strong>Your materials:</strong> popsicle sticks or cardstock for the chassis. Straws for bearings and spacers. ' +
            'Skewers or thin dowels for axles. Plastic wheels, hot glue and tape. Keep the glue and tape away from anything that turns.');
        }
      }
    ],
    quiz: [
      { q: 'What does friction do to a rolling car?', options: ['It speeds the car up', 'It slows the car down', 'It makes the car lighter', 'It pushes the car forward'], answer: 1,
        why: 'Friction rubs against motion. It works against the car and slows it down.' },
      { q: 'You tape some pennies onto your car to make it heavier. What happens to its friction?', options: ['It gets smaller', 'It stays the same', 'It gets bigger', 'It goes away'], answer: 2,
        why: 'A heavier car presses down harder on its wheels and axles. So it has more friction.' },
      { q: 'Your car keeps curving into the wall. What should you check first?', options: ['That the sail is big enough', 'That the axles are parallel', 'That the car is heavy enough', 'That the fans are on high'], answer: 1,
        why: 'Crooked axles steer the car to one side. Measure the gap between the axles at both ends.' },
      { q: 'Far down the hall, the wind can’t start a still car. But a car rolling in from the start line keeps going past that spot. Why?', options: ['The wind only pushes moving cars', 'A still car has no friction', 'Starting takes more push than rolling', 'Gravity is stronger on a still car'], answer: 2,
        why: 'Parts that sit still grip each other a little more. So it takes more push to start rolling than to keep rolling.' },
      { q: 'Which axle has the LEAST friction?', options: ['A skewer spinning freely in a straw', 'A skewer in a tight cardstock hole', 'Wheels rubbing the side of the chassis', 'Tape wrapped where the wheels turn'], answer: 0,
        why: 'A straw makes a smooth bearing, so the skewer spins easily. Tight holes, rubbing and tape all add friction.' },
      { q: 'You flick a wheel and it stops after half a second. What does that tell you?', options: ['The sail is too small', 'The car is too light', 'Nothing, wheels always stop fast', 'Something is rubbing or too tight'], answer: 3,
        why: 'A good wheel spins for 3 seconds or more. If it stops fast, find what rubs and fix it.' },
      { q: 'What is a spacer for?', options: ['It makes the wheel spin faster', 'It keeps the wheel from rubbing the chassis', 'It adds weight to hold the car down', 'It locks the wheel so it can’t turn'], answer: 1,
        why: 'A spacer keeps a small gap between the wheel and the chassis. Rubbing makes lots of friction.' },
      { q: 'Same car, same fans. You swap rubbing wheels for wheels that spin freely. What happens?', options: ['It rolls about the same', 'It rolls a little less far', 'It won’t move at all', 'It rolls much farther'], answer: 3,
        why: 'In our model, the car with rubbing wheels ' + rollText(RUN.rub) + '. With wheels that spin freely, it ' + rollText(RUN.smooth) + '.' },
      { q: 'Last year’s sleds slid about 25 ft. Why can a car with wheels go much farther?', options: ['Rolling has much less friction than sliding', 'Cars with wheels are always lighter', 'The fans blow harder on cars', 'Heavier things always go farther'], answer: 0,
        why: 'In our model, the 20 g sled has ' + kid.force(SLED_FR) + ' of friction. The 70 g car with OK wheels has only ' + kid.force(FR) + '.' },
      { q: 'You glue the wheels tight onto a skewer. How should the skewer be held on the chassis?', options: ['Glued down so it can’t move', 'Taped down tight', 'Loose inside a straw, so it can turn', 'Pushed through a tight hole'], answer: 2,
        why: 'If the wheels are glued on, the whole skewer must turn. A straw lets it spin freely.' }
    ],
    // the model's numbers and the challenge rules, for the node check script (not used by the page)
    _model: { WHEELS: WHEELS, SLED: SLED, BEARING: BEARING, WOBBLY: WOBBLY, RUBBING: RUBBING, axleCrr: axleCrr, coast: coast, PUSH_V: PUSH_V, PUSH_GOAL_FT: PUSH_GOAL_FT,
              pushAt: pushAt, farStart: farStart, startsUpTo: startsUpTo, spot: spot, STOP_X: STOP_X, ZONE: ZONE, SPOT_MAX_FT: SPOT_MAX_FT, FAR_FT: FAR_FT,
              HALL_GOAL: HALL_GOAL, GOAL_IS_END: GOAL_IS_END, ONLY_FULL_FIX: ONLY_FULL_FIX, TERRIBLE: TERRIBLE, TERRIBLE_D: TERRIBLE_D, TERRIBLE_SET: TERRIBLE_SET,
              RUN: RUN, END_X: END_X, LONG_HALL: LONG_HALL, checks: checks, VEER: VEER, FR: FR, ST: ST, SLED_FR: SLED_FR,
              RACE_PREDICT: RACE_PREDICT, raceOutcome: raceOutcome, raceJudge: raceJudge, timesAsFar: timesAsFar,
              FIX_PREDICT: FIX_PREDICT, FIX_SET: FIX_SET, FIX_D: FIX_D, FIX_ORDER: FIX_ORDER, BEST_FIX: BEST_FIX, fixesOf: fixesOf, singleFix: singleFix, fixJudge: fixJudge }
  });
})();
