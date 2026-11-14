// Sail Car Lab — Design Studio (the final step, no check)
// 1. Design: real parts → mass, balance, friction, sail push (all fed into SailLab.physics)
// 2. Predict: run the design down the simulated hallway
// 3. Race day: log real hallway runs (sailcar_runs) and compare with the prediction
// 4. Class board: best real run per student, visible only to the class and the teacher
// Each student's design + prediction is kept with their account (sailcar_progress/{uid}.design,
// written only here and never touching 'modules') and on this device ('sailcar-design-v2-<uid>');
// whichever copy was saved last (savedMs) wins.
(function () {
  const TEACHER_EMAIL = 'ncapellini@hhh.k12.ny.us';
  const FT_PER_M = 3.28084;
  const UNIT_KEY = 'sailcar-run-unit';          // the unit this device last logged a run in
  const SAVE_WAIT_MS = 4000;                    // after this long without the server's OK, the write is waiting for Wi-Fi
  const START_X = 0.3;                          // simulate()'s start line: 30 cm in front of the fans
  const LOG_TEXT = '🏁 Log this run';
  function modelVersion() { return String(SailLab.physics.MODEL_VERSION || 'unversioned').slice(0, 24); }
  // The hallway's size lives ONLY in sailcar-core.js (SailLab.physics.HALL, 70 ft × 11 ft today):
  // every hallway number below is worked out from it, so changing it there needs no edits here.
  function hall() { return SailLab.physics.HALL; }
  // "A longer hall" (same width): room for any design to coast to a stop. It is also the most a stored
  // prediction may be (the database's 100 m cap), so a longer-hall distance always fits in bestM.
  const LONG_HALL_M = 100;
  const END_REASON = 'reached the end of the hall';   // simulate()'s exact reason
  // a run logged by hand within about half a foot of the hallway's length made it to the end
  const END_SLACK_M = 0.15;

  // Part data (approximate masses of the classroom materials)
  const CHASSIS = {
    regular: { label: 'Regular sticks (11 cm)', stick: 1.8, cross: 1.8, wheelbase: 0.10 },
    jumbo:   { label: 'Jumbo sticks (15 cm)',   stick: 4.0, cross: 4.0, wheelbase: 0.13 },
    // the rails are two sticks glued end to end; the 2 cross pieces are single regular sticks
    double:  { label: 'Two sticks end-to-end (21 cm)', stick: 3.6, cross: 1.8, wheelbase: 0.18 }
  };
  const BEARING = {      // crr with the small (3 cm) wheels
    straw: { label: 'Skewer spins in a straw', crr: 0.012 },
    taped: { label: 'Wheels spin on a taped skewer', crr: 0.022 },
    hole:  { label: 'Skewer through a cardstock hole', crr: 0.03 }
  };
  const SMALL_R = 0.015, BIG_R = 0.025;                       // wheel radius, m (3 cm and 5 cm wheels)
  const GLUE = { light: 3, normal: 6, heavy: 10 };            // grams of hot glue
  const SAIL_GSM = { paper: 80, cardstock: 200 };             // grams per square metre
  const MAST_POS = { front: 0.3, middle: 0.5, back: 0.7 };     // fraction of the wheelbase behind the front axle

  // a sensible, ordinary first car — students improve it from here
  const DEFAULT = { chassis: 'double', rails: 3, bearing: 'taped', wobbly: false, rubbing: false, bigWheels: false, square: true,
                    sailMat: 'paper', sailW: 20, sailH: 16, cupped: false, sailGap: 1, mastPos: 'middle', guys: 0, pennies: 1, glue: 'normal' };
  const CHOICES = { chassis: CHASSIS, bearing: BEARING, sailMat: SAIL_GSM, mastPos: MAST_POS, glue: GLUE };
  const RANGES = { rails: [2, 5], sailW: [8, 35], sailH: [8, 35], sailGap: [0, 15], guys: [0, 2], pennies: [0, 6] };
  const FLAGS = ['wobbly', 'rubbing', 'bigWheels', 'square'];

  // Turn a design into the numbers the physics model needs
  function analyse(d) {
    const P = SailLab.physics;
    const ch = CHASSIS[d.chassis] || CHASSIS.jumbo, wb = ch.wheelbase;
    const wheelR = d.bigWheels ? BIG_R : SMALL_R, deck = wheelR * 2 + 0.005;
    const sailArea = (d.sailW / 100) * (d.sailH / 100);
    const parts = [];
    function add(name, g, pos, height) { parts.push({ name: name, g: g, pos: pos, h: height }); }
    add('Chassis rails', d.rails * ch.stick, wb / 2, deck);
    add('Cross pieces (2)', 2 * ch.cross, wb / 2, deck);
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
    // Axle friction: the skewer rubs at its own tiny radius. The wheel is a lever that turns that
    // rubbing into a much smaller drag where the tyre meets the floor — the bigger the wheel, the
    // smaller the drag (drag ∝ axle radius ÷ wheel radius, so 5 cm wheels have 3/5 the drag of 3 cm ones).
    const axleCrr = (BEARING[d.bearing] || BEARING.straw).crr * (SMALL_R / wheelR);
    const crr = axleCrr + (d.wobbly ? 0.012 : 0) + (d.rubbing ? 0.03 : 0);
    const car = {
      mass: grams / 1000, sailArea: sailArea, sailCd: d.cupped ? 1.4 : 1.2, sailAngle: 0,
      sailHeight: deck + d.sailGap / 100 + d.sailH / 200, bodyArea: d.bigWheels ? 0.0035 : 0.003, bodyCd: 1.0,
      crr: crr, cgHeight: cgHeight, cgToFront: cgToFront, wheelbase: wb, veerDeg: d.square ? 0 : 1.5
    };
    const w0 = P.windAt(START_X);
    const push = P.airForce(w0, car.sailArea, car.sailCd, 0);                     // on the sail: this is what tips the car
    const startPush = push + P.airForce(w0, car.bodyArea, car.bodyCd, 0);         // sail + body: what must beat friction (as in simulate())
    const friction = P.rollingFriction(car.mass, car.crr);
    const tipMoment = push * (car.sailHeight - car.cgHeight), holdMoment = car.mass * P.G * car.cgToFront;
    return { car: car, parts: parts, grams: grams, push: push, startPush: startPush, friction: friction,
             canStart: startPush > friction * P.STICKY, tipMargin: holdMoment / tipMoment };
  }
  function summary(d) {
    return (CHASSIS[d.chassis] || CHASSIS.jumbo).label.replace(/ \(.*/, '') + ' · ' + d.sailW + '×' + d.sailH + ' cm ' + (d.cupped ? 'cupped ' : '') + d.sailMat + ' sail · ' +
      (BEARING[d.bearing] || BEARING.straw).label.toLowerCase() + (d.bigWheels ? ' · big wheels' : '') +
      (d.pennies ? ' · ' + d.pennies + (d.pennies === 1 ? ' penny' : ' pennies') : '');
  }

  // ── numbers for people ──
  // The model is calibrated only from past years' sled runs, so predictions are shown as a rounded
  // range (about ±20 %), never to the centimetre. predictedM itself stays exact for the % comparison.
  const TUNED_NOTE = 'The simulator was tuned with the paper sleds from past years (no wheels), so this is a good guess, not a promise — your real run in the hallway is the true test.';
  function fmt(v, d) { return SailLab.fmt(v, d); }
  function mWhole(m) { return m >= 5 ? String(Math.round(m)) : fmt(m, 1); }
  function ftWhole(m) { return String(Math.round(m * FT_PER_M)); }
  function aboutText(m) { return 'about ' + mWhole(m) + ' m (' + ftWhole(m) + ' ft)'; }
  function hallLenText() { const L = hall().length; return ftWhole(L) + ' ft (' + mWhole(L) + ' m)'; }         // "70 ft (21 m)"
  function hallWideText() { const W = hall().width; return ftWhole(W) + ' ft (' + fmt(W, 1) + ' m)'; }        // "11 ft (3.4 m)"
  // a predicted (simulated) distance that is the whole hallway: simulate() stops every such car at exactly HALL.length
  function atEnd(m) { return m >= hall().length - 0.005; }

  // A design's run in our hallway. A car that reaches the far end stops there in the simulator, tied with
  // every other car that gets there, so it is also run in a longer hall of the same width: that distance
  // ('longer') is what designs are compared by. For a car that stops inside the hallway, longer = distance.
  function longerRun(car) { return SailLab.physics.simulate(car, { hallLength: LONG_HALL_M, hallWidth: hall().width }).distance; }
  function judge(r) { const end = r.reason === END_REASON; return { distance: r.distance, reason: r.reason, end: end, longer: end ? longerRun(r.car) : r.distance }; }
  function forecast(d) { const H = hall(); return judge(SailLab.physics.simulate(analyse(d).car, { hallLength: H.length, hallWidth: H.width })); }

  // m = the simulated distance in the hallway; longer = the same car in a longer hall (only used when m is the whole hallway)
  function predictionText(m, longer) {
    const H = hall().length;
    if (atEnd(m)) return 'all the way to the end of our ' + hallLenText() + ' hallway' +
      (longer >= H + 0.5 ? ' — in a longer hall it would roll ' + aboutText(longer) : ', right about where it would stop anyway');
    // the real car can't go past the end of the hallway, so the likely range stops there
    const lo = m * 0.8, hi = m * 1.2;
    return aboutText(m) + ' — likely ' + (hi >= H ? mWhole(lo) + ' m (' + ftWhole(lo) + ' ft) up to the end of the hallway'
                                                 : mWhole(lo) + '–' + mWhole(hi) + ' m (' + ftWhole(lo) + '–' + ftWhole(hi) + ' ft)');
  }
  // bestM is a longer-hall distance: more than the hallway means that design reaches the end of ours
  function bestText(m) { return aboutText(m) + (m >= hall().length + 0.5 ? ' in a longer hall (it reaches the end of ours)' : ''); }
  // a stored prediction, short: "to reach the end of the 70 ft (21 m) hallway" / "about 16 m (52 ft)"
  function predictedText(m) { return atEnd(m) ? 'to reach the end of the ' + hallLenText() + ' hallway' : aboutText(m); }
  // a prediction in a table cell; one made with another physics model (another hallway) is shown as it was
  function predictedCell(r) { return r.predictedM > 0 ? (r.model === modelVersion() && atEnd(r.predictedM) ? 'end of hall' : mWhole(r.predictedM) + ' m') : '—'; }
  // a real, hand-measured run that made it to the far end of the hallway
  function realAtEnd(m) { return m >= hall().length - END_SLACK_M; }
  function trimNum(v) { return String(Math.round(v * 100) / 100); }
  // a real distance in the unit it was measured in, then the other unit: "52 ft (15.85 m)" / "4.20 m (13.8 ft)"
  function bothUnits(v, unit) { return unit === 'ft' ? trimNum(v) + ' ft (' + fmt(v / FT_PER_M, 2) + ' m)' : fmt(v, 2) + ' m (' + fmt(v * FT_PER_M, 1) + ' ft)'; }

  // ── the design store: one design per account ──
  function clamp(v, lo, hi) { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo; }
  // only known keys with sensible values get in, so a damaged copy can't break the maths
  function clean(raw) {
    const d = Object.assign({}, DEFAULT, { predictedM: 0, bestM: 0, model: modelVersion(), savedMs: 0 });
    if (!raw || typeof raw !== 'object') return d;
    Object.keys(CHOICES).forEach(function (k) { if (typeof raw[k] === 'string' && Object.prototype.hasOwnProperty.call(CHOICES[k], raw[k])) d[k] = raw[k]; });
    Object.keys(RANGES).forEach(function (k) { if (typeof raw[k] === 'number' && isFinite(raw[k])) d[k] = Math.round(clamp(raw[k], RANGES[k][0], RANGES[k][1])); });
    FLAGS.forEach(function (k) { if (typeof raw[k] === 'boolean') d[k] = raw[k]; });
    d.savedMs = clamp(raw.savedMs, 0, 1e15);
    // a prediction made with a different physics model (e.g. the old one-fan wind) no longer counts
    if (raw.model === d.model) { d.predictedM = clamp(raw.predictedM, 0, 100); d.bestM = clamp(raw.bestM, 0, 100); }
    return d;
  }
  function cloudCopy(d) {
    const o = {};
    Object.keys(DEFAULT).forEach(function (k) { o[k] = d[k]; });
    o.predictedM = d.predictedM || 0; o.bestM = d.bestM || 0; o.model = modelVersion(); o.savedMs = d.savedMs || 0;
    return o;
  }
  function db() { return firebase.firestore(); }
  function currentUser() { try { return firebase.auth().currentUser; } catch (e) { return null; } }

  let design = clean(null), designUid = null, designUser = null;
  let cloudDirty = false, cloudTimer = null, cloudStatus = '';
  const watchers = [];
  function localKey(uid) { return 'sailcar-design-v2-' + uid; }
  function saveLocal() { if (designUid) try { localStorage.setItem(localKey(designUid), JSON.stringify(design)); } catch (e) {} }
  function notify(what) { watchers.slice().forEach(function (fn) { try { fn(what); } catch (e) { console.error(e); } }); }
  function watch(api, fn) { watchers.push(fn); api.onLeave(function () { const i = watchers.indexOf(fn); if (i >= 0) watchers.splice(i, 1); }); }
  function setStatus(s) { cloudStatus = s; notify('status'); }
  const STATUS_TEXT = {
    cloud: '💾 Saved to your account — it follows you to any Chromebook or phone you sign in on.',
    saving: '💾 Saving to your account…',
    offline: '💾 Saved on this device — it will go to your account when Wi-Fi is back.',
    local: '💾 Saved on this device only (the class database isn’t taking designs yet).'
  };
  // a cloud copy wins only if it was saved later than the one we have
  function adoptCloud(cd) {
    if (!cd || typeof cd !== 'object') return false;
    const c = clean(cd);
    if (!(c.savedMs > design.savedMs)) return false;
    design = c; saveLocal();
    return true;
  }
  // Load the signed-in student's design: this device's copy, the copy the core read at sign-in,
  // then a fresh read of sailcar_progress/{uid} (it may have been saved on another device since).
  function useDesignFor(user) {
    const uid = user ? user.uid : 'anon';
    if (uid === designUid) return;
    flushCloud();
    designUid = uid; designUser = user || null; cloudDirty = false; cloudStatus = '';
    let local = null;
    try { local = JSON.parse(localStorage.getItem(localKey(uid)) || 'null'); } catch (e) {}
    design = clean(local);
    if (!user) return;
    const pr = SailLab.progress;
    if (pr && pr.mode === 'cloud' && pr.user && pr.user.uid === uid && pr.data && pr.data.design) adoptCloud(pr.data.design);
    try {
      db().collection('sailcar_progress').doc(uid).get().then(function (doc) {
        if (designUid !== uid) return;
        const cd = doc.exists ? (doc.data() || {}).design : null;
        if (adoptCloud(cd)) notify('design');
        if (design.savedMs > ((cd && Number(cd.savedMs)) || 0)) { cloudDirty = true; flushCloud(); }   // this device has newer work: upload it
        else setStatus(cd ? 'cloud' : '');
      }).catch(function (err) { if (designUid === uid) setStatus(err && err.code === 'permission-denied' ? 'local' : 'offline'); });
    } catch (e) { setStatus('local'); }
  }
  // every change: save on this device now, in the student's account a moment later
  function touch() {
    design.savedMs = Date.now(); design.model = modelVersion();
    saveLocal();
    cloudDirty = true;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(flushCloud, 1500);
  }
  function flushCloud() {
    clearTimeout(cloudTimer); cloudTimer = null;
    const user = designUser;
    if (!cloudDirty || !user || typeof firebase === 'undefined') return;
    cloudDirty = false;
    const uid = user.uid;
    let settled = false;
    setStatus('saving');
    const wait = setTimeout(function () { if (!settled && designUid === uid) setStatus('offline'); }, SAVE_WAIT_MS);
    try {
      // only design (+ who it belongs to): never 'modules', which the core owns
      db().collection('sailcar_progress').doc(uid).set({
        uid: uid, name: String(user.displayName || user.email || '').slice(0, 100), email: String(user.email || '').slice(0, 100),
        design: cloudCopy(design), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { mergeFields: ['uid', 'name', 'email', 'design', 'updatedAt'] }).then(function () {
        settled = true; clearTimeout(wait);
        if (designUid === uid && !cloudDirty && cloudStatus !== 'local') setStatus('cloud');
      }, function (err) {
        settled = true; clearTimeout(wait);
        if (designUid !== uid) return;
        const denied = err && err.code === 'permission-denied';
        if (!denied) cloudDirty = true;                    // try again with the next change
        setStatus(denied ? 'local' : 'offline');
      });
    } catch (e) { settled = true; clearTimeout(wait); setStatus('local'); }
  }
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('pagehide', flushCloud);

  // listeners and timers that belong to one rendering of one step; all stop when the student leaves,
  // including ones attached by an async callback that only finishes after they left
  function lifetime(api) {
    const subs = [], timers = [];
    const life = {
      left: false,
      keep: function (un) { if (life.left) { try { un(); } catch (e) {} } else subs.push(un); },
      later: function (fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; }
    };
    api.onLeave(function () {
      life.left = true;
      subs.splice(0).forEach(function (u) { try { u(); } catch (e) {} });
      timers.splice(0).forEach(function (t) { clearTimeout(t); });
    });
    return life;
  }

  // ── Step 1: design ──
  function renderDesign(el, api) {
    useDesignFor(currentUser());
    const h = api.h, ui = api.ui;
    const root = h('div');
    el.appendChild(root);
    const status = h('p', { class: 'sl-muted', 'aria-live': 'polite' });
    function showStatus() { status.textContent = STATUS_TEXT[cloudStatus] || ''; }
    let refresh = function () {};
    function build() {
      root.textContent = '';
      const wrap = h('div', { class: 'sl-row' });
      root.appendChild(wrap);
      const left = h('div'), right = h('div');
      wrap.appendChild(left); wrap.appendChild(right);
      function set(k) { return function (v) { design[k] = v; design.predictedM = 0; touch(); refresh(); }; }
      left.appendChild(h('h3', { class: 'sl-step-title', style: 'font-size:0.9rem;margin:6px 0', text: '🪵 Chassis & wheels' }));
      ui.choice(left, { label: 'Chassis', value: design.chassis, options: Object.keys(CHASSIS).map(function (k) { return { value: k, label: CHASSIS[k].label }; }), onChange: set('chassis') });
      ui.slider(left, { label: 'Sticks along the chassis', min: 2, max: 5, step: 1, value: design.rails, format: function (v) { return v + ' (+2 cross pieces)'; }, onInput: set('rails') });
      ui.choice(left, { label: 'Axles', value: design.bearing, options: Object.keys(BEARING).map(function (k) { return { value: k, label: BEARING[k].label }; }), onChange: set('bearing') });
      ui.choice(left, { label: 'Wheels', value: design.bigWheels ? 'big' : 'small', options: [{ value: 'small', label: 'Small (3 cm)' }, { value: 'big', label: 'Big (5 cm)' }], onChange: function (v) { set('bigWheels')(v === 'big'); } });
      left.appendChild(h('p', { class: 'sl-muted', style: 'margin:-6px 0 10px;font-size:0.8rem;line-height:1.45',
        text: 'Why big wheels roll easier: the axle rubs at a tiny radius, and the wheel works like a lever that turns that rubbing into a smaller drag at the floor. A 5 cm wheel has about 3/5 of the axle drag of a 3 cm wheel — but 4 big wheels weigh 8 g more.' }));
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
      root.appendChild(card);
      const pic = api.svg('svg', { viewBox: '0 0 560 200', role: 'img', 'aria-label': 'Your car' }, root);
      refresh = function () {
        const a = analyse(design);
        card.textContent = '';
        function line(label, value, color) { card.appendChild(h('div', null, [h('strong', { text: label + ': ' }), h('span', { text: value, style: color ? 'color:' + color : '' })])); }
        line('Mass', api.fmt(a.grams, 0) + ' g');
        line('Starting push from the fans', api.fmt(a.startPush, 3) + ' N');
        // red exactly when simulate() would say "never moved": the start push can't beat sticky friction
        line('Friction', api.fmt(a.friction, 3) + ' N' + (a.canStart ? '' : ' — too much: the fans can’t get it rolling'), a.canStart ? '' : '#ff8080');
        const tm = a.tipMargin;
        line('Tipping safety', tm >= 1.5 ? 'Safe (' + api.fmt(tm, 1) + '× what it needs)'
                             : tm >= 1 ? 'Close to tipping (' + api.fmt(tm, 2) + '×) — lower the sail, or tape a penny low at the back'
                             : 'TIPS OVER — lower the sail, move weight back, or use a smaller sail',
             tm >= 1.5 ? '#40e080' : tm >= 1 ? '#f0c040' : '#ff8080');
        // drawn at the real on-screen width (like the hallway simulator), so the label stays readable on a phone
        const W = Math.max(300, Math.min(560, Math.round(root.clientWidth || 560))), FLOOR = 175;
        pic.setAttribute('viewBox', '0 0 ' + W + ' 200');
        pic.textContent = '';
        api.svg('rect', { x: 0, y: 0, width: W, height: 200, rx: 12, fill: '#120826' }, pic);
        api.svg('line', { x1: 16, y1: FLOOR, x2: W - 16, y2: FLOOR, stroke: '#4a3a6a', 'stroke-width': 3 }, pic);
        // the whole car (wheels + deck + mast) must fit in the picture
        const wr = design.bigWheels ? 2.5 : 1.5, len = a.car.wheelbase * 100 + 2 * wr, tallCm = 2 * wr + 1.5 + design.sailGap + design.sailH;
        const scale = Math.min(4.5, 150 / tallCm, (W - 120) / len), x0 = W / 2 - len * scale / 2;
        const frontAxle = x0 + len * scale - wr * scale;
        const mastX = frontAxle - MAST_POS[design.mastPos] * a.car.wheelbase * 100 * scale;
        api.draw.car(pic, x0, FLOOR, { scale: scale, length: len, sailW: design.sailW, sailH: design.sailH, mastH: design.sailGap + design.sailH, mastAt: (mastX - x0) / (len * scale),
                                       cupped: design.cupped, wheelR: wr, sailColor: design.sailMat === 'cardstock' ? '#f0d8a0' : '#f0e6ff' });
        const cgX = frontAxle - a.car.cgToFront * 100 * scale, cgY = FLOOR - a.car.cgHeight * 100 * scale;
        api.svg('circle', { cx: cgX, cy: cgY, r: 6, fill: '#00a8ff', stroke: '#fff', 'stroke-width': 1.5 }, pic);
        const roomRight = cgX + 110 < W;
        api.svg('text', { x: roomRight ? cgX + 10 : cgX - 10, y: cgY - 8, 'text-anchor': roomRight ? 'start' : 'end', fill: '#7ad7ff', 'font-size': 14, 'font-weight': 700, class: 'sl-lbl' }, pic, 'balance point');
      };
      refresh();
      ui.note(root, 'build', '🛠️ Everything here is a real choice you can make with your materials. The masses are close to real ones — weigh your parts on a kitchen scale to check.');
      root.appendChild(status);
      showStatus();
    }
    build();
    watch(api, function (what) { if (what === 'design') build(); else showStatus(); });
    let lastW = 0;
    function onResize() { const w = root.clientWidth; if (w && w !== lastW) { lastW = w; refresh(); } }
    window.addEventListener('resize', onResize);
    api.onLeave(function () { window.removeEventListener('resize', onResize); flushCloud(); });
  }

  // ── Step 2: predict ──
  function renderPredict(el, api) {
    useDesignFor(currentUser());
    const h = api.h;
    const about = h('p');
    function showDesign() { about.textContent = 'Your design: ' + summary(design) + ' — ' + api.fmt(analyse(design).grams, 0) + ' g.'; }
    showDesign();
    el.appendChild(about);
    el.appendChild(h('p', { html: 'In the simulator the car starts <strong>' + Math.round(START_X * 100) + ' cm</strong> in front of two box fans on high, side by side, at the start of a hallway ' +
      hallLenText() + ' long and ' + hallWideText() + ' wide — like ours. Run it, then go back and change one thing at a time to see what helps most.' }));
    el.appendChild(h('p', { class: 'sl-muted', text: 'A car that reaches the far end can’t go any farther, so every car that gets there ties. When yours does, the simulator also works out how far it would roll in a longer hall — use that number to compare designs that all reach the end.' }));
    const best = h('div', { class: 'sl-note sl-note-good', 'aria-live': 'polite' });
    function say(main, strongText, rest) {
      best.textContent = '';
      best.appendChild(h('div', null, [main, strongText ? h('strong', { text: strongText }) : null, rest || null]));
      if (strongText) best.appendChild(h('div', { style: 'margin-top:6px;font-size:0.85rem;color:#c8b8ea', text: TUNED_NOTE }));
    }
    function showLast() {
      // the longer-hall distance isn't stored: the same design in the same model always rolls the same, so work it out again
      if (design.predictedM > 0) say('🔮 Your last prediction for this design: ', predictionText(design.predictedM, atEnd(design.predictedM) ? forecast(design).longer : 0), '.');
      else say('🔮 Run the simulator to get your prediction.');
    }
    const sim = api.ui.trackSim(el, function () { return analyse(design).car; }, {
      scaleM: hall().length,            // the whole hallway, start line to far end, the same view every run so designs are easy to compare
      getOpts: function () { const H = hall(); return { hallLength: H.length, hallWidth: H.width }; },
      onResult: function (res) {
        const r = judge(res);
        design.predictedM = Math.round(r.distance * 100) / 100;                 // in OUR hallway: what race day compares with
        design.bestM = Math.max(design.bestM || 0, Math.round(r.longer * 100) / 100);   // compared in a longer hall, so designs that reach the end still rank
        touch(); flushCloud();          // the prediction goes to the account straight away, ready for race day
        if (r.reason === 'tipped over') say('🤸 In the simulator this design tips over at the start line. Go back, lower the sail, or tape a penny low at the back.');
        else if (r.reason === 'never moved') say('😴 In the simulator this design never starts rolling: friction beats the fans’ push. Go back and fix the axles or use a bigger sail.');
        else say('🔮 Prediction for this design: ', predictionText(design.predictedM, r.longer),
                 '.' + (r.reason === 'hit the wall' ? ' (It veered into the wall — square the axles with a ruler.)' : '') + ' Your best design so far: ' + bestText(design.bestM) + '.');
      }
    });
    el.appendChild(best);
    showLast();
    watch(api, function (what) { if (what === 'design') { showDesign(); showLast(); } });
    api.onLeave(function () { sim.stop(); flushCloud(); });
  }

  // ── Step 3: race day ──
  function renderRace(el, api) {
    const h = api.h;
    const me = currentUser();
    const isTeacher = !!(me && me.email === TEACHER_EMAIL);
    if (isTeacher) {
      api.ui.note(el, 'tip', '👩‍🏫 <strong>Teacher:</strong> students log their own runs here after each hallway run (in feet or metres, plus an optional note). The design and prediction saved with their account are logged with it. You see every class on the next step and can delete a run there.');
      return;
    }
    useDesignFor(me);
    const life = lifetime(api);
    el.appendChild(h('p', { html: 'After each real run in the hallway, measure from the start line to where the car <strong>stopped</strong> and log it here. ' +
      'If it made it all the way to the far end of the hallway, about ' + hallLenText() + ' away, measure to the end — every car that gets there ties. ' +
      'Your teacher and your class will see your best run on the class board.' }));
    const designLine = h('div', { class: 'sl-note sl-note-tip' });
    function showDesignLine() {
      designLine.textContent = '';
      designLine.appendChild(h('strong', { text: 'Design being logged: ' }));
      designLine.appendChild(document.createTextNode(summary(design) + ' · ' + Math.round(analyse(design).grams) + ' g · ' +
        (design.predictedM > 0 ? 'predicted ' + predictedText(design.predictedM) : 'no prediction yet (run the simulator in step 2)') + '. Not the car you raced? Go back to step 1 and set it up.'));
    }
    showDesignLine();
    el.appendChild(designLine);
    watch(api, function (what) { if (what === 'design') showDesignLine(); });

    // feet by default (US tape measures; the hallway is marked in feet); this device remembers the last unit
    let unit = 'ft';
    try { const u = localStorage.getItem(UNIT_KEY); if (u === 'm' || u === 'ft') unit = u; } catch (e) {}
    function placeholder() { return unit === 'ft' ? 'e.g. 52 ft' : 'e.g. 16 m'; }
    const form = h('div', { class: 'sl-row' });
    el.appendChild(form);
    const distIn = h('input', { type: 'number', min: '0', step: 'any', inputmode: 'decimal', id: 'sl-run-dist', placeholder: placeholder(), style: 'width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;font-size:1rem' });
    form.appendChild(h('div', { class: 'sl-ctrl' }, [h('label', { for: 'sl-run-dist', class: 'sl-ctrl-lbl', text: 'Distance your real car went' }), distIn]));
    let confirmKey = null;          // a surprising distance needs a second tap on Log
    api.ui.choice(form, { label: 'Measured in', value: unit, options: [{ value: 'ft', label: 'feet' }, { value: 'm', label: 'metres' }],
      onChange: function (v) { unit = v; confirmKey = null; distIn.placeholder = placeholder(); try { localStorage.setItem(UNIT_KEY, v); } catch (e) {} } });
    distIn.addEventListener('input', function () { confirmKey = null; });
    const noteIn = h('input', { type: 'text', maxlength: '80', id: 'sl-run-note', placeholder: 'What did you change? (optional)', style: 'width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;font-size:0.95rem' });
    el.appendChild(h('div', { class: 'sl-ctrl' }, [h('label', { for: 'sl-run-note', class: 'sl-ctrl-lbl', text: 'Note' }), noteIn]));
    const classSel = h('select', { id: 'sl-run-class', style: 'display:none;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.25)' });
    const classLbl = h('label', { for: 'sl-run-class', class: 'sl-ctrl-lbl', style: 'display:none', text: 'Class' });
    el.appendChild(h('div', { class: 'sl-ctrl' }, [classLbl, classSel]));
    // stays disabled until the student's classes have loaded from the server, so a run is never saved without its class
    const btn = h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: 'Loading your classes…', disabled: true });
    const retry = h('button', { type: 'button', class: 'sl-btn', text: '↻ Retry', style: 'display:none;margin-left:8px' });
    const msg = h('div', { class: 'sl-ctrl', 'aria-live': 'polite' });
    function say(text, warn) { msg.textContent = text; msg.style.color = warn ? '#ffd070' : ''; }
    el.appendChild(h('div', null, [btn, retry])); el.appendChild(msg);
    const mine = h('div');
    el.appendChild(mine);
    if (!me) return;

    let classesOk = false, myClasses = [];
    function loadClasses() {
      classesOk = false; btn.disabled = true; btn.textContent = 'Loading your classes…'; retry.style.display = 'none';
      if (/Couldn’t load your classes/.test(msg.textContent)) say('');
      db().collection('enrollments').where('uid', '==', me.uid).get().then(function (snap) {
        if (life.left) return;
        // offline, Firestore answers from its (empty) cache: that is not "no classes"
        if (snap.metadata && snap.metadata.fromCache) throw Object.assign(new Error('offline'), { code: 'unavailable' });
        myClasses = snap.docs.map(function (d) { return d.data(); }).filter(function (x) { return x.classId; })
          .map(function (x) { return { id: String(x.classId), name: String(x.className || 'Class') }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
        classSel.textContent = '';
        if (myClasses.length > 1) classSel.appendChild(h('option', { value: '', disabled: true, selected: true, text: 'Choose your class' }));
        myClasses.forEach(function (c) { classSel.appendChild(h('option', { value: c.id, text: c.name })); });
        const show = myClasses.length > 1;
        classSel.style.display = show ? '' : 'none';
        classLbl.style.display = show ? '' : 'none';
        classesOk = true; btn.disabled = false; btn.textContent = LOG_TEXT;
      }).catch(function () {
        if (life.left) return;
        classesOk = false; btn.disabled = true; btn.textContent = LOG_TEXT;
        retry.style.display = '';
        say('Couldn’t load your classes — check Wi-Fi and tap Retry.', true);
      });
    }
    retry.addEventListener('click', loadClasses);
    loadClasses();

    life.keep(db().collection('sailcar_runs').where('userEmail', '==', me.email).onSnapshot(function (snap) {
      if (life.left) return;
      // a run that is still saving has no server time yet: use the estimated time so it sorts last
      const runs = snap.docs.map(function (d) { return Object.assign({}, d.data({ serverTimestamps: 'estimate' }), { id: d.id }); })
        .sort(function (a, b) { return (a.savedAt ? a.savedAt.toMillis() : 0) - (b.savedAt ? b.savedAt.toMillis() : 0); });
      mine.textContent = '';
      if (!runs.length) return;
      mine.appendChild(h('h3', { class: 'sl-step-title', style: 'font-size:0.9rem;margin-top:14px', text: '📋 My runs' }));
      const t = h('table', { class: 'sl-table' });
      t.appendChild(h('thead', null, [h('tr', null, [h('th', { text: 'Run' }), h('th', { text: 'Real' }), h('th', { text: 'Predicted' }), h('th', { text: 'Real ÷ predicted' }), h('th', { text: 'Note' })])]));
      const tb = h('tbody');
      runs.forEach(function (r, i) {
        const pct = r.predictedM > 0 ? Math.round(r.distanceM / r.predictedM * 100) + '%' : '—';
        // in the unit it was measured in first: "13.5 ft (4.11 m)"
        const real = typeof r.distance === 'number' && (r.unit === 'ft' || r.unit === 'm') ? bothUnits(r.distance, r.unit) : bothUnits(r.distanceM, 'm');
        tb.appendChild(h('tr', null, [h('td', { text: String(i + 1) }), h('td', { text: real }),
          h('td', { text: predictedCell(r) }), h('td', { text: pct }), h('td', { text: String(r.note || ''), style: 'text-align:left;white-space:normal' })]));
      });
      t.appendChild(tb);
      mine.appendChild(h('div', { class: 'sl-table-wrap' }, [t]));
    }, function (err) {
      if (life.left) return;
      mine.textContent = '';
      if (err && err.code === 'permission-denied') api.ui.note(mine, 'warn', '⚠️ Run logging isn’t switched on in the class database yet — ask your teacher.');
    }));

    function loggedText(rec) {
      const pct = rec.predictedM > 0 ? Math.round(rec.distanceM / rec.predictedM * 100) : 0;
      return '✓ Logged ' + bothUnits(rec.distance, rec.unit) +
        (!(rec.predictedM > 0) ? '.'
          : atEnd(rec.predictedM) ? ' — you predicted it would reach the end of the hallway' + (realAtEnd(rec.distanceM) ? ', and it did!' : ', and this run went ' + pct + '% of the way there.')
          : ' — your prediction was ' + aboutText(rec.predictedM) + ', so this run went ' + pct + '% of it.') +
        (rec.classId ? '' : ' Join your class on the Classes page so it shows on the class board.');
    }
    function save(rec) {
      btn.disabled = true; btn.textContent = 'Saving…';
      let settled = false, queued = false;
      // offline the write waits in Firestore's queue and its promise only settles once it reaches the server
      life.later(function () {
        if (settled) return;
        queued = true;
        btn.disabled = !classesOk; btn.textContent = LOG_TEXT;
        distIn.value = ''; noteIn.value = '';
        say('📶 ' + bothUnits(rec.distance, rec.unit) + ' saved on this device — it will upload when Wi-Fi is back. Keep this page open until you see ✓.', true);
      }, SAVE_WAIT_MS);
      db().collection('sailcar_runs').add(rec).then(function () {
        settled = true;
        if (life.left) return;
        if (!queued) { btn.disabled = !classesOk; btn.textContent = LOG_TEXT; distIn.value = ''; noteIn.value = ''; }
        say(loggedText(rec) + (queued ? ' (Uploaded now that Wi-Fi is back.)' : ''));
      }, function (err) {
        settled = true;
        if (life.left) return;
        btn.disabled = !classesOk; btn.textContent = LOG_TEXT;
        const why = err && err.code === 'permission-denied' ? 'run logging isn’t switched on in the class database yet — ask your teacher.' : 'check your connection and try again.';
        say(queued ? 'Your ' + bothUnits(rec.distance, rec.unit) + ' run was NOT saved: ' + why : 'Not saved: ' + why, true);
      });
    }
    btn.addEventListener('click', function () {
      if (!classesOk) return;
      say('');
      const v = parseFloat(distIn.value), u = unit;
      const m = u === 'ft' ? v / FT_PER_M : v;
      if (!(v >= 0) || !(m <= 100)) { say('Type the distance your car went (0 to ' + (u === 'ft' ? '328 ft' : '100 m') + ').', true); return; }
      let cls = { id: '', name: '' };
      if (myClasses.length === 1) cls = myClasses[0];
      else if (myClasses.length > 1) {
        if (!classSel.value) { say('Choose your class first.', true); return; }
        cls = myClasses.find(function (c) { return c.id === classSel.value; }) || cls;
      }
      // a typo (an extra digit, or metres typed as feet) gets a second look before it goes on the board
      // (5 % slack: the hallway is "about" that long, and a car that reaches the end is measured by hand)
      const H = hall().length, pred = design.predictedM > 0 ? design.predictedM : 0, key = u + ':' + v;
      const why = m > H * 1.05 ? 'longer than our ' + hallLenText() + ' hallway'
                : pred > 0 && m > 2.5 * pred ? 'more than 2.5 times your prediction (' + aboutText(pred) + ')' : '';
      if (why && confirmKey !== key) {
        confirmKey = key;
        say('That’s ' + (u === 'ft' ? trimNum(v) + ' ft (' + Math.round(m) + ' m)' : trimNum(v) + ' m (' + ftWhole(v) + ' ft)') + ' — ' + why + '. Tap Log again if that’s right.', true);
        return;
      }
      confirmKey = null;
      const rec = {
        uid: me.uid, userEmail: me.email || '', name: String(me.displayName || me.email || '').slice(0, 60),
        classId: cls.id, className: String(cls.name || '').slice(0, 80),
        distanceM: Math.round(m * 100) / 100, unit: u, distance: Math.round(v * 100) / 100,
        predictedM: Math.min(100, Math.max(0, pred)), model: modelVersion(),
        design: { summary: summary(design).slice(0, 160), grams: Math.round(analyse(design).grams) },
        note: noteIn.value.trim().slice(0, 80), savedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      save(rec);
    });
  }

  // ── Step 4: class board ──
  // Farthest first. Runs that made it to the end of the hallway can't be beaten here, so they all tie (🏁);
  // equal distances tie too. rank = 1 + the number of runs that went strictly farther ("1, 1, 3").
  function rankRows(rows) {
    const endM = hall().length - END_SLACK_M;
    function score(r) { return realAtEnd(r.distanceM) ? endM : Math.round(r.distanceM * 100) / 100; }
    rows.sort(function (a, b) { return score(b) - score(a) || b.distanceM - a.distanceM; });
    rows.forEach(function (r, i) {
      r.atEnd = realAtEnd(r.distanceM);
      r.rank = i > 0 && score(r) === score(rows[i - 1]) ? rows[i - 1].rank : i + 1;
    });
    return rows;
  }
  function renderBoard(el, api) {
    const h = api.h;
    const me = currentUser();
    if (!me) return;
    const life = lifetime(api);
    const isTeacher = me.email === TEACHER_EMAIL;
    const tabs = h('div', { class: 'sl-chips', role: 'tablist', style: 'margin-bottom:12px' });
    const box = h('div', { class: 'sl-table-wrap' });
    el.appendChild(tabs); el.appendChild(box);
    let classes = [], runsByClass = {}, active = null;
    // the document id always wins over any 'id' field stored in the run
    function row(d) { return Object.assign({}, d.data(), { id: d.id }); }
    function draw() {
      if (life.left) return;
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
      const rows = rankRows(Object.keys(best).map(function (k) { return best[k]; }));
      if (!rows.length) { box.appendChild(h('p', { class: 'sl-muted', text: 'No runs logged for this class yet.' })); return; }
      const t = h('table', { class: 'sl-table' });
      const head = [h('th', { text: '#' }), h('th', { text: 'Name' }), h('th', { text: 'Best real run' }), h('th', { text: 'Predicted' }), h('th', { text: 'Design' })];
      if (isTeacher) head.push(h('th', { 'aria-label': 'Delete' }));
      t.appendChild(h('thead', null, [h('tr', null, head)]));
      const tb = h('tbody');
      rows.forEach(function (r) {
        const cells = [h('td', { text: r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : String(r.rank) }), h('td', { text: String(r.name || 'Anonymous') }),
          h('td', { text: (r.atEnd ? '🏁 ' : '') + api.fmt(r.distanceM, 2) + ' m (' + api.fmt(r.distanceM * FT_PER_M, 1) + ' ft)' }),
          h('td', { text: predictedCell(r) }),
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
      if (rows.some(function (r) { return r.atEnd; })) box.appendChild(h('p', { class: 'sl-muted', text: '🏁 = made it all the way to the end of the ' + hallLenText() + ' hallway. ' +
        'No car can go farther than that here, so those runs tie and share the same place. In step 2 the simulator’s “longer hall” number shows which of those designs would roll farthest.' }));
      box.appendChild(h('p', { class: 'sl-muted', text: isTeacher ? 'Best real run per student. Only you and this class can see this board. (✕ deletes that run.)' : 'Best real run per student. Only your class and your teacher can see this board.' }));
    }
    function watchClass(classId) {
      life.keep(db().collection('sailcar_runs').where('classId', '==', classId).onSnapshot(function (snap) {
        runsByClass[classId] = snap.docs.map(row);
        draw();
      }, function () { if (life.left) return; box.textContent = ''; api.ui.note(box, 'warn', '⚠️ The class board isn’t switched on in the class database yet — ask your teacher.'); }));
    }
    if (isTeacher) {
      db().collection('classes').where('teacherEmail', '==', TEACHER_EMAIL).get().then(function (s) {
        if (life.left) return;
        const known = s.docs.map(function (d) { return { id: d.id, name: d.data().name || 'Class' }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
        life.keep(db().collection('sailcar_runs').onSnapshot(function (snap) {
          runsByClass = {};
          snap.docs.forEach(function (d) {
            const r = row(d);
            const k = known.some(function (c) { return c.id === r.classId; }) ? r.classId : '';
            (runsByClass[k] = runsByClass[k] || []).push(r);
          });
          classes = known.concat(runsByClass[''] ? [{ id: '', name: 'No class' }] : []);
          if (active == null || !classes.some(function (c) { return c.id === active; })) active = classes.length ? classes[0].id : null;
          draw();
        }, function () { if (life.left) return; box.textContent = ''; api.ui.note(box, 'warn', '⚠️ Runs can’t be loaded yet — publish the new Firestore rules.'); }));
      }).catch(function () { classes = []; draw(); });
      return;
    }
    db().collection('enrollments').where('uid', '==', me.uid).get().then(function (s) {
      if (life.left) return;
      if (s.metadata && s.metadata.fromCache) throw Object.assign(new Error('offline'), { code: 'unavailable' });   // offline: not "no classes"
      classes = s.docs.map(function (d) { return d.data(); }).filter(function (x) { return x.classId; })
        .map(function (x) { return { id: String(x.classId), name: String(x.className || 'Class') }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
      active = classes.length ? classes[0].id : null;
      classes.forEach(function (c) { watchClass(c.id); });
      draw();
    }).catch(function () {
      if (life.left) return;
      box.textContent = '';
      box.appendChild(h('p', { class: 'sl-muted', text: 'Couldn’t load your classes — check Wi-Fi, then tap ← Back and Next → to try again.' }));
    });
  }

  SailLab.register({
    id: 'studio',
    num: 7,
    title: 'Design Studio',
    icon: '🏁',
    blurb: 'Design your car, predict how far it goes, then log your real hallway runs.',
    noQuiz: true,
    steps: [
      { title: 'Design your car', html: '<p>Use everything you learned. Every choice changes the <span class="key">mass</span>, the <span class="key">push</span> from the fan, the <span class="key">friction</span> and the <span class="key">balance</span>. Your design is saved with your account, so you can pick it up on any Chromebook or phone.</p>', render: renderDesign },
      { title: 'Predict: run it in the hallway', render: renderPredict },
      { title: 'Race day: log your real runs', render: renderRace },
      { title: 'Class board', render: renderBoard }
    ],
    _analyse: analyse,
    _studio: { clean: clean, predictionText: predictionText, forecast: forecast, rankRows: rankRows, LONG_HALL_M: LONG_HALL_M,
               state: function () { return { design: design, uid: designUid, status: cloudStatus }; } }
  });
})();
