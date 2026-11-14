// Sail Car Lab — Module 6: Balance & Stability
// The balance point (centre of gravity), why the wind from the two box fans flips a car forward over its front
// wheels, and why crooked axles curve a car into the wall. Every number comes from SailLab.physics (the two-fan
// wind: windAt, FAN) — the tipping rule is simulate()'s own:
//   the car flips if  sail push × (sail height − balance-point height)  >  mass × 9.81 × (balance point to front axle)
// and a front axle turned off square makes simulate() steer the car round a circle (radius = wheelbase ÷ tan(angle)).
(function () {
  'use strict';
  const P = SailLab.physics, D = P.DEFAULT_CAR, G = P.G;
  // The hallway's size lives ONLY in sailcar-core.js (SailLab.physics.HALL: 70 ft × 11 ft today). Every hallway number
  // below — the goals, the map, the text — is worked out from it and from simulate(), so re-measuring the hall needs no edit here.
  const HALL = P.HALL;
  const LONG_HALL = 1000;                               // "in a longer hall": the same run with no end wall, so cars that reach the end can still be compared
  function ft(v) { return Math.round(v / 0.3048); }     // metres → whole feet (students measure in both)
  function m1(v) { return String(Number(SailLab.fmt(v, 1))); }          // 21.3 · 3.4 · 16
  const HALL_TXT = m1(HALL.length) + ' m (' + ft(HALL.length) + ' ft)';  // "21.3 m (70 ft)"
  const WIDE_TXT = m1(HALL.width) + ' m (' + ft(HALL.width) + ' ft)';    // "3.4 m (11 ft)"
  const START = 0.3;                                    // the start line: 30 cm from the fans (simulate's default startX)
  const PAPER = 0.08;                                   // printer paper weighs about 80 g per square metre
  const FRAME = D.mass - D.sailArea * PAPER;            // the default 70 g car without its 20 × 20 cm paper sail (66.8 g)
  const FRAME_H = 0.025;                                // its balance point is 2.5 cm up (3 cm with the sail, like DEFAULT_CAR)
  const NICKEL = 0.005, COIN_H = 0.03;                  // a US nickel is 5 g; taped flat on the chassis, 3 cm off the floor
  const STICK = 0.0005;                                 // a longer chassis needs more stick and glue: about 0.5 g per cm
  const STRAIGHT_GOAL = 12;                             // step 4: metres down the hall without hitting a wall (¼° off, the least crooked
                                                        // axle on the slider, hits the wall before this; square axles roll ≈ 16 m)
  const MAP_M = HALL.length;                            // step 4: the top-down map shows the whole hallway, start line to far end
  // A car built from the default one: a wb-cm wheelbase, a side × side cm paper sail whose bottom sits gap cm above the
  // chassis (so its middle is 3 cm + gap + half the sail above the floor), and nickels taped over the back axle.
  // Chassis, wheels, mast and sail sit mid-way between the axles. cgCm (optional) sets the balance point directly.
  function makeCar(side, gap, wb, nickels, cgCm) {
    const area = side * side / 10000, sail = area * PAPER, frame = FRAME + (wb - 16) * STICK, coins = nickels * NICKEL;
    const mass = frame + sail + coins, sh = 0.03 + gap / 100 + side / 200;
    return { mass: mass, sailArea: area, sailHeight: sh, wheelbase: wb / 100,
             cgToFront: cgCm != null ? cgCm / 100 : ((frame + sail) * wb / 200 + coins * wb / 100) / mass,
             cgHeight: (frame * FRAME_H + sail * sh + coins * COIN_H) / mass };
  }
  // The two turns at the start line, where the push is biggest (the car is still and the wind is strongest), in N·cm.
  // simulate() flips the car exactly when tip > hold.
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
    return api.svg('text', { x: x, y: y, 'text-anchor': o.anchor || 'start', fill: o.color || '#c8b8ea', 'font-size': o.size || 16,
      'font-weight': o.bold === false ? null : 700, class: 'sl-lbl' }, s, text);
  }
  const nickels = function (v) { return v + ' (' + v * 5 + ' g)'; };
  const deg = function (v) { return (Math.round(v * 100) / 100) + '°'; };
  const RED = '#ff6060', BLUE = '#7ad7ff', MUTED = '#9080b0';
  // numbers quoted in the text, straight from simulate()
  const f1 = function (v) { return SailLab.fmt(v, 1); };
  const DEFAULT_RUN = P.simulate({});
  const STRAIGHT_RUN = DEFAULT_RUN.distance;                        // a square-axled default car (≈ 16 m: it coasts to a stop inside the hall)
  const HALL_W = DEFAULT_RUN.opts.hallWidth;                        // = HALL.width (3.35 m today)
  const ROOM = HALL_W / 2 - 0.1;                                    // simulate() calls it a wall hit 10 cm (half a car) before the wall
  const WALL_AT = function (a) { return P.simulate({ veerDeg: a }).distance; };
  // how far a car would roll in a hall with no end (for a run that reached the end of the real one, still rolling)
  function longer(car, opts) { return P.simulate(car, Object.assign({}, opts || {}, { hallLength: LONG_HALL })).distance; }

  // Step 3: tame the big 30 × 30 cm sail. Its farthest non-flipping run with the step's controls (gap 0/5/10 cm, chassis
  // 12/16/22 cm, 0–4 nickels), in a hall with no end: only a low sail + long chassis + 2–3 nickels gets past the end of our hall.
  const BIG = 30, BIG_AREA = BIG * BIG / 10000;
  const BIG_BEST = (function () {
    let best = 0;
    [0, 5, 10].forEach(function (gap) {
      [12, 16, 22].forEach(function (wb) {
        for (let n = 0; n <= 4; n++) { const r = P.simulate(makeCar(BIG, gap, wb, n), { hallLength: LONG_HALL }); if (r.reason !== 'tipped over') best = Math.max(best, r.distance); }
      });
    });
    return best;
  })();
  // The goal: all the way to the END of the hallway (4 nickels is too heavy to get there). If the hall is ever made longer than
  // even the best big-sail car can roll, the goal becomes the whole metres that car can still reach.
  const HALL_GOAL = Math.min(HALL.length, Math.floor(BIG_BEST));
  const GOAL_IS_END = HALL_GOAL >= HALL.length;
  // the challenge rule (the step calls it before api.done(); the check script tests it): the big sail, no flip, goal reached
  function tamed(r) {
    return r.car.sailArea >= BIG_AREA - 1e-6 && r.reason !== 'tipped over' &&
           (GOAL_IS_END ? r.reason === 'reached the end of the hall' : r.distance >= HALL_GOAL);
  }
  // The builds that pass, and whether every one of them uses all three fixes (a lower sail than the 10 cm gap it starts
  // with, a longer chassis than 16 cm, and nickels). Today: gap 0 + 22 cm + 2 or 3 nickels, so the page says "all three".
  const BIG_WINNERS = [];
  [0, 5, 10].forEach(function (gap) {
    [12, 16, 22].forEach(function (wb) {
      for (let n = 0; n <= 4; n++) if (tamed(P.simulate(makeCar(BIG, gap, wb, n)))) BIG_WINNERS.push({ gap: gap, wb: wb, n: n });
    });
  });
  const ALL_THREE = BIG_WINNERS.length > 0 && BIG_WINNERS.every(function (w) { return w.gap < 10 && w.wb > 16 && w.n > 0; });

  SailLab.register({
    id: 'balance',
    num: 6,
    title: 'Balance & Stability',
    icon: '🎯',
    blurb: 'Find the balance point, stop your car flipping onto its nose, and make it roll straight.',
    minutes: 15,
    steps: [
      {
        title: 'Find the balance point',
        html:
          '<p>Every object has a <span class="key">balance point</span>: the one spot where you could balance it on your fingertip. ' +
          'Scientists call it the <span class="key">centre of gravity</span> (CG for short). The car acts as if all its weight were squeezed into that one point.</p>' +
          '<p>The balance point is always closer to the heavy parts. Where it sits decides whether your car stays on its wheels or flips onto its nose — you’ll see how in the next step.</p>' +
          '<p>Try it! Balance this car on your finger. If it tilts, the heavy end is going down: slide your finger toward that end.</p>',
        challenge: 'Tape at least 2 nickels on the back of the car. Then slide your finger until the car balances.',
        render: function (el, api) {
          const H = 250, s = board(api, el, H, 'A sail car resting on a fingertip');
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const coins = api.ui.slider(row, { label: 'Nickels taped over the back axle', min: 0, max: 4, step: 1, value: 0, format: nickels, onInput: draw });
          const finger = api.ui.slider(row, { label: 'Your finger, behind the front axle', min: 2, max: 14, step: 0.5, value: 5, format: function (v) { return v.toFixed(1) + ' cm'; }, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const K = 8, FA = 360, PY = 200, CG0 = makeCar(20, 0, 16, 0).cgToFront * 100;   // 8 px per cm · front axle · fingertip
          function draw() {
            const n = coins.get(), f = finger.get(), cg = makeCar(20, 0, 16, n).cgToFront * 100, ok = Math.abs(f - cg) <= 0.3, fx = FA - f * K;
            clear(api, s, H);
            // the car rests on the fingertip; if the balance point isn't right above it, the heavy end drops
            const g = api.svg('g', { transform: 'rotate(' + (ok ? 0 : cg > f ? -8 : 8) + ',' + fx + ',' + PY + ')' }, s);
            api.draw.car(g, FA - 17.5 * K, PY + 2 * K, { scale: K, length: 19, wheelR: 1.5, sailW: 20, sailH: 20, mastH: 20, mastAt: 0.5 });
            for (let i = 0; i < n; i++) api.svg('rect', { x: FA - 16 * K - 9, y: PY - 2 * K - 4.5 * (i + 1), width: 19, height: 4, rx: 1, fill: '#c8c8d0', stroke: '#80808a', 'stroke-width': 0.8 }, g);
            if (n) label(api, g, FA - 16 * K - 14, PY - 2 * K - 4.5 * n + 4, n + ' nickel' + (n === 1 ? ' →' : 's →'), { anchor: 'end', color: '#c8c8d0' });   // the coins hide behind the sail's corner
            if (ok) {
              api.svg('circle', { cx: FA - cg * K, cy: PY - K, r: 6, fill: '#00a8ff', stroke: '#fff', 'stroke-width': 1.5 }, g);
              label(api, s, FA - cg * K + 14, PY - 30, 'balance point', { color: BLUE });
            }
            api.svg('rect', { x: fx - 11, y: PY, width: 22, height: H - PY + 20, rx: 11, fill: '#e2b08a', stroke: '#b07850', 'stroke-width': 1.5 }, s);
            api.svg('ellipse', { cx: fx, cy: PY + 9, rx: 6.5, ry: 5, fill: '#f4d4c0' }, s);
            label(api, s, 14, 240, '← back (fans side)', { bold: false, color: MUTED });
            label(api, s, 546, 240, 'front →', { anchor: 'end', bold: false, color: MUTED });
            const where = api.fmt(cg, 1) + ' cm';
            if (ok) {
              say(api, out, ['⚖️ ', ['Balanced!'], ' With ' + n + ' nickel' + (n === 1 ? '' : 's') + ' on the back, the balance point is ', [where], ' behind the front axle.' +
                (n < 2 ? ' Now tape on 2 or more nickels and find the new balance point.' : '')]);
              if (n >= 2) api.done('The balance point moved toward the heavy end: from ' + api.fmt(CG0, 1) + ' cm to ' + where + ' behind the front axle. Weight at the back moves the balance point back.');
            } else if (cg > f) say(api, out, ['↙️ The ', ['back'], ' end drops, so the balance point is behind your finger. Slide your finger toward the back (a bigger number).']);
            else say(api, out, ['↘️ The ', ['front'], ' end drops, so the balance point is in front of your finger. Slide your finger toward the front (a smaller number).']);
          }
          draw();
        }
      },
      {
        title: 'Why cars flip forward',
        html:
          '<p>Push a door right next to its hinges and it barely moves. Push the handle, far from the hinges, and it swings easily. ' +
          'How hard a push <em>turns</em> something depends on the push <strong>and</strong> on how far it is from the turning point (that distance is the <span class="key">lever</span>). ' +
          'Scientists call turning strength <span class="key">torque</span>. We’ll just call it a <strong>turn</strong>:</p>' +
          '<p style="text-align:center;font-size:1.1rem"><strong>turn = force × lever</strong></p>' +
          '<p>When the two box fans blow, your car tries to turn over its <strong>front wheels</strong>. They are the hinge. Two turns fight:</p>' +
          '<ul><li><span style="color:#ff6060">●</span> <strong>Tip turn</strong> = the wind’s push × how high the middle of the sail is <strong>above the balance point</strong>.</li>' +
          '<li><span style="color:#7ad7ff">●</span> <strong>Hold turn</strong> = the car’s weight × how far the balance point is <strong>behind the front wheels</strong>.</li></ul>' +
          '<p>If the tip turn wins, the back wheels lift and the car flips onto its nose. The push is strongest at the start line (the car is still and right in front of the fans), so that’s where cars flip. ' +
          'Two fans push hard there, so this matters! Forces are in newtons and levers in cm, so turns are in <strong>newton-centimetres (N·cm)</strong>. Weight in newtons = mass in kg × 9.81.</p>',
        render: function (el, api) {
          const H = 340, s = board(api, el, H, 'A sail car seen from the side: the tip turn against the hold turn');
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const size = api.ui.slider(row, { label: 'Sail size (square)', min: 10, max: 35, step: 5, value: 30, format: function (v) { return v + ' × ' + v + ' cm'; }, onInput: draw });
          const gap = api.ui.slider(row, { label: 'Gap under the sail (tall mast)', min: 0, max: 15, step: 5, value: 10, unit: 'cm', onInput: draw });
          const cgS = api.ui.slider(row, { label: 'Balance point, behind the front wheels', min: 2, max: 14, step: 1, value: 8, unit: 'cm', onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const K = 4.2, FL = 280, FA = 230, BX = 352, BAR = 5.4;   // px per cm · floor · front wheel (the hinge) · bar chart · px per N·cm
          function draw() {
            const side = size.get(), c = makeCar(side, gap.get(), 16, 0, cgS.get()), t = turns(c), flips = t.tip > t.hold;
            const mastX = FA - 8 * K, sailY = FL - c.sailHeight * 100 * K, cgX = FA - t.holdArm * K, cgY = FL - c.cgHeight * 100 * K, LX = FA + 26;
            clear(api, s, H);
            api.svg('line', { x1: 10, y1: FL, x2: 325, y2: FL, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            api.draw.fan(s, 14, FL, 70, ' ');
            label(api, s, 4, FL + 22, '2 fans', { color: MUTED, bold: false });   // under the floor: a low, big sail's push arrow passes above the fans
            // the car (sail bottom 3 cm + gap off the floor); a faint copy shows where it goes if it flips
            const carO = { scale: K, length: 19, wheelR: 1.5, sailW: side, sailH: side, mastH: gap.get() + side - 1, mastAt: 0.5 };
            if (flips) api.draw.car(s, FA - 17.5 * K, FL, Object.assign({ tilt: 24 }, carO)).setAttribute('opacity', 0.3);
            api.draw.car(s, FA - 17.5 * K, FL, carO);
            api.svg('polygon', { points: [FA, FL + 1, FA - 7, FL + 13, FA + 7, FL + 13].join(','), fill: '#ffa040' }, s);
            label(api, s, FA + 11, FL + 14, 'hinge', { color: '#ffa040' });
            // the push on the middle of the sail, and the tip lever: from the balance point up to the middle of the sail
            api.draw.arrow(s, mastX - 8 - (30 + t.push * 120), sailY, mastX - 8, sailY, '#40e080', '');
            label(api, s, mastX - side * K * 0.45 - 6, sailY - 10, 'push ' + api.fmt(t.push, 2) + ' N', { anchor: 'end', color: '#40e080' });   // just left of the sail
            api.svg('circle', { cx: mastX, cy: sailY, r: 4, fill: RED }, s);
            [[mastX, sailY], [cgX, cgY]].forEach(function (p) { api.svg('line', { x1: p[0], y1: p[1], x2: LX + 6, y2: p[1], stroke: RED, 'stroke-width': 1.5, 'stroke-dasharray': '2,4', opacity: 0.8 }, s); });
            api.svg('line', { x1: LX, y1: cgY, x2: LX, y2: sailY, stroke: RED, 'stroke-width': 3 }, s);
            label(api, s, LX + 8, (cgY + sailY) / 2 - 4, 'tip lever', { color: RED });
            label(api, s, LX + 8, (cgY + sailY) / 2 + 14, api.fmt(t.tipArm, 1) + ' cm', { color: RED });
            // the weight pulls down at the balance point; the hold lever runs from there to the hinge
            api.draw.arrow(s, cgX, cgY, cgX, FL + 24, BLUE, '', { width: 3 });
            label(api, s, cgX - 10, FL + 26, 'weight ' + api.fmt(t.weight, 2) + ' N', { anchor: 'end', color: BLUE });
            api.svg('line', { x1: cgX, y1: FL + 40, x2: FA, y2: FL + 40, stroke: BLUE, 'stroke-width': 3 }, s);
            [cgX, FA].forEach(function (x) { api.svg('line', { x1: x, y1: FL + 33, x2: x, y2: FL + 47, stroke: BLUE, 'stroke-width': 2 }, s); });
            label(api, s, FA + 11, FL + 46, 'hold lever ' + api.fmt(t.holdArm, 0) + ' cm', { color: BLUE });
            api.svg('circle', { cx: cgX, cy: cgY, r: 6, fill: '#00a8ff', stroke: '#fff', 'stroke-width': 1.5 }, s);
            // the two turns as bars (the biggest tip turn these sliders can make, ≈ 27.5 N·cm, still fits)
            label(api, s, BX, 34, 'Turn strength (N·cm)');
            [['Tip turn (wind)', t.tip, RED, 70], ['Hold turn (weight)', t.hold, BLUE, 138]].forEach(function (b) {
              const w = Math.max(2, Math.min(155, b[1] * BAR));
              label(api, s, BX, b[3], b[0], { color: b[2] });
              api.svg('rect', { x: BX, y: b[3] + 10, width: w, height: 24, rx: 4, fill: b[2], opacity: 0.85 }, s);
              label(api, s, BX + w + 6, b[3] + 28, api.fmt(b[1], 1), { color: b[2] });
            });
            label(api, s, BX, 216, flips ? 'IT FLIPS!' : 'IT STAYS DOWN', { color: flips ? RED : '#40e080', size: 22 });
            label(api, s, BX, 242, flips ? 'the tip turn is bigger' : 'the hold turn is bigger', { bold: false });
            const tie = Math.abs(t.tip - t.hold) < 0.1;
            say(api, out, ['🔴 Tip turn = push ' + api.fmt(t.push, 2) + ' N × tip lever ' + api.fmt(t.tipArm, 1) + ' cm ≈ ', [api.fmt(t.tip, 1) + ' N·cm'],
              '. 🔵 Hold turn = weight ' + api.fmt(t.weight, 2) + ' N (' + api.fmt(c.mass * 1000, 0) + ' g) × hold lever ' + api.fmt(t.holdArm, 0) + ' cm ≈ ', [api.fmt(t.hold, 1) + ' N·cm'], '. ',
              tie ? 'It’s almost a tie! In the model the ' + (flips ? 'tip' : 'hold') + ' turn is a hair bigger, so it ' + (flips ? 'flips' : 'stays down') + ' — but one tiny gust could change that. Real engineers leave a safety margin.'
                  : flips ? 'The tip turn wins: the back wheels lift and the car flips onto its nose.' : 'The hold turn wins: the car stays on all four wheels.']);
          }
          draw();
          api.ui.note(el, 'tip', '💡 <strong>Try this:</strong> 1. Drop the gap under the sail to 0 cm. 2. Slide the balance point back. 3. Make the sail smaller. ' +
            'Which changes shrink the red bar? Which one grows the blue bar? (On a real car you move the balance point back by adding weight at the back, or with a longer chassis.)');
        }
      },
      {
        title: 'Hallway challenge: tame the big sail',
        html:
          '<p>This car has a big <strong>30 × 30 cm</strong> sail on a tall mast, 10 cm above the chassis. A big sail catches lots of wind from the two box fans… but press ▶ Run and watch what happens at the start line.</p>' +
          '<p>Fix it with <strong>balance</strong>, not by giving up the big sail! You can mount the sail lower, use a longer chassis, or tape nickels over the back axle. ' +
          (ALL_THREE ? 'A sail this big needs <strong>all three</strong> fixes: a low sail, a long chassis <em>and</em> a little weight at the back. '
                     : 'A sail this big needs <strong>more than one</strong> fix. ') +
          'Watch the tip turn and the hold turn (in the box just above the hallway) change as you try each one. ' +
          'But remember Module 5: extra mass means extra friction, so add only as much weight as you need.</p>' +
          (GOAL_IS_END
            ? '<p>Tamed, this sail can push a car all the way to the far end of our ' + HALL_TXT + ' hallway. ' +
              (BIG_WINNERS.length > 1 ? 'More than one build can get there, and on race day they would tie at the end wall. So when' : 'When') +
              ' your car reaches the end, the simulator also tells you how far it would have rolled in a <strong>longer</strong> hall.' +
              (BIG_WINNERS.length > 1 ? ' That shows which build is really best.' : '') + '</p>'
            : '<p>Our hallway is ' + HALL_TXT + ' long, so there’s room to show what a tamed big sail can do.</p>'),
        challenge: GOAL_IS_END ? 'Keep the 30 × 30 cm sail and get the car all the way to the end of the ' + HALL_TXT + ' hallway without flipping.'
                               : 'Keep the 30 × 30 cm sail and get the car to roll at least ' + HALL_GOAL + ' metres (about ' + ft(HALL_GOAL) + ' ft) without flipping.',
        render: function (el, api) {
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          let sim = null;
          const side = api.ui.choice(row, { label: 'Sail size (square)', value: 30, options: [20, 25, 30].map(function (v) { return { value: v, label: v + ' × ' + v + ' cm' }; }), onChange: info });
          const gap = api.ui.choice(row, { label: 'Gap under the sail (mast height)', value: 10, options: [{ value: 0, label: 'None (low)' }, { value: 5, label: '5 cm' }, { value: 10, label: '10 cm (tall)' }], onChange: info });
          const wb = api.ui.choice(row, { label: 'Chassis: front axle to back axle', value: 16, options: [{ value: 12, label: 'Short 12 cm' }, { value: 16, label: 'Normal 16 cm' }, { value: 22, label: 'Long 22 cm' }], onChange: info });
          const coins = api.ui.slider(row, { label: 'Nickels taped over the back axle', min: 0, max: 4, step: 1, value: 0, format: nickels, onInput: info });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const HINT = '💡 Check the tip turn and hold turn above before you run.';
          const fb = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite', text: HINT });
          function car() { return makeCar(side.get(), gap.get(), wb.get(), coins.get()); }
          // any change to the car clears the old run, so a run of a different car can't pass the challenge
          function info() {
            const c = car(), t = turns(c);
            say(api, out, ['⚖️ Car ', [api.fmt(c.mass * 1000, 0) + ' g'], ' · balance point ' + api.fmt(t.holdArm, 1) + ' cm behind the front axle · tip turn ', [api.fmt(t.tip, 1) + ' N·cm'],
              ' vs hold turn ', [api.fmt(t.hold, 1) + ' N·cm'], t.tip > t.hold ? ' → it will flip! 🤸' : ' → it stays down ✓']);
            fb.textContent = HINT;
            if (sim) sim.reset();
          }
          info();
          sim = api.ui.trackSim(el, car, {
            scaleM: HALL.length,                              // the whole hallway, start line to far end, the same view every run
            onResult: function (r) {
              const d = api.fmt(r.distance, 2) + ' m', end = r.reason === 'reached the end of the hall';
              // a car that reached the end was still rolling: how far it would have gone in a longer hall
              const far = end ? longer(r.car, r.opts) : r.distance, farTxt = 'about ' + m1(far) + ' m (' + ft(far) + ' ft)';
              if (r.reason === 'tipped over') {
                const three = ALL_THREE && r.car.sailArea >= BIG_AREA - 1e-6;
                say(api, fb, ['🤸 ', ['Flipped!'], ' The tip turn beat the hold turn. Shrink the tip lever (lower the sail) ' + (three ? 'and' : 'or') +
                  ' grow the hold turn (longer chassis, nickels at the back)' + (three ? ': this big sail needs all three fixes.' : '.')]);
              }
              else if (r.car.sailArea < BIG_AREA - 1e-6) say(api, fb, end
                ? ['No flip, and it reached the end — but with a smaller sail. This challenge is to tame the BIG sail: put the 30 × 30 cm sail back and fix the balance instead.']
                : ['No flip — but it stopped at ', [d], '. A smaller sail catches less wind. Keep the 30 cm sail and fix the balance instead.']);
              else if (tamed(r)) {
                const need = fewestNickels(side.get(), gap.get(), wb.get()), fewer = need != null && coins.get() > need;
                const lightFar = fewer ? longer(makeCar(side.get(), gap.get(), wb.get(), need), r.opts) : 0;
                say(api, fb, ['🏆 ', [end ? 'All the way to the end of the hallway' : d], ' and no flip!']
                  .concat(end ? [' It was still rolling: in a longer hall it would have gone ', [farTxt], '.'] : [])
                  .concat(fewer ? [' Can you do it with fewer nickels? ' + need + ' ' + (need === 1 ? 'is' : 'are') + ' enough to stop the flip here, and a lighter car rolls farther' +
                    (end ? ': about ' + m1(lightFar) + ' m in that longer hall. On race day both would tie at the end wall, but a lighter car has speed to spare.' : '.')] : []));
                api.done((end ? 'It rolled all the way to the end of the ' + HALL_TXT + ' hallway without flipping, and in a longer hall it would have kept going to ' + farTxt + '! '
                              : 'It rolled ' + d + ' without flipping! ') +
                  'A low sail, a long chassis and a little weight over the back axle let a big sail push hard without tipping — and the lighter your fix, the farther it goes.');
              } else say(api, fb, ['No flip — nice! But it stopped at ', [d], GOAL_IS_END ? ', short of the end of our ' + HALL_TXT + ' hallway.' : ', short of ' + HALL_GOAL + ' m.',
                ' Every nickel and every extra cm of chassis adds weight, and weight adds friction. Can you stop the flip with less weight?']);
            }
          });
          api.onLeave(sim.stop);
          el.appendChild(fb);
        }
      },
      {
        title: 'Drive straight: square axles',
        html:
          '<p>Wheels roll the way they point. An axle is <span class="key">square</span> when it sits at a perfect right angle (90°) across the chassis. ' +
          'If your two axles aren’t <span class="key">parallel</span> (lined up the same way), the front wheels point a little to one side. ' +
          'Then the car doesn’t go straight: it drives around a giant circle.</p>' +
          '<p>Our hallway is about ' + WIDE_TXT + ' wide and your car starts in the middle, so it has only about ' + m1(ROOM) + ' m (' + ft(ROOM) + ' ft) of room on each side. ' +
          'With two box fans, a typical car rolls about ' + Math.round(STRAIGHT_RUN) + ' m (' + ft(STRAIGHT_RUN) + ' ft), so even a crooked axle you can barely see has plenty of time to steer it into the wall!</p>' +
          '<p>The map below shows the whole ' + HALL_TXT + ' hallway, squeezed from end to end so it fits on your screen. That makes the drift look steeper than it really is, but the distances are real.</p>',
        challenge: 'Fix the front axle so the car rolls at least ' + STRAIGHT_GOAL + ' metres (about ' + ft(STRAIGHT_GOAL) + ' ft) down the hall without hitting a wall. Press ▶ Roll to test.',
        render: function (el, api) {
          const TH = 160, top = board(api, el, TH, 'Your car seen from above, with its two axles');
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const ang = api.ui.slider(row, { label: 'Front axle turned off square', min: 0, max: 5, step: 0.25, value: 3, format: deg,
            onInput: function () { stop(); carTop(); hall([], null); explain(null); } });
          const go = api.h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: '▶ Roll' });
          row.appendChild(api.h('div', { class: 'sl-ctrl' }, [go]));
          const HH = 280, hs = board(api, el, HH, 'Map of the whole hallway seen from above, with your car’s path');
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          // fan face · px per metre down the hall (the whole hall: its far end lands at x 533) · half the hall's width in px, so
          // px per metre across it (any hall width fills 192 px) · middle of the hall
          const X0 = 30, KX = 503 / (MAP_M + START), HALF = 96, KY = HALF / (HALL_W / 2), YC = 140, ghosts = [];
          const WT = YC - HALF, WB = YC + HALF, SX = X0 + START * KX, EX = X0 + (START + MAP_M) * KX;   // the side walls · start line · far end
          let raf = null;
          // simulate()'s trace: x = metres down the hall from the start line, lateral = metres sideways from the middle
          function pt(p) { return [X0 + (START + p.x) * KX, YC - p.lateral * KY]; }
          function axle(x, rot, color) {
            const g = api.svg('g', { transform: 'rotate(' + rot + ',' + x + ',75)' }, top);
            [23, 127].forEach(function (y) {
              api.svg('line', { x1: x + 20, y1: y, x2: x + 420, y2: y, stroke: color, 'stroke-width': 2, 'stroke-dasharray': '6,6' }, g);   // the way this wheel rolls
              api.svg('rect', { x: x - 18, y: y - 6, width: 36, height: 12, rx: 3, fill: '#222', stroke: '#888', 'stroke-width': 1.5 }, g);
            });
            api.svg('line', { x1: x, y1: 23, x2: x, y2: 127, stroke: '#c8a060', 'stroke-width': 3 }, g);
          }
          function carTop() {
            const a = ang.get(), bx = 222, fx = bx + 16 * 12;   // 12 px per cm: back and front axles, 16 cm apart
            clear(api, top, TH);
            label(api, top, 14, 32, 'Your car from above');
            label(api, top, 14, 64, 'back axle: square', { color: BLUE, bold: false });
            label(api, top, 14, 92, a ? 'front axle: ' + deg(a) + ' off' : 'front axle: square', { color: a ? RED : '#40e080', bold: false });
            [-14, 0, 14].forEach(function (dy) { api.svg('rect', { x: bx - 14, y: 69 + dy, width: fx - bx + 28, height: 12, rx: 5, fill: '#d8b070', stroke: '#a07830' }, top); });
            axle(bx, 0, BLUE);
            axle(fx, -a, a ? RED : '#40e080');
            label(api, top, 548, 154, 'dashes = the way each wheel rolls', { anchor: 'end', bold: false, color: MUTED });
          }
          function line(pts, color, w, op) {
            api.svg('polyline', { points: pts.map(function (p) { return pt(p).join(','); }).join(' '), fill: 'none', stroke: color, 'stroke-width': w, opacity: op, 'stroke-linejoin': 'round' }, hs);
          }
          function hall(pts, res) {
            clear(api, hs, HH);
            // the two side walls and the far end of the hall
            [WT - 3, WB + 3].forEach(function (y) { api.svg('line', { x1: 0, y1: y, x2: EX + 6, y2: y, stroke: '#6a5a8a', 'stroke-width': 6 }, hs); });
            api.svg('line', { x1: EX + 3, y1: WT - 6, x2: EX + 3, y2: WB + 6, stroke: '#6a5a8a', 'stroke-width': 6 }, hs);
            label(api, hs, EX, WT - 14, 'wall — the hall is ' + WIDE_TXT + ' wide', { anchor: 'end', bold: false, color: MUTED, size: 18 });
            label(api, hs, EX - 8, WB - 12, 'end of the hall', { anchor: 'end', bold: false, color: MUTED, size: 18 });   // lower half: paths only ever drift up
            label(api, hs, SX + 2, WT - 14, 'start', { anchor: 'middle', color: '#f0c040', size: 18 });
            api.svg('line', { x1: SX, y1: WT, x2: SX, y2: WB, stroke: '#f0c040', 'stroke-width': 1.5, 'stroke-dasharray': '4,4', opacity: 0.6 }, hs);
            api.svg('line', { x1: SX, y1: YC, x2: EX, y2: YC, stroke: '#4a3a6a', 'stroke-width': 2, 'stroke-dasharray': '6,8' }, hs);
            // two box fans side by side, about 50 cm wide each, facing down the hall
            const FW = 0.5 * KY;
            [YC - FW - 1, YC + 1].forEach(function (y) { api.svg('rect', { x: X0 - 14, y: y, width: 14, height: FW, rx: 3, fill: '#3a2a5a', stroke: MUTED, 'stroke-width': 2 }, hs); });
            label(api, hs, SX + 8, YC + 30, '← 2 fans', { bold: false, color: MUTED, size: 18 });   // lower half: paths only ever drift up, and this clears the start line
            // a tick every 2 m inside the hall, labelled every 4 m (big enough to read on a phone), none crowding the end wall
            for (let m = 2; m < MAP_M; m += 2) {
              const x = SX + m * KX;
              if (EX - x < 12) break;
              api.svg('line', { x1: x, y1: WB + 6, x2: x, y2: WB + 14, stroke: '#6a5a8a', 'stroke-width': 1.5 }, hs);
              if (m % 4 === 0 && EX - x > 28) label(api, hs, x, WB + 36, m + ' m', { anchor: 'middle', bold: false, color: MUTED, size: 20 });
            }
            ghosts.forEach(function (gh) {
              line(gh.pts, MUTED, 2, 0.55);
              const e = pt(gh.pts[gh.pts.length - 1]);
              label(api, hs, Math.min(e[0] + 8, 520), e[1] + 6, deg(gh.deg), { bold: false, color: MUTED });
            });
            if (!pts.length) return;
            line(pts, '#f0c040', 3, 1);
            const e = pt(pts[pts.length - 1]), q = pt(pts[Math.max(0, pts.length - 3)]), hd = Math.atan2(e[1] - q[1], e[0] - q[0]) * 180 / Math.PI;
            api.svg('rect', { x: e[0] - 7, y: e[1] - 4.5, width: 14, height: 9, rx: 2, fill: '#b44fff', stroke: '#fff', 'stroke-width': 1, transform: 'rotate(' + hd + ',' + e[0] + ',' + e[1] + ')' }, hs);
            if (res) {
              const crash = res.reason === 'hit the wall';
              label(api, hs, Math.min(e[0], 548), e[1] < YC - 30 ? e[1] + 28 : e[1] - 14, api.fmt(res.distance, 2) + ' m' + (crash ? ' — crash!' : ''),
                { anchor: e[0] > 440 ? 'end' : 'middle', color: crash ? RED : '#40e080' });
            }
          }
          function explain(r) {
            const a = r ? r.car.veerDeg : ang.get();
            if (!r) {
              say(api, out, a ? ['Front axle ', [deg(a)], ' off square → the car drives around a circle with a radius of ', [api.fmt(D.wheelbase / Math.tan(a * Math.PI / 180), 1) + ' m'],
                ' (centre to edge). Press ▶ Roll.'] : ['Both axles square → the car rolls ', ['straight'], '. Press ▶ Roll.']);
              return;
            }
            say(api, out, [deg(a) + ' off: it went ', [api.fmt(r.distance, 2) + ' m'], ' down the hall and drifted ', [api.fmt(r.trace[r.trace.length - 1].lateral, 2) + ' m'],
              ' sideways' + (r.reason === 'hit the wall' ? ' — then hit the wall! 🧱' : '. 🏁')]);
          }
          function stop() { if (raf) cancelAnimationFrame(raf); raf = null; go.disabled = false; }
          go.addEventListener('click', function () {
            stop();
            const r = P.simulate({ veerDeg: ang.get() }), tr = r.trace, t0 = performance.now();
            const speedUp = Math.max(2, r.time / 8);         // long runs play faster, like the hallway simulator
            let i = 0;
            go.disabled = true;
            function frame(now) {
              const tt = (now - t0) / 1000 * speedUp;
              while (i < tr.length - 1 && tr[i + 1].t <= tt) i++;
              const done = i >= tr.length - 1;
              hall(tr.slice(0, i + 1), done ? r : null);
              if (!done) { raf = requestAnimationFrame(frame); return; }
              raf = null; go.disabled = false;
              ghosts.push({ deg: r.car.veerDeg, pts: tr });
              if (ghosts.length > 3) ghosts.shift();
              explain(r);
              if (r.reason !== 'hit the wall' && r.distance >= STRAIGHT_GOAL) api.done('Square axles = a straight run! At ' + deg(r.car.veerDeg) + ' your car rolled ' + api.fmt(r.distance, 2) + ' m. ' +
                'Our hall is only ' + ft(HALL_W) + ' ft wide: just 1° off hits the wall after about ' + f1(WALL_AT(1)) + ' m (' + ft(WALL_AT(1)) + ' ft), and even ½° off after about ' +
                f1(WALL_AT(0.5)) + ' m (' + ft(WALL_AT(0.5)) + ' ft) — so square your axles with a ruler.');
            }
            raf = requestAnimationFrame(frame);
          });
          api.onLeave(stop);
          carTop(); hall([], null); explain(null);
        }
      },
      {
        title: 'Real build: stable and straight',
        html:
          '<p>Use these tricks to keep your real car on its wheels and rolling straight:</p>' +
          '<ul><li><strong>Mount the sail low.</strong> Glue or tape the bottom edge of the sail close to the chassis. No big gap under it! A low sail has a short tip lever.</li>' +
          '<li><strong>Tall sail? Brace the mast.</strong> Twist pipe cleaners from the top of the mast down to the two back corners of the chassis (braces like these are called guy lines). They stop the mast bending forward and keep the sail upright.</li>' +
          '<li><strong>Stretch the chassis.</strong> Hot-glue two popsicle sticks end-to-end (overlap them about 3 cm) to make the car longer. The balance point ends up farther behind the front wheels.</li>' +
          '<li><strong>Weight at the back, only if needed.</strong> If it still flips, tape a coin or two flat on the chassis right over the back axle, or put your extra hot glue there. Every gram adds friction, so add just enough.</li>' +
          '<li><strong>Square the axles.</strong> Before the glue sets, line up each straw straight across the chassis using a ruler or the corner of a sheet of paper (a perfect 90° corner). Check that both axles are parallel.</li></ul>' +
          '<p><strong>Test it in the hallway:</strong></p>' +
          '<ol><li><strong>Finger test:</strong> balance the finished car on one finger or a pencil, under the chassis. Mark that spot with a marker: it’s your balance point. The farther behind the front axle it is, the harder your car is to flip.</li>' +
          '<li><strong>Start-line flip test:</strong> set the car at the start line with both box fans on high — that’s where the wind pushes hardest. Watch from the side at floor level. If the back wheels lift even a little, it’s starting to flip: lower the sail, lengthen the chassis or add a coin at the back.</li>' +
          '<li><strong>Straight-roll test:</strong> stick a long strip of tape on the floor as a straight line. Set the car on it and give it a gentle push. If it curves away from the tape, an axle is crooked (or a wheel is rubbing). Re-square it and test again — before race day!</li>' +
          '<li><strong>Race-day line-up:</strong> start your car in the middle of the hall, in front of the two fans, pointing straight down the hall.</li></ol>',
        render: function (el, api) {
          api.ui.note(el, 'build', '🛠️ <strong>Your materials:</strong> popsicle sticks, straws, paper, pipe cleaners, cardstock, plastic wheels, skewers or thin dowels, tape and hot glue — plus a few coins for weight (a nickel is about 5 g). ' +
            'Change <strong>one thing at a time</strong> and re-test, so you know which fix worked.');
        }
      }
    ],
    quiz: [
      { q: 'What is a car’s centre of gravity (its balance point)?', options: ['The spot where the car balances, as if all its weight were there', 'The middle of the front axle', 'The top of the mast', 'The spot where the wind hits the sail'], answer: 0,
        why: 'The centre of gravity is the balance point: you could balance the car on one finger there. The car acts as if all its weight were at that point.' },
      { q: 'You tape 3 nickels on the back of your car, right over the back axle. What happens to its balance point?', options: ['It moves up to the top of the mast', 'It moves toward the front', 'It moves toward the back, closer to the nickels', 'It stays exactly where it was'], answer: 2,
        why: 'The balance point always moves toward the heavy parts. Weight at the back moves it back.' },
      { q: 'When the wind from the two box fans flips a sail car over, which way does it usually go?', options: ['Backward, toward the fans', 'Forward onto its nose, turning over its front wheels', 'Straight up into the air', 'Sideways, rolling onto its side'], answer: 1,
        why: 'The wind pushes high on the sail, so the car turns over its front wheels (the hinge) and lands on its nose. Its weight is what holds the back down.' },
      { q: 'Why does a sail mounted high on a tall mast make a car more likely to flip?', options: ['A high sail makes the fans blow harder', 'The push acts farther above the balance point, so it has a longer lever to flip the car', 'A tall mast makes the car lighter', 'A high sail adds friction to the wheels'], answer: 1,
        why: 'Tip turn = push × height of the middle of the sail above the balance point. The same push on a longer lever turns the car harder.' },
      { q: 'At the start line, the wind from the two box fans pushes a sail with 0.5 N, 14 cm above the car’s balance point. The car weighs 0.7 N, and its balance point is 8 cm behind the front wheels. Does it flip?',
        options: ['No: its weight (0.7 N) is bigger than the push (0.5 N)', 'Yes: the tip turn (0.5 × 14 = 7 N·cm) beats the hold turn (0.7 × 8 = 5.6 N·cm)', 'No: the hold turn (0.7 × 14 = 9.8 N·cm) is bigger', 'You can’t tell without knowing the wheel size'], answer: 1,
        why: 'Compare turns, not just forces. Tip turn = 0.5 N × 14 cm = 7 N·cm. Hold turn = 0.7 N × 8 cm = 5.6 N·cm. The tip turn is bigger, so the back lifts and the car flips.' },
      { q: 'Your car flips onto its nose every time the fans turn on. Which change helps?', options: ['Tape coins on the front, ahead of the front axle', 'Move the sail higher up the mast', 'Mount the sail lower, right down near the chassis', 'Make the sail taller'], answer: 2,
        why: 'A lower sail shortens the tip lever, so the same push has less turning strength. The other changes make flipping worse.' },
      { q: 'Car A stopped flipping by taping 4 nickels (20 g) on the back. Car B has the same sail and stopped flipping by mounting its sail lower instead. Which will probably roll farther?',
        options: ['Car A, because extra weight always makes a car faster', 'Car B, because it stayed light, so it has less friction to fight', 'They tie: once a car doesn’t flip, its mass doesn’t matter', 'Car A, because the nickels catch extra wind'], answer: 1,
        why: 'Both cars stay on their wheels, but Car A carries 20 g more. More mass means more friction, so the lighter Car B rolls farther. Lowering the sail is a free fix!' },
      { q: 'In the simulator, a car whose front axle is turned 3° off square…', options: ['goes perfectly straight, just a little slower', 'flips over at the start line', 'curves sideways and hits the hallway wall before it gets even ' + (Math.floor(WALL_AT(3)) + 1) + ' m down the hall', 'rolls farther, because it zig-zags'], answer: 2,
        why: 'Wheels roll the way they point. A 3° crooked axle steers the car around a circle. Our hall is only ' + ft(HALL_W) + ' ft wide, so it hits the wall after only about ' + f1(WALL_AT(3)) + ' m. ' +
          'With square axles the same car rolls about ' + f1(STRAIGHT_RUN) + ' m.' },
      { q: 'What’s the best way to make sure your two axles are square and parallel?', options: ['Spin each wheel and see how long it spins', 'Line them up with a ruler or the corner of a sheet of paper, then check that a gentle push rolls the car straight', 'Use a bigger sail', 'Put the heaviest parts on the front'], answer: 1,
        why: 'A ruler or a paper corner gives you a perfect right angle for lining up each axle. A gentle push along a straight line shows whether the car really rolls straight.' },
      { q: 'You set your car at the start line in front of the two box fans and see its back wheels lift off the floor a little. What does that tell you?', options: ['It is starting to flip forward: the tip turn is beating the hold turn', 'The wheels have too much friction', 'The sail is too small to catch the wind', 'The axles are crooked'], answer: 0,
        why: 'Back wheels lifting means the wind’s turn is winning. Lower the sail, lengthen the chassis or move weight to the back before race day.' }
    ],
    // for the check script only: the module's own car builder and turn maths
    _calc: { makeCar: makeCar, turns: turns, fewestNickels: fewestNickels, tamed: tamed, longer: longer, HALL_GOAL: HALL_GOAL, GOAL_IS_END: GOAL_IS_END,
             BIG_BEST: BIG_BEST, BIG_WINNERS: BIG_WINNERS, ALL_THREE: ALL_THREE, STRAIGHT_GOAL: STRAIGHT_GOAL, MAP_M: MAP_M, ROOM: ROOM }
  });
})();
