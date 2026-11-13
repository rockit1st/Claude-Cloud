// Sail Car Lab — Design Studio (the final step, no check)
// 1. Design: real parts → mass, balance, friction, sail push (all fed into SailLab.physics)
// 2. Predict: run the design down the simulated hallway
// 3. Race day: log real hallway runs (sailcar_runs) and compare with the prediction
// 4. Class board: best real run per student, visible only to the class and the teacher
(function () {
  const TEACHER_EMAIL = 'ncapellini@hhh.k12.ny.us';
  const KEY = 'sailcar-design-v1';
  const FT_PER_M = 3.28084;

  // Part data (approximate masses of the classroom materials)
  const CHASSIS = {
    regular: { label: 'Regular sticks (11 cm)', stick: 1.8, wheelbase: 0.10 },
    jumbo:   { label: 'Jumbo sticks (15 cm)',   stick: 4.0, wheelbase: 0.13 },
    double:  { label: 'Two sticks end-to-end (21 cm)', stick: 3.6, wheelbase: 0.18 }
  };
  const BEARING = {
    straw: { label: 'Skewer spins in a straw', crr: 0.012 },
    taped: { label: 'Wheels spin on a taped skewer', crr: 0.022 },
    hole:  { label: 'Skewer through a cardstock hole', crr: 0.03 }
  };
  const GLUE = { light: 3, normal: 6, heavy: 10 };            // grams of hot glue
  const SAIL_GSM = { paper: 80, cardstock: 200 };             // grams per square metre
  const MAST_POS = { front: 0.3, middle: 0.5, back: 0.7 };     // fraction of the wheelbase behind the front axle

  // a sensible, ordinary first car — students improve it from here
  const DEFAULT = { chassis: 'double', rails: 3, bearing: 'taped', wobbly: false, rubbing: false, bigWheels: false, square: true,
                    sailMat: 'paper', sailW: 20, sailH: 16, cupped: false, sailGap: 1, mastPos: 'middle', guys: 0, pennies: 1, glue: 'normal' };
  let design = Object.assign({}, DEFAULT);
  try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) design = Object.assign({}, DEFAULT, saved); } catch (e) {}
  function saveDesign() { try { localStorage.setItem(KEY, JSON.stringify(design)); } catch (e) {} }

  // Turn a design into the numbers the physics model needs
  function analyse(d) {
    const ch = CHASSIS[d.chassis] || CHASSIS.jumbo, wb = ch.wheelbase;
    const wheelR = d.bigWheels ? 0.025 : 0.015, deck = wheelR * 2 + 0.005;
    const sailArea = (d.sailW / 100) * (d.sailH / 100);
    const parts = [];
    function add(name, g, pos, height) { parts.push({ name: name, g: g, pos: pos, h: height }); }
    add('Chassis sticks', (d.rails + 2) * ch.stick, wb / 2, deck);
    add('Axles (2 skewers)', 2, wb / 2, wheelR);
    if (d.bearing === 'straw') add('Straw bearings', 1, wb / 2, wheelR);
    add('Wheels (4)', 4 * (d.bigWheels ? 5 : 3), wb / 2, wheelR);
    add('Hot glue', GLUE[d.glue], wb / 2, deck);
    add('Tape', 1, wb / 2, deck);
    const mastLen = (d.sailGap + d.sailH) / 100, mastX = wb * MAST_POS[d.mastPos];
    add('Mast (skewer)', 1, mastX, deck + mastLen / 2);
    add('Sail (' + d.sailMat + ')', sailArea * SAIL_GSM[d.sailMat], mastX, deck + d.sailGap / 100 + d.sailH / 200);
    if (d.cupped) add('Pipe-cleaner sail frame', 1.5, mastX, deck + d.sailGap / 100 + d.sailH / 200);
    if (d.guys) add('Pipe-cleaner braces', d.guys * 1.5, mastX, deck + mastLen / 3);
    if (d.pennies) add('Pennies at the back', d.pennies * 2.5, wb * 0.95, deck);
    const grams = parts.reduce(function (s, p) { return s + p.g; }, 0);
    const cgToFront = parts.reduce(function (s, p) { return s + p.g * p.pos; }, 0) / grams;
    const cgHeight = parts.reduce(function (s, p) { return s + p.g * p.h; }, 0) / grams;
    let crr = (BEARING[d.bearing] || BEARING.straw).crr + (d.wobbly ? 0.012 : 0) + (d.rubbing ? 0.03 : 0);
    if (d.bigWheels) crr *= 0.85;
    const car = {
      mass: grams / 1000, sailArea: sailArea, sailCd: d.cupped ? 1.4 : 1.2, sailAngle: 0,
      sailHeight: deck + d.sailGap / 100 + d.sailH / 200, bodyArea: d.bigWheels ? 0.0035 : 0.003, bodyCd: 1.0,
      crr: crr, cgHeight: cgHeight, cgToFront: cgToFront, wheelbase: wb, veerDeg: d.square ? 0 : 1.5
    };
    const P = SailLab.physics;
    const push = P.airForce(P.windAt(0.3), car.sailArea, car.sailCd, 0);
    const tipMoment = push * (car.sailHeight - car.cgHeight), holdMoment = car.mass * P.G * car.cgToFront;
    return { car: car, parts: parts, grams: grams, push: push, friction: P.rollingFriction(car.mass, car.crr), tipMargin: holdMoment / tipMoment };
  }
  function summary(d) {
    return (CHASSIS[d.chassis] || CHASSIS.jumbo).label.replace(/ \(.*/, '') + ' · ' + d.sailW + '×' + d.sailH + ' cm ' + (d.cupped ? 'cupped ' : '') + d.sailMat + ' sail · ' +
      (BEARING[d.bearing] || BEARING.straw).label.toLowerCase() + (d.pennies ? ' · ' + d.pennies + ' pennies' : '');
  }

  // ── Step 1: design ──
  function renderDesign(el, api) {
    const h = api.h, ui = api.ui;
    const wrap = h('div', { class: 'sl-row' });
    el.appendChild(wrap);
    const left = h('div'), right = h('div');
    wrap.appendChild(left); wrap.appendChild(right);
    function set(k) { return function (v) { design[k] = v; design.predictedM = 0; saveDesign(); refresh(); }; }
    left.appendChild(h('h3', { class: 'sl-step-title', style: 'font-size:0.9rem;margin:6px 0', text: '🪵 Chassis & wheels' }));
    ui.choice(left, { label: 'Chassis', value: design.chassis, options: Object.keys(CHASSIS).map(function (k) { return { value: k, label: CHASSIS[k].label }; }), onChange: set('chassis') });
    ui.slider(left, { label: 'Sticks along the chassis', min: 2, max: 5, step: 1, value: design.rails, format: function (v) { return v + ' (+2 cross pieces)'; }, onInput: set('rails') });
    ui.choice(left, { label: 'Axles', value: design.bearing, options: Object.keys(BEARING).map(function (k) { return { value: k, label: BEARING[k].label }; }), onChange: set('bearing') });
    ui.choice(left, { label: 'Wheels', value: design.bigWheels ? 'big' : 'small', options: [{ value: 'small', label: 'Small (3 cm)' }, { value: 'big', label: 'Big (5 cm)' }], onChange: function (v) { set('bigWheels')(v === 'big'); } });
    ui.choice(left, { label: 'Do the wheels wobble?', value: design.wobbly ? 'y' : 'n', options: [{ value: 'n', label: 'Spin true' }, { value: 'y', label: 'Wobbly' }], onChange: function (v) { set('wobbly')(v === 'y'); } });
    ui.choice(left, { label: 'Gap between wheels and chassis', value: design.rubbing ? 'y' : 'n', options: [{ value: 'n', label: 'Gap / spacer' }, { value: 'y', label: 'Rubbing' }], onChange: function (v) { set('rubbing')(v === 'y'); } });
    ui.choice(left, { label: 'Axles lined up', value: design.square ? 'y' : 'n', options: [{ value: 'y', label: 'Squared with a ruler' }, { value: 'n', label: 'Eyeballed' }], onChange: function (v) { set('square')(v === 'y'); } });
    right.appendChild(h('h3', { class: 'sl-step-title', style: 'font-size:0.9rem;margin:6px 0', text: '⛵ Sail & balance' }));
    ui.choice(right, { label: 'Sail material', value: design.sailMat, options: [{ value: 'paper', label: 'Paper' }, { value: 'cardstock', label: 'Cardstock' }], onChange: set('sailMat') });
    ui.slider(right, { label: 'Sail width', min: 8, max: 35, step: 1, value: design.sailW, unit: 'cm', onInput: set('sailW') });
    ui.slider(right, { label: 'Sail height', min: 8, max: 35, step: 1, value: design.sailH, unit: 'cm', onInput: set('sailH') });
    ui.choice(right, { label: 'Sail shape', value: design.cupped ? 'cup' : 'flat', options: [{ value: 'flat', label: 'Flat' }, { value: 'cup', label: 'Cupped (pipe-cleaner frame)' }], onChange: function (v) { set('cupped')(v === 'cup'); } });
    ui.slider(right, { label: 'Gap under the sail', min: 0, max: 15, step: 1, value: design.sailGap, unit: 'cm', onInput: set('sailGap') });
    ui.choice(right, { label: 'Mast position', value: design.mastPos, options: [{ value: 'front', label: 'Front' }, { value: 'middle', label: 'Middle' }, { value: 'back', label: 'Back' }], onChange: set('mastPos') });
    ui.slider(right, { label: 'Pennies taped low at the back', min: 0, max: 6, step: 1, value: design.pennies, format: function (v) { return v + ' (' + (v * 2.5) + ' g)'; }, onInput: set('pennies') });
    ui.slider(right, { label: 'Pipe-cleaner mast braces', min: 0, max: 2, step: 1, value: design.guys, onInput: set('guys') });
    ui.choice(right, { label: 'Hot glue', value: design.glue, options: [{ value: 'light', label: 'Just enough' }, { value: 'normal', label: 'Normal' }, { value: 'heavy', label: 'Lots' }], onChange: set('glue') });

    const card = h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
    el.appendChild(card);
    const pic = api.svg('svg', { viewBox: '0 0 560 200', role: 'img', 'aria-label': 'Your car' }, el);
    function refresh() {
      const a = analyse(design);
      card.textContent = '';
      function line(label, value, color) { card.appendChild(h('div', null, [h('strong', { text: label + ': ' }), h('span', { text: value, style: color ? 'color:' + color : '' })])); }
      line('Mass', api.fmt(a.grams, 0) + ' g');
      line('Starting push from the fans', api.fmt(a.push, 3) + ' N');
      line('Friction', api.fmt(a.friction, 3) + ' N', a.friction > a.push / api.physics.STICKY ? '#ff8080' : '');
      line('Tipping safety', a.tipMargin >= 1.25 ? 'Safe (' + api.fmt(a.tipMargin, 1) + '× what it needs)' : a.tipMargin >= 1 ? 'Close to tipping! (' + api.fmt(a.tipMargin, 2) + '×)' : 'TIPS OVER — lower the sail, move weight back, or use a smaller sail',
           a.tipMargin >= 1.25 ? '#40e080' : a.tipMargin >= 1 ? '#f0c040' : '#ff8080');
      pic.textContent = '';
      api.svg('rect', { x: 0, y: 0, width: 560, height: 200, rx: 12, fill: '#120826' }, pic);
      api.svg('line', { x1: 20, y1: 175, x2: 540, y2: 175, stroke: '#4a3a6a', 'stroke-width': 3 }, pic);
      // the whole car (wheels + deck + mast) must fit in the picture
      const wr = design.bigWheels ? 2.5 : 1.5, len = a.car.wheelbase * 100 + 2 * wr, tallCm = 2 * wr + 1.5 + design.sailGap + design.sailH;
      const scale = Math.min(4.5, 150 / tallCm, 440 / len), x0 = 280 - len * scale / 2;
      const frontAxle = x0 + len * scale - wr * scale;
      const mastX = frontAxle - MAST_POS[design.mastPos] * a.car.wheelbase * 100 * scale;
      api.draw.car(pic, x0, 175, { scale: scale, length: len, sailW: design.sailW, sailH: design.sailH, mastH: design.sailGap + design.sailH, mastAt: (mastX - x0) / (len * scale),
                                   cupped: design.cupped, wheelR: wr, sailColor: design.sailMat === 'cardstock' ? '#f0d8a0' : '#f0e6ff' });
      const cgX = frontAxle - a.car.cgToFront * 100 * scale;
      api.svg('circle', { cx: cgX, cy: 175 - a.car.cgHeight * 100 * scale, r: 6, fill: '#00a8ff', stroke: '#fff', 'stroke-width': 1.5 }, pic);
      api.svg('text', { x: cgX + 10, y: 175 - a.car.cgHeight * 100 * scale - 8, fill: '#7ad7ff', 'font-size': 13, class: 'sl-lbl' }, pic, 'balance point');
    }
    refresh();
    api.ui.note(el, 'build', '🛠️ Everything here is a real choice you can make with your materials. The masses are close to real ones — weigh your parts on a kitchen scale to check.');
  }

  // ── Step 2: predict ──
  function renderPredict(el, api) {
    const a = analyse(design);
    el.appendChild(api.h('p', { text: 'Your design: ' + summary(design) + ' — ' + api.fmt(a.grams, 0) + ' g.' }));
    el.appendChild(api.h('p', { html: 'In the simulator the car starts <strong>30 cm</strong> in front of two box fans on high, side by side — like the real hallway. Run it, then go back and change one thing at a time to see what helps most.' }));
    const best = api.h('div', { class: 'sl-note sl-note-good', 'aria-live': 'polite' });
    const sim = api.ui.trackSim(el, function () { return analyse(design).car; }, {
      onResult: function (r) {
        design.predictedM = Math.round(r.distance * 100) / 100;
        design.bestM = Math.max(design.bestM || 0, design.predictedM);
        saveDesign();
        best.innerHTML = '🔮 Prediction for this design: <strong>' + api.fmt(r.distance, 2) + ' m</strong> (' + api.fmt(r.distance * FT_PER_M, 1) + ' ft). Your best design so far: ' + api.fmt(design.bestM, 2) + ' m.';
      }
    });
    el.appendChild(best);
    best.textContent = design.predictedM ? '🔮 Last prediction: ' + api.fmt(design.predictedM, 2) + ' m.' : '🔮 Run the simulator to get your prediction.';
    api.onLeave(sim.stop);
  }

  // ── Step 3: race day ──
  let me = null, myClasses = [], unsubs = [];
  function db() { return firebase.firestore(); }
  function renderRace(el, api) {
    const h = api.h;
    me = firebase.auth().currentUser;
    const isTeacher = me && me.email === TEACHER_EMAIL;
    if (isTeacher) {
      api.ui.note(el, 'tip', '👩‍🏫 <strong>Teacher:</strong> students log their own runs here after each hallway run (distance in metres or feet, plus an optional note). Their prediction from the simulator is saved with it. You see every class on the next step and can delete a run there.');
      return;
    }
    el.appendChild(h('p', { html: 'After each real run in the hallway, measure from the start line to where the car <strong>stopped</strong> and log it here. ' +
      'Your teacher and your class will see your best run on the class board.' }));
    const form = h('div', { class: 'sl-row' });
    el.appendChild(form);
    const distIn = h('input', { type: 'number', min: '0', step: 'any', id: 'sl-run-dist', placeholder: 'e.g. 4.5', style: 'width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;font-size:1rem' });
    const unit = { v: 'm' };
    const distBox = h('div', { class: 'sl-ctrl' }, [h('label', { for: 'sl-run-dist', class: 'sl-ctrl-lbl', text: 'Distance your real car went' }), distIn]);
    form.appendChild(distBox);
    const unitCtl = api.ui.choice(form, { label: 'Measured in', value: 'm', options: [{ value: 'm', label: 'metres' }, { value: 'ft', label: 'feet' }], onChange: function (v) { unit.v = v; } });
    const noteIn = h('input', { type: 'text', maxlength: '80', id: 'sl-run-note', placeholder: 'What did you change? (optional)', style: 'width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;font-size:0.95rem' });
    el.appendChild(h('div', { class: 'sl-ctrl' }, [h('label', { for: 'sl-run-note', class: 'sl-ctrl-lbl', text: 'Note' }), noteIn]));
    const classSel = h('select', { id: 'sl-run-class', style: 'display:none;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.25)' });
    el.appendChild(h('div', { class: 'sl-ctrl' }, [h('label', { for: 'sl-run-class', class: 'sl-ctrl-lbl', id: 'sl-run-class-lbl', style: 'display:none', text: 'Class' }), classSel]));
    // stays disabled until the student's classes have loaded, so a run is never saved without its class
    const btn = h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: 'Loading your classes…', disabled: true });
    const msg = h('div', { class: 'sl-ctrl', 'aria-live': 'polite' });
    el.appendChild(btn); el.appendChild(msg);
    const mine = h('div');
    el.appendChild(mine);
    if (!me) return;

    {
      myClasses = [];
      const ready = function () { btn.disabled = false; btn.textContent = '🏁 Log this run'; };
      db().collection('enrollments').where('uid', '==', me.uid).get().then(function (snap) {
        myClasses = snap.docs.map(function (d) { return d.data(); }).filter(function (x) { return x.classId; })
          .map(function (x) { return { id: x.classId, name: x.className || 'Class' }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
        classSel.textContent = '';
        if (myClasses.length > 1) classSel.appendChild(h('option', { value: '', disabled: true, selected: true, text: 'Choose your class' }));
        myClasses.forEach(function (c) { classSel.appendChild(h('option', { value: c.id, text: c.name })); });
        const show = myClasses.length > 1;
        classSel.style.display = show ? '' : 'none';
        document.getElementById('sl-run-class-lbl').style.display = show ? '' : 'none';
        ready();
      }).catch(function () { myClasses = []; ready(); });
      const un = db().collection('sailcar_runs').where('userEmail', '==', me.email).onSnapshot(function (snap) {
        // a run that is still saving has no server time yet: use the estimated time so it sorts last
        const runs = snap.docs.map(function (d) { return d.data({ serverTimestamps: 'estimate' }); }).sort(function (a, b) { return (a.savedAt ? a.savedAt.toMillis() : 0) - (b.savedAt ? b.savedAt.toMillis() : 0); });
        mine.textContent = '';
        if (!runs.length) return;
        mine.appendChild(h('h3', { class: 'sl-step-title', style: 'font-size:0.9rem;margin-top:14px', text: '📋 My runs' }));
        const t = h('table', { class: 'sl-table' });
        t.appendChild(h('thead', null, [h('tr', null, [h('th', { text: 'Run' }), h('th', { text: 'Real' }), h('th', { text: 'Predicted' }), h('th', { text: 'Real ÷ predicted' }), h('th', { text: 'Note' })])]));
        const tb = h('tbody');
        runs.forEach(function (r, i) {
          const pct = r.predictedM > 0 ? Math.round(r.distanceM / r.predictedM * 100) + '%' : '—';
          tb.appendChild(h('tr', null, [h('td', { text: String(i + 1) }), h('td', { text: api.fmt(r.distanceM, 2) + ' m' }), h('td', { text: r.predictedM > 0 ? api.fmt(r.predictedM, 2) + ' m' : '—' }), h('td', { text: pct }), h('td', { text: String(r.note || ''), style: 'text-align:left;white-space:normal' })]));
        });
        t.appendChild(tb);
        mine.appendChild(h('div', { class: 'sl-table-wrap' }, [t]));
      }, function (err) {
        mine.textContent = '';
        if (err && err.code === 'permission-denied') api.ui.note(mine, 'warn', '⚠️ Run logging isn’t switched on in the class database yet — ask your teacher.');
      });
      unsubs.push(un);
    }
    api.onLeave(function () { unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = []; });

    btn.addEventListener('click', function () {
      msg.textContent = '';
      const v = parseFloat(distIn.value);
      const m = unit.v === 'ft' ? v / FT_PER_M : v;
      if (!(v >= 0) || !(m <= 100)) { msg.textContent = 'Type the distance your car went (0 to 100 m).'; return; }
      let cls = { id: '', name: '' };
      if (myClasses.length === 1) cls = myClasses[0];
      else if (myClasses.length > 1) {
        if (!classSel.value) { msg.textContent = 'Choose your class first.'; return; }
        cls = myClasses.find(function (c) { return c.id === classSel.value; }) || cls;
      }
      const rec = {
        uid: me.uid, userEmail: me.email || '', name: String(me.displayName || me.email || '').slice(0, 60),
        classId: cls.id, className: cls.name, distanceM: Math.round(m * 100) / 100, unit: unit.v, distance: v,
        predictedM: design.predictedM || 0, design: { summary: summary(design).slice(0, 160), grams: Math.round(analyse(design).grams) },
        note: noteIn.value.trim().slice(0, 80), savedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      btn.disabled = true; btn.textContent = 'Saving…';
      db().collection('sailcar_runs').add(rec).then(function () {
        btn.disabled = false; btn.textContent = '🏁 Log this run';
        msg.textContent = '✓ Logged ' + api.fmt(rec.distanceM, 2) + ' m' + (rec.predictedM ? ' — your prediction was ' + api.fmt(rec.predictedM, 2) + ' m (' + Math.round(rec.distanceM / rec.predictedM * 100) + '%).' : '.') +
          (cls.id ? '' : ' Join your class on the Classes page so it shows on the class board.');
        distIn.value = ''; noteIn.value = '';
      }, function (err) {
        btn.disabled = false; btn.textContent = '🏁 Log this run';
        msg.textContent = err && err.code === 'permission-denied' ? 'Not saved: run logging isn’t switched on in the class database yet — ask your teacher.' : 'Not saved — check your connection and try again.';
      });
    });
  }

  // ── Step 4: class board ──
  function renderBoard(el, api) {
    const h = api.h;
    me = firebase.auth().currentUser;
    if (!me) return;
    const isTeacher = me.email === TEACHER_EMAIL;
    const tabs = h('div', { class: 'sl-chips', role: 'tablist', style: 'margin-bottom:12px' });
    const box = h('div', { class: 'sl-table-wrap' });
    el.appendChild(tabs); el.appendChild(box);
    let classes = [], runsByClass = {}, active = null;
    function draw() {
      tabs.textContent = '';
      classes.forEach(function (c) {
        const b = h('button', { type: 'button', class: 'sl-chip' + (c.id === active ? ' active' : ''), role: 'tab', 'aria-selected': String(c.id === active), text: c.name });
        b.addEventListener('click', function () { active = c.id; draw(); });
        tabs.appendChild(b);
      });
      box.textContent = '';
      if (!classes.length) { box.appendChild(h('p', { class: 'sl-muted', text: isTeacher ? 'No classes yet.' : 'Join your class on the Classes page to see your class board.' })); return; }
      const runs = runsByClass[active] || [];
      const best = {};
      runs.forEach(function (r) { const k = r.uid || r.userEmail; if (!best[k] || r.distanceM > best[k].distanceM) best[k] = r; });
      const rows = Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, b) { return b.distanceM - a.distanceM; });
      if (!rows.length) { box.appendChild(h('p', { class: 'sl-muted', text: 'No runs logged for this class yet.' })); return; }
      const t = h('table', { class: 'sl-table' });
      const head = [h('th', { text: '#' }), h('th', { text: 'Name' }), h('th', { text: 'Best real run' }), h('th', { text: 'Predicted' }), h('th', { text: 'Design' })];
      if (isTeacher) head.push(h('th', { 'aria-label': 'Delete' }));
      t.appendChild(h('thead', null, [h('tr', null, head)]));
      const tb = h('tbody');
      rows.forEach(function (r, i) {
        const cells = [h('td', { text: i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1) }), h('td', { text: String(r.name || 'Anonymous') }),
          h('td', { text: api.fmt(r.distanceM, 2) + ' m (' + api.fmt(r.distanceM * FT_PER_M, 1) + ' ft)' }),
          h('td', { text: r.predictedM > 0 ? api.fmt(r.predictedM, 2) + ' m' : '—' }),
          h('td', { text: String((r.design && r.design.summary) || ''), style: 'text-align:left;white-space:normal;font-size:0.8rem' })];
        if (isTeacher) {
          const del = h('button', { type: 'button', class: 'sl-btn', text: '✕', 'aria-label': 'Delete the run for ' + r.name, style: 'padding:4px 10px' });
          del.addEventListener('click', function () { if (confirm('Delete this run for ' + r.name + '?')) db().collection('sailcar_runs').doc(r.id).delete().catch(function () { alert('Could not delete — check your connection.'); }); });
          cells.push(h('td', null, [del]));
        }
        tb.appendChild(h('tr', null, cells));
      });
      t.appendChild(tb);
      box.appendChild(t);
      box.appendChild(h('p', { class: 'sl-muted', text: isTeacher ? 'Best real run per student. Only you and this class can see this board. (✕ deletes that run.)' : 'Best real run per student. Only your class and your teacher can see this board.' }));
    }
    function watch(classId) {
      const un = db().collection('sailcar_runs').where('classId', '==', classId).onSnapshot(function (snap) {
        runsByClass[classId] = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        draw();
      }, function (err) { box.textContent = ''; api.ui.note(box, 'warn', '⚠️ The class board isn’t switched on in the class database yet' + (isTeacher ? ' — publish the new Firestore rules.' : ' — ask your teacher.')); });
      unsubs.push(un);
    }
    if (isTeacher) {
      db().collection('classes').where('teacherEmail', '==', TEACHER_EMAIL).get().then(function (s) {
        const known = s.docs.map(function (d) { return { id: d.id, name: d.data().name || 'Class' }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
        const un = db().collection('sailcar_runs').onSnapshot(function (snap) {
          runsByClass = {};
          snap.docs.forEach(function (d) {
            const r = Object.assign({ id: d.id }, d.data());
            const k = known.some(function (c) { return c.id === r.classId; }) ? r.classId : '';
            (runsByClass[k] = runsByClass[k] || []).push(r);
          });
          classes = known.concat(runsByClass[''] ? [{ id: '', name: 'No class' }] : []);
          if (active == null || !classes.some(function (c) { return c.id === active; })) active = classes.length ? classes[0].id : null;
          draw();
        }, function () { box.textContent = ''; api.ui.note(box, 'warn', '⚠️ Runs can’t be loaded yet — publish the new Firestore rules.'); });
        unsubs.push(un);
      }).catch(function () { classes = []; draw(); });
      api.onLeave(function () { unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = []; });
      return;
    }
    const q = isTeacher ? null
                        : db().collection('enrollments').where('uid', '==', me.uid).get().then(function (s) { return s.docs.map(function (d) { return d.data(); }).filter(function (x) { return x.classId; }).map(function (x) { return { id: x.classId, name: x.className || 'Class' }; }); });
    q.then(function (list) {
      classes = list.sort(function (a, b) { return a.name.localeCompare(b.name); });
      active = classes.length ? classes[0].id : null;
      classes.forEach(function (c) { watch(c.id); });
      draw();
    }).catch(function () { classes = []; draw(); });
    api.onLeave(function () { unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = []; });
  }

  SailLab.register({
    id: 'studio',
    num: 7,
    title: 'Design Studio',
    icon: '🏁',
    blurb: 'Design your car, predict how far it goes, then log your real hallway runs.',
    noQuiz: true,
    steps: [
      { title: 'Design your car', html: '<p>Use everything you learned. Every choice changes the <span class="key">mass</span>, the <span class="key">push</span> from the fan, the <span class="key">friction</span> and the <span class="key">balance</span>. Your design is saved on this device.</p>', render: renderDesign },
      { title: 'Predict: run it in the hallway', render: renderPredict },
      { title: 'Race day: log your real runs', render: renderRace },
      { title: 'Class board', render: renderBoard }
    ],
    _analyse: analyse
  });
})();
