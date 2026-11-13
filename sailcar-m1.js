// Sail Car Lab — Module 1: Forces & Motion
// The reference module: every other module follows this shape.
//   steps: lesson pages. A step can have static `html`, a `render(el, api)` function, or both.
//          A step with `challenge` keeps the Next button locked until the step calls api.done().
//   quiz:  a pool of questions; the lab draws 5 of them each try (4 right = 80% to pass).
//          `answer` is the index of the right option in `options`; `why` explains it.
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
        '<p>When your sail car sits in front of the box fans, <strong>five forces</strong> act on it at the same time:</p>',
      render: function (el, api) {
        const s = api.svg('svg', { viewBox: '0 0 560 270', role: 'img', 'aria-label': 'A sail car with five force arrows' }, el);
        api.svg('rect', { x: 0, y: 0, width: 560, height: 270, rx: 12, fill: '#120826' }, s);
        api.svg('line', { x1: 20, y1: 200, x2: 540, y2: 200, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
        api.draw.fan(s, 30, 200, 90);
        api.draw.car(s, 250, 200, { scale: 3, length: 30, sailW: 20, sailH: 20, mastH: 30 });
        // thrust on the sail, drag on the front, friction at the wheels, gravity down, floor up
        api.draw.arrow(s, 110, 120, 238, 120, '#40e080', 'THRUST: wind pushes the sail');
        api.draw.arrow(s, 470, 128, 305, 128, '#ff5050', 'DRAG: air pushes back', { dx: 30, dy: -12 });
        api.draw.arrow(s, 320, 212, 258, 212, '#ffa040', 'FRICTION', { dy: 22 });
        api.draw.arrow(s, 300, 150, 300, 190, '#7ad7ff', 'GRAVITY', { dx: 34, dy: 4 });
        api.draw.arrow(s, 259, 255, 259, 208, '#c0a0ff', '', {});
        api.draw.arrow(s, 341, 255, 341, 208, '#c0a0ff', '', {});
        api.svg('text', { x: 400, y: 248, fill: '#c0a0ff', 'font-size': 12, 'font-weight': 700, class: 'sl-lbl' }, s, 'FLOOR pushes up');
        api.ui.note(el, 'tip',
          '🟢 <strong>Thrust</strong> pushes the car forward. 🔴 <strong>Drag</strong> (air resistance) and 🟠 <strong>friction</strong> work against the motion. ' +
          '🔵 <strong>Gravity</strong> pulls the car down, and the 🟣 <strong>floor</strong> pushes back up just as hard — those two cancel out, so the car doesn’t sink or float.');
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
        const s = api.svg('svg', { viewBox: '0 0 560 170', role: 'img', 'aria-label': 'Tug of war between push and friction' }, el);
        const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
        const row = api.h('div', { class: 'sl-row' });
        el.appendChild(row);
        const push = api.ui.slider(row, { label: 'Fan push (thrust)', min: 0, max: 0.4, step: 0.01, value: 0.2, format: function (v) { return v.toFixed(2) + ' N'; }, onInput: draw });
        const back = api.ui.slider(row, { label: 'Friction + drag (backward)', min: 0, max: 0.4, step: 0.01, value: 0.08, format: function (v) { return v.toFixed(2) + ' N'; }, onInput: draw });
        el.appendChild(out);
        function draw() {
          const p = push.get(), b = back.get(), net = Math.round((p - b) * 100) / 100;
          s.textContent = '';
          api.svg('rect', { x: 0, y: 0, width: 560, height: 170, rx: 12, fill: '#120826' }, s);
          api.svg('line', { x1: 20, y1: 140, x2: 540, y2: 140, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
          api.draw.car(s, 250, 140, { scale: 2.2, length: 26, sailW: 18, sailH: 18, mastH: 26 });
          const k = 500;
          if (p > 0) api.draw.arrow(s, 250 - p * k, 70, 250, 70, '#40e080', p.toFixed(2) + ' N');
          if (b > 0) api.draw.arrow(s, 320 + b * k, 120, 320, 120, '#ffa040', b.toFixed(2) + ' N', { dy: 20 });
          if (net !== 0) api.draw.arrow(s, 285, 30, 285 + Math.max(-140, Math.min(140, net * k)), 30, net > 0 ? '#40e080' : '#ff5050', 'net ' + Math.abs(net).toFixed(2) + ' N ' + (net > 0 ? 'forward' : 'backward'));
          else api.svg('text', { x: 285, y: 34, 'text-anchor': 'middle', fill: '#f0c040', 'font-size': 14, 'font-weight': 700 }, s, 'net force = 0 → balanced');
          out.innerHTML = net === 0
            ? '⚖️ <strong>Balanced!</strong> The car keeps doing what it was doing: if it was still, it stays still.'
            : net > 0 ? '➡️ <strong>Unbalanced forward</strong> by ' + net.toFixed(2) + ' N — the car <strong>speeds up</strong>.'
                      : '⬅️ <strong>Unbalanced backward</strong> by ' + Math.abs(net).toFixed(2) + ' N — a moving car <strong>slows down</strong> (a still car just stays put: friction can’t push it backward).';
          if (net === 0 && p >= 0.1) api.done('Balanced forces — no change in motion. That’s Newton’s First Law.');
        }
        draw();
      }
    },
    {
      title: 'Try it in the hallway',
      html:
        '<p>Here’s a real-size hallway with two box fans side by side — just like ours. The car only <strong>starts</strong> rolling if the wind’s push beats friction. ' +
        'Then it keeps going until the wind gets too weak (it fades the farther you are from the fans) and friction wins.</p>' +
        '<p>Watch the arrows on the car while it rolls: <span style="color:#40e080">green</span> = wind push, <span style="color:#ff5050">red</span> = air drag, <span style="color:#ffa040">orange</span> = friction.</p>',
      challenge: 'Get the car to roll at least 12 metres (about 40 ft).',
      render: function (el, api) {
        const row = api.h('div', { class: 'sl-row' });
        el.appendChild(row);
        const fan = api.ui.choice(row, { label: 'Fan speed', value: 'high', options: [{ value: 'low', label: 'Low' }, { value: 'med', label: 'Medium' }, { value: 'high', label: 'High' }] });
        const fric = api.ui.choice(row, { label: 'Wheels', value: 'sticky', options: [{ value: 'sticky', label: 'Rubbing & sticky' }, { value: 'ok', label: 'OK' }, { value: 'smooth', label: 'Spin freely' }] });
        const FAN_V = { low: 1.8, med: 2.6, high: 3.5 }, CRR = { sticky: 0.12, ok: 0.03, smooth: 0.015 };
        const sim = api.ui.trackSim(el, function () { return { crr: CRR[fric.get()] }; }, {
          getOpts: function () { return { fan: { v0: FAN_V[fan.get()], L: api.physics.FAN.L } }; },
          onResult: function (r) {
            if (r.distance >= 12) api.done('It rolled ' + api.fmt(r.distance, 1) + ' m! More push and less friction = a bigger net force for longer.');
          }
        });
        api.onLeave(sim.stop);
        api.ui.note(el, 'tip', '💡 Try the sticky wheels on a low fan: the car never moves, because the push is smaller than friction. That’s <strong>balanced</strong> (well, friction-locked) — no motion.');
      }
    },
    {
      title: 'Real build: test your forces',
      html:
        '<p>You can feel these forces with your real car before race day:</p>' +
        '<ol><li><strong>Push test (friction):</strong> on the hallway floor, give the car a gentle push and let go. The farther it rolls, the less friction it has. ' +
        'If it stops fast, check that the wheels spin freely and nothing rubs.</li>' +
        '<li><strong>Blow test (thrust):</strong> blow gently on the sail from behind. A car that starts rolling from a gentle breath will start in front of the fan easily.</li>' +
        '<li><strong>Stand test (balance):</strong> set the car in front of the fan, hold it lightly, and feel which way it wants to go. Does the nose dip? Does it pull to one side?</li></ol>',
      render: function (el, api) {
        api.ui.note(el, 'build', '🛠️ <strong>Your materials:</strong> popsicle sticks, straws, paper, pipe cleaners, cardstock, plastic wheels, skewers or thin dowels, tape and hot glue. ' +
          'Every module ends with tips for using them well.');
      }
    }
  ],
  quiz: [
    { q: 'What is a force?', options: ['A push or a pull', 'How fast something moves', 'How heavy something is', 'The energy in the wind'], answer: 0,
      why: 'A force is any push or pull, measured in newtons (N).' },
    { q: 'The fan pushes the sail with 0.30 N and friction pushes back with 0.10 N. What is the net force?', options: ['0.40 N forward', '0.20 N forward', '0.20 N backward', '0 N (balanced)'], answer: 1,
      why: 'Net force = forward − backward = 0.30 − 0.10 = 0.20 N forward.' },
    { q: 'What happens to a sail car when the forces on it are balanced?', options: ['It speeds up', 'It slows down', 'Its motion doesn’t change — still stays still, moving keeps the same speed', 'It tips over'], answer: 2,
      why: 'Balanced forces (net force = 0) don’t change motion. That’s Newton’s First Law.' },
    { q: 'The fan is on, but the car doesn’t move at all. What is the most likely reason?', options: ['Gravity is too strong', 'The wind’s push is smaller than the friction holding it', 'The car is too fast', 'The floor pushes it backward'], answer: 1,
      why: 'A car only starts rolling when the push beats friction. Weak wind or sticky wheels = no motion.' },
    { q: 'Which two forces cancel each other out, so the car doesn’t sink into the floor or float up?', options: ['Thrust and drag', 'Friction and thrust', 'Gravity and the floor pushing up', 'Drag and friction'], answer: 2,
      why: 'Gravity pulls the car down and the floor pushes up exactly as hard — they’re balanced.' },
    { q: 'A rolling car leaves the fan’s wind. Which forces slow it down?', options: ['Gravity only', 'Friction and air drag', 'Thrust', 'Nothing — it keeps rolling forever'], answer: 1,
      why: 'Friction (wheels and axles) and air drag push backward on a moving car, so it slows down and stops.' },
    { q: 'Newton’s First Law says a moving object keeps moving at the same speed…', options: ['forever, no matter what', 'unless an unbalanced force acts on it', 'only if it is heavy', 'only if the wind keeps blowing'], answer: 1,
      why: 'Objects keep their motion unless an unbalanced force changes it. In real life friction and drag are always there, which is why cars eventually stop.' },
    { q: 'Forces are measured in…', options: ['metres', 'kilograms', 'newtons', 'degrees'], answer: 2,
      why: 'Forces are measured in newtons (N). One newton is about the weight of a small apple.' }
  ]
});
