// Sail Car Lab — Module 5: Mass & Inertia
// Newton's Second Law (acceleration = net force ÷ mass), inertia, and the hallway twist: mass also adds
// rolling friction (crr × mass × 9.81), so lighter cars usually roll farther — until the car is so light
// that the push high on the sail flips it forward. Every number comes from SailLab.physics
// (airForce, windAt, rollingFriction, simulate) — the same model the hallway and Design Studio use.
(function () {
  'use strict';
  const P = SailLab.physics, D = P.DEFAULT_CAR, G = P.G;
  const START = 0.3;                                    // the start line: 30 cm from the two fans (simulate's default startX)
  // the wind's push on the default car (20 × 20 cm sail + chassis) sitting still at the start line
  const SAIL0 = P.airForce(P.windAt(START), D.sailArea, D.sailCd, D.sailAngle);
  const PUSH0 = SAIL0 + P.airForce(P.windAt(START), D.bodyArea, D.bodyCd, 0);
  // the same tipping rule simulate() uses at the start line: the push high on the sail beats the weight holding the back down
  function tips(g) { return SAIL0 * (D.sailHeight - D.cgHeight) > (g / 1000) * G * D.cgToFront; }
  const TIP_G = SAIL0 * (D.sailHeight - D.cgHeight) / (G * D.cgToFront) * 1000;   // ≈ 40 g: lighter than this, the default car flips
  const HALL_GOAL = 18;                                 // Step 4: metres to beat (about 59 ft)
  const grams = function (v) { return v + ' g'; };
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
  // the car's mass as blocks on its deck (1 block = 25 g, plus a part-block for the rest) so you can SEE it
  function blocks(api, s, x, deckY, g, bw, bh, per) {
    for (let i = 0; i * 25 < g; i++) {
      const part = Math.min(1, (g - i * 25) / 25);
      api.svg('rect', { x: x + (i % per) * (bw + 1), y: deckY - (Math.floor(i / per) + 1) * (bh + 1), width: bw * part, height: bh, rx: 1,
        fill: '#c0563a', stroke: '#ff9a70', 'stroke-width': 0.8 }, s);
    }
  }
  // Step 3's mass budget: approximate masses of the students' real materials
  const PARTS = [
    { name: 'Popsicle stick', each: 2, n: 0, grp: 1 }, { name: 'Jumbo craft stick', each: 4, n: 6, grp: 1 },
    { name: 'Plastic wheel', each: 4, n: 4, grp: 0 }, { name: 'Skewer or dowel', each: 1, n: 3, grp: 3 },
    { name: 'Straw', each: 0.5, n: 2, grp: 3 }, { name: 'Paper (1 sheet)', each: 4.5, n: 0, grp: 2 },
    { name: 'Cardstock (1 sheet)', each: 10, n: 1, grp: 2 }, { name: 'Hot glue (1 dot)', each: 0.5, n: 20, grp: 4 },
    { name: 'Tape (10 cm)', each: 0.3, n: 5, grp: 4 }, { name: 'Pipe cleaner', each: 1.5, n: 2, grp: 5 }
  ];
  const GROUPS = [['Wheels', '#40e080'], ['Sticks', '#d8b070'], ['Sail', '#f0e6ff'], ['Skewers & straws', '#7ad7ff'], ['Glue & tape', '#ff9a70'], ['Pipe cleaners', '#ff5fa0']];
  function tenths(t) { return (t % 10 ? (t / 10).toFixed(1) : String(t / 10)) + ' g'; }   // masses are added up in tenths of a gram (no rounding errors)

  SailLab.register({
    id: 'mass',
    num: 5,
    title: 'Mass & Inertia',
    icon: '🧱',
    blurb: 'Why the same push speeds up a light car faster — and how light is too light.',
    minutes: 15,
    steps: [
      {
        title: 'Same push, different mass',
        html:
          '<p>Push an empty shopping cart and it zooms away. Push a full one just as hard and it barely creeps. The difference is <span class="key">mass</span>: how much “stuff” is in something. ' +
          'We measure mass in grams (g) or kilograms (kg). 1000 g = 1 kg, so 150 g = 0.150 kg.</p>' +
          '<p><strong>Newton’s Second Law</strong> tells you exactly how mass matters:</p>' +
          '<p style="text-align:center;font-size:1.1rem"><strong>acceleration = net force ÷ mass</strong></p>' +
          '<p><span class="key">Acceleration</span> is how much speed the car gains every second. It’s measured in m/s², which means “metres per second, every second.” ' +
          'Example: 0.20 N ÷ 0.100 kg = 2 m/s², so the car gains 2 m/s of speed each second.</p>' +
          '<p>Below, two cars race to a line 1 metre away. The top car is a light 50 g car with a 0.10 N push. You control the bottom car. Each red block is 25 g.</p>',
        challenge: 'Make YOUR car 150 g or heavier, then find the push that makes it TIE the light car. Press ▶ Race to check.',
        render: function (el, api) {
          const H = 250, s = board(api, el, H, 'A race to a line 1 metre away between a light car and your car');
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const pushS = api.ui.slider(row, { label: 'Push on YOUR car (net force)', min: 0.05, max: 0.4, step: 0.05, value: 0.1, format: function (v) { return v.toFixed(2) + ' N'; }, onInput: reset });
          const massS = api.ui.slider(row, { label: 'YOUR car’s mass', min: 25, max: 200, step: 25, value: 150, format: grams, onInput: reset });
          const go = api.h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: '▶ Race' });
          el.appendChild(api.h('div', { class: 'sl-ctrl' }, [go]));
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const LIGHT = { push: 0.1, g: 50 }, X0 = 140, X1 = 530, FL = [108, 218], LEN = 26 * 2.2;
          let raf = null;
          function accel(push, g) { return push / (g / 1000); }
          function timeTo1m(a) { return Math.sqrt(2 / a); }           // from a standing start: distance = ½ × a × t²
          function cars() { return [{ name: 'Light car', push: LIGHT.push, g: LIGHT.g, color: '#7ad7ff' }, { name: 'Your car', push: pushS.get(), g: massS.get(), color: '#f0c040' }]; }
          function scene(t) {
            clear(api, s, H);
            [[X0, 'start'], [X1, '1 m']].forEach(function (m) { label(api, s, m[0], 242, m[1], { anchor: 'middle', color: '#9080b0', size: 16, bold: false }); });
            cars().forEach(function (c, i) {
              const a = accel(c.push, c.g), d = t == null ? 0 : Math.min(1, 0.5 * a * t * t), back = X0 + d * (X1 - X0) - LEN, fl = FL[i];
              api.svg('line', { x1: 10, y1: fl, x2: 550, y2: fl, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
              [X0, X1].forEach(function (x) { api.svg('line', { x1: x, y1: fl - 64, x2: x, y2: fl, stroke: '#f0c040', 'stroke-width': 2, 'stroke-dasharray': '5,5', opacity: 0.7 }, s); });
              label(api, s, 14, fl - 76, c.name + ': ' + c.g + ' g, push ' + c.push.toFixed(2) + ' N', { color: c.color, size: 19 });
              api.draw.car(s, back, fl, { scale: 2.2, length: 26, sailW: 18, sailH: 18, mastH: 24 });
              blocks(api, s, back + 30, fl - 15.4, c.g, 11, 7, 2);
              api.draw.arrow(s, back + 6 - c.push * 150, fl - 43, back + 6, fl - 43, '#40e080', '', { width: 4 });
            });
          }
          function explain(extra) {
            const p = pushS.get(), g = massS.get();
            say(api, out, ['Light car: 0.10 N ÷ 0.050 kg = ', [api.fmt(accel(LIGHT.push, LIGHT.g), 2) + ' m/s²'], '. Your car: ' + p.toFixed(2) + ' N ÷ ' + (g / 1000).toFixed(3) + ' kg = ',
              [api.fmt(accel(p, g), 2) + ' m/s²'], '. '].concat(extra || ['Press ▶ Race!']));
          }
          function stop() { if (raf) cancelAnimationFrame(raf); raf = null; go.disabled = false; }
          function reset() { stop(); scene(null); explain(); }
          function finish() {
            const aL = accel(LIGHT.push, LIGHT.g), aY = accel(pushS.get(), massS.get()), tie = Math.abs(aL - aY) < 1e-6;
            const times = '🏁 Light car: ' + api.fmt(timeTo1m(aL), 2) + ' s. Your car: ' + api.fmt(timeTo1m(aY), 2) + ' s. ';
            if (!tie) explain([times, [aY > aL ? 'Your car wins!' : 'The light car wins.'], ' A tie needs the same acceleration.']);
            else if (massS.get() < 150) explain([times, ['A tie!'], ' Now try it with a car of 150 g or more.']);
            else {
              explain([times, ['A tie!'], ' Your car has ' + massS.get() / LIGHT.g + '× the mass, so it needed ' + massS.get() / LIGHT.g + '× the push.']);
              api.done('A heavier car needs a bigger push to speed up just as fast. Acceleration = net force ÷ mass: that’s Newton’s Second Law!');
            }
          }
          go.addEventListener('click', function () {
            stop();
            const tEnd = Math.max(timeTo1m(accel(LIGHT.push, LIGHT.g)), timeTo1m(accel(pushS.get(), massS.get()))), t0 = performance.now();
            go.disabled = true;
            function frame(now) {
              const t = Math.min(tEnd, (now - t0) / 1000);
              scene(t);
              if (t < tEnd) { raf = requestAnimationFrame(frame); return; }
              raf = null; go.disabled = false; finish();
            }
            raf = requestAnimationFrame(frame);
          });
          api.onLeave(stop);
          reset();
        }
      },
      {
        title: 'Inertia — and a hidden catch',
        html:
          '<p><span class="key">Inertia</span> is the way every object keeps doing what it’s already doing. The more mass something has, the more inertia it has:</p>' +
          '<ul><li><strong>Harder to start:</strong> a heavy car needs a bigger push to get going (you saw that in the race).</li>' +
          '<li><strong>Harder to stop:</strong> a heavy rolling car needs a bigger force to stop it. Catching a rolling bowling ball is harder than catching a rolling soccer ball!</li></ul>' +
          '<p>Here’s the catch in the hallway: a heavier car also presses down harder on its wheels and axles, so they rub more. More mass = <strong>more friction</strong>:</p>' +
          '<p style="text-align:center;font-size:1.1rem"><strong>friction = 0.025 × mass × 9.81</strong></p>' +
          '<p>Mass × 9.81 is the car’s <span class="key">weight</span> in newtons (mass in kg). The 0.025 is the friction number for a typical car’s wheels. ' +
          'Slide the mass and watch what happens at the start line, where the wind from our two box fans pushes the car with about ' + SailLab.fmt(PUSH0, 2) + ' N.</p>',
        render: function (el, api) {
          const H = 290, s = board(api, el, H, 'Forces on the car at the start line, and how quickly it speeds up and slows down');
          const mS = api.ui.slider(el, { label: 'Car mass', min: 25, max: 200, step: 5, value: 70, format: grams, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          api.ui.note(el, 'good', '🤯 <strong>Surprise!</strong> Friction ÷ mass = 0.025 × 9.81 ≈ <strong>0.25 m/s²</strong> for <em>every</em> mass. ' +
            'A heavy car has more friction, but it also has more inertia for that friction to slow down. The two cancel out! ' +
            'So friction by itself slows a light car and a heavy car at the same rate. The light car wins because the wind gave it much <strong>more speed</strong> first.');
          const K = 520 / 14;                                   // meter: px per m/s² (0 … 14 m/s²; a 25 g car would get about 13)
          function meter(y, text, val, color) {
            label(api, s, 20, y, text, { color: color, size: 17 });
            api.svg('rect', { x: 20, y: y + 8, width: 520, height: 14, rx: 7, fill: '#2a1a4a' }, s);
            api.svg('rect', { x: 20, y: y + 8, width: Math.max(4, val * K), height: 14, rx: 7, fill: color }, s);
          }
          function draw() {
            const g = mS.get(), m = g / 1000, wt = m * G, fr = P.rollingFriction(m, D.crr), a = (PUSH0 - fr) / m;
            clear(api, s, H);
            api.svg('line', { x1: 14, y1: 150, x2: 546, y2: 150, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            api.draw.fan(s, 22, 150, 90, ' ');                // our own, bigger "2 FANS" label (readable on a phone)
            label(api, s, 36, 172, '2 FANS', { anchor: 'middle', color: '#9080b0', size: 16 });
            api.draw.car(s, 300, 150, { scale: 3, length: 30, sailW: 20, sailH: 20, mastH: 30 });
            blocks(api, s, 345, 129, g, 13, 8, 3);
            api.draw.arrow(s, 95, 74, 311, 74, '#40e080', 'wind push ' + api.fmt(PUSH0, 2) + ' N', { size: 16 });
            api.draw.arrow(s, 300, 164, 300 - Math.max(8, fr * 1500), 164, '#ffa040', 'friction ' + api.fmt(fr, 3) + ' N', { size: 16, dy: 22, dx: -40 });
            api.draw.arrow(s, 345, 128, 345, 128 + Math.max(12, wt * 22), '#7ad7ff', '', { width: 4 });     // weight presses the car down on its wheels
            label(api, s, 358, 172, 'weight ' + api.fmt(wt, 2) + ' N', { color: '#7ad7ff', size: 16 });
            const flip = tips(g);
            if (flip) meter(212, '⚠ It tips over! (If it didn’t: ' + api.fmt(a, 1) + ' m/s²)', a, '#ff5050');
            else meter(212, 'Speeds up at the start line: ' + api.fmt(a, 1) + ' m/s²', a, '#40e080');
            meter(258, 'Friction alone slows it: ' + api.fmt(fr / m, 2) + ' m/s² (never changes!)', fr / m, '#ffa040');
            say(api, out, ['⚖️ ' + g + ' g car: weight = ' + m.toFixed(3) + ' kg × 9.81 = ', [api.fmt(wt, 2) + ' N'], '. Friction = 0.025 × ' + api.fmt(wt, 2) + ' N = ', [api.fmt(fr, 3) + ' N'],
              '. At the start line: (' + api.fmt(PUSH0, 2) + ' − ' + api.fmt(fr, 3) + ') N ÷ ' + m.toFixed(3) + ' kg ≈ ', [api.fmt(a, 1) + ' m/s²'], ' of speed-up.']
              .concat(flip ? [' ⚠️ But a car this light ', ['tips onto its nose'], ': the strong push high on the sail beats the weight holding its back down. You’ll test this in Step 4.'] : []));
          }
          draw();
        }
      },
      {
        title: 'Weigh your car: a mass budget',
        html:
          '<p>Engineers keep a <span class="key">mass budget</span>: a list of every part and its mass, added up. It shows where the grams come from <em>before</em> you build.</p>' +
          '<p>Here is a first-draft car. The part masses are <strong>approximate</strong> — your own sticks and wheels may be a little different. Use − and + to change the parts.</p>' +
          '<p>Careful: our two box fans push hard at the start line, so a car can be <em>too</em> light. The checklist under the chart also tells you what the hallway simulator says — including whether your car would tip over.</p>',
        challenge: 'Trim this 68.5 g first-draft car to 50 g or less. Keep it a complete car (every item on the checklist ✓) that the simulator says won’t tip over.',
        render: function (el, api) {
          const parts = PARTS.map(function (p) { return Object.assign({}, p); });
          const CELL = 'padding:6px 4px;white-space:normal';
          const tb = api.h('tbody'), totalCell = api.h('td', { style: CELL + ';font-weight:700;color:#f0c040' });
          el.appendChild(api.h('div', { class: 'sl-table-wrap' }, [api.h('table', { class: 'sl-table' }, [
            api.h('thead', null, [api.h('tr', null, [api.h('th', { style: CELL, text: 'Part' }), api.h('th', { style: CELL, text: 'How many' }), api.h('th', { style: CELL, text: 'Mass' })])]),
            tb,
            api.h('tfoot', null, [api.h('tr', null, [api.h('td', { style: CELL + ';font-weight:700', text: 'Total' }), api.h('td', { style: CELL }), totalCell])])
          ])]));
          const cells = parts.map(function (p) {
            const cnt = api.h('span', { style: 'display:inline-block;min-width:2.2em;text-align:center;font-weight:700' }), sub = api.h('td', { style: CELL });
            function btn(txt, d, what) {
              return api.h('button', { type: 'button', class: 'sl-btn', style: 'padding:3px 11px', text: txt, 'aria-label': what + ' ' + p.name,
                onclick: function () { p.n = Math.max(0, Math.min(40, p.n + d)); update(); } });
            }
            tb.appendChild(api.h('tr', null, [
              api.h('td', { style: CELL }, [p.name, api.h('br'), api.h('span', { style: 'color:#9080b0;font-size:0.8rem', text: '≈ ' + p.each + ' g each' })]),
              api.h('td', { style: CELL }, [btn('−', -1, 'One less'), cnt, btn('+', 1, 'One more')]), sub]));
            return { cnt: cnt, sub: sub };
          });
          const H = 196, s = board(api, el, H, 'Bar showing where the grams in your car come from');
          const check = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(check);
          api.ui.note(el, 'warn', '⚖️ Wheels and cardstock are the heavy parts. Hot glue adds up fast too: 20 dots ≈ 10 g!');
          function update() {
            const byGrp = GROUPS.map(function () { return 0; });
            let tot = 0;
            parts.forEach(function (p, i) {
              const t = Math.round(p.each * 10) * p.n;
              cells[i].cnt.textContent = p.n; cells[i].sub.textContent = tenths(t);
              byGrp[p.grp] += t; tot += t;
            });
            totalCell.textContent = tenths(tot);
            // the bar: where the grams are, with the 50 g goal marked
            clear(api, s, H);
            label(api, s, 20, 28, 'Where the grams are: ' + tenths(tot), { color: '#f0e6ff', size: 19 });
            const k = 520 / Math.max(80, tot / 10);
            let x = 20;
            byGrp.forEach(function (t, i) { if (t) api.svg('rect', { x: x, y: 42, width: t / 10 * k, height: 36, fill: GROUPS[i][1], stroke: '#120826', 'stroke-width': 1.5 }, s); x += t / 10 * k; });
            api.svg('line', { x1: 20 + 50 * k, y1: 36, x2: 20 + 50 * k, y2: 84, stroke: '#f0c040', 'stroke-width': 3, 'stroke-dasharray': '5,4' }, s);
            label(api, s, 20 + 50 * k, 103, 'goal: 50 g', { anchor: 'middle', color: '#f0c040', size: 17 });
            GROUPS.forEach(function (gr, i) {
              const lx = i % 2 ? 290 : 20, ly = 134 + Math.floor(i / 2) * 26;
              api.svg('rect', { x: lx, y: ly - 14, width: 16, height: 16, rx: 3, fill: gr[1] }, s);
              label(api, s, lx + 24, ly, gr[0] + ' ' + tenths(byGrp[i]), { size: 17, bold: false });
            });
            // is it still a complete car?
            const c = parts.map(function (p) { return p.n; });
            const rules = [['4 wheels', c[2] >= 4], ['3 skewers: 2 axles + 1 mast', c[3] >= 3], ['2 straws to hold the axles', c[4] >= 2],
              ['3 or more sticks for the frame', c[0] + c[1] >= 3], ['a sail: 1 sheet of paper or cardstock', c[5] + c[6] >= 1], ['6 or more joints (glue dots or tape strips)', c[7] + c[8] >= 6]];
            const complete = rules.every(function (r) { return r[1]; });
            check.textContent = '';
            check.appendChild(api.h('strong', { text: complete ? '✅ Complete car — it has everything it needs:' : '🔧 Not a complete car yet. It needs:' }));
            check.appendChild(api.h('ul', { style: 'list-style:none;margin:6px 0 4px 4px' }, rules.map(function (r) {
              return api.h('li', { style: 'margin:0;color:' + (r[1] ? '#80f0b0' : '#ffb0b0'), text: (r[1] ? '✓ ' : '✗ ') + r[0] });
            })));
            if (complete) {
              const r = P.simulate({ mass: tot / 10000 }), flipped = r.reason === 'tipped over';
              say(api, check.appendChild(api.h('div')), flipped
                ? ['⚠️ With a 20 × 20 cm sail, the hallway simulator says this car ', ['tips onto its nose'], ' at the start line. It’s too light to hold its back end down. Add a few grams back (Step 4 shows why).']
                : ['🏁 With a 20 × 20 cm sail and typical wheels, the hallway simulator says this car rolls about ', [api.fmt(r.distance, 1) + ' m'], ' (about ' + Math.round(r.distance * 3.281) + ' ft).']);
              if (tot <= 500 && !flipped) api.done('A complete car at 50 g or less that stays on its wheels! Small swaps (jumbo → popsicle sticks, cardstock → paper, fewer glue dots) add up — and the lighter car rolls farther.');
            }
          }
          update();
        }
      },
      {
        title: 'Hallway challenge: light, but not too light',
        html:
          '<p>Now let’s see what mass does in the hallway. Light cars usually win, for two reasons:</p>' +
          '<ul><li><strong>Faster speed-up:</strong> the same wind push gives a light car more acceleration (force ÷ mass).</li>' +
          '<li><strong>Less friction:</strong> far from the fans the wind gets weak. A light car has so little friction that even weak wind keeps pushing it.</li></ul>' +
          '<p>But watch out! The wind pushes <strong>high</strong> on the sail, and two box fans push hard right at the start line. That push tries to flip the car forward over its front wheels. ' +
          'The car’s <strong>weight</strong> is what holds its back end down. Make the car too light and the push wins: it <strong>tips over</strong>.</p>',
        challenge: 'Find a mass that rolls FARTHER than ' + HALL_GOAL + ' metres (about 59 ft) without tipping over.',
        render: function (el, api) {
          const log = [];
          // changing the mass clears the hallway, so a run with the old mass can't finish (and count) after the slider moves
          const massS = api.ui.slider(el, { label: 'Total mass of the car (20 × 20 cm sail, typical wheels)', min: 20, max: 200, step: 5, value: 150, format: grams, onInput: function () { sim.reset(); } });
          const sim = api.ui.trackSim(el, function () { return { mass: massS.get() / 1000 }; }, {
            scaleM: 25,                                     // same scale every run (the hallway is 30 m), so runs are easy to compare
            onResult: function (r) {
              const g = Math.round(r.car.mass * 1000), flipped = r.reason === 'tipped over';
              log.push({ g: g, d: r.distance, tipped: flipped });
              if (log.length > 30) log.shift();
              chart();
              if (!flipped && r.distance > HALL_GOAL) api.done('It rolled ' + api.fmt(r.distance, 1) + ' m (about ' + Math.round(r.distance * 3.281) + ' ft) at ' + g + ' g! Lighter = farther… but below about ' + Math.round(TIP_G) + ' g this car flips. That’s its lightest safe mass.');
            }
          });
          api.onLeave(sim.stop);
          const H = 250, s = board(api, el, H, 'Chart of your runs: car mass and how far it rolled');
          function X(g) { return 75 + (g - 20) / 180 * 455; }
          function Y(m) { return 205 - m / 25 * 160; }
          function chart() {
            clear(api, s, H);
            label(api, s, 20, 28, 'Your runs', { color: '#f0e6ff', size: 19 });
            api.svg('circle', { cx: 300, cy: 22, r: 7, fill: '#40e080' }, s);
            label(api, s, 313, 28, 'rolled', { size: 17, bold: false });
            api.svg('path', { d: 'M 392,16 l 12,12 m 0,-12 l -12,12', stroke: '#ff5050', 'stroke-width': 3 }, s);
            label(api, s, 412, 28, 'tipped over', { size: 17, bold: false });
            for (let m = 0; m <= 25; m += 5) {
              api.svg('line', { x1: X(20), y1: Y(m), x2: X(200), y2: Y(m), stroke: m ? '#2a1a4a' : '#4a3a6a', 'stroke-width': m ? 1 : 2 }, s);
              label(api, s, 64, Y(m) + 6, m + ' m', { anchor: 'end', color: '#9080b0', size: 17, bold: false });
            }
            for (let g = 50; g <= 200; g += 50) label(api, s, X(g), 232, g + ' g', { anchor: 'middle', color: '#9080b0', size: 17, bold: false });
            api.svg('line', { x1: X(20), y1: Y(HALL_GOAL), x2: X(200), y2: Y(HALL_GOAL), stroke: '#f0c040', 'stroke-width': 2, 'stroke-dasharray': '6,5' }, s);
            label(api, s, X(200), Y(HALL_GOAL) + 22, 'goal: farther than ' + HALL_GOAL + ' m', { anchor: 'end', color: '#f0c040', size: 17 });
            if (!log.length) label(api, s, 300, Y(8) + 6, 'Run the car to add a dot here.', { anchor: 'middle', color: '#9080b0', size: 17, bold: false });
            log.forEach(function (r, i) {
              const x = X(r.g), y = Y(r.d), last = i === log.length - 1;
              if (r.tipped) api.svg('path', { d: 'M ' + (x - 6) + ',' + (y - 14) + ' l 12,12 m 0,-12 l -12,12', stroke: '#ff5050', 'stroke-width': last ? 4 : 3 }, s);
              else api.svg('circle', { cx: x, cy: y, r: last ? 7 : 5, fill: '#40e080', stroke: last ? '#fff' : 'none', 'stroke-width': 2 }, s);
            });
          }
          chart();
          api.ui.note(el, 'tip', '💡 Start at 150 g and work your way down. Watch the dots: what happens to the distance as the car gets lighter? What happens when it gets <em>too</em> light?');
          api.ui.note(el, 'good', '🔮 <strong>Coming up in Module 6:</strong> tricks that stop a light car from flipping — so it can be lighter AND safe.');
        }
      },
      {
        title: 'Real build: make it light (but not too light)',
        html:
          '<p>Here’s how to use mass to your advantage on your real car:</p>' +
          '<ul><li><strong>Weigh it.</strong> Use a kitchen scale or postal scale that reads in grams. Weigh parts before you glue them, then weigh the finished car. No scale? Use a mass budget like the one in Step 3.</li>' +
          '<li><strong>Glue smart.</strong> A small dot of hot glue (about 0.5 g) holds a joint fine. Big blobs just add grams. Glue only where two parts touch.</li>' +
          '<li><strong>Trim the extras.</strong> Cut off stick ends that hang past the frame, skewer ends that poke out far past the wheels (leave a few millimetres so the wheels stay on), and any mast sticking up above the sail.</li>' +
          '<li><strong>Know your heavy parts.</strong> Wheels (≈ 4 g each) and cardstock (≈ 10 g a sheet) are the heaviest. Use just 4 wheels, try a paper sail, and use regular popsicle sticks instead of jumbo ones where they’re strong enough.</li>' +
          '<li><strong>Skip the extras.</strong> Decorations, extra pipe cleaners and “just in case” tape all add mass and friction.</li>' +
          '<li><strong>But don’t go too light!</strong> If the sail flips your car onto its nose, add a little weight near the <strong>back</strong> axle (a coin or a pipe cleaner) or lower the sail. Module 6 shows you more fixes.</li></ul>' +
          '<p><strong>Test it in the hallway:</strong></p>' +
          '<ol><li><strong>Flick test (inertia):</strong> with the fans off, give your car a gentle flick. Tape 2 nickels (about 5 g each) on top and flick it the same way. The heavier car starts slower.</li>' +
          '<li><strong>Mass test:</strong> run the car 3 times in front of the two box fans and measure each run with a tape measure. Then run it 3 more times with the 2 nickels taped on. Same fans on high, same start line. How much distance did 10 g cost you?</li>' +
          '<li><strong>Flip check:</strong> watch from the side as you let go in front of the fans. If the back wheels lift off the floor, your car is too light for its sail — add a little weight at the back.</li></ol>',
        render: function (el, api) {
          api.ui.note(el, 'build', '🛠️ <strong>Approximate masses:</strong> popsicle stick ≈ 2 g · jumbo stick ≈ 4 g · plastic wheel ≈ 4 g · skewer ≈ 1 g · straw ≈ 0.5 g · ' +
            'paper ≈ 4.5 g a sheet · cardstock ≈ 10 g a sheet · hot glue ≈ 0.5 g a dot · pipe cleaner ≈ 1.5 g · tape ≈ 0.3 g per 10 cm. Weigh yours to be sure!');
        }
      }
    ],
    quiz: [
      { q: 'Newton’s Second Law says a car’s acceleration equals…', options: ['mass ÷ net force', 'net force ÷ mass', 'net force × mass', 'net force − mass'], answer: 1,
        why: 'Acceleration = net force ÷ mass. More force → more acceleration. More mass → less acceleration.' },
      { q: 'Two cars get the same 0.20 N push. Car A is 50 g and car B is 100 g. What happens?', options: ['Car B speeds up twice as fast as car A', 'They speed up at the same rate', 'Car A speeds up twice as fast as car B', 'Car A speeds up four times as fast as car B'], answer: 2,
        why: 'Same force, half the mass = twice the acceleration: 0.20 ÷ 0.050 = 4 m/s² and 0.20 ÷ 0.100 = 2 m/s².' },
      { q: 'A 100 g car (0.100 kg) has a net force of 0.30 N on it. What is its acceleration?', options: ['0.03 m/s²', '0.3 m/s²', '3 m/s²', '30 m/s²'], answer: 2,
        why: '0.30 N ÷ 0.100 kg = 3 m/s², so it gains 3 m/s of speed every second. Change grams to kilograms first!' },
      { q: 'What is inertia?', options: ['The push of the wind on the sail', 'An object’s resistance to changing its motion — more mass means more inertia', 'How fast an object is moving right now', 'The rubbing between the axles and the straws'], answer: 1,
        why: 'Inertia is how much an object resists speeding up, slowing down or turning. A heavier car is harder to start and harder to stop.' },
      { q: 'Why does a heavier sail car have more rolling friction?', options: ['Its weight presses its wheels and axles down harder, so they rub more', 'The fans blow weaker on heavy cars', 'Heavy cars always have bigger sails', 'It doesn’t — every car has the same friction'], answer: 0,
        why: 'Rolling friction = friction number × mass × 9.81. Double the mass and you double the friction.' },
      { q: 'Friction by itself slows a 45 g car and a 150 g car. Which one does friction slow down faster?', options: ['The 150 g car, because it has more friction', 'The 45 g car, because it has less inertia', 'Friction stops working once a car is rolling', 'Neither — it slows both at the same rate, about 0.25 m/s every second'], answer: 3,
        why: 'Friction grows with mass, but so does the inertia it has to slow down. Friction ÷ mass = 0.025 × 9.81 ≈ 0.25 m/s² for any mass.' },
      { q: 'You make your car lighter, from 150 g to 45 g, with the same sail and wheels. What happens in the hallway with the two box fans?', options: ['It rolls the same distance — mass doesn’t matter', 'It rolls much farther — about 9.8 m becomes about 20.8 m', 'It rolls less far, because a light car has less inertia to keep it going', 'It can’t start moving at all'], answer: 1,
        why: 'A lighter car speeds up faster AND has less friction, so even the weak wind far from the fans keeps pushing it. (45 g is still heavy enough not to tip.)' },
      { q: 'Your super-light 25 g car flips onto its nose as soon as you let it go in front of the two box fans. What is happening?', options: ['Its wheels have too much friction', 'It has too much inertia', 'The wind pushes high on the sail, and the car is too light to hold its back end down', 'The fans are blowing too weakly'], answer: 2,
        why: 'The push high on the sail tries to flip the car forward over its front wheels. The car’s weight holds it down — too little weight and it flips. With a 20 × 20 cm sail, that happens below about ' + Math.round(TIP_G) + ' g.' },
      { q: 'Which change cuts the MOST mass from a sail car?', options: ['Using 4 cm less tape (≈ 0.1 g)', 'Leaving out one straw (≈ 0.5 g)', 'Trimming 1 cm off a skewer (less than 0.1 g)', 'Making the sail from paper (≈ 4.5 g) instead of cardstock (≈ 10 g)'], answer: 3,
        why: 'Swapping cardstock for paper saves about 5.5 g. Tiny trims help a little, but the big parts matter most.' },
      { q: 'Your car averages 16.0 m over 3 runs. You tape on two nickels (about 10 g) and, with the same two fans and start line, it averages 14.7 m. What does this show?', options: ['Extra mass made it roll less far, so trimming mass should help', 'Heavier cars always tip over', 'The nickels helped the sail catch more wind', 'Mass makes no difference to how far a car rolls'], answer: 0,
        why: 'Only the mass changed, so the extra 10 g caused the shorter runs. Taking grams off your car should make it roll farther (as long as it doesn’t tip).' }
    ]
  });
})();
