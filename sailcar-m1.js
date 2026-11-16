// Sail Car Lab — Module 1: Forces & Motion
// The reference module: every other module follows this shape.
//   steps: lesson pages. A step can have static `html`, a `render(el, api)` function, or both.
//          A step with `challenge` keeps the Next button locked until the step calls api.done().
//   quiz:  a pool of questions; the lab draws 5 of them each try (4 right = 80% to pass).
//          `answer` is the index of the right option in `options`; `why` explains it.
// Written for 6th graders: short sentences, forces in paper clips (SailLab.kid.force), distances in
// feet first (SailLab.kid.dist), no formulas. Every number a student reads is worked out from simulate().
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
  // Fan speeds for the hallway step (High = the real fans, SailLab.physics.FAN.v0 = 3.5 m/s at the grilles).
  const FAN_V = { low: 1.8, med: 2.6, high: P.FAN.v0 };
  const FAN_OPTS = [{ value: 'low', label: 'Low' }, { value: 'med', label: 'Medium' }, { value: 'high', label: 'High' }];
  // Wheel stickiness (crr). Rubbing / OK / Spin freely mean the SAME numbers in Modules 1, 3 and 4
  // (OK = the lab's standard car, DEFAULT_CAR.crr), so a "Rubbing" car rolls the same distance everywhere.
  // Jammed is an extra, worse choice only here: on the Low fan its push (about 9 clips) is smaller than
  // the most its stuck wheels can hold back (about 12 clips), so the car never starts — friction matches
  // the push exactly: the "balanced, nothing moves" demo.
  const WHEELS = { jam: 0.13, rub: 0.07, ok: P.DEFAULT_CAR.crr, free: 0.012 };
  const WHEEL_OPTS = [{ value: 'jam', label: 'Jammed (rubbing hard)' }, { value: 'rub', label: 'Rubbing' }, { value: 'ok', label: 'OK' }, { value: 'free', label: 'Spin freely' }];
  // The hallway step starts on its first test: Low fan + Jammed wheels (0 ft: it never moves).
  const START = { fan: 'low', wheels: 'jam' };
  function hallOpts(fan) { return { fan: { v0: FAN_V[fan], L: P.FAN.L } }; }
  // Can any car on the hallway step catch up with the fading wind? (High fan + Spin freely does, for a few feet.)
  // The step's text says so only when simulate() agrees. The trace's last point is the "stopped" marker, so it is skipped.
  const CATCHES_UP = Object.keys(FAN_V).some(function (f) {
    return Object.keys(WHEELS).some(function (w) {
      const tr = P.simulate({ crr: WHEELS[w] }, hallOpts(f)).trace;
      return tr.some(function (p, i) { return i < tr.length - 1 && p.v > p.wind; });
    });
  });
  // A typical car (DEFAULT_CAR), for step 1: its weight and the wind's push right at the fans.
  const TYPICAL = P.simulate({}, {});
  const WEIGHT_N = P.DEFAULT_CAR.mass * P.G;

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
  // the answer shown after a run: { text, right, why } — every number comes from this run
  function judge(r, v) {
    const got = outcome(r), end = r.reason === 'reached the end of the hall';
    const text = got === 'still' ? 'The car did not move.'
               : end ? 'The car rolled all ' + kid.dist(r.distance) + ' to the end of the hall!'
               : 'The car rolled ' + kid.dist(r.distance) + '.';
    const why = got === 'still'
      ? 'The wind pushed with ' + kid.force(r.startPush) + '. These wheels can hold back up to ' + kid.force(r.friction * P.STICKY) + '. ' +
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
  // a "Word to know" box at the very top of the step (above the step's html)
  function wordFirst(api, el, term, meaningHtml) {
    const box = api.ui.word(el, term, meaningHtml);
    el.insertBefore(box, el.firstChild);
    return box;
  }
  function clipsText(n) { return n + (n === 1 ? ' paper clip' : ' paper clips'); }

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
        html:
          '<p>Scientists measure force in units called <strong>newtons</strong>. ' +
          'In this lab we compare forces with arrows: <strong>a longer arrow means a bigger force</strong>.</p>' +
          '<p>In front of the fans, <strong>four forces</strong> act on your car at once. ' +
          'A fifth one joins in only if the car goes faster than the wind.</p>',
        render: function (el, api) {
          wordFirst(api, el, 'force', 'a push or a pull.');
          const s = api.svg('svg', { role: 'img', 'aria-label': 'A sail car in front of two box fans. Thrust from the wind pushes it forward. Friction pushes back at the wheels. Gravity pulls down and the floor pushes up. A dashed drag arrow shows the push back that only happens if the car is faster than the wind.' }, el);
          function paint() {
            const W = boardWidth(el), FL = 165, H = FL + 66;
            startBoard(api, s, W, H);
            api.svg('line', { x1: 12, y1: FL, x2: W - 12, y2: FL, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            const fan = api.draw.fan(s, 10, FL, 96), fanR = 10 + 96 * 0.32;
            const fanTxt = fan.querySelector('text');
            if (fanTxt) { fanTxt.setAttribute('font-size', 13); fanTxt.setAttribute('y', FL + 18); }
            // the car, and where its parts are (the same sums api.draw.car uses)
            const sc = W < 440 ? 2.6 : 3.6, len = 30 * sc, carX = Math.round(W * 0.42), front = carX + len, r = 3 * sc;
            api.draw.car(s, carX, FL, { scale: sc, length: 30, sailW: 20, sailH: 20, mastH: 30 });
            const deckY = FL - r * 2 - sc, mastX = carX + len * 0.45, sailL = mastX - 20 * sc * 0.45, midY = Math.round(deckY - 18 * sc);
            // THRUST: the fans' wind pushes the sail forward
            api.draw.arrow(s, fanR + 8, midY, sailL - 3, midY, '#40e080', '');
            const tx = (fanR + 8 + sailL) / 2;
            label(api, s, tx, midY - 12, 'THRUST', '#40e080', { size: 16 });
            // how hard the wind pushes a typical car right at the fans (from simulate(), in clips)
            if (W >= 440) {
              label(api, s, tx, midY + 24, 'the wind pushes the sail', '#40e080', { size: 13, light: true });
              label(api, s, tx, midY + 41, 'with about ' + kid.forceShort(TYPICAL.startPush) + ' at the start', '#40e080', { size: 13, light: true });
            } else label(api, s, tx, midY + 22, 'about ' + kid.forceShort(TYPICAL.startPush), '#40e080', { size: 13, light: true });
            // DRAG (dashed): the air only pushes BACK if the car moves faster than the wind
            const d1 = W - 12, d2 = mastX + 5, dx = (d1 + d2) / 2;
            const drag = api.draw.arrow(s, d1, midY, d2, midY, '#ff5050', '');
            const dl = drag.querySelector('line');
            if (dl) dl.setAttribute('stroke-dasharray', '8 7');
            if (d1 - d2 >= 240) {
              label(api, s, dx, midY - 30, 'DRAG', '#ff5050', { size: 16 });
              label(api, s, dx, midY - 12, 'only if the car outruns the wind', '#ff8080', { size: 13, light: true });
            } else {
              label(api, s, dx, midY - 44, 'DRAG', '#ff5050', { size: 16 });
              label(api, s, dx, midY - 28, 'only if the car', '#ff8080', { size: 13, light: true });
              label(api, s, dx, midY - 12, 'outruns the wind', '#ff8080', { size: 13, light: true });
            }
            // GRAVITY pulls down on the car
            const gx = carX + len * 0.8;
            api.draw.arrow(s, gx, midY + 12, gx, deckY - 1, '#7ad7ff', '');
            label(api, s, gx + 9, Math.round((midY + deckY) / 2) + 11, 'GRAVITY', '#7ad7ff', { anchor: 'start', size: W < 300 ? 13 : 15 });
            // FRICTION at the wheels pushes back
            api.draw.arrow(s, carX - 3, FL - 6, carX - 48, FL - 6, '#ffa040', '');
            label(api, s, carX - 6, FL - 16, 'FRICTION', '#ffa040', { anchor: 'end' });
            // the FLOOR pushes up on both wheels
            [carX + r, front - r].forEach(function (wx) { api.draw.arrow(s, wx, FL + 56, wx, FL + 5, '#c0a0ff', ''); });
            label(api, s, front - r + 10, FL + 30, 'FLOOR', '#c0a0ff', { anchor: 'start' });
            label(api, s, front - r + 10, FL + 47, 'pushes up', '#c0a0ff', { anchor: 'start', size: 13, light: true });
          }
          paint();
          keepFitted(api, el, paint);
          // one short line per force (the thrust number is on the picture; Module 3 covers outrunning the wind)
          api.ui.note(el, 'tip',
            '<ul style="margin:0 0 0 18px">' +
            '<li>🟢 <strong>Thrust:</strong> the wind pushes the sail forward.</li>' +
            '<li>🟠 <strong>Friction:</strong> rubbing at the wheels holds the car back.</li>' +
            '<li>🔵 <strong>Gravity</strong> pulls down. 🟣 The <strong>floor</strong> pushes up just as hard. They cancel out.</li>' +
            '<li>🔴 <strong>Drag:</strong> air pushing <em>back</em>, only if the car outruns the wind.</li></ul>');
        }
      },
      {
        title: 'Balanced or unbalanced?',
        html:
          '<p>Forces that point opposite ways work against each other. It is like a tug of war!</p>' +
          '<p><strong>Balanced:</strong> the motion stays the same. A still car stays still. A rolling car keeps the same speed.</p>' +
          '<p><strong>Unbalanced:</strong> one force is bigger, so it wins. The car speeds up or slows down.</p>',
        challenge: 'Move the sliders so the forces are balanced. Keep the wind’s push at 10 paper clips or more.',
        render: function (el, api) {
          wordFirst(api, el, 'balanced forces', 'forces that are the same size but push opposite ways. They cancel out. ' +
            'If one force is bigger, the forces are <strong>unbalanced</strong>.');
          const s = api.svg('svg', { role: 'img', 'aria-label': 'Tug of war between the wind’s push and friction' }, el);
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const MAX = 40;
          const push = api.ui.slider(row, { label: 'Wind’s push (thrust)', min: 0, max: MAX, step: 1, value: 20, format: clipsText, onInput: draw });
          const back = api.ui.slider(row, { label: 'Friction (pushes back)', min: 0, max: MAX, step: 1, value: 8, format: clipsText, onInput: draw });
          el.appendChild(out);
          api.ui.note(el, 'tip', '📜 Isaac Newton figured this out over 300 years ago. We call it <strong>Newton’s First Law</strong>. ' +
            'Things keep doing what they are doing until an unbalanced force acts on them.');
          function draw() {
            const p = push.get(), b = back.get(), net = p - b;
            const W = boardWidth(el), H = 190, FL = 160, mid = W / 2;
            startBoard(api, s, W, H);
            api.svg('line', { x1: 12, y1: FL, x2: W - 12, y2: FL, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            const sc = W < 440 ? 2.2 : 3, len = 26 * sc, carX = Math.round(mid - len / 2), front = carX + len;
            api.draw.car(s, carX, FL, { scale: sc, length: 26, sailW: 18, sailH: 18, mastH: 26 });
            const k = (carX - 18) / MAX;                  // px per paper clip: the biggest push just fits
            const sailL = carX + len * 0.45 - 18 * sc * 0.45, sailY = Math.round(FL - 22 * sc);
            if (p > 0) {
              api.draw.arrow(s, sailL - 2 - p * k, sailY, sailL - 2, sailY, '#40e080', '');
              label(api, s, Math.min(sailL - 2 - p * k / 2, sailL - 36), sailY - 11, p + ' clips', '#40e080');   // a short arrow's label stays clear of the sail
            }
            if (b > 0) api.draw.arrow(s, front + 2 + b * k, FL - 10, front + 2, FL - 10, '#ffa040', b + ' clips', { size: 15, dy: 24 });
            if (net !== 0) {
              const end = mid + Math.max(-(mid - 20), Math.min(mid - 20, net * k)), color = net > 0 ? '#40e080' : '#ff5050';
              const str = (net > 0 ? 'push wins by ' : 'friction wins by ') + Math.abs(net) + (Math.abs(net) === 1 ? ' clip' : ' clips');
              const half = str.length * 15 * 0.3 + 6;     // about half the label's width: it stays inside the picture
              api.draw.arrow(s, mid, 42, end, 42, color, '');
              label(api, s, Math.max(half, Math.min(W - half, (mid + end) / 2)), 30, str, color);
            } else label(api, s, mid, 46, 'balanced ⚖️', '#f0c040', { size: 16 });
            out.innerHTML = net === 0
              ? '⚖️ <strong>Balanced!</strong> The car keeps doing what it was doing. If it was still, it stays still.'
              : net > 0 ? '➡️ <strong>Unbalanced!</strong> The push wins by ' + clipsText(net) + '. The car <strong>speeds up</strong>.'
                        : '⬅️ <strong>Unbalanced!</strong> Friction wins by ' + clipsText(-net) + '. A rolling car <strong>slows down</strong>. ' +
                          'A still car just stays still. (Friction can’t push a car backward.)';
            if (net === 0 && p >= 10) api.done('Balanced forces! The motion does not change. That is Newton’s First Law.');
          }
          draw();
          keepFitted(api, el, draw);
        }
      },
      {
        title: 'Try it in the hallway',
        html:
          '<p>This hallway is ' + kid.dist(HALL.length) + ' long, like ours. Two box fans sit side by side at the start.</p>' +
          '<p>The car starts rolling only if the wind’s push beats friction. The wind fades as it spreads down the hall. ' +
          'When friction wins, the car slows down and stops.</p>' +
          '<p><strong>How to test:</strong> pick a fan speed and wheels. Make a prediction. Then press ▶ Run. ' +
          'Your first test is set up: the <strong>Low</strong> fan and <strong>Jammed</strong> wheels.</p>',
        challenge: 'Change the fan and the wheels. Make the car roll at least ' + kid.dist(GOAL_FT / kid.FT_PER_M) + '.',
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
          api.ui.note(el, 'tip', '👀 Watch the arrows on the car. <span style="color:#40e080">Green</span> is the wind’s push. ' +
            '<span style="color:#ffa040">Orange</span> is friction. When green is longer, the car speeds up. When orange is longer, it slows down. ' +
            'Down the hall, the two arrows are almost the same size. So the car slows down only a little at a time.' +
            (CATCHES_UP ? ' If the car ever goes faster than the wind, the green arrow turns <span style="color:#ff5050">red</span>. ' +
                          'That is drag: the air pushes back.' : ''));
        }
      },
      {
        title: 'Real build: test your forces',
        html:
          '<p>You can feel these forces with your real car before race day.</p>' +
          '<ol><li><strong>Push test (friction):</strong> give the car a gentle push on the hallway floor. Let go. ' +
          'The farther it rolls, the less friction it has. If it stops fast, check the wheels. They should spin freely and not rub.</li>' +
          '<li><strong>Blow test (thrust):</strong> blow gently on the sail from behind. Does the car start rolling? ' +
          'Then it will start easily in front of the fans.</li>' +
          '<li><strong>Hold test (balance):</strong> hold the car lightly in front of the fans. Feel which way it wants to go. ' +
          'Does the front dip? Does it pull to one side?</li></ol>',
        render: function (el, api) {
          api.ui.note(el, 'good', '🏁 Last year’s sail sleds slid about ' + kid.dist(25 / kid.FT_PER_M) + '. The best one went ' + kid.dist(30 / kid.FT_PER_M) + '. ' +
            'Wheels that spin freely have much less friction than sliding, so your car can beat that!');
          api.ui.note(el, 'build', '🛠️ <strong>Your materials:</strong> popsicle sticks, straws, paper, pipe cleaners, cardstock, plastic wheels, ' +
            'skewers or thin dowels, tape and hot glue. Every module ends with tips for using them well.');
        }
      }
    ],
    quiz: [
      // The options in each question are about the same length, so "pick the longest" is no clue: the right
      // answer is the single longest option in at most 3 of the 10 (the check script counts it).
      { q: 'What is a force?', options: ['A push or a pull on something', 'How fast something is moving', 'How big something is', 'The energy that moving air has'], answer: 0,
        why: 'A force is any push or pull.' },
      { q: 'The wind pushes your car forward with 30 paper clips. Friction pushes back with 10. What does the car do?', options: ['It keeps speeding up', 'It slows down bit by bit', 'It keeps the same speed', 'It stops right away'], answer: 0,
        why: 'The forward push is bigger, so the forces are unbalanced. The car speeds up.' },
      { q: 'The forces on a rolling car are balanced. What happens?', options: ['It keeps speeding up', 'It slows down bit by bit', 'It keeps the same speed', 'It stops right away'], answer: 2,
        why: 'Balanced forces cancel out. The car keeps doing what it was doing.' },
      { q: 'The fans are on, but the car does not move at all. What is the most likely reason?', options: ['Gravity pulls harder than the floor pushes', 'The wind’s push can’t beat friction', 'The wind only pushes rolling cars', 'The forces on it are unbalanced'], answer: 1,
        why: 'A car only starts rolling when the push beats friction. Weak wind or jammed wheels mean no motion.' },
      { q: 'Which two forces cancel out, so the car does not sink or float?', options: ['Thrust and the air that pushes back', 'The wind’s push and friction', 'Gravity and the floor pushing up', 'Drag and friction at the wheels'], answer: 2,
        why: 'Gravity pulls the car down. The floor pushes up just as hard.' },
      { q: 'A car is rolling when the fans turn off. What happens next?', options: ['It stops the moment the fans turn off', 'It slows down bit by bit, then stops', 'It keeps rolling forever at the same speed', 'It rolls back toward the fans'], answer: 1,
        why: 'Friction and air drag push back on the moving car. They slow it down bit by bit.' },
      { q: 'Newton’s First Law says a moving thing keeps the same speed…', options: ['forever, no matter what happens to it', 'until an unbalanced force acts on it', 'only if it is very big and heavy', 'only while it is being pushed'], answer: 1,
        why: 'Motion only changes when an unbalanced force acts. For a rolling car, that force is usually friction.' },
      { q: 'In this lab, what does “a push of 30 paper clips” mean?', options: ['As hard as holding up 30 paper clips', 'A push that lasts for 30 seconds', 'A push that rolls the car 30 feet', 'A car that is 30 paper clips long'], answer: 0,
        why: 'Scientists measure force in newtons. Paper clips make the numbers easy to picture.' },
      { q: 'The fans stay on, but far down the hall your car slows down and stops. Why?', options: ['The wind fades, so friction wins', 'Gravity is stronger at the far end', 'The car gets heavier the farther it goes', 'Moving things always stop on their own'], answer: 0,
        why: 'The wind is strongest near the fans and fades down the hall. Once its push is smaller than friction, the car slows down.' },
      { q: 'Which change would most likely make your car roll farther?', options: ['More push and wheels that spin freely', 'A weaker fan and wheels that rub badly', 'Wheels that rub, so they grip the floor', 'Nothing, because all cars roll the same'], answer: 0,
        why: 'More push makes the car speed up more. Less friction lets the wind keep it rolling longer.' }
    ],
    // the hallway step's settings, for the node check script (not used by the page)
    _model: { GOAL_FT: GOAL_FT, GOAL_M: GOAL_M, FAN_V: FAN_V, WHEELS: WHEELS, START: START, CATCHES_UP: CATCHES_UP,
              PREDICT: PREDICT, judge: judge, outcome: outcome, reachesGoal: reachesGoal, fanOf: fanOf, wheelsOf: wheelsOf }
  });
})();
