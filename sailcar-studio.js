// Sail Car Lab — Design Studio (the final step, no check)
// 1. Design: real parts → mass, balance, friction, sail push (all fed into SailLab.physics)
// 2. Test it: the student guesses first (predict-first), then runs the design down the simulated hallway
// 3. Race day: log real hallway runs (sailcar_runs) and compare with the simulator's prediction
// 4. Class board: best real run per student, visible only to the class and the teacher
// Each student's design + prediction is kept with their account (sailcar_progress/{uid}.design,
// written only here and never touching 'modules') and on this device ('sailcar-design-v2-<uid>');
// whichever copy was saved last (savedMs) wins.
// Written for 6th graders: short sentences, distances in FEET (SailLab.kid.dist) and sizes in INCHES (kid.len / kid.lenIn),
// no formulas, and NO force
// numbers or force units: on the design card a force is an arrow whose LENGTH shows its size (draw.forceScale: one
// honest scale per row), with a word label, and the words COMPARE two forces (kid.compare, the whole lab's vocabulary).
// The side picture draws the wind as faint streaks (no arrowhead, the same for every design): the card's rows are the
// one place that compares sizes, so two pictures on one screen never show two different push lengths.
// Every number a student reads (grams, inches, feet) is worked out from simulate().
// CHALLENGE FIRST: every step opens with a "Your job" box right under its title (the core draws it from step.job and step.todo: one short
// sentence and 2-4 short numbered lines that use the control names exactly as they are on screen). The text under it only explains.
// UNITS: students see feet and inches (and grams for the car's mass), never metres or centimetres. The physics, the
// stored design and the run log stay metric: a design keeps its sail sizes as plain numbers of CENTIMETRES, exactly as
// designs saved before the change did, so an old design loads and looks right (cm → the nearest inch on the sliders).
// The sliders are in inches; the module turns inches into cm (× 2.54) before anything is stored or simulated.
(function () {
  const TEACHER_EMAIL = 'ncapellini@hhh.k12.ny.us';
  const kid = SailLab.kid;
  const FT_PER_M = kid.FT_PER_M;
  const SAVE_WAIT_MS = 4000;                    // after this long without the server's OK, the write is waiting for Wi-Fi
  const START_X = 0.3;                          // simulate()'s start line: 0.3 m (1 ft) in front of the fans
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
  // how the last simulator run ended, kept with the design (design.predictedWhy): a car that tips over or
  // never moves has predictedM 0, and this says why instead of "no prediction yet"
  const WHY = { 'tipped over': 'tipped', 'never moved': 'never moved', 'hit the wall': 'wall', 'reached the end of the hall': 'end', 'coasted to a stop': 'stopped' };
  const WHY_NOW = { tipped: 'tips over at the start', 'never moved': 'never starts rolling' };
  const WHY_SAID = { tipped: 'would tip over at the start', 'never moved': 'would never start rolling' };
  // Last year's paper-sail SLEDS (no wheels) slid about 25 ft in this hallway (the teacher's results; the same
  // runs the wind in sailcar-core.js is tuned to). The predict-first question and its answer compare with it.
  const SLED_FT = 25;
  const MID_FT = 50;                            // the predict-first question's other edge: "25 to 50 ft"

  // Part data (approximate masses of the classroom materials)
  // The real sticks are 11 cm, 15 cm and 21 cm long (two regular sticks end to end): the labels say it in inches
  // (kid.len: 4 1/2 in, 6 in, 8 1/2 in). The wheelbases below are the physics' numbers and are not shown.
  const CHASSIS = {
    regular: { label: 'Regular sticks (' + kid.len(11) + ')', stick: 1.8, cross: 1.8, wheelbase: 0.10 },
    jumbo:   { label: 'Jumbo sticks (' + kid.len(15) + ')',   stick: 4.0, cross: 4.0, wheelbase: 0.13 },
    // the rails are two sticks glued end to end; the 2 cross pieces are single regular sticks
    double:  { label: 'Two sticks end-to-end (' + kid.len(21) + ')', stick: 3.6, cross: 1.8, wheelbase: 0.18 }
  };
  const BEARING = {      // crr with the small wheels
    straw: { label: 'Skewer spins in a straw', crr: 0.012 },
    taped: { label: 'Wheels spin on a taped skewer', crr: 0.022 },
    hole:  { label: 'Skewer through a cardstock hole', crr: 0.03 }
  };
  const SMALL_R = 0.015, BIG_R = 0.025;                       // wheel radius, m (the small wheels are 3 cm = about 1 in across, the big ones 5 cm = 2 in)
  const SMALL_WHEEL = kid.len(3), BIG_WHEEL = kid.len(5);     // '1 in' and '2 in': what the wheel choices say
  const SMALL_G = 3, BIG_G = 5;                               // grams per wheel
  const GLUE = { light: 3, normal: 6, heavy: 10 };            // grams of hot glue
  const SAIL_GSM = { paper: 80, cardstock: 200 };             // grams per square metre
  const MAST_POS = { front: 0.3, middle: 0.5, back: 0.7 };     // fraction of the wheelbase behind the front axle
  const PENNY_G = 2.5;

  // The sail's size is set on sliders in INCHES (whole inches; the gap under the sail in half inches) but is stored, as it
  // always was, as a number of CENTIMETRES (inches × 2.54, to 0.01), which is what analyse() and the physics use.
  // SIZES = each slider's range and step, in inches.
  const SIZES = { sailW: { min: 3, max: 14, step: 1 }, sailH: { min: 3, max: 14, step: 1 }, sailGap: { min: 0, max: 6, step: 0.5 } };
  function cmOf(inches) { return Math.round(kid.inToCm(inches) * 100) / 100; }
  // a stored number of cm → the inches shown on its slider (and everywhere else): the nearest whole inch (half inch for the
  // gap). A design saved in cm before the change (22 cm) shows as 9 in; its stored numbers, and so its physics, are kept.
  function inchesOf(key, cm) {
    const z = SIZES[key], v = Math.round(kid.cmToIn(Number(cm) || 0) / z.step) * z.step;
    return Math.min(z.max, Math.max(z.min, v));
  }
  // a sensible, ordinary first car — students improve it from here (a sail 8 in wide and 6 in tall, 1 in above the deck:
  // its card still says "Safe. Holding down is bigger than tipping", as before)
  const DEFAULT = { chassis: 'double', rails: 3, bearing: 'taped', wobbly: false, rubbing: false, bigWheels: false, square: true,
                    sailMat: 'paper', sailW: cmOf(8), sailH: cmOf(6), cupped: false, sailGap: cmOf(1), mastPos: 'middle', guys: 0, pennies: 1, glue: 'normal' };
  const CHOICES = { chassis: CHASSIS, bearing: BEARING, sailMat: SAIL_GSM, mastPos: MAST_POS, glue: GLUE };
  const RANGES = { rails: [2, 5], sailW: [cmOf(SIZES.sailW.min), cmOf(SIZES.sailW.max)], sailH: [cmOf(SIZES.sailH.min), cmOf(SIZES.sailH.max)],
                   sailGap: [cmOf(SIZES.sailGap.min), cmOf(SIZES.sailGap.max)], guys: [0, 2], pennies: [0, 6] };
  const FLAGS = ['wobbly', 'rubbing', 'bigWheels', 'square', 'cupped'];

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
    add('Wheels (4)', 4 * (d.bigWheels ? BIG_G : SMALL_G), wb / 2, wheelR);
    add('Hot glue', GLUE[d.glue], wb / 2, deck);
    add('Tape', 1, wb / 2, deck);
    const mastLen = (d.sailGap + d.sailH) / 100, mastX = wb * MAST_POS[d.mastPos];
    add('Mast (skewer)', 1, mastX, deck + mastLen / 2);
    add('Sail (' + d.sailMat + ')', sailArea * SAIL_GSM[d.sailMat], mastX, deck + d.sailGap / 100 + d.sailH / 200);
    if (d.cupped) add('Pipe-cleaner sail frame', 1.5, mastX, deck + d.sailGap / 100 + d.sailH / 200);
    if (d.guys) add('Pipe-cleaner braces', d.guys * 1.5, mastX, deck + mastLen / 3);
    if (d.pennies) add('Pennies at the back', d.pennies * PENNY_G, wb * 0.95, deck);
    const grams = parts.reduce(function (s, p) { return s + p.g; }, 0);
    const cgToFront = parts.reduce(function (s, p) { return s + p.g * p.pos; }, 0) / grams;
    const cgHeight = parts.reduce(function (s, p) { return s + p.g * p.h; }, 0) / grams;
    // Axle friction: the skewer rubs at its own tiny radius. The wheel is a lever that turns that
    // rubbing into a much smaller drag where the tyre meets the floor — the bigger the wheel, the
    // smaller the drag (drag ∝ axle radius ÷ wheel radius, so the 2 in wheels have 3/5 the drag of the 1 in ones).
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
  // the design in a few words (the sail in inches); it is also stored with each logged run (design.summary)
  function summary(d) {
    return (CHASSIS[d.chassis] || CHASSIS.jumbo).label.replace(/ \(.*/, '') + ' · ' + kid.by(inchesOf('sailW', d.sailW), inchesOf('sailH', d.sailH)) + ' ' + (d.cupped ? 'cupped ' : '') + d.sailMat + ' sail · ' +
      (BEARING[d.bearing] || BEARING.straw).label.toLowerCase() + (d.bigWheels ? ' · big wheels' : '') +
      (d.pennies ? ' · ' + d.pennies + (d.pennies === 1 ? ' penny' : ' pennies') : '');
  }

  // A run logged before the change stored its design's summary with the sail in centimetres ("20×16 cm paper sail"). The
  // class board shows it in inches, the nearest whole inch, like the sliders: "8 × 6 in paper sail".
  function summaryText(s) {
    return String(s == null ? '' : s).replace(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?) cm\b/, function (all, w, h) {
      return kid.by(inchesOf('sailW', Number(w)), inchesOf('sailH', Number(h)));
    });
  }

  // ── numbers for people ──
  // a DISTANCE ratio in words (last year's sleds): 2 → "twice", 3 → "3 times". Forces are never compared with this:
  // they use kid.compare, the whole lab's vocabulary.
  function times(n) { return n === 2 ? 'twice' : n + ' times'; }
  // ── forces on the design card: arrows and words, never a number ──
  const GREEN = '#40e080', ORANGE = '#ffa040', RED = '#ff6060', BLUE = '#7ad7ff';
  // a card row's arrows, in % of the row: ONE scale per row (draw.forceScale), and the row's words are built from that
  // same scale, so they state a ratio only when both arrows are drawn to scale
  function barScale(max) { return SailLab.draw.forceScale(max, 92, { min: 6, over: 0 }); }
  // the side picture's wind: faint dashed streaks this long (px) in front of the sail, the same for every design
  const WIND_PX = 56, WIND = '#9fb4d8';
  // What the design card says, as plain rows (label, text, colour, and for a force row its arrows: bars = { len, rows }).
  // Every fact comes from analyse(), the same sums simulate() uses: the card shows "TIPS OVER" exactly when simulate()
  // says 'tipped over' and "Too much friction" exactly when it says 'never moved'.
  function designFacts(d) {
    const a = analyse(d), rows = [];
    // grams are shown whole (as on race day and in the run log)
    rows.push({ label: 'Mass', text: Math.round(a.grams) + ' g' });
    // the sail as the sliders show it (whole inches), and its area worked out from those two numbers on screen
    const sw = inchesOf('sailW', d.sailW), sh = inchesOf('sailH', d.sailH);
    rows.push({ label: 'Sail', text: kid.lenIn(sw) + ' × ' + kid.lenIn(sh) + ' = ' + kid.areaIn(sw * sh) });
    // the wind's push against friction at the start line: the bigger one fills the row, so the two lengths show how they compare
    const push = a.startPush, fr = a.friction, fl = barScale(Math.max(push, fr));
    const pf = 'The push is ' + kid.compare(push, fr, { noun: 'friction', times: fl.toScale(push) && fl.toScale(fr) });
    rows.push({ label: 'Wind’s push and friction',
                // a still car needs a slightly bigger push to START than to keep rolling (P.STICKY, Module 4)
                text: !a.canStart ? '❌ Too much friction! ' + pf + '.' + (push > fr ? ' But a still car needs a little bigger push to start.' : '') + ' So the wind can’t start the car.'
                    : push < fr * kid.COMPARE.RATIO ? pf + '. That is not much extra push, so the car barely gets going.'
                    : pf + '. Friction can’t hold the car still.',
                color: a.canStart ? '' : '#ff8080',
                bars: { len: fl, rows: [{ label: 'wind push', value: push, color: GREEN }, { label: 'friction', value: fr, color: ORANGE, dir: 'left' }] } });
    // the tug-of-war (as in Module 6): tipping against holding down, the bigger one fills the row. tipMargin is
    // holding down ÷ tipping, so 1 and tipMargin are the two sides' sizes.
    const tm = a.tipMargin, tl = barScale(Math.max(1, tm)), o = { times: tl.toScale(1) && tl.toScale(tm) };
    const holdWords = 'Holding down is ' + kid.compare(tm, 1, Object.assign({ noun: 'tipping' }, o)) + '.';
    const tipWords = 'Tipping is ' + kid.compare(1, tm, Object.assign({ noun: 'holding down' }, o)) + (kid.bigger(1, tm) === 'about the same' ? ', but it wins by a hair.' : '.');
    // ONE verdict for each phrase: holding down only "about the same" as tipping, or "a little bigger", is a close call (⚠️);
    // "bigger" and up is Safe (✅). The line sits on the words' own boundary (kid.COMPARE.LITTLE), not on a number of its own.
    const close = tm >= 1 && /^(about the same|a little bigger)$/.test(kid.compare(tm, 1, { times: false })), safe = tm >= 1 && !close;
    rows.push({ label: 'Tipping', text: safe ? '✅ Safe. ' + holdWords
                                  : tm >= 1 ? '⚠️ Close to tipping! ' + holdWords + ' Lower the sail, or tape a penny low at the back.'
                                  : '🤸 TIPS OVER! ' + tipWords + ' Lower the sail, add weight at the back, or use a smaller sail.',
                color: safe ? '#40e080' : tm >= 1 ? '#f0c040' : '#ff8080',
                bars: { len: tl, tug: true, rows: [{ label: 'tipping', value: 1, color: RED }, { label: 'holding down', value: tm, color: BLUE }] } });
    return rows;
  }
  // a card row's arrows (tug-of-war bars for tipping), drawn with the row's own scale so the picture and the words beside
  // it always agree. The look is ui.forceBars' (the same CSS): word labels, never numbers. Screen readers skip them:
  // the row's words just above say the same thing.
  function barsEl(h, row) {
    const b = row.bars;
    return h('div', { class: 'sl-fbars', 'aria-hidden': 'true' }, b.rows.map(function (r) {
      const w = b.len(r.value);
      return h('div', { class: 'sl-fbar-row' }, [h('span', { class: 'sl-fbar-lbl', style: 'color:' + r.color, text: r.label }),
        h('span', { class: 'sl-fbar-track' }, [h('span', { class: 'sl-fbar' + (r.dir === 'left' ? ' sl-fbar-left' : ''), hidden: !(w > 0),
          style: 'width:' + Math.round(w * 100) / 100 + '%;background:' + r.color + (b.tug ? ';clip-path:none;border-radius:4px' : '') })])]);
    }));
  }

  // The model is calibrated only from past years' sled runs, so predictions are shown as a rounded
  // range (about ±20 %), never to the inch. predictedM itself stays exact for the % comparison.
  const TUNED_NOTE = 'The simulator was set up using last year’s paper sleds, which had no wheels. So its number is a good guess, not a promise. Your real run in the hallway is the true test.';
  function aboutText(m) { return 'about ' + kid.dist(m); }                       // "about 53 ft"
  function hallLenText() { return kid.dist(hall().length); }                     // "70 ft"
  function hallWideText() { return kid.dist(hall().width); }                     // "11 ft"
  // a predicted (simulated) distance that is the whole hallway: simulate() stops every such car at exactly HALL.length
  function atEnd(m) { return m >= hall().length - 0.005; }

  // A design's run in our hallway. A car that reaches the far end stops there in the simulator, tied with
  // every other car that gets there, so it is also run in a longer hall of the same width: that distance
  // ('longer') is what designs are compared by. For a car that stops inside the hallway, longer = distance.
  function longerRun(car) { return SailLab.physics.simulate(car, { hallLength: LONG_HALL_M, hallWidth: hall().width }).distance; }
  function judge(r) { const end = r.reason === END_REASON; return { distance: r.distance, reason: r.reason, end: end, longer: end ? longerRun(r.car) : r.distance }; }
  function forecast(d) { const H = hall(); return judge(SailLab.physics.simulate(analyse(d).car, { hallLength: H.length, hallWidth: H.width })); }

  // two distances as one range, the unit said once when it is the same: "42 to 64 ft" · "7 in to 1.2 ft"
  function rangeText(lo, hi) {
    const a = kid.dist(lo), b = kid.dist(hi), u = a.slice(a.lastIndexOf(' ') + 1);
    return b.slice(b.lastIndexOf(' ') + 1) === u ? a.slice(0, a.length - u.length - 1) + ' to ' + b : a + ' to ' + b;
  }
  // m = the simulated distance in the hallway; longer = the same car in a longer hall (only used when m is the whole hallway)
  // "about 53 ft. A real car will likely go 42 to 64 ft"
  function predictionText(m, longer) {
    const H = hall().length;
    if (atEnd(m)) return 'all the way to the end of our ' + hallLenText() + ' hallway. ' +
      (longer >= H + 0.5 ? 'In a longer hall, it would roll ' + aboutText(longer) : 'It would stop right about there anyway');
    // the real car can't go past the end of the hallway, so the likely range stops there
    const lo = m * 0.8, hi = m * 1.2;
    return aboutText(m) + '. A real car will likely go ' + (hi >= H ? kid.dist(lo) + ' up to the end of the hall' : rangeText(lo, hi));
  }
  // bestM is a longer-hall distance: more than the hallway means that design reaches the end of ours
  function bestLine(m) {
    return m >= hall().length + 0.5 ? 'Your best design so far makes it to the end. In a longer hall, it would roll ' + aboutText(m) + '.'
                                    : 'Your best design so far: ' + aboutText(m) + '.';
  }
  // a stored prediction, short: "to reach the end of the 70 ft hallway" / "about 53 ft"
  function predictedText(m) { return atEnd(m) ? 'to reach the end of the ' + hallLenText() + ' hallway' : aboutText(m); }
  // a prediction in a table cell; one made with another physics model (another hallway) is shown as it was
  function predictedCell(r) { return r.predictedM > 0 ? (r.model === modelVersion() && atEnd(r.predictedM) ? 'end of hall' : kid.dist(r.predictedM)) : '—'; }
  // a real, hand-measured run that made it to the far end of the hallway
  function realAtEnd(m) { return m >= hall().length - END_SLACK_M; }
  function trimNum(v) { return String(Math.round(v * 100) / 100); }
  function r1(v) { return Math.round(v * 10) / 10; }
  // A real, hand-measured distance, in FEET. The number the student typed is their measurement, so it is shown just as
  // typed ("45 ft", "13.5 ft"); under a foot it is in inches (0.5 ft → "6 in"). A run logged before the change in metres
  // (unit 'm', 4.2 m) is shown in feet with one decimal ("13.8 ft"), so a board that mixes the two still reads in rank order.
  // (Only the text changes: distance, unit and distanceM are stored exactly as before; new runs are always unit 'ft'.)
  function realDist(v, unit) {
    const ft = unit === 'm' ? r1(v * FT_PER_M) : Math.round(v * 100) / 100;
    return ft < 1 ? kid.feet(ft) : trimNum(ft) + ' ft';
  }
  // a logged run's real distance with the number the student typed. distanceM is what the board ranks by (and
  // the database caps at 100 m); the typed number is only shown when it agrees with it, so a hand-made run
  // can't show a different distance from the one it is ranked by. Otherwise distanceM is shown, as kid.dist.
  function realRunText(r) {
    const typed = typeof r.distance === 'number' && isFinite(r.distance) && (r.unit === 'ft' || r.unit === 'm') &&
      Math.abs((r.unit === 'ft' ? r.distance / FT_PER_M : r.distance) - r.distanceM) < 0.01;
    return typed ? realDist(r.distance, r.unit) : kid.dist(r.distanceM);
  }

  // ── predict first (step 2): how far will this design go? ──
  // The buckets are read off the distance as the student sees it (kid.ft rounds it), so "25 ft" on the readout is "25 to 50 ft".
  function guessQuestion() {
    return {
      question: 'How far will your car go in our ' + kid.ft(hall().length) + ' ft hallway?',
      choices: [{ value: 'short', label: 'Less than ' + SLED_FT + ' ft, or not at all' },
                { value: 'mid', label: SLED_FT + ' to ' + MID_FT + ' ft' },
                { value: 'long', label: 'More than ' + MID_FT + ' ft, but not to the end' },
                { value: 'end', label: 'All the way to the end (' + kid.ft(hall().length) + ' ft)' }],
      hint: 'Last year’s paper sleds slid about ' + SLED_FT + ' ft. Pick one, then press ▶ Run.'
    };
  }
  function guessOutcome(r) {
    if (r.reason === END_REASON) return 'end';
    if (r.reason === 'tipped over' || r.reason === 'never moved') return 'short';
    const ft = kid.ft(r.distance);
    return ft < SLED_FT ? 'short' : ft <= MID_FT ? 'mid' : 'long';
  }
  // compared with last year's sleds, from the distance as shown
  function sledLine(distM) {
    const x = kid.ft(distM) / SLED_FT;
    if (x >= 1.75) return ' That’s about ' + times(Math.round(x)) + ' as far as last year’s sleds!';
    if (x >= 1.2) return ' That’s farther than last year’s sleds!';
    if (x >= 0.8) return ' That’s about as far as last year’s sleds.';
    return '';
  }
  // the answer shown under the guess after each run: { text, right, why }. r = simulate()'s result in our hallway.
  const GUESS_ORDER = ['short', 'mid', 'long', 'end'];
  function guessJudge(r, v) {
    const got = guessOutcome(r), d = r.distance, L = hall().length;
    const off = GUESS_ORDER.indexOf(got) - GUESS_ORDER.indexOf(v);
    const vs = v == null || !off ? '' : off > 0 ? ' It went farther than you guessed.' : ' It did not go as far as you guessed.';
    let text, why;
    if (r.reason === 'tipped over') {
      text = 'Your car tipped over at the start line.';
      why = 'The wind pushed high on the sail and flipped the car forward. A lower sail or pennies at the back can help.';
    } else if (r.reason === 'never moved') {
      text = 'Your car did not move at all.';
      why = 'Friction held it still. The wind’s push was too small to beat it. Make the wheels spin freely, or use a bigger sail.';
    } else if (r.reason === 'hit the wall') {
      text = 'Your car rolled ' + kid.dist(d) + ', then hit the wall.';
      why = 'Its axles were not lined up, so it curved off course. Line them up with a ruler.';
    } else if (r.reason === END_REASON) {
      const longer = longerRun(r.car);
      text = 'Your car made it to the end of the ' + kid.dist(L) + ' hall!';
      why = longer >= L + 0.5 ? 'It was still rolling at the end. In a longer hall, it would roll ' + aboutText(longer) + '.'
                              : 'It would have stopped right about there anyway.';
    } else {
      text = 'Your car rolled ' + kid.dist(d) + ', then stopped.' + sledLine(d);
      why = 'The wind fades as it spreads down the hall. When the push got smaller than friction, the car slowed down and stopped.';
    }
    return { text: text + vs, right: got === v, why: why };
  }

  // ── race day messages ──
  // the design line above the race form
  function designLineText(d) {
    const why = noDistanceWhy(d);
    return summary(d) + ' · ' + Math.round(analyse(d).grams) + ' g · ' +
      (d.predictedM > 0 ? 'predicted ' + predictedText(d.predictedM)
        : why ? 'the simulator says this design ' + WHY_NOW[why] + '. So there is no predicted distance to compare with. Log what your real car does'
        : 'no prediction yet (test it in the simulator in step 2)') + '. Not the car you raced? Go back to step 1 and set it up.';
  }
  // after a run is saved. why = 'tipped' / 'never moved' when the design had no predicted distance (see noDistanceWhy)
  function loggedText(rec, why) {
    const pct = rec.predictedM > 0 ? Math.round(rec.distanceM / rec.predictedM * 100) : 0;
    return '✓ Logged ' + realDist(rec.distance, rec.unit) + '.' +
      (!(rec.predictedM > 0) ? (WHY_SAID[why] ? ' The simulator said this design ' + WHY_SAID[why] + '. So there is no predicted distance to compare.' : '')
        : atEnd(rec.predictedM) ? ' The simulator predicted it would reach the end of the hall' + (realAtEnd(rec.distanceM) ? ', and it did!' : '. This run went ' + pct + '% of the way there.')
        : ' The simulator predicted ' + aboutText(rec.predictedM) + '. This run went ' + pct + '% of that.') +
      (rec.classId ? '' : ' Join your class on the Classes page so it shows on the class board.');
  }

  // ── the design store: one design per account ──
  function clamp(v, lo, hi) { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo; }
  // only known keys with sensible values get in, so a damaged copy can't break the maths
  function clean(raw) {
    const d = Object.assign({}, DEFAULT, { predictedM: 0, predictedWhy: '', bestM: 0, model: modelVersion(), savedMs: 0 });
    if (!raw || typeof raw !== 'object') return d;
    Object.keys(CHOICES).forEach(function (k) { if (typeof raw[k] === 'string' && Object.prototype.hasOwnProperty.call(CHOICES[k], raw[k])) d[k] = raw[k]; });
    // the sail sizes are centimetres (kept to 0.01: an inch is 2.54 cm), the rest are whole numbers. A design saved in whole
    // centimetres comes through exactly as it was.
    Object.keys(RANGES).forEach(function (k) {
      if (typeof raw[k] === 'number' && isFinite(raw[k])) d[k] = SIZES[k] ? Math.round(clamp(raw[k], RANGES[k][0], RANGES[k][1]) * 100) / 100 : Math.round(clamp(raw[k], RANGES[k][0], RANGES[k][1]));
    });
    FLAGS.forEach(function (k) { if (typeof raw[k] === 'boolean') d[k] = raw[k]; });
    d.savedMs = clamp(raw.savedMs, 0, 1e15);
    // a prediction made with a different physics model (e.g. the old one-fan wind) no longer counts
    if (raw.model === d.model) {
      d.predictedM = clamp(raw.predictedM, 0, 100); d.bestM = clamp(raw.bestM, 0, 100);
      const why = raw.predictedWhy;
      if (typeof why === 'string' && Object.keys(WHY).some(function (k) { return WHY[k] === why; })) d.predictedWhy = why;
    }
    return d;
  }
  function cloudCopy(d) {
    const o = {};
    Object.keys(DEFAULT).forEach(function (k) { o[k] = d[k]; });
    o.predictedM = d.predictedM || 0; o.predictedWhy = d.predictedWhy || ''; o.bestM = d.bestM || 0; o.model = modelVersion(); o.savedMs = d.savedMs || 0;
    return o;
  }
  // 'tipped' / 'never moved' when the last simulator run of this design had no distance, else ''
  function noDistanceWhy(d) { return !(d.predictedM > 0) && WHY_NOW[d.predictedWhy] ? d.predictedWhy : ''; }
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
    cloud: '💾 Saved to your account. It follows you to any Chromebook or phone you sign in on.',
    saving: '💾 Saving to your account…',
    offline: '💾 Saved on this device. It will go to your account when the Wi-Fi is back.',
    local: '💾 Saved on this device only. The class database isn’t saving designs yet.'
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
      function set(k) { return function (v) { design[k] = v; design.predictedM = 0; design.predictedWhy = ''; touch(); refresh(); }; }
      // a size slider is in inches; the design keeps the sail's size in centimetres (inches × 2.54), as it always did
      function sizeSlider(parent, k, label) {
        const z = SIZES[k];
        ui.slider(parent, { label: label, min: z.min, max: z.max, step: z.step, value: inchesOf(k, design[k]), inches: true, onInput: function (v) { set(k)(cmOf(v)); } });
      }
      function tip(parent, text) { parent.appendChild(h('p', { class: 'sl-muted', style: 'margin:-6px 0 10px;font-size:0.85rem;line-height:1.45', text: text })); }
      left.appendChild(h('h3', { class: 'sl-step-title', style: 'font-size:0.9rem;margin:6px 0', text: '🪵 Frame & wheels' }));
      ui.choice(left, { label: 'Frame (popsicle sticks)', value: design.chassis, options: Object.keys(CHASSIS).map(function (k) { return { value: k, label: CHASSIS[k].label }; }), onChange: set('chassis') });
      ui.slider(left, { label: 'Sticks along the frame', min: 2, max: 5, step: 1, value: design.rails, format: function (v) { return v + ' (plus 2 across)'; }, onInput: set('rails') });
      ui.choice(left, { label: 'Axles', value: design.bearing, options: Object.keys(BEARING).map(function (k) { return { value: k, label: BEARING[k].label }; }), onChange: set('bearing') });
      ui.choice(left, { label: 'Wheels', value: design.bigWheels ? 'big' : 'small', options: [{ value: 'small', label: 'Small (' + SMALL_WHEEL + ')' }, { value: 'big', label: 'Big (' + BIG_WHEEL + ')' }], onChange: function (v) { set('bigWheels')(v === 'big'); } });
      tip(left, 'Big wheels roll more easily. The axle’s rubbing slows them less. But 4 big wheels add ' + (4 * (BIG_G - SMALL_G)) + ' g.');
      ui.choice(left, { label: 'Do the wheels wobble?', value: design.wobbly ? 'y' : 'n', options: [{ value: 'n', label: 'They spin straight' }, { value: 'y', label: 'Wobbly' }], onChange: function (v) { set('wobbly')(v === 'y'); } });
      ui.choice(left, { label: 'Do the wheels rub the frame?', value: design.rubbing ? 'y' : 'n', options: [{ value: 'n', label: 'No, there’s a gap' }, { value: 'y', label: 'Yes, they rub' }], onChange: function (v) { set('rubbing')(v === 'y'); } });
      ui.choice(left, { label: 'Are the axles lined up?', value: design.square ? 'y' : 'n', options: [{ value: 'y', label: 'Lined up with a ruler' }, { value: 'n', label: 'Just by eye' }], onChange: function (v) { set('square')(v === 'y'); } });
      right.appendChild(h('h3', { class: 'sl-step-title', style: 'font-size:0.9rem;margin:6px 0', text: '⛵ Sail & balance' }));
      ui.choice(right, { label: 'Sail material', value: design.sailMat, options: [{ value: 'paper', label: 'Paper' }, { value: 'cardstock', label: 'Cardstock' }], onChange: set('sailMat') });
      sizeSlider(right, 'sailW', 'Sail width');
      sizeSlider(right, 'sailH', 'Sail height');
      ui.choice(right, { label: 'Sail shape', value: design.cupped ? 'cup' : 'flat', options: [{ value: 'flat', label: 'Flat' }, { value: 'cup', label: 'Cupped (bent with a pipe cleaner)' }], onChange: function (v) { set('cupped')(v === 'cup'); } });
      sizeSlider(right, 'sailGap', 'Gap under the sail');
      ui.choice(right, { label: 'Mast (the stick that holds the sail)', value: design.mastPos, options: [{ value: 'front', label: 'Front' }, { value: 'middle', label: 'Middle' }, { value: 'back', label: 'Back' }], onChange: set('mastPos') });
      ui.slider(right, { label: 'Pennies taped low at the back', min: 0, max: 6, step: 1, value: design.pennies, format: function (v) { return v + ' (' + (v * PENNY_G) + ' g)'; }, onInput: set('pennies') });
      ui.slider(right, { label: 'Pipe cleaners to brace the mast', min: 0, max: 2, step: 1, value: design.guys, onInput: set('guys') });
      ui.choice(right, { label: 'Hot glue', value: design.glue, options: [{ value: 'light', label: 'Just enough' }, { value: 'normal', label: 'Normal' }, { value: 'heavy', label: 'Lots' }], onChange: set('glue') });

      const card = h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
      root.appendChild(card);
      const pic = api.svg('svg', { viewBox: '0 0 560 200', role: 'img', 'aria-label': 'Your car from the side. The wind pushes on the sail. A blue dot shows the balance point.' }, root);
      refresh = function () {
        const a = analyse(design);
        card.textContent = '';
        designFacts(design).forEach(function (row) {
          card.appendChild(h('div', null, [h('strong', { text: row.label + ': ' }), h('span', { text: row.text, style: row.color ? 'color:' + row.color : '' })]));
          if (row.bars) card.appendChild(barsEl(h, row));
        });
        // drawn at the real on-screen width (like the hallway simulator), so the labels stay readable on a phone
        const W = Math.max(260, Math.min(560, Math.round(root.clientWidth || 560))), FLOOR = 175;
        pic.setAttribute('viewBox', '0 0 ' + W + ' 200');
        pic.setAttribute('width', W);           // shown 1 : 1, so a 13 px label is 13 px on screen (CSS max-width: 100% still applies)
        pic.textContent = '';
        api.svg('rect', { x: 0, y: 0, width: W, height: 200, rx: 12, fill: '#120826' }, pic);
        api.svg('line', { x1: 16, y1: FLOOR, x2: W - 16, y2: FLOOR, stroke: '#4a3a6a', 'stroke-width': 3 }, pic);
        // the whole car (wheels + deck + mast) must fit in the picture (sizes here are drawing units of 1 px per cm × scale: never shown)
        const wr = design.bigWheels ? 2.5 : 1.5, len = a.car.wheelbase * 100 + 2 * wr, tallCm = 2 * wr + 1.5 + design.sailGap + design.sailH;
        const scale = Math.min(4.5, 150 / tallCm, (W - 120) / len), carW = len * scale;
        // the sail's front edge, measured from the car's back end; the car moves right (never off the picture) when
        // the wind streaks need more room in front of a big sail
        const sailRel = carW - wr * scale - MAST_POS[design.mastPos] * a.car.wheelbase * 100 * scale - design.sailW * scale * 0.45;
        let x0 = W / 2 - carW / 2;
        x0 += Math.max(0, Math.min(WIND_PX + 18 - (x0 + sailRel), W - 16 - (x0 + carW)));
        const frontAxle = x0 + carW - wr * scale;
        const mastX = frontAxle - MAST_POS[design.mastPos] * a.car.wheelbase * 100 * scale;
        api.draw.car(pic, x0, FLOOR, { scale: scale, length: len, sailW: design.sailW, sailH: design.sailH, mastH: design.sailGap + design.sailH, mastAt: (mastX - x0) / (len * scale),
                                       cupped: design.cupped, wheelR: wr, sailColor: design.sailMat === 'cardstock' ? '#f0d8a0' : '#f0e6ff' });
        // the wind blows on the middle of the sail (high up: that is what tips a car forward). It is drawn as faint dashed
        // streaks with NO arrowhead and the same length for every design (as in Module 1): the picture only shows which way
        // the wind blows, never how big the push is. The card's push-and-friction row above is the one honest comparison.
        const sailFront = mastX - design.sailW * scale * 0.45, sailMidY = FLOOR - (2 * wr + 1 + design.sailGap + design.sailH / 2) * scale + design.sailW * scale * 0.06;
        const tipX = sailFront - 6, off = Math.max(7, Math.min(16, design.sailH * scale * 0.3));
        if (tipX - WIND_PX >= 4) {
          [[-off, 0], [0, 14], [off, 0]].forEach(function (s) {
            api.svg('line', { x1: tipX - WIND_PX + s[1], y1: sailMidY + s[0], x2: tipX, y2: sailMidY + s[0], stroke: WIND, 'stroke-width': 1.5, opacity: 0.55,
                              'stroke-dasharray': '10 6', 'stroke-linecap': 'round' }, pic);
          });
          api.svg('text', { x: tipX, y: sailMidY - off - 7, 'text-anchor': 'end', fill: WIND, 'font-size': 13, 'font-weight': 700, class: 'sl-lbl' }, pic, 'wind');
        }
        const cgX = frontAxle - a.car.cgToFront * 100 * scale, cgY = FLOOR - a.car.cgHeight * 100 * scale;
        api.svg('circle', { cx: cgX, cy: cgY, r: 6, fill: '#00a8ff', stroke: '#fff', 'stroke-width': 1.5 }, pic);
        const roomRight = cgX + 110 < W;
        api.svg('text', { x: roomRight ? cgX + 10 : cgX - 10, y: cgY - 8, 'text-anchor': roomRight ? 'start' : 'end', fill: '#7ad7ff', 'font-size': 14, 'font-weight': 700, class: 'sl-lbl' }, pic, 'balance point');
      };
      refresh();
      ui.note(root, 'build', '🛠️ Every choice here is something you can really build. The masses are close to real ones. Weigh your parts on a kitchen scale to check.');
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

  // ── Step 2: test it in the simulator (predict first) ──
  function renderPredict(el, api) {
    useDesignFor(currentUser());
    const h = api.h;
    const about = h('p');
    function showDesign() { about.textContent = 'Your design: ' + summary(design) + ' · ' + Math.round(analyse(design).grams) + ' g.'; }
    showDesign();
    el.appendChild(about);
    el.appendChild(h('p', { text: 'In the simulator, your car starts ' + kid.dist(START_X) + ' in front of the two fans. The hallway is ' +
      hallLenText() + ' long and ' + hallWideText() + ' wide, just like ours.' }));
    // PREDICT FIRST: the student commits to a guess; ▶ Run stays off until they pick one
    // ("prediction" is taught in a Word-to-know box above Module 1's first predict card; the job box above says "Answer the Predict first question")
    const q = guessQuestion();
    const guess = api.ui.predict(el, { question: q.question, choices: q.choices, hint: q.hint, judge: guessJudge });
    const best = h('div', { class: 'sl-note sl-note-good', 'aria-live': 'polite' });
    function say(main, strongText, rest) {
      best.textContent = '';
      best.appendChild(h('div', null, [main, strongText ? h('strong', { text: strongText }) : null, rest || null]));
      if (strongText) best.appendChild(h('div', { style: 'margin-top:6px;font-size:0.85rem;color:#c8b8ea', text: TUNED_NOTE }));
    }
    const TIP_TEXT = '🤸 In the simulator, this design tips over at the start line. Go back and lower the sail. Or tape a penny low at the back.';
    const STUCK_TEXT = '😴 In the simulator, this design never starts rolling. The wind’s push is too small to beat friction. Go back and fix the axles, or use a bigger sail.';
    function showLast() {
      // the longer-hall distance isn't stored: the same design in the same model always rolls the same, so work it out again
      if (design.predictedM > 0) say('🔮 The simulator’s last prediction for this design: ', predictionText(design.predictedM, atEnd(design.predictedM) ? forecast(design).longer : 0), '.');
      else if (design.predictedWhy === 'tipped') say(TIP_TEXT);            // the simulator was run: it just has no distance
      else if (design.predictedWhy === 'never moved') say(STUCK_TEXT);
      else say('🔮 Pick your guess above. Then press ▶ Run to see the simulator’s prediction.');
    }
    const sim = api.ui.trackSim(el, function () { return analyse(design).car; }, {
      scaleM: hall().length,            // the whole hallway, start line to far end, the same view every run so designs are easy to compare
      getOpts: function () { const H = hall(); return { hallLength: H.length, hallWidth: H.width }; },
      needPrediction: guess,
      onResult: function (res) {
        const r = judge(res);
        design.predictedM = Math.round(r.distance * 100) / 100;                 // in OUR hallway: what race day compares with
        design.predictedWhy = WHY[r.reason] || '';                               // so a tip or a car that never moves is remembered too
        design.bestM = Math.max(design.bestM || 0, Math.round(r.longer * 100) / 100);   // compared in a longer hall, so designs that reach the end still rank
        touch(); flushCloud();          // the prediction goes to the account straight away, ready for race day
        if (r.reason === 'tipped over') say(TIP_TEXT);
        else if (r.reason === 'never moved') say(STUCK_TEXT);
        else say('🔮 Prediction for this design: ', predictionText(design.predictedM, r.longer),
                 '.' + (r.reason === 'hit the wall' ? ' It curved into the wall. Line up the axles with a ruler.' : '') + ' ' + bestLine(design.bestM));
      }
    });
    el.appendChild(best);
    el.appendChild(h('p', { text: '💡 Which change helps the most?' }));
    el.appendChild(h('p', { class: 'sl-muted', text: 'Every car that reaches the far end ties. So the simulator also says how far it would roll in a longer hall. Use that number to compare.' }));
    showLast();
    // a design that arrives from another device mid-step is a different car: the guess was about the old one
    watch(api, function (what) { if (what === 'design') { showDesign(); showLast(); guess.reset(); } });
    api.onLeave(function () { sim.stop(); flushCloud(); });
  }

  // ── Step 3: race day ──
  function renderRace(el, api) {
    const h = api.h;
    const me = currentUser();
    const isTeacher = !!(me && me.email === TEACHER_EMAIL);
    if (isTeacher) {
      api.ui.note(el, 'tip', '👩‍🏫 <strong>Teacher:</strong> students log their own runs here after each hallway run (in feet, plus an optional note). The design and prediction saved with their account are logged with it. You see every class on the next step and can delete a run there.');
      return;
    }
    useDesignFor(me);
    const life = lifetime(api);
    el.appendChild(h('p', { text: 'Did your car reach the far end, about ' + hallLenText() + ' away? Then measure to the end. Every car that gets there ties.' }));
    el.appendChild(h('p', { text: 'Your teacher and your class will see your best run on the class board.' }));
    const designLine = h('div', { class: 'sl-note sl-note-tip' });
    function showDesignLine() {
      designLine.textContent = '';
      designLine.appendChild(h('strong', { text: 'Design being logged: ' }));
      designLine.appendChild(document.createTextNode(designLineText(design)));
    }
    showDesignLine();
    el.appendChild(designLine);
    watch(api, function (what) { if (what === 'design') showDesignLine(); });

    // FEET only (US tape measures; the hallway is marked in feet). A run is always stored with unit 'ft'; runs saved in
    // metres before the change are still shown, in feet (realDist).
    const unit = 'ft';
    const form = h('div', { class: 'sl-row' });
    el.appendChild(form);
    const distIn = h('input', { type: 'number', min: '0', step: 'any', inputmode: 'decimal', id: 'sl-run-dist', 'aria-describedby': 'sl-run-hint', placeholder: 'e.g. 52 ft', style: 'width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;font-size:1rem' });
    form.appendChild(h('div', { class: 'sl-ctrl' }, [h('label', { for: 'sl-run-dist', class: 'sl-ctrl-lbl', text: 'Real distance, in feet' }), distIn,
      h('p', { id: 'sl-run-hint', class: 'sl-muted', style: 'margin:6px 0 0;font-size:0.85rem;line-height:1.45', text: 'Your tape shows feet and inches? Type 13 ft 6 in as 13.5.' })]));
    let confirmKey = null;          // a surprising distance needs a second tap on Log
    distIn.addEventListener('input', function () { confirmKey = null; });
    const noteIn = h('input', { type: 'text', maxlength: '80', id: 'sl-run-note', placeholder: 'What did you change? (you can skip this)', style: 'width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;font-size:0.95rem' });
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

    // The name on the class board must be exactly the sign-in's own name (the database checks it against the
    // "name" in the student's Google sign-in, or their email if the account has none), so it is never cut short.
    // currentUser.displayName is that same Google profile name; the sign-in token is asked for it too, in case
    // the two ever differ. Offline with an old token, displayName is used.
    let runName = String(me.displayName || me.email || '');
    try {
      Promise.resolve(me.getIdTokenResult()).then(function (t) {
        const c = (t && t.claims) || {};
        if (typeof c.name === 'string') runName = c.name;                         // exactly what the database compares with
        else if (typeof c.email === 'string' && c.email) runName = c.email;
      }).catch(function () {});
    } catch (e) {}

    const NO_CLASSES = 'Couldn’t load your classes. Check the Wi-Fi and tap Retry.';
    let classesOk = false, myClasses = [];
    function loadClasses() {
      classesOk = false; btn.disabled = true; btn.textContent = 'Loading your classes…'; retry.style.display = 'none';
      if (msg.textContent === NO_CLASSES) say('');
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
        say(NO_CLASSES, true);
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
      t.appendChild(h('thead', null, [h('tr', null, [h('th', { text: 'Run' }), h('th', { text: 'Real distance' }), h('th', { text: 'Simulator said' }), h('th', { text: '% of prediction' }), h('th', { text: 'Note' })])]));
      const tb = h('tbody');
      runs.forEach(function (r, i) {
        const pct = r.predictedM > 0 ? Math.round(r.distanceM / r.predictedM * 100) + '%' : '—';
        const real = realRunText(r);          // feet, the typed number as typed: "13.5 ft"
        tb.appendChild(h('tr', null, [h('td', { text: String(i + 1) }), h('td', { text: real }),
          h('td', { text: predictedCell(r) }), h('td', { text: pct }), h('td', { text: String(r.note || ''), style: 'text-align:left;white-space:normal;min-width:' + (r.note ? 140 : 0) + 'px' })]));
      });
      t.appendChild(tb);
      mine.appendChild(h('div', { class: 'sl-table-wrap' }, [t]));
      if (runs.some(function (r) { return !(r.predictedM > 0); })) mine.appendChild(h('p', { class: 'sl-muted', style: 'font-size:0.85rem',
        text: '— means no predicted distance. The simulator said the car would tip over or not move. Or it wasn’t tested yet.' }));
    }, function (err) {
      if (life.left) return;
      mine.textContent = '';
      if (err && err.code === 'permission-denied') api.ui.note(mine, 'warn', '⚠️ Logging runs isn’t turned on in the class database yet. Ask your teacher.');
    }));

    function save(rec, why) {
      btn.disabled = true; btn.textContent = 'Saving…';
      let settled = false, queued = false;
      // offline the write waits in Firestore's queue and its promise only settles once it reaches the server
      life.later(function () {
        if (settled) return;
        queued = true;
        btn.disabled = !classesOk; btn.textContent = LOG_TEXT;
        distIn.value = ''; noteIn.value = '';
        say('📶 ' + realDist(rec.distance, rec.unit) + ' is saved on this device. It will upload when the Wi-Fi is back. Keep this page open until you see ✓.', true);
      }, SAVE_WAIT_MS);
      db().collection('sailcar_runs').add(rec).then(function () {
        settled = true;
        if (life.left) return;
        if (!queued) { btn.disabled = !classesOk; btn.textContent = LOG_TEXT; distIn.value = ''; noteIn.value = ''; }
        say(loggedText(rec, why) + (queued ? ' (It uploaded now that the Wi-Fi is back.)' : ''));
      }, function (err) {
        settled = true;
        if (life.left) return;
        btn.disabled = !classesOk; btn.textContent = LOG_TEXT;
        const why = err && err.code === 'permission-denied' ? 'Logging runs isn’t turned on in the class database yet. Ask your teacher.' : 'Check the Wi-Fi and try again.';
        say(queued ? 'Your ' + realDist(rec.distance, rec.unit) + ' run was NOT saved. ' + why : 'Not saved. ' + why, true);
      });
    }
    btn.addEventListener('click', function () {
      if (!classesOk) return;
      say('');
      const v = parseFloat(distIn.value), u = unit;
      const m = v / FT_PER_M;
      if (!(v >= 0) || !(m <= 100)) { say('Type how far your car went (0 to 328 ft).', true); return; }
      let cls = { id: '', name: '' };
      if (myClasses.length === 1) cls = myClasses[0];
      else if (myClasses.length > 1) {
        if (!classSel.value) { say('Choose your class first.', true); return; }
        cls = myClasses.find(function (c) { return c.id === classSel.value; }) || cls;
      }
      // a typo (an extra digit) gets a second look before it goes on the board
      // (5 % slack: the hallway is "about" that long, and a car that reaches the end is measured by hand)
      const H = hall().length, pred = design.predictedM > 0 ? design.predictedM : 0, key = u + ':' + v;
      const why = m > H * 1.05 ? 'That’s longer than our ' + hallLenText() + ' hallway!'
                : pred > 0 && m > 2.5 * pred ? 'That’s more than 2½ times the simulator’s prediction (' + aboutText(pred) + ')!' : '';
      if (why && confirmKey !== key) {
        confirmKey = key;
        // what they typed, as realDist logs it
        say('You typed ' + realDist(v, u) + '. ' + why + ' Tap Log again if that’s right.', true);
        return;
      }
      confirmKey = null;
      const rec = {
        uid: me.uid, userEmail: me.email || '', name: runName,           // never shortened: it must match the sign-in's name exactly
        classId: cls.id, className: String(cls.name || '').slice(0, 80),
        distanceM: Math.round(m * 100) / 100, unit: u, distance: Math.round(v * 100) / 100,
        predictedM: Math.min(100, Math.max(0, pred)), model: modelVersion(),
        design: { summary: summary(design).slice(0, 160), grams: Math.round(analyse(design).grams) },
        note: noteIn.value.trim().slice(0, 80), savedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      save(rec, noDistanceWhy(design));
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
      const head = [h('th', { text: '#' }), h('th', { text: 'Name' }), h('th', { text: 'Best real run' }), h('th', { text: 'Simulator said' }), h('th', { text: 'Car design' })];
      if (isTeacher) head.push(h('th', { 'aria-label': 'Delete' }));
      t.appendChild(h('thead', null, [h('tr', null, head)]));
      const tb = h('tbody');
      rows.forEach(function (r) {
        const name = String(r.name || 'Anonymous'), email = String(r.userEmail || '');
        // the teacher (only) sees whose account posted each row: hover the name, and in the delete question
        const cells = [h('td', { text: r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : String(r.rank) }),
          h('td', { text: name, title: isTeacher && email ? 'Posted by ' + email : null }),
          h('td', { text: (r.atEnd ? '🏁 ' : '') + realRunText(r) }),          // feet, the typed number as typed, like "My runs"
          h('td', { text: predictedCell(r) }),
          h('td', { text: summaryText(r.design && r.design.summary), style: 'text-align:left;white-space:normal;font-size:0.85rem;min-width:170px' })];
        if (isTeacher) {
          const who = name + (email ? ' (' + email + ')' : '');
          const del = h('button', { type: 'button', class: 'sl-btn', text: '✕', 'aria-label': 'Delete the run for ' + who, title: 'Delete the run for ' + who, style: 'padding:4px 10px' });
          del.addEventListener('click', function () { if (confirm('Delete this run for ' + who + '?')) db().collection('sailcar_runs').doc(r.id).delete().catch(function () { alert('Could not delete — check your connection.'); }); });
          cells.push(h('td', null, [del]));
        }
        tb.appendChild(h('tr', null, cells));
      });
      t.appendChild(tb);
      box.appendChild(t);
      if (rows.some(function (r) { return r.atEnd; })) box.appendChild(h('p', { class: 'sl-muted', text: '🏁 means the car made it to the end of the ' + hallLenText() + ' hallway. ' +
        'No car can go farther here, so those runs tie. In step 2, the simulator’s “longer hall” number shows which would roll farthest.' }));
      box.appendChild(h('p', { class: 'sl-muted', text: isTeacher ? 'Best real run per student. Only you and this class can see this board. Hover a name to see which account posted it. (✕ deletes that run.)' : 'This shows each student’s best real run. Only your class and your teacher can see it.' }));
    }
    function watchClass(classId) {
      life.keep(db().collection('sailcar_runs').where('classId', '==', classId).onSnapshot(function (snap) {
        runsByClass[classId] = snap.docs.map(row);
        draw();
      }, function () { if (life.left) return; box.textContent = ''; api.ui.note(box, 'warn', '⚠️ The class board isn’t turned on in the class database yet. Ask your teacher.'); }));
    }
    // a problem loading the classes: say so, with a Retry button, instead of an empty or wrong board
    function problem(text, retryFn) {
      if (life.left) return;
      tabs.textContent = ''; box.textContent = '';
      const again = h('button', { type: 'button', class: 'sl-btn', text: '↻ Retry', style: 'margin-left:8px' });
      again.addEventListener('click', function () { box.textContent = ''; box.appendChild(h('p', { class: 'sl-muted', text: 'Loading your classes…' })); retryFn(); });
      box.appendChild(h('p', { class: 'sl-muted' }, [text, again]));
    }
    const NO_CLASSES = 'Couldn’t load your classes. Check the Wi-Fi and tap Retry.';
    // offline, Firestore answers from its (empty) cache: that is not "no classes"
    function fromServer(s) { if (s.metadata && s.metadata.fromCache) throw Object.assign(new Error('offline'), { code: 'unavailable' }); return s; }
    if (isTeacher) {
      // the runs are sorted into the teacher's classes, so they are only listened to once the classes came from the server
      (function loadTeacher() {
        db().collection('classes').where('teacherEmail', '==', TEACHER_EMAIL).get().then(fromServer).then(function (s) {
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
        }).catch(function () { problem(NO_CLASSES, loadTeacher); });
      })();
      return;
    }
    (function loadStudent() {
      db().collection('enrollments').where('uid', '==', me.uid).get().then(fromServer).then(function (s) {
        if (life.left) return;
        classes = s.docs.map(function (d) { return d.data(); }).filter(function (x) { return x.classId; })
          .map(function (x) { return { id: String(x.classId), name: String(x.className || 'Class') }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
        active = classes.length ? classes[0].id : null;
        classes.forEach(function (c) { watchClass(c.id); });
        draw();
      }).catch(function () { problem(NO_CLASSES, loadStudent); });
    })();
  }

  SailLab.register({
    id: 'studio',
    num: 7,
    title: 'Design Studio',
    icon: '🏁',
    blurb: 'Design your own car. Test it in the simulator. Then race it in the real hallway!',
    noQuiz: true,
    steps: [
      { title: 'Design your car',
        job: 'Design a car that will not tip over or get stuck.',
        todo: ['Pick parts in “Frame & wheels”.', 'Pick parts in “Sail & balance”.', 'Check that “Tipping” says “Safe”.', 'Fix any red or yellow warning.'],
        html: '<p>Now use everything you learned!</p>' +
          '<p>Every choice changes the <span class="key">mass</span>, the wind’s <span class="key">push</span>, the <span class="key">friction</span> and the <span class="key">balance</span>.</p>' +
          '<p>Your design is saved with your account. You can pick it up on any Chromebook or phone.</p>', render: renderDesign },
      { title: 'Test it in the simulator', job: 'Guess how far your car will go. Then run it.',
        todo: ['Answer the “Predict first” question.', 'Press ▶ Run and watch your car.', 'Read the 🔮 prediction under the picture.', 'Press “← Back”. Change one thing. Test again.'],
        render: renderPredict },
      { title: 'Race day: log your real runs', job: 'Race your real car. Log how far it goes.',
        todo: ['Run your real car down the hall.', 'Measure from the start to where it stopped.', 'Type your feet in “Real distance, in feet”.', 'Press “🏁 Log this run”.'],
        render: renderRace },
      { title: 'Class board', job: 'Find your run on the class board.',
        todo: ['Tap your class name above the table.', 'Find your name in the “Name” column.', 'Check your “Best real run”.', 'Read the “Car design” of the top runs.'],
        render: renderBoard }
    ],
    _analyse: analyse,
    _studio: { clean: clean, predictionText: predictionText, forecast: forecast, rankRows: rankRows, LONG_HALL_M: LONG_HALL_M,
               designFacts: designFacts, guessQuestion: guessQuestion, guessOutcome: guessOutcome, guessJudge: guessJudge,
               bestLine: bestLine, designLineText: designLineText, loggedText: loggedText, summary: summary,
               barScale: barScale, WIND_PX: WIND_PX,
               SIZES: SIZES, cmOf: cmOf, inchesOf: inchesOf, summaryText: summaryText, realRunText: realRunText, predictedCell: predictedCell, rangeText: rangeText,
               SLED_FT: SLED_FT, MID_FT: MID_FT, START_X: START_X,
               state: function () { return { design: design, uid: designUid, status: cloudStatus }; } }
  });
})();
