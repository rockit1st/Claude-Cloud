// Sail Car Lab — Module 3: Drag
// Air pushes back on anything that moves through it. The big idea is RELATIVE WIND: the sail only
// feels (wind speed − car speed). Every force here comes from SailLab.physics.airForce — the same
// function the hallway simulator uses — so the numbers match the rest of the lab.
(function () {
  'use strict';
  // body front shapes (Cd = drag coefficient). The lab's default chassis is the flat one.
  const SHAPES = [
    { name: 'Flat box front', cd: SailLab.physics.DEFAULT_CAR.bodyCd, kind: 'flat' },
    { name: 'Pointed wedge', cd: 0.6, kind: 'wedge' },
    { name: 'Rounded nose', cd: 0.5, kind: 'round' }
  ];
  function nf(f) { f = Math.abs(f); return (f >= 0.01 ? f.toFixed(3) : f.toFixed(4)) + ' N'; }   // tiny forces need 4 decimals
  function ms(v) { return v.toFixed(1) + ' m/s'; }
  function bg(api, s, w, hgt) { api.svg('rect', { x: 0, y: 0, width: w, height: hgt, rx: 12, fill: '#120826' }, s); }

  SailLab.register({
    id: 'drag',
    num: 3,
    title: 'Drag',
    icon: '🌬️',
    blurb: 'Air pushes back. Find out when your own sail turns into a parachute.',
    minutes: 12,
    steps: [
      {
        title: 'Drag: the air pushes back',
        html:
          '<p>Air is made of tiny bits you can’t see. When something moves, it has to shove that air out of the way — and the air shoves back. ' +
          'That backward push is called <span class="key">drag</span>, or <span class="key">air resistance</span>.</p>' +
          '<p>You’ve felt it. Run while holding a big piece of cardboard: the faster you run, the harder the air pushes back.</p>' +
          '<p>Here your sail car rolls through <strong>still air</strong> (the fans are off). Change its speed and watch the red drag arrow.</p>',
        challenge: 'Find the speed where the drag is exactly 4 times bigger than it is at 1 m/s.',
        render: function (el, api) {
          const P = api.physics, C = P.DEFAULT_CAR;
          // still air: wind = 0, so the relative wind is (0 − speed) and airForce comes out backward
          function drag(v) { return { sail: -P.airForce(0 - v, C.sailArea, C.sailCd, 0), body: -P.airForce(0 - v, C.bodyArea, C.bodyCd, 0) }; }
          const at1 = drag(1), ref = at1.sail + at1.body;
          const s = api.svg('svg', { viewBox: '0 0 560 220', role: 'img', 'aria-label': 'A sail car rolling through still air, with its drag arrow' }, el);
          const sp = api.ui.slider(el, { label: 'Car speed through still air', min: 0, max: 4, step: 0.5, value: 1, format: ms, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          function draw() {
            const v = sp.get(), d = drag(v), tot = d.sail + d.body, ratio = tot / ref;
            s.textContent = '';
            bg(api, s, 560, 220);
            api.svg('line', { x1: 20, y1: 185, x2: 540, y2: 185, stroke: '#4a3a6a', 'stroke-width': 3 }, s);
            // the air rushing at the front of the car, the way the car "sees" it
            if (v > 0) [84, 108, 132, 156].forEach(function (y, i) {
              const x1 = 530 - (i % 2) * 22;
              api.draw.arrow(s, x1, y, x1 - 18 - v * 16, y, '#7ad7ff', '', { width: 2, head: 5 });
            });
            if (v > 0) api.svg('text', { x: 534, y: 70, 'text-anchor': 'end', fill: '#7ad7ff', 'font-size': 17 }, s, 'air hits the front');
            api.draw.car(s, 250, 185, { scale: 3, length: 30, sailW: 20, sailH: 20, mastH: 30 });
            if (v > 0) api.draw.arrow(s, 260, 36, 290 + v * 25, 36, '#d8a8ff', '', { width: 3, head: 6 });
            api.svg('text', { x: v > 0 ? 300 + v * 25 : 260, y: 42, fill: '#d8a8ff', 'font-size': 18, 'font-weight': 700, class: 'sl-lbl' }, s, v > 0 ? 'car ' + ms(v) : 'car standing still');
            const len = tot * 400;     // 400 px per newton
            if (len > 1) api.draw.arrow(s, 258, 118, 258 - len, 118, '#ff5050', '', { width: 4, head: Math.max(3, Math.min(7, len / 3)) });
            api.svg('text', { x: 252, y: 102, 'text-anchor': 'end', fill: '#ff5050', 'font-size': 20, 'font-weight': 700, class: 'sl-lbl' }, s, 'DRAG ' + nf(tot));
            api.svg('text', { x: 20, y: 46, fill: '#f0c040', 'font-size': 34, 'font-weight': 700 }, s, '×' + api.fmt(ratio, ratio === Math.round(ratio) ? 0 : 2));
            api.svg('text', { x: 20, y: 70, fill: '#f0c040', 'font-size': 17 }, s, 'the drag at 1 m/s');
            out.innerHTML = v === 0
              ? '🛑 Standing still in still air: no air rushes past, so there is <strong>no drag</strong> at all.'
              : 'Drag on the sail: <strong>' + nf(d.sail) + '</strong> · on the body: <strong>' + nf(d.body) + '</strong> · total: <strong>' + nf(tot) + '</strong><br>' +
                'That’s <strong>×' + api.fmt(ratio, ratio === Math.round(ratio) ? 0 : 2) + '</strong> the drag at 1 m/s.';
            if (Math.abs(ratio - 4) < 1e-9) api.done('At 2 m/s the drag is ×4, not ×2! Twice as fast means 2 × 2 = 4 times the drag. Drag grows with speed × speed.');
          }
          draw();
          api.ui.note(el, 'tip', '💡 Notice the sail makes almost all the drag. A big flat sail is great for catching wind — but it also catches air when the car moves.');
        }
      },
      {
        title: 'Front size and shape',
        html:
          '<p>Speed isn’t the only thing that matters. Drag also depends on:</p>' +
          '<ul><li><strong>Front size</strong> — how big the car looks from the front. This is its <span class="key">frontal area</span>. Twice the area = twice the drag.</li>' +
          '<li><strong>Shape</strong> — a flat front slams into the air and leaves a swirly, messy wake behind it. A pointed or rounded front lets the air slide around. ' +
          'Engineers give each shape a number called the <span class="key">drag coefficient (Cd)</span>. Smaller Cd = a slipperier shape.</li></ul>' +
          '<p style="text-align:center"><strong>drag = ½ × air density × Cd × front area × speed × speed</strong></p>' +
          '<p>Air density is how much air is packed into a space: about 1.2 kg in every cubic metre. All three shapes below move at the same speed.</p>',
        render: function (el, api) {
          const P = api.physics, C = P.DEFAULT_CAR, HALF = { 15: 11, 30: 16, 60: 22 };
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const sp = api.ui.slider(row, { label: 'Speed through the air', min: 0.5, max: 3, step: 0.5, value: 1, format: ms, onInput: draw });
          const size = api.ui.choice(row, { label: 'Front size', value: 30, onChange: draw,
            options: [{ value: 15, label: 'Slim 15 cm²' }, { value: 30, label: 'Normal 30 cm²' }, { value: 60, label: 'Bulky 60 cm²' }] });
          const cmp = api.ui.choice(el, { label: 'Compare with', value: 'body', onChange: draw,
            options: [{ value: 'body', label: 'Body shapes only' }, { value: 'sail', label: '+ the 20 × 20 cm sail' }] });
          const s = api.svg('svg', { viewBox: '0 0 560 250', role: 'img', 'aria-label': 'Drag on three front shapes at the same speed' }, el);
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          function shape(kind, cy, hh) {
            const c = { fill: '#d8b070', stroke: '#a07830', 'stroke-width': 1.5 };
            if (kind === 'flat') api.svg('rect', Object.assign({ x: 30, y: cy - hh, width: 74, height: hh * 2 }, c), s);
            else if (kind === 'wedge') api.svg('polygon', Object.assign({ points: [30, cy - hh, 70, cy - hh, 104, cy, 70, cy + hh, 30, cy + hh].join(',') }, c), s);
            else if (kind === 'round') api.svg('path', Object.assign({ d: 'M30,' + (cy - hh) + ' L' + (104 - hh) + ',' + (cy - hh) + ' A' + hh + ',' + hh + ' 0 0 1 ' + (104 - hh) + ',' + (cy + hh) + ' L30,' + (cy + hh) + ' Z' }, c), s);
            else {   // the sail, seen from the side: a tall thin sheet on a mast
              api.svg('line', { x1: 101, y1: cy + 30, x2: 101, y2: cy - 30, stroke: '#c8a060', 'stroke-width': 3 }, s);
              api.svg('rect', { x: 92, y: cy - 28, width: 8, height: 52, rx: 2, fill: '#f0e6ff', stroke: '#9080b0' }, s);
            }
            // the wake: a flat front leaves more swirls behind it
            const swirls = { flat: 3, wedge: 2, round: 1, sail: 4 }[kind];
            for (let i = 0; i < swirls; i++) api.svg('path', { d: 'M' + (22 - i * 4) + ',' + (cy - 16 + i * 11) + ' a5,5 0 1 0 -6,4', fill: 'none', stroke: '#7ad7ff', 'stroke-width': 1.5, opacity: 0.7 }, s);
            [-0.6, 0, 0.6].forEach(function (k) { api.draw.arrow(s, 150, cy + k * hh, 124, cy + k * hh, '#7ad7ff', '', { width: 2, head: 4 }); });
          }
          function draw() {
            const v = sp.get(), area = size.get() / 10000, hh = HALF[size.get()];
            const rows = SHAPES.map(function (sh) { return { label: sh.name + ' · Cd ' + sh.cd.toFixed(1), kind: sh.kind, f: -P.airForce(-v, area, sh.cd, 0) }; });
            if (cmp.get() === 'sail') rows.push({ label: 'Sail 20 × 20 cm · Cd ' + C.sailCd, kind: 'sail', f: -P.airForce(-v, C.sailArea, C.sailCd, 0) });
            const H = rows.length * 88 + 8, k = 250 / Math.max.apply(null, rows.map(function (r) { return r.f; }));
            s.setAttribute('viewBox', '0 0 560 ' + H);
            s.textContent = '';
            bg(api, s, 560, H);
            rows.forEach(function (r, i) {
              const y0 = i * 88, cy = y0 + 60;
              api.svg('text', { x: 24, y: y0 + 26, fill: '#e0d0ff', 'font-size': 19, 'font-weight': 700 }, s, r.label);
              shape(r.kind, cy, r.kind === 'sail' ? 26 : hh);
              const w = Math.max(2, r.f * k);
              api.svg('rect', { x: 170, y: cy - 9, width: w, height: 18, rx: 3, fill: '#ff5050' }, s);
              api.svg('text', { x: 178 + w, y: cy + 7, fill: '#ffb0b0', 'font-size': 19, 'font-weight': 700 }, s, nf(r.f));
            });
            const flat = rows[0].f;
            out.innerHTML = cmp.get() === 'sail'
              ? '⛵ The sail has about <strong>' + api.fmt(rows[3].f / flat, 0) + ' times</strong> as much drag as even the flat box body. On a sail car, the sail is the big drag maker. ' +
                'The air’s force on the body is so small that in the simulator, changing the body’s shape or size changes the standard car’s 16-metre run by <strong>less than 60 cm</strong>. ' +
                '(Wheels that spin freely add about 11 m!)'
              : '🚀 The rounded nose has <strong>half</strong> the drag of the flat front (Cd ' + SHAPES[2].cd.toFixed(1) + ' vs ' + SHAPES[0].cd.toFixed(1) + '). ' +
                'But look how small these numbers are: even the flat box only feels <strong>' + nf(flat) + '</strong> at ' + ms(v) + '. Tap “+ the sail” to compare.';
          }
          draw();
        }
      },
      {
        title: 'Relative wind: the difference is what counts',
        html:
          '<p>Here’s the big idea of this module. The sail doesn’t feel the fans’ wind speed all by itself. It only feels the wind <strong>compared with its own speed</strong>. ' +
          'That’s called the <span class="key">relative wind</span>:</p>' +
          '<p style="text-align:center;font-size:1.1rem"><strong>relative wind = wind speed − car speed</strong></p>' +
          '<ul><li>Wind <strong>faster</strong> than the car → air hits the sail from <strong>behind</strong> → it <span style="color:#40e080">pushes</span> the car forward. That’s thrust.</li>' +
          '<li>Car <strong>faster</strong> than the wind → the sail runs into the air → air hits it from the <strong>front</strong> → it <span style="color:#ff5050">drags</span> the car back. ' +
          'The sail has become a <span class="key">parachute</span>!</li></ul>' +
          '<p>Ride along with the car below. The blue streaks show the air the way the sail feels it.</p>',
        challenge: 'Find two settings: one where the sail feels NO wind at all (zero force, with the wind at least 0.5 m/s), and one where the sail turns into a parachute (a red arrow).',
        render: function (el, api) {
          const P = api.physics, C = P.DEFAULT_CAR, W = 560, H = 250, FLOOR = 214, PX = 40;   // PX = screen px per metre in the animation
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const wind = api.ui.slider(row, { label: '🌀 Wind from the fans', min: 0, max: 3.5, step: 0.1, value: 2.5, format: ms, onInput: update });
          const car = api.ui.slider(row, { label: '🚗 Car speed', min: 0, max: 3.5, step: 0.1, value: 0.5, format: ms, onInput: update });
          const s = api.svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Riding along with the sail car: the air the sail feels and the force on it' }, el);
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          const hint = api.h('div', { class: 'sl-muted' });
          el.appendChild(out); el.appendChild(hint);
          bg(api, s, W, H);
          const moving = api.svg('g', null, s), front = api.svg('g', null, s);
          const STREAKS = [[0, 70], [90, 150], [170, 96], [260, 178], [330, 78], [420, 128], [500, 160], [40, 112], [220, 136], [380, 188], [470, 92], [130, 192]];
          const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          let airOff = 0, groundOff = 0, last = null, raf = null, seenZero = false, seenChute = false;
          function rel() { return Math.round((wind.get() - car.get()) * 10) / 10; }
          function moveAir() {     // in the car's view, the air drifts by at the relative wind and the floor slides backward
            moving.textContent = '';
            STREAKS.forEach(function (p) {
              const x = ((p[0] + airOff) % 600 + 600) % 600 - 20;
              if (x > 8 && x < W - 34) api.svg('line', { x1: x, y1: p[1], x2: x + 26, y2: p[1], stroke: '#7ad7ff', 'stroke-width': 2, opacity: 0.5, 'stroke-linecap': 'round' }, moving);
            });
            for (let k = 0; k < 15; k++) {
              const x = ((k * 40 - groundOff) % 600 + 600) % 600 - 20;
              if (x > 10 && x < W - 26) api.svg('line', { x1: x, y1: FLOOR + 8, x2: x + 16, y2: FLOOR + 8, stroke: '#6a5a8a', 'stroke-width': 3 }, moving);
            }
          }
          function update() {
            const w = wind.get(), c = car.get(), r = rel(), f = P.airForce(r, C.sailArea, C.sailCd, 0);
            front.textContent = '';
            api.svg('line', { x1: 10, y1: FLOOR, x2: W - 10, y2: FLOOR, stroke: '#4a3a6a', 'stroke-width': 3 }, front);
            api.svg('text', { x: 16, y: 32, fill: '#7ad7ff', 'font-size': 20, 'font-weight': 700 }, front, 'Wind ' + ms(w) + ' →');
            api.svg('text', { x: W - 16, y: 32, 'text-anchor': 'end', fill: '#d8a8ff', 'font-size': 20, 'font-weight': 700 }, front, 'Car ' + ms(c) + ' →');
            const feel = r > 0 ? 'Sail feels ' + ms(r) + ' from behind' : r < 0 ? 'Sail feels ' + ms(-r) + ' from the front' : 'Sail feels NO wind';
            api.svg('text', { x: W / 2, y: 60, 'text-anchor': 'middle', fill: r > 0 ? '#40e080' : r < 0 ? '#ff5050' : '#f0c040', 'font-size': 20, 'font-weight': 700, class: 'sl-lbl' }, front, feel);
            api.draw.car(front, 200, FLOOR, { scale: 3, length: 30, sailW: 20, sailH: 20, mastH: 30 });
            // force arrow at the middle of the sail. Not to scale when tiny (every non-zero force gets at
            // least a short arrow, so the colour always matches the words): the label gives the real size.
            const len = Math.min(170, 14 + Math.abs(f) * 420);
            if (f > 0) {
              api.draw.arrow(front, 248, 136, 248 + len, 136, '#40e080');
              api.svg('text', { x: 250, y: 120, fill: '#40e080', 'font-size': 18, 'font-weight': 700, class: 'sl-lbl' }, front, 'PUSH ' + nf(f));
            }
            if (f < 0) {
              api.draw.arrow(front, 206, 136, 206 - len, 136, '#ff5050');
              api.svg('text', { x: 204, y: 120, 'text-anchor': 'end', fill: '#ff5050', 'font-size': 18, 'font-weight': 700, class: 'sl-lbl' }, front, 'DRAG ' + nf(f));
            }
            const eq = 'relative wind = ' + w.toFixed(1) + ' − ' + c.toFixed(1) + ' = <strong>' + (r === 0 ? '0' : r.toFixed(1)) + ' m/s</strong>';
            out.innerHTML = r > 0
              ? '🟢 ' + eq + ' → the air hits the sail from behind and <strong>pushes</strong> the car forward with ' + nf(f) + '.'
              : r < 0 ? '🔴 ' + eq + ' → the car runs into the air, so it hits the sail from the front and <strong>drags</strong> the car back with ' + nf(f) + '. The sail is a parachute! 🪂'
                : '🟡 ' + eq + ' → the car moves exactly with the air. The sail feels <strong>no wind</strong>, so there is no push at all.';
            if (w >= 0.5 && r === 0) seenZero = true;
            if (r < 0 && c > 0) seenChute = true;
            hint.textContent = seenZero && !seenChute ? '✔ You found the no-wind setting. Now make the car faster than the wind.'
              : seenChute && !seenZero ? '✔ Parachute found! Now find a setting where the sail feels no wind at all (with the wind at least 0.5 m/s).' : '';
            if (seenZero && seenChute) api.done('Same speed as the wind = no push. Faster than the wind = the air hits the sail from the front and drags the car back. The very same sail became a parachute!');
            if (still) moveAir();
          }
          function frame(now) {
            const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000);
            last = now;
            airOff += rel() * PX * dt; groundOff += car.get() * PX * dt;
            moveAir();
            raf = requestAnimationFrame(frame);
          }
          update(); moveAir();
          if (!still) raf = requestAnimationFrame(frame);
          api.onLeave(function () { if (raf) cancelAnimationFrame(raf); raf = null; });
        }
      },
      {
        title: 'Spot the parachute in the hallway',
        html:
          '<p>Back to the real hallway, with the two box fans side by side at the start. Right in front of the fans the wind is about 3.3 m/s — much faster than your car. ' +
          'But the wind spreads out and fades as it goes down the hall: about 1.7 m/s at 5 m, 1.1 m/s at 10 m, and only 0.5 m/s at the end of the 30 m hallway.</p>' +
          '<p>A light car with wheels that spin freely can zoom into that weaker wind and end up <strong>faster than the wind</strong>. While it is faster, its sail is a parachute. ' +
          '(Later the car slows down below the wind speed, and the wind gently pushes it again.)</p>' +
          '<p>Run the car, then read the graph under the hallway: the <span style="color:#7ad7ff">blue line</span> is the wind speed and the <span style="color:#f0c040">yellow line</span> is your car’s speed. ' +
          'Where the yellow line climbs above the blue one, the graph turns <span style="color:#ff5050">red</span>.</p>',
        challenge: 'Make a run where your car outruns the wind (a red zone appears on the graph). Then answer the question about the red zone.',
        render: function (el, api) {
          const P = api.physics, START = 0.3;     // simulate() starts the car 30 cm in front of the fans
          // 50 g is the lightest choice on purpose: a 30–40 g car with this sail tips forward in the two fans' strong start push
          const MASS = { 50: 0.05, 70: 0.07, 100: 0.1 }, CRR = { rub: 0.05, ok: 0.025, free: 0.01 };
          const EPS = 0.01;      // m/s — "faster than the wind" means the same thing on the graph and for the challenge
          let outran = false;    // did the run now on screen outrun the wind?
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const wt = api.ui.choice(row, { label: 'Car weight', value: 70, onChange: changed, options: [{ value: 50, label: '50 g (light)' }, { value: 70, label: '70 g' }, { value: 100, label: '100 g (heavy)' }] });
          const wh = api.ui.choice(row, { label: 'Wheels', value: 'ok', onChange: changed, options: [{ value: 'rub', label: 'Rubbing' }, { value: 'ok', label: 'OK' }, { value: 'free', label: 'Spin freely' }] });
          // long runs play faster automatically (the whole run takes about 9 seconds to watch)
          const sim = api.ui.trackSim(el, function () { return { mass: MASS[wt.get()], crr: CRR[wh.get()] }; }, { onResult: function (r) { plot(r); judge(r); } });
          api.onLeave(sim.stop);
          const g = api.svg('svg', { viewBox: '0 0 560 262', role: 'img', 'aria-label': 'Graph of wind speed and car speed along the hallway' }, el);
          const TIP = '💡 The run plays sped up, so watch closely: when “speed” in the readout is bigger than “wind”, the car has outrun the wind. ' +
            'The green arrow on the car shrinks as the car’s speed gets close to the wind’s speed. When the car stops, the graph shows the whole trip.';
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite', text: TIP });
          const ask = api.h('div', { style: 'display:none' });
          el.appendChild(out); el.appendChild(ask);
          const L = 50, R = 540, T = 46, B = 204, VMAX = 3.5;
          function fast(p, i, tr) { return i < tr.length - 1 && p.v - p.wind > EPS; }   // the last trace point is the "stopped" marker
          function plot(r, msg) {
            const scale = r ? Math.max(6, Math.ceil(r.distance * 1.15)) : 8, sx = r ? r.opts.startX : START;   // same scale as the hallway
            function X(m) { return L + m / scale * (R - L); }
            function Y(v) { return B - Math.min(v, VMAX) / VMAX * (B - T); }
            g.textContent = '';
            bg(api, g, 560, 262);
            if (r) {     // red zones: wherever the car is faster than the wind
              let from = null;
              r.trace.forEach(function (p, i, tr) {
                const f = fast(p, i, tr);
                if (f && from == null) from = p.x;
                if (!f && from != null) {
                  api.svg('rect', { x: X(from), y: T, width: Math.max(2, X(p.x) - X(from)), height: B - T, fill: '#ff5050', opacity: 0.25 }, g);
                  if (X(p.x) - X(from) > 150) api.svg('text', { x: (X(from) + X(p.x)) / 2, y: T + 24, 'text-anchor': 'middle', fill: '#ffb0b0', 'font-size': 17, 'font-weight': 700 }, g, '🪂 parachute zone');
                  from = null;
                }
              });
              const hall = r.opts.hallLength;
              if (scale > hall) {   // the hallway ends at 30 m
                api.svg('line', { x1: X(hall), y1: T, x2: X(hall), y2: B, stroke: '#f0c040', 'stroke-width': 1.5, 'stroke-dasharray': '5,4' }, g);
                api.svg('text', { x: X(hall) - 6, y: T + 20, 'text-anchor': 'end', fill: '#f0c040', 'font-size': 16 }, g, 'end of hall');
              }
            }
            for (let v = 0; v <= VMAX; v++) {
              api.svg('line', { x1: L, y1: Y(v), x2: R, y2: Y(v), stroke: '#2e2050', 'stroke-width': 1 }, g);
              api.svg('text', { x: L - 10, y: Y(v) + 6, 'text-anchor': 'end', fill: '#9080b0', 'font-size': 16 }, g, String(v));
            }
            const step = scale <= 8 ? 1 : scale <= 16 ? 2 : 5;
            for (let m = 0; m <= scale; m += step) api.svg('text', { x: X(m), y: B + 20, 'text-anchor': 'middle', fill: '#9080b0', 'font-size': 16 }, g, String(m));
            api.svg('text', { x: (L + R) / 2, y: B + 46, 'text-anchor': 'middle', fill: '#9080b0', 'font-size': 16 }, g, 'distance down the hallway (m)');
            api.svg('text', { x: 10, y: T - 16, fill: '#9080b0', 'font-size': 16 }, g, 'm/s');
            const wpts = [];
            for (let i = 0; i <= 100; i++) { const m = scale * i / 100; wpts.push(X(m) + ',' + Y(P.windAt(sx + m))); }
            api.svg('polyline', { points: wpts.join(' '), fill: 'none', stroke: '#7ad7ff', 'stroke-width': 3 }, g);
            [['wind', '#7ad7ff', 90], ['car', '#f0c040', 190]].forEach(function (lg) {
              api.svg('line', { x1: lg[2], y1: T - 22, x2: lg[2] + 24, y2: T - 22, stroke: lg[1], 'stroke-width': 4 }, g);
              api.svg('text', { x: lg[2] + 30, y: T - 16, fill: lg[1], 'font-size': 17, 'font-weight': 700 }, g, lg[0]);
            });
            api.svg('rect', { x: 270, y: T - 32, width: 18, height: 18, fill: '#ff5050', opacity: 0.5 }, g);
            api.svg('text', { x: 294, y: T - 16, fill: '#ff8080', 'font-size': 17, 'font-weight': 700 }, g, 'car faster than wind');
            if (!r) { api.svg('text', { x: 350, y: 84, 'text-anchor': 'middle', fill: '#c8b8ea', 'font-size': 17 }, g, msg || 'Press ▶ Run to draw your car’s speed'); return; }
            api.svg('polyline', { points: r.trace.map(function (p) { return X(p.x) + ',' + Y(p.v); }).join(' '), fill: 'none', stroke: '#f0c040', 'stroke-width': 3 }, g);
          }
          function judge(r) {
            let over = 0, from = null, to = null, chute = 0;
            r.trace.forEach(function (p, i, tr) { if (fast(p, i, tr)) { over = Math.max(over, p.v - p.wind); if (from == null) from = p.x; to = p.x; chute = Math.min(chute, p.thrust); } });
            const fric = P.rollingFriction(r.car.mass, r.car.crr);
            outran = from != null;
            if (outran) {
              out.className = 'sl-note sl-note-good';
              out.innerHTML = '🪂 From about <strong>' + api.fmt(from, 1) + ' m</strong> to <strong>' + api.fmt(to, 1) + ' m</strong> your car was faster than the wind (by up to ' + api.fmt(over, 2) + ' m/s). ' +
                'In the red zone the air hit the sail from the front. The biggest drag on the sail there was <strong>' + (-chute < 0.0001 ? 'less than 0.0001 N' : nf(chute)) + '</strong> — ' +
                (-chute >= 0.8 * fric ? 'about as big as' : 'smaller than') + ' the wheel friction (' + nf(fric) + '). That’s too small to show as an arrow in the hallway picture, but it’s there, and it slows the car down along with friction.';
              ask.style.display = 'block';
            } else {
              out.className = 'sl-note sl-note-tip';
              out.textContent = r.reason === 'tipped over' ? '🤸 The car tipped over at the start, so it never got going.'
                : '🔵 The yellow line stayed under the blue line the whole way: the wind was always faster than the car, so it pushed the car the whole time. ' +
                  (r.reason === 'reached the end of the hall' ? 'It still made it to the end of the hall.'
                    : 'The car stopped because the push got weaker than friction. To outrun the wind, a car must keep its speed as it rolls into the weaker wind. Try wheels that spin freely.');
            }
          }
          ask.appendChild(api.h('p', { html: '<strong>Now think:</strong> inside the red zone, which way does the air push on the sail?' }));
          const reply = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite', style: 'display:none' });
          const answer = api.ui.choice(ask, { label: 'Your answer:', value: null,
            options: [{ value: 'fwd', label: 'Forward ➡️' }, { value: 'none', label: 'Not at all' }, { value: 'back', label: '⬅️ Backward' }],
            onChange: function (v) {
              reply.style.display = 'block';
              reply.className = 'sl-note ' + (v === 'back' ? 'sl-note-good' : 'sl-note-warn');
              reply.textContent = v === 'back' ? '✅ Yes! The car is faster than the wind, so the sail runs into the air. The air pushes it backward and slows the car down.'
                : v === 'fwd' ? 'Not quite. Forward pushes only happen while the wind is faster than the car. In the red zone the car is the faster one.'
                  : 'Not quite. “No push” only happens at the exact spot where the two lines cross — car and wind at the same speed. In the red zone the car is faster.';
              if (v === 'back' && outran) api.done('Faster than the wind = the air hits the sail from the front and pushes it backward. Your sail became a parachute!');
            } });
          ask.appendChild(reply);
          // a new run, Reset, or a new weight/wheel choice clears the old graph and question,
          // so an old run can't be mixed up with the car on screen
          function clearRun(msg) {
            outran = false;
            plot(null, msg);
            out.className = 'sl-note sl-note-tip'; out.textContent = TIP;
            ask.style.display = 'none'; reply.style.display = 'none'; answer.set(null);
          }
          function changed() { sim.reset(); clearRun(); }
          const btns = el.querySelectorAll('.sl-track-bar .sl-btn');
          btns[0].addEventListener('click', function () { clearRun('Running… the graph comes when the car stops'); });
          btns[1].addEventListener('click', function () { clearRun(); });
          plot(null);
        }
      },
      {
        title: 'Real build: beat the drag',
        html:
          '<p>Here’s the honest truth about drag on <strong>your</strong> car:</p>' +
          '<ul><li>For most of the run, the wind from the fans is faster than your car, so the air comes from <strong>behind</strong> and pushes. ' +
          'Drag only slows your car where the car is faster than the air around it — like in the red zone.</li>' +
          '<li>The <strong>body’s</strong> drag is tiny. Even at 2 m/s (about as fast as sail cars go in our hallway) it’s about 0.007 N — less than the weight of one paper clip. ' +
          'In the simulator, changing the body’s shape or size changes the standard car’s 16 m run by less than 60 cm.</li>' +
          '<li>The <strong>sail</strong> makes the most drag — but it’s also your engine. <strong>Don’t shrink it</strong> to beat drag: you’d lose far more push near the fans than you’d save.</li></ul>' +
          '<p><strong>Tidy up</strong> (small wins — and they save weight too):</p>' +
          '<ol><li><strong>Trim and tape.</strong> Cut cardstock edges neatly. Tape down loose flaps and corners so they can’t flutter.</li>' +
          '<li><strong>Cut axle ends short.</strong> Leave about 5 mm of skewer or dowel past each wheel. A tiny ring of straw or a dab of hot glue stops the wheel sliding off.</li>' +
          '<li><strong>Small, smooth front, nothing sticking out.</strong> No wide flat bumper, pipe-cleaner antennas, long tape tails or hot-glue strings.</li>' +
          '<li><strong>Tight sail, not floppy.</strong> Tape the paper’s edges to a frame of skewers or straws, or use cardstock. A sail that flaps wastes the wind’s energy.</li></ol>' +
          '<p><strong>Test drag in the hallway:</strong></p>' +
          '<ol><li><strong>Ramp test (fans OFF).</strong> Prop up a binder to make a little ramp. Let the car roll down from the same spot and measure how far it coasts — ' +
          'once with the sail facing forward, once with it turned edge-on. In still air, the air hits the sail from the front. The difference in distance shows how much the sail’s drag slows the car.</li>' +
          '<li><strong>Wind-strip test (fans ON).</strong> Tape a thin 5 cm strip of paper to the top of the mast. It blows the way the relative wind blows. ' +
          'Walk beside the car: if the strip goes limp, your car has caught up with the wind. If it flips back toward the fans, your car has outrun the wind!</li>' +
          '<li><strong>Flutter check.</strong> Hold the car in front of the fans and look at the sail from the side. If it flaps or ripples, tighten it.</li></ol>',
        render: function (el, api) {
          api.ui.note(el, 'build', '🛠️ <strong>Remember the order:</strong> a tight sail of a good size (about 20 × 20 cm) for push and wheels that spin freely matter much more than a streamlined body. ' +
            'Tidy the body last, as a finishing touch.');
        }
      }
    ],
    quiz: [
      { q: 'What is drag?', options: ['The air pushing back on something that moves through it', 'The wind from the fans pushing the car forward', 'The rubbing between the wheels and the axles', 'The pull of gravity on the car'], answer: 0,
        why: 'Anything moving through air has to push the air out of the way, and the air pushes back. That backward push is drag (air resistance).' },
      { q: 'Your car moves through still air. If its speed doubles, what happens to the drag?', options: ['It stays the same', 'It becomes 2 times bigger', 'It becomes 4 times bigger', 'It becomes half as big'], answer: 2,
        why: 'Drag grows with speed × speed. Twice as fast means 2 × 2 = 4 times the drag.' },
      { q: 'Three car bodies have the same front size and go the same speed. Which one has the MOST drag?', options: ['The one with a rounded nose', 'The one with a flat box front', 'The one with a pointed wedge front', 'They all have exactly the same drag'], answer: 1,
        why: 'A flat front slams into the air (Cd about 1.0). Wedge and rounded fronts let air slide around them, so they have less drag.' },
      { q: 'Car B has a front twice as big as car A. Same shape, same speed. How does car B’s drag compare?', options: ['About half as big', 'About the same', 'About 2 times bigger', 'About 4 times bigger'], answer: 2,
        why: 'Drag grows in step with the front area: twice the area means twice the drag. (It’s speed that counts twice, not area.)' },
      { q: 'The wind from the two box fans is 2.3 m/s where your car is, and the car is rolling at 1.6 m/s. What does the sail feel?', options: ['3.9 m/s of wind from behind', '0.7 m/s of wind from behind, so it pushes the car forward', '0.7 m/s of wind from the front, so it slows the car', 'No wind at all'], answer: 1,
        why: 'Relative wind = wind speed − car speed = 2.3 − 1.6 = 0.7 m/s. It’s positive, so the air hits the sail from behind and pushes. (In the simulator, the standard car is at about these speeds 2 m down the hall.)' },
      { q: 'Your car rolls at exactly the same speed as the wind around it. What is the wind’s push on the sail?', options: ['Its biggest push ever', 'Zero — the sail feels no wind', 'It pushes the car backward hard', 'Twice the normal push'], answer: 1,
        why: 'Relative wind = wind − car speed = 0. The car moves with the air, so the sail feels no wind and gets no push.' },
      { q: 'About 10 m down the hall, your car is going 1.3 m/s, but the wind from the fans there is only 1.1 m/s. What does the air do to the sail?', options: ['Pushes it forward and speeds the car up', 'Nothing, because there is still some wind', 'Hits it from the front and slows the car down', 'Lifts the car off the floor'], answer: 2,
        why: 'Relative wind = 1.1 − 1.3 = −0.2 m/s. The car is faster than the wind, so the sail runs into the air and acts like a parachute.' },
      { q: 'At 1 m/s, a sail car’s sail has about 0.03 N of drag and its flat-front body has about 0.002 N. What does that tell you?', options: ['Streamlining the body makes only a small difference — the sail makes most of the drag', 'The body makes most of the drag, so streamlining it is the most important job', 'The body and the sail make the same amount of drag', 'The sail has no drag because it is made of paper'], answer: 0,
        why: 'The sail’s drag is about 16 times the body’s. The body’s air force is so small that in the simulator, changing the body’s shape or size changes the standard car’s 16 m run by less than 60 cm.' },
      { q: 'Which change to your real car cuts down extra drag on the body?', options: ['Glue a wide, flat cardstock bumper across the front', 'Add pipe-cleaner antennas for style', 'Tape down loose flaps and cut long skewer ends short', 'Leave long skewer ends sticking out past the wheels'], answer: 2,
        why: 'Loose flaps flutter and long ends stick out into the air. Trimming them removes drag makers and saves a little weight too.' },
      { q: 'A classmate wants to cut their sail much smaller to get rid of drag. Good idea?', options: ['Yes — the smallest sail always wins', 'No — the sail is also the engine, and a smaller sail loses much more push near the fans than it saves in drag', 'Yes — take the sail off completely', 'It makes no difference either way'], answer: 1,
        why: 'In the simulator the standard car goes about 16 m with a 20 cm sail but only about 7.4 m with a 10 cm sail. The push near the fans matters far more than the drag later.' }
    ]
  });
})();
