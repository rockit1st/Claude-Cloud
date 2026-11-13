// Sail Car Lab — Module 1: Forces & Motion
// The reference module: every other module follows this shape.
//   steps: lesson pages. A step can have static `html`, a `render(el, api)` function, or both.
//          A step with `challenge` keeps the Next button locked until the step calls api.done().
//   quiz:  a pool of questions; the lab draws 5 of them each try (4 right = 80% to pass).
//          `answer` is the index of the right option in `options`; `why` explains it.
(function () {
  'use strict';
  // The pictures are drawn at their real on-screen width (300–560 px) and shown 1 : 1, so a 15 px
  // label is 15 px on a phone too (a fixed 560-wide drawing shrank the labels to about 6 px there).
  function boardWidth(el) { return Math.max(300, Math.min(560, Math.round(el.clientWidth || 560))); }
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

  SailLab.register({
    id: 'forces',
    num: 1,
    title: 'Forces & Motion',
    icon: '⚖️',
    blurb: 'Pushes, pulls, and why a car speeds up, slows down or stays still.',
    minutes: 10,
    steps: [
      {
        title: 'Forces are pushes and pulls',
        html:
          '<p>A <span class="key">force</span> is a push or a pull. Forces are measured in <strong>newtons (N)</strong>. ' +
          'One newton is about the weight of a small apple.</p>' +
          '<p>When your sail car is in front of the two box fans, <strong>four forces</strong> act on it at the same time. ' +
          'A fifth force, <strong>air drag</strong>, only joins in if the car moves faster than the wind:</p>',
        render: function (el, api) {
          const s = api.svg('svg', { role: 'img', 'aria-label': 'A sail car in front of two box fans. Thrust from the wind pushes it forward, friction pushes back at the wheels, gravity pulls down, the floor pushes up, and a dashed drag arrow shows the push back that only happens if the car outruns the wind.' }, el);
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
            if (W >= 440) label(api, s, tx, midY + 24, 'the wind pushes the sail', '#40e080', { size: 13, light: true });
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
            label(api, s, gx + 9, Math.round((midY + deckY) / 2) + 11, 'GRAVITY', '#7ad7ff', { anchor: 'start' });
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
          api.ui.note(el, 'tip',
            '🟢 <strong>Thrust</strong>: the fans’ wind pushes on the sail, so the car goes forward. 🟠 <strong>Friction</strong> in the wheels and axles works against the motion. ' +
            '🔵 <strong>Gravity</strong> pulls the car down, and the 🟣 <strong>floor</strong> pushes back up just as hard — those two cancel out, so the car doesn’t sink or float.');
          api.ui.note(el, 'tip',
            '🔴 <strong>Air drag</strong> (the dashed arrow) is air pushing <em>back</em> on something that moves faster than the air around it — like the push on your hand out the window of a moving car. ' +
            'Near our fans the wind is faster than the car, so the air pushes the car <em>forward</em> instead: that’s thrust. Module 3 shows what happens when a car outruns the wind.');
        }
      },
      {
        title: 'The net force decides what happens',
        html:
          '<p>Forces that point in opposite directions work against each other. The <span class="key">net force</span> is what’s left over:</p>' +
          '<p style="text-align:center;font-size:1.1rem"><strong>net force = forward forces − backward forces</strong></p>' +
          '<ul><li><strong>Balanced</strong> (net force = 0): the motion doesn’t change. A car that is still stays still; a moving car keeps the same speed.</li>' +
          '<li><strong>Unbalanced</strong>: the car <strong>speeds up</strong> in the direction of the bigger force, or <strong>slows down</strong> if the bigger force points backward.</li></ul>' +
          '<p>This is <strong>Newton’s First Law</strong>: an object keeps doing what it’s doing — staying still or moving at the same speed — unless an unbalanced force acts on it.</p>',
        challenge: 'Use the sliders to make the forces exactly balanced (net force = 0.00 N), with the fan push at least 0.10 N.',
        render: function (el, api) {
          const s = api.svg('svg', { role: 'img', 'aria-label': 'Tug of war between push and friction' }, el);
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const push = api.ui.slider(row, { label: 'Fan push (thrust)', min: 0, max: 0.4, step: 0.01, value: 0.2, format: function (v) { return v.toFixed(2) + ' N'; }, onInput: draw });
          const back = api.ui.slider(row, { label: 'Friction + drag (backward)', min: 0, max: 0.4, step: 0.01, value: 0.08, format: function (v) { return v.toFixed(2) + ' N'; }, onInput: draw });
          el.appendChild(out);
          function draw() {
            const p = push.get(), b = back.get(), net = Math.round((p - b) * 100) / 100;
            const W = boardWidth(el), H = 190, FL = 160, mid = W / 2;
            startBoard(api, s, W, H);
            api.svg('line', { x1: 12, y1: FL, x2: W - 12, y2: FL, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            const sc = W < 440 ? 2.2 : 3, len = 26 * sc, carX = Math.round(mid - len / 2), front = carX + len;
            api.draw.car(s, carX, FL, { scale: sc, length: 26, sailW: 18, sailH: 18, mastH: 26 });
            const k = (carX - 18) / 0.4;                  // px per newton: the biggest push (0.4 N) just fits
            const sailL = carX + len * 0.45 - 18 * sc * 0.45, sailY = Math.round(FL - 22 * sc);
            if (p > 0) {
              api.draw.arrow(s, sailL - 2 - p * k, sailY, sailL - 2, sailY, '#40e080', '');
              label(api, s, Math.min(sailL - 2 - p * k / 2, sailL - 36), sailY - 11, p.toFixed(2) + ' N', '#40e080');   // a short arrow's label stays clear of the sail
            }
            if (b > 0) api.draw.arrow(s, front + 2 + b * k, FL - 10, front + 2, FL - 10, '#ffa040', b.toFixed(2) + ' N', { size: 15, dy: 24 });
            if (net !== 0) api.draw.arrow(s, mid, 42, mid + Math.max(-(mid - 20), Math.min(mid - 20, net * k)), 42, net > 0 ? '#40e080' : '#ff5050', 'net ' + Math.abs(net).toFixed(2) + ' N ' + (net > 0 ? 'forward' : 'backward'), { size: 15, dy: -12 });
            else label(api, s, mid, 46, 'net force = 0 → balanced', '#f0c040', { size: 16 });
            out.innerHTML = net === 0
              ? '⚖️ <strong>Balanced!</strong> The car keeps doing what it was doing: if it was still, it stays still.'
              : net > 0 ? '➡️ <strong>Unbalanced forward</strong> by ' + net.toFixed(2) + ' N — the car <strong>speeds up</strong>.'
                        : '⬅️ <strong>Unbalanced backward</strong> by ' + Math.abs(net).toFixed(2) + ' N — a moving car <strong>slows down</strong> (a still car just stays put: friction can’t push it backward).';
            if (net === 0 && p >= 0.1) api.done('Balanced forces — no change in motion. That’s Newton’s First Law.');
          }
          draw();
          keepFitted(api, el, draw);
        }
      },
      {
        title: 'Try it in the hallway',
        html:
          '<p>Here’s a real-size hallway with two box fans side by side — just like ours. The car only <strong>starts</strong> rolling if the wind’s push beats friction. ' +
          'Then it keeps going until the wind gets too weak (it fades the farther you are from the fans) and friction wins.</p>' +
          '<p>Watch the arrows on the car while it rolls: <span style="color:#40e080">green</span> = the wind’s push, <span style="color:#ffa040">orange</span> = friction. ' +
          'While the green arrow is longer, the net force points forward and the car speeds up. Down the hall the wind fades and the green arrow shrinks; ' +
          'once it is shorter than the orange one, the car slows down. (In this hallway the car never catches up with the wind, so the air only ever pushes it forward.)</p>',
        challenge: 'Get the car to roll at least 12 metres (about 40 ft).',
        render: function (el, api) {
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const fan = api.ui.choice(row, { label: 'Fan speed', value: 'high', options: [{ value: 'low', label: 'Low' }, { value: 'med', label: 'Medium' }, { value: 'high', label: 'High' }] });
          const fric = api.ui.choice(row, { label: 'Wheels', value: 'sticky', options: [{ value: 'sticky', label: 'Rubbing & sticky' }, { value: 'ok', label: 'OK' }, { value: 'smooth', label: 'Spin freely' }] });
          // sticky 0.13: on the low fan the push (≈ 0.088 N) is less than rolling friction (≈ 0.089 N), so it never starts
          const FAN_V = { low: 1.8, med: 2.6, high: 3.5 }, CRR = { sticky: 0.13, ok: 0.03, smooth: 0.015 };
          const sim = api.ui.trackSim(el, function () { return { crr: CRR[fric.get()] }; }, {
            getOpts: function () { return { fan: { v0: FAN_V[fan.get()], L: api.physics.FAN.L } }; },
            onResult: function (r) {
              if (r.distance >= 12) api.done('It rolled ' + api.fmt(r.distance, 1) + ' m! More push and less friction = a bigger net force for longer.');
            }
          });
          api.onLeave(sim.stop);
          api.ui.note(el, 'tip', '💡 Try the sticky wheels on a low fan: the car never moves, because the wind’s push is smaller than friction. ' +
            'Friction holds the car still, so the forces are <strong>balanced</strong> — no motion.');
        }
      },
      {
        title: 'Real build: test your forces',
        html:
          '<p>You can feel these forces with your real car before race day:</p>' +
          '<ol><li><strong>Push test (friction):</strong> on the hallway floor, give the car a gentle push and let go. The farther it rolls, the less friction it has. ' +
          'If it stops fast, check that the wheels spin freely and nothing rubs.</li>' +
          '<li><strong>Blow test (thrust):</strong> blow gently on the sail from behind. A car that starts rolling from a gentle breath will start in front of the fans easily.</li>' +
          '<li><strong>Stand test (balance):</strong> set the car in front of the fans, hold it lightly, and feel which way it wants to go. Does the nose dip? Does it pull to one side?</li></ol>',
        render: function (el, api) {
          api.ui.note(el, 'build', '🛠️ <strong>Your materials:</strong> popsicle sticks, straws, paper, pipe cleaners, cardstock, plastic wheels, skewers or thin dowels, tape and hot glue. ' +
            'Every module ends with tips for using them well.');
        }
      }
    ],
    quiz: [
      { q: 'What is a force?', options: ['A push or a pull', 'How fast something moves', 'How heavy something is', 'The energy in the wind'], answer: 0,
        why: 'A force is any push or pull, measured in newtons (N).' },
      { q: 'The fans’ wind pushes the sail with 0.30 N and friction pushes back with 0.10 N. What is the net force?', options: ['0.40 N forward', '0.20 N forward', '0.20 N backward', '0 N (balanced)'], answer: 1,
        why: 'Net force = forward − backward = 0.30 − 0.10 = 0.20 N forward.' },
      { q: 'What happens to a sail car when the forces on it are balanced?', options: ['It speeds up', 'It slows down', 'Its motion doesn’t change — still stays still, moving keeps the same speed', 'It tips over'], answer: 2,
        why: 'Balanced forces (net force = 0) don’t change motion. That’s Newton’s First Law.' },
      { q: 'The fans are on, but the car doesn’t move at all. What is the most likely reason?', options: ['Gravity is too strong', 'The wind’s push is smaller than the friction holding it', 'The car is too fast', 'The wind is pushing too hard'], answer: 1,
        why: 'A car only starts rolling when the push beats friction. Weak wind or sticky wheels = no motion.' },
      { q: 'Which two forces cancel each other out, so the car doesn’t sink into the floor or float up?', options: ['Thrust and drag', 'Friction and thrust', 'Gravity and the floor pushing up', 'Drag and friction'], answer: 2,
        why: 'Gravity pulls the car down and the floor pushes up exactly as hard — they’re balanced.' },
      { q: 'A rolling car leaves the fans’ wind. Which forces slow it down?', options: ['Gravity only', 'Friction and air drag', 'Thrust', 'Nothing — it keeps rolling forever'], answer: 1,
        why: 'Friction (wheels and axles) and air drag push backward on a moving car, so it slows down and stops.' },
      { q: 'Newton’s First Law says a moving object keeps moving at the same speed…', options: ['forever, no matter what', 'unless an unbalanced force acts on it', 'only if it is heavy', 'only if the wind keeps blowing'], answer: 1,
        why: 'Objects keep their motion unless an unbalanced force changes it. In real life friction is always there (and air drag, once something moves faster than the air), which is why cars eventually stop.' },
      { q: 'Forces are measured in…', options: ['metres', 'kilograms', 'newtons', 'degrees'], answer: 2,
        why: 'Forces are measured in newtons (N). One newton is about the weight of a small apple.' },
      { q: 'The fans stay on, but far down the hallway your rolling car slows down and stops. Why?', options: ['The wind fades far from the fans, so its push gets smaller than friction', 'Gravity pulls harder at the far end of the hallway', 'The car gets heavier the farther it rolls', 'Newton’s First Law says every moving object has to stop'], answer: 0,
        why: 'The fans’ wind is strongest near the fans and fades down the hall. Once its push is smaller than friction, the net force points backward, so the car slows down and stops.' },
      { q: 'Which change would most likely make your sail car roll farther down the hallway?', options: ['A stronger push from the wind and wheels that spin more freely', 'A weaker push from the wind and wheels that rub more', 'Wheels that rub more, so the car grips the floor better', 'Nothing — every sail car rolls the same distance'], answer: 0,
        why: 'More push and less friction make a bigger forward net force that lasts farther down the hall, so the car speeds up more and goes farther.' }
    ]
  });
})();
