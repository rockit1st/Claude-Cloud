// Sail Car Lab — Module 5: Mass & Inertia
// Written for 6th graders: short sentences, forces in paper clips (SailLab.kid.force), distances in feet first
// (SailLab.kid.dist), no formulas. Behind the scenes it is the same model as the hallway: the race in step 1 is a
// steady push with no friction (speed-up = push ÷ mass), rolling friction = crr × weight
// (SailLab.physics.rollingFriction), the start-line tipping rule from simulate(), and simulate() for every hallway
// number. Every number a student reads is worked out from the model when the page loads.
(function () {
  'use strict';
  const P = SailLab.physics, kid = SailLab.kid, D = P.DEFAULT_CAR, G = P.G, FT = kid.FT_PER_M;
  const START = P.simulate(D, { maxTime: 0 }).opts.startX;   // the start line, metres from the two fans (simulate's own default)
  // the wind's push on the standard car (20 × 20 cm sail + chassis) sitting still x metres from the fans
  function pushAt(x) { const w = P.windAt(x); return P.airForce(w, D.sailArea, D.sailCd, D.sailAngle) + P.airForce(w, D.bodyArea, D.bodyCd, 0); }
  const SAIL0 = P.airForce(P.windAt(START), D.sailArea, D.sailCd, D.sailAngle);   // on the sail alone, at the start line
  const PUSH0 = pushAt(START);                                                    // about 34 paper clips
  // the same tipping rule simulate() uses at the start line: the push high on the sail beats the weight holding the back down
  function tips(g) { return SAIL0 * (D.sailHeight - D.cgHeight) > (g / 1000) * G * D.cgToFront; }
  const TIP_G = SAIL0 * (D.sailHeight - D.cgHeight) / (G * D.cgToFront) * 1000;   // ≈ 40 g: lighter than this, the standard car flips
  const FAR_FT = 50, FAR_PUSH = pushAt(FAR_FT / FT);                              // step 2's note: the wind 50 ft from the fans
  const REF_G = Math.round(D.mass * 1000);                                        // 70: the standard car from Modules 1–4
  function weightN(g) { return g / 1000 * G; }
  function frictionN(g) { return P.rollingFriction(g / 1000, D.crr); }
  // how quickly the car gains speed at the start line (only ever shown as "about half as fast as the 70 g car")
  function speedUp(g) { return (PUSH0 - frictionN(g)) / (g / 1000); }
  function clipsTxt(N) { const n = kid.clips(N); return n + (n === 1 ? ' paper clip' : ' paper clips'); }
  function times(r) { return (Math.round(r * 10) / 10) + ' times'; }                // 3 → "3 times", 3.5 → "3.5 times"

  // ── the hallway: its size lives ONLY in SailLab.physics.HALL (sailcar-core.js); nothing below hard-codes it ──
  const HALL = P.HALL, HALL_TXT = kid.dist(HALL.length), LONG_HALL = 1000;   // LONG_HALL: room for any car to coast to a stop
  function atEnd(r) { return r.reason === 'reached the end of the hall'; }
  // how far a run would have gone with no end wall (a run that stopped inside the hallway: just its distance)
  function longer(r) { return atEnd(r) ? P.simulate(r.car, Object.assign({}, r.opts, { hallLength: LONG_HALL })).distance : r.distance; }

  // ── words for "how many times as much" (this car ÷ the 70 g car) ──
  function asMuch(r) {
    if (Math.abs(r - 1) < 0.07) return 'about the same as';
    if (r > 1) return r < 1.3 ? 'a little more than' : r < 1.75 ? 'about one and a half times' : 'about ' + Math.round(r) + ' times';
    const q = 1 / r;
    return q < 1.3 ? 'a little less than' : q < 1.75 ? 'about two-thirds of' : q < 2.5 ? 'about half of' : q < 3.5 ? 'about a third of' : 'about a quarter of';
  }
  function asFast(r) {
    if (Math.abs(r - 1) < 0.07) return 'about as fast as';
    if (r > 1) return r < 1.3 ? 'a little faster than' : r < 1.75 ? 'about one and a half times as fast as' : 'about ' + Math.round(r) + ' times as fast as';
    const q = 1 / r;
    return q < 1.3 ? 'a little slower than' : q < 1.75 ? 'about two-thirds as fast as' : q < 2.5 ? 'about half as fast as' : q < 3.5 ? 'about a third as fast as' : 'about a quarter as fast as';
  }

  // ── STEP 1: the race. A steady push, no friction: the speed-up is push ÷ mass, so the time to the line is √(2 × d ÷ speed-up) ──
  const RACE = { lightG: 50, lightClips: 10, ft: 3 };        // the light car, and the finish line 3 ft away
  const RACE_M = RACE.ft / FT, RACE_TXT = kid.dist(RACE_M);  // "3 ft (0.9 m)"
  const PUSH_S = { min: 5, max: 40, step: 5, start: 10 };    // YOUR car's push, in whole paper clips
  const MASS_S = { min: 25, max: 200, step: 25, start: 150 };
  const TIE_MIN_G = 150;
  function clipsN(c) { return c * kid.CLIP_N; }
  function raceTime(clips, g) { return Math.sqrt(2 * RACE_M / (clipsN(clips) / (g / 1000))); }
  // a tie = the same speed-up: the same push for each gram (whole clips and grams, so no rounding)
  function tie(clips, g) { return clips * RACE.lightG === RACE.lightClips * g; }
  function raceWinner(clips, g) { return tie(clips, g) ? 'tie' : clips * RACE.lightG > RACE.lightClips * g ? 'yours' : 'light'; }
  function secs(t) { const s = Math.round(t * 10) / 10; return s + (s === 1 ? ' second' : ' seconds'); }
  const RACE_PREDICT = {
    question: 'Both cars get the same push: ' + clipsTxt(clipsN(RACE.lightClips)) + '. Which car will win the race?',
    choices: [{ value: 'light', label: 'The light car (' + RACE.lightG + ' g)' },
              { value: 'yours', label: 'Your car (' + MASS_S.start + ' g)' },
              { value: 'tie', label: 'It will be a tie' }]
  };
  function raceTimes(clips, g) { return 'Light car: ' + secs(raceTime(RACE.lightClips, RACE.lightG)) + '. Your car: ' + secs(raceTime(clips, g)) + '.'; }
  // the answer to the prediction, after the first race (always the same push on both cars)
  function raceJudge(clips, g, v) {
    const win = raceWinner(clips, g), tl = secs(raceTime(RACE.lightClips, RACE.lightG)), ty = secs(raceTime(clips, g));
    const text = win === 'tie' ? 'It was a tie! Both cars took ' + tl + '.'
      : (win === 'light' ? 'The light car won. It took ' + tl + '. Your car took ' + ty + '.' : 'Your car won. It took ' + ty + '. The light car took ' + tl + '.');
    const why = win === 'light' ? 'Your car has ' + times(g / RACE.lightG) + ' the mass. With the same push, more mass speeds up more slowly.'
      : win === 'yours' ? 'Your car had more push for each gram of mass, so it sped up faster.'
      : 'Both cars had the same push for each gram of mass.';
    return { text: text, right: win === v, why: why };
  }
  // the readout after a race (the first race's answer is in the prediction card)
  function raceResult(clips, g, first) {
    const win = raceWinner(clips, g), pre = '🏁 ' + raceTimes(clips, g) + ' ';
    if (first) return [pre, ['The light car wins.'], ' Now change YOUR car. Can you make it tie?'];
    if (win !== 'tie') return [pre, [win === 'yours' ? 'Your car wins!' : 'The light car wins.'], ' For a tie, both cars must speed up the same.'];
    return g < TIE_MIN_G ? [pre, ['A tie!'], ' Now try it with a car of ' + TIE_MIN_G + ' g or more.'] : [pre, ['A tie!']];
  }
  function raceDone(g) {
    const r = times(g / RACE.lightG);
    return 'Your car has ' + r + ' the mass, so it needed ' + r + ' the push. More mass needs a bigger push to speed up just as fast.';
  }

  // ── STEP 2: inertia, and more mass = more friction ──
  function massReadout(g) {
    const head = ['⚖️ A ' + g + ' g car weighs ' + kid.force(weightN(g)) + '. Its friction is ', [kid.force(frictionN(g))], '. '];
    if (tips(g)) return head.concat(['⚠️ But a car this light ', ['tips over'], '! The wind pushes high on the sail. The car is too light to hold its back end down.']);
    if (g === REF_G) return head.concat(['This is the ' + REF_G + ' g car from the earlier modules. Try a heavier car. Then try a lighter one.']);
    return head.concat(['That is ' + asMuch(g / REF_G) + ' the ' + REF_G + ' g car’s friction. At the start line, it speeds up ', [asFast(speedUp(g) / speedUp(REF_G))], ' the ' + REF_G + ' g car.']);
  }

  // ── STEP 3: the mass budget (approximate masses of the students' real materials) ──
  const PARTS = [
    { name: 'Popsicle stick', each: 2, n: 0, grp: 1 }, { name: 'Jumbo craft stick', each: 4, n: 6, grp: 1 },
    { name: 'Plastic wheel', each: 4, n: 4, grp: 0 }, { name: 'Skewer or dowel', each: 1, n: 3, grp: 3 },
    { name: 'Straw', each: 0.5, n: 2, grp: 3 }, { name: 'Paper (1 sheet)', each: 4.5, n: 0, grp: 2 },
    { name: 'Cardstock (1 sheet)', each: 10, n: 1, grp: 2 }, { name: 'Hot glue (1 dot)', each: 0.5, n: 20, grp: 4 },
    { name: 'Tape (10 cm)', each: 0.3, n: 5, grp: 4 }, { name: 'Pipe cleaner', each: 1.5, n: 2, grp: 5 }
  ];
  const GROUPS = [['Wheels', '#40e080'], ['Sticks', '#d8b070'], ['Sail', '#f0e6ff'], ['Skewers & straws', '#7ad7ff'], ['Glue & tape', '#ff9a70'], ['Pipe cleaners', '#ff5fa0']];
  const BUDGET_GOAL = 500;                                   // tenths of a gram: 50 g
  function tenths(t) { return (t % 10 ? (t / 10).toFixed(1) : String(t / 10)) + ' g'; }   // masses are added up in tenths of a gram (no rounding errors)
  function totalTenths(counts) { return PARTS.reduce(function (a, p, i) { return a + Math.round(p.each * 10) * counts[i]; }, 0); }
  const START_TENTHS = totalTenths(PARTS.map(function (p) { return p.n; }));   // 685 → "68.5 g"
  // is it still a complete car? (c = how many of each part, in PARTS order)
  function rules(c) {
    return [['4 wheels', c[2] >= 4], ['3 skewers: 2 axles and 1 mast', c[3] >= 3], ['2 straws to hold the axles', c[4] >= 2],
            ['3 or more sticks for the frame', c[0] + c[1] >= 3], ['a sail: 1 sheet of paper or cardstock', c[5] + c[6] >= 1],
            ['6 or more joints (glue dots or tape strips)', c[7] + c[8] >= 6]];
  }
  function complete(c) { return rules(c).every(function (r) { return r[1]; }); }
  function budgetSim(t) {
    const r = P.simulate({ mass: t / 10000 }), far = longer(r);
    if (r.reason === 'tipped over') return { r: r, parts: ['⚠️ The simulator says this car ', ['tips onto its nose'], ' at the start line. It is too light to hold its back end down. Add a few grams back.'] };
    const SAIL = ' (That is with a 20 × 20 cm sail and OK wheels.)';
    if (atEnd(r)) return { r: r, parts: ['🏁 The simulator says this car rolls ', ['all the way to the end of the ' + HALL_TXT + ' hall'],
      (kid.ft(far) === kid.ft(HALL.length) ? '!' : '. In a longer hall it would go about ' + kid.dist(far) + '.') + SAIL] };
    return { r: r, parts: ['🏁 The simulator says this car rolls ', [kid.dist(r.distance)], '.' + SAIL] };
  }

  // ── STEP 4: the hallway. The mass slider, and its goal ──
  // The lightest car that doesn't tip goes farthest, but on the slider that car (40 g today) only just stays down.
  // A real car needs a few grams of safety margin, so the goal is the whole feet that a car MARGIN_G heavier still
  // reaches (50 g rolls 64 ft today: 40, 45 and 50 g pass), or the end of the hallway if that car makes it all the way.
  const MASS = { min: 20, max: 200, step: 5, start: 150 };
  const MARGIN_G = 10;                                       // two nickels
  let LIGHTEST = null;                                       // the lightest mass on the slider that doesn't tip
  for (let g = MASS.min; g <= MASS.max && LIGHTEST == null; g += MASS.step) if (P.simulate({ mass: g / 1000 }).reason !== 'tipped over') LIGHTEST = g;
  const MARGIN_RUN = P.simulate({ mass: (LIGHTEST + MARGIN_G) / 1000 });
  const GOAL_IS_END = atEnd(MARGIN_RUN);
  const GOAL_FT = GOAL_IS_END ? kid.ft(HALL.length) : Math.floor(MARGIN_RUN.distance * FT);
  const GOAL_TXT = GOAL_IS_END ? HALL_TXT : kid.dist(GOAL_FT / FT);   // "64 ft (20 m)"
  // the check uses the feet the student sees in the readout (kid.ft rounds to whole feet)
  function reachedGoal(r) { return r.reason !== 'tipped over' && (GOAL_IS_END ? atEnd(r) : kid.ft(r.distance) >= GOAL_FT); }
  // the masses on the slider that pass, heavier than the lightest safe one: "a few grams of margin" (45 and 50 g today)
  const MARGIN_PASS = [];
  for (let g = LIGHTEST + MASS.step; g <= MASS.max; g += MASS.step) if (reachedGoal(P.simulate({ mass: g / 1000 }))) MARGIN_PASS.push(g);
  function orList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1]; }
  const checks = {
    race: function (clips, g) { return g >= TIE_MIN_G && tie(clips, g); },
    budget: function (t, counts) { return complete(counts) && t <= BUDGET_GOAL && P.simulate({ mass: t / 10000 }).reason !== 'tipped over'; },
    hall: reachedGoal
  };
  function hallDone(r) {
    const g = Math.round(r.car.mass * 1000);
    const head = atEnd(r) ? 'At ' + g + ' g it reached the end of the ' + HALL_TXT + ' hall!' : 'At ' + g + ' g it rolled ' + kid.dist(r.distance) + '!';
    // the step's explanation lives here and in the prediction's answer, so the text above the "Predict first" card can't give it away
    return head + ' Lighter cars roll farther. They speed up faster and have less friction. ' +
      'But the wind pushes high on the sail. Below about ' + Math.round(TIP_G) + ' g, this car tips over. ' +
      (g === LIGHTEST
        ? LIGHTEST + ' g ' + (LIGHTEST - TIP_G < 1 ? 'only just stays' : 'stays') + ' on its wheels. A gust of wind or extra glue up front could flip it. ' +
          'So build yours a few grams heavier' + (MARGIN_PASS.length ? ', like ' + orList(MARGIN_PASS) + ' g.' : '.') + ' Those extra grams are a safety margin.'
        : 'Your ' + g + ' g car has ' + (g - LIGHTEST) + ' g to spare. That is a smart safety margin.');
  }
  // PREDICT FIRST #2: what happens as the car gets lighter and lighter? Judged once the runs show it.
  const HALL_PREDICT = {
    question: 'You will make the car lighter and lighter. What do you think will happen?',
    choices: [{ value: 'farther', label: 'It will roll farther every time' },
              { value: 'tip', label: 'Farther at first, then it tips over' },
              { value: 'less', label: 'It will roll less far' },
              { value: 'same', label: 'Mass won’t change much' }]
  };
  function hallEntry(r) { return { g: Math.round(r.car.mass * 1000), d: r.distance, tipped: r.reason === 'tipped over', end: atEnd(r) }; }
  function runText(e) {
    return e.tipped ? 'At ' + e.g + ' g, the car tipped over.'
      : e.end ? 'At ' + e.g + ' g, the car reached the end of the ' + HALL_TXT + ' hall.' : 'At ' + e.g + ' g, the car rolled ' + kid.dist(e.d) + '.';
  }
  function evidence(runs) {
    const rolled = runs.filter(function (e) { return !e.tipped; });
    return { lighterFarther: rolled.some(function (a) { return rolled.some(function (b) { return a.g < b.g && a.d > b.d + 0.01; }); }),
             tipSeen: runs.some(function (e) { return e.tipped; }) };
  }
  // runs = every run so far, this one last
  function hallJudge(runs, v) {
    const ev = evidence(runs), text = runText(runs[runs.length - 1]);
    if (ev.lighterFarther && ev.tipSeen) return { text: text, right: v === 'tip',
      why: 'Lighter cars speed up faster and have less friction, so they rolled farther. But the wind pushes high on the sail. Too light, and that push flips the car forward.' };
    if (ev.lighterFarther) {
      if (v === 'less' || v === 'same') return { text: text, right: false, why: 'The lighter car rolled farther. It speeds up faster and has less friction.' };
      return { text: text, right: null, why: 'So far, lighter cars roll farther. Keep going lighter. What happens?' };
    }
    if (ev.tipSeen) return { text: text, right: null, why: 'Too light! The wind pushes high on the sail, and it flipped the car forward. Now try some heavier cars too.' };
    return { text: text, right: null, why: 'Now make the car lighter and run it again.' };
  }

  // ── the quiz's hallway numbers, straight from simulate(): 150 g → 45 g, and the 70 g car before/after 2 nickels (10 g) ──
  const Q_MASS = { heavy: P.simulate({ mass: 0.150 }), light: P.simulate({ mass: 0.045 }) };
  const Q_NICKEL = { before: P.simulate(D), after: P.simulate({ mass: D.mass + 0.010 }) };
  function rolls(r) { return atEnd(r) ? 'the end of the hall' : kid.dist(r.distance); }

  // ── drawing helpers. The pictures are drawn at their real on-screen width (260–560 px) and shown 1 : 1,
  // so a 13 px label is 13 px on a phone too ──
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
  function label(api, s, x, y, text, o) {
    o = o || {};
    return api.svg('text', { x: x, y: y, 'text-anchor': o.anchor || 'start', fill: o.color || '#c8b8ea', 'font-size': o.size || 13,
      'font-weight': o.bold === false ? 400 : 700, class: 'sl-lbl' }, s, text);
  }
  function line(api, s, x1, y1, x2, y2, color, o) { return api.svg('line', Object.assign({ x1: x1, y1: y1, x2: x2, y2: y2, stroke: color, 'stroke-width': 2 }, o || {}), s); }
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
  // the car's mass as blocks on its deck (1 block = 25 g, plus a part-block for the rest) so you can SEE it
  function blocks(api, s, x, deckY, g, bw, bh, per) {
    for (let i = 0; i * 25 < g; i++) {
      const part = Math.min(1, (g - i * 25) / 25);
      api.svg('rect', { x: x + (i % per) * (bw + 1), y: deckY - (Math.floor(i / per) + 1) * (bh + 1), width: bw * part, height: bh, rx: 1,
        fill: '#c0563a', stroke: '#ff9a70', 'stroke-width': 0.8 }, s);
    }
  }

  SailLab.register({
    id: 'mass',
    num: 5,
    title: 'Mass & Inertia',
    icon: '🧱',
    blurb: 'Why does the same push speed up a light car faster? And how light is too light?',
    minutes: 15,
    steps: [
      {
        title: 'Same push, different mass',
        html:
          '<p>Every object has <strong>mass</strong>. A full shopping cart has more mass than an empty one.</p>' +
          '<p>Does mass change how fast a push gets something going? Let’s race two cars to find out. ' +
          'Pretend there is no friction. Each car gets a steady push. They race to a line ' + RACE_TXT + ' away.</p>' +
          '<p>The light car is ' + RACE.lightG + ' g. Your car is ' + MASS_S.start + ' g. Each red block on a car is 25 g.</p>',
        challenge: 'Make YOUR car ' + TIE_MIN_G + ' g or heavier. Then find the push that makes it TIE the light car.',
        render: function (el, api) {
          wordFirst(api, el, 'mass', 'how much stuff is in an object. We measure mass in grams (g). 1 gram weighs about as much as 1 paper clip.');
          const s = api.svg('svg', { role: 'img', 'aria-label': 'A race to a line ' + RACE.ft + ' feet away between a light car and your car' }, el);
          const pred = api.ui.predict(el, { question: RACE_PREDICT.question, choices: RACE_PREDICT.choices });
          const go = api.h('button', { type: 'button', class: 'sl-btn sl-btn-go', text: '▶ Race' });
          el.appendChild(api.h('div', { class: 'sl-ctrl' }, [go]));
          pred.gate(go);
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          const lock = api.h('p', { class: 'sl-muted', style: 'margin:4px 0;font-size:0.9rem', text: '🔒 Race once to test your prediction. Then you can change your car.' });
          el.appendChild(lock);
          const row = api.h('div', { class: 'sl-row' });
          el.appendChild(row);
          const pushS = api.ui.slider(row, { label: 'Push on YOUR car:', min: PUSH_S.min, max: PUSH_S.max, step: PUSH_S.step, value: PUSH_S.start,
            format: function (v) { return clipsTxt(clipsN(v)); }, onInput: reset });
          const massS = api.ui.slider(row, { label: 'Mass of YOUR car:', min: MASS_S.min, max: MASS_S.max, step: MASS_S.step, value: MASS_S.start,
            format: function (v) { return v + ' g'; }, onInput: reset });
          pushS.input.disabled = true; massS.input.disabled = true;     // the first race tests the prediction: same push on both cars
          let raf = null, raced = false;
          function cars() {
            return [{ name: 'Light car', clips: RACE.lightClips, g: RACE.lightG, color: '#7ad7ff' },
                    { name: 'Your car', clips: pushS.get(), g: massS.get(), color: '#f0c040' }];
          }
          function scene(t) {                                // t = seconds since the start (null: at the start line)
            const W = boardWidth(el), H = 238, sc = W < 440 ? 1.9 : 2.2, LEN = 26 * sc, X0 = Math.round(LEN + 64), X1 = W - 16, FL = [106, 208];
            startBoard(api, s, W, H);
            cars().forEach(function (c, i) {
              const fl = FL[i], a = clipsN(c.clips) / (c.g / 1000), d = t == null ? 0 : Math.min(RACE_M, 0.5 * a * t * t);
              const back = X0 - LEN + d / RACE_M * (X1 - X0), deckY = fl - 7 * sc;
              line(api, s, 10, fl, W - 10, fl, '#4a3a6a', { 'stroke-width': 3 });
              [X0, X1].forEach(function (x) { line(api, s, x, fl - 32 * sc, x, fl, '#f0c040', { 'stroke-dasharray': '5,5', opacity: 0.7 }); });
              label(api, s, 12, fl - 31 * sc - 10, c.name + ': ' + c.g + ' g · push ' + kid.forceShort(clipsN(c.clips)), { color: c.color });
              api.draw.car(s, back, fl, { scale: sc, length: 26, sailW: 18, sailH: 18, mastH: 24 });
              blocks(api, s, back + 13.6 * sc, deckY, c.g, 5 * sc, 3.2 * sc, 2);
              const len = c.clips * (X0 - LEN - 14) / PUSH_S.max;    // the push arrow: longer = more paper clips
              api.draw.arrow(s, back - 2 - len, fl - 22 * sc, back - 2, fl - 22 * sc, '#40e080', '', { width: 4 });
            });
            label(api, s, X0, H - 8, 'start', { anchor: 'middle', color: '#9080b0', bold: false });
            label(api, s, X1, H - 8, RACE_TXT, { anchor: 'end', color: '#9080b0', bold: false });
          }
          function ready() { say(api, out, [pred.get() == null ? 'Make a prediction first ↑' : 'Press ▶ Race!']); }
          pred.onChange(function () { if (!raf) ready(); });
          function stop() { if (raf) cancelAnimationFrame(raf); raf = null; go.disabled = pred.get() == null; }
          function reset() { stop(); scene(null); ready(); }
          function finish() {
            const clips = pushS.get(), g = massS.get(), first = !raced;
            if (first) {
              const j = raceJudge(clips, g, pred.get());
              pred.reveal(j.text, j.right, j.why);
              raced = true;
              pushS.input.disabled = false; massS.input.disabled = false;
              lock.hidden = true;
            }
            say(api, out, raceResult(clips, g, first));
            if (checks.race(clips, g)) api.done(raceDone(g));
          }
          go.addEventListener('click', function () {
            if (pred.get() == null) return;
            stop();
            const tEnd = Math.max(raceTime(RACE.lightClips, RACE.lightG), raceTime(pushS.get(), massS.get())), t0 = performance.now();
            go.disabled = true;
            say(api, out, ['🏁 Racing…']);
            function frame(now) {
              if (!s.isConnected) { raf = null; return; }
              const t = Math.min(tEnd, (now - t0) / 1000);
              scene(t);
              if (t < tEnd) { raf = requestAnimationFrame(frame); return; }
              raf = null; go.disabled = false; finish();
            }
            raf = requestAnimationFrame(frame);
          });
          api.onLeave(stop);
          keepFitted(api, el, function () { if (!raf) scene(null); });
          reset();
        }
      },
      {
        title: 'Inertia, and a hidden catch',
        html:
          '<p>Inertia makes a heavy car <strong>slower to speed up</strong>. You saw that in the race: same push, slower start. ' +
          'This is not the grip from Module 4. The race had no friction at all.</p>' +
          '<p>Inertia also makes a heavy car <strong>harder to stop</strong>. Think about catching a rolling bowling ball. Now think about a soccer ball!</p>' +
          '<p>Here is the catch. A heavy car presses down harder on its wheels. So its wheels and axles rub more. ' +
          '<strong>More mass means more friction.</strong> Move the slider and watch.</p>',
        render: function (el, api) {
          wordFirst(api, el, 'inertia', 'objects keep doing what they are doing. A still car stays still. A rolling car keeps rolling. More mass means more inertia.');
          const s = api.svg('svg', { role: 'img', 'aria-label': 'Forces on the car at the start line, and how quickly it speeds up' }, el);
          const mS = api.ui.slider(el, { label: 'Car mass:', min: 25, max: 200, step: 5, value: REF_G, format: function (v) { return v + ' g'; }, onInput: draw });
          const out = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(out);
          api.ui.note(el, 'tip', '💡 Near the fans, the wind pushes with ' + kid.force(PUSH0) + '. That is much more than friction. ' +
            'But the wind fades down the hall. ' + kid.dist(FAR_FT / FT).replace(' ft', '&nbsp;ft') + ' from the fans, it can push with only ' + kid.force(FAR_PUSH) + '. ' +
            'Out there, a heavy car’s extra friction stops it sooner.');
          const A_MAX = speedUp(25);                         // the bar's full length: a 25 g car (it would tip, but that's the top of the slider)
          function draw() {
            const g = mS.get(), W = boardWidth(el), FL = 150, H = FL + 100, flip = tips(g);
            startBoard(api, s, W, H);
            line(api, s, 10, FL, W - 10, FL, '#4a3a6a', { 'stroke-width': 3 });
            // the car sits far enough from the fans for the "wind push" label to fit before the sail
            const sc = W < 440 ? 2.2 : 3, len = 30 * sc, carX = Math.round(Math.min(W - len - 24, Math.max(W * 0.45, 200))), r = 3 * sc, deckY = FL - 2 * r - sc;
            const mastX = carX + len * 0.45, sailL = mastX - 20 * sc * 0.45, sailMid = deckY - 30 * sc + 10 * sc;
            api.draw.fan(s, 10, FL, 84, ' ');                // our own, bigger "2 FANS" label above the fans (readable on a phone),
            label(api, s, 10, Math.min(FL - 92, sailMid - 32), '2 FANS', { color: '#9080b0' });   // and above the "wind push" label
            api.draw.car(s, carX, FL, { scale: sc, length: 30, sailW: 20, sailH: 20, mastH: 30 });
            const blkW = 4 * sc, blkH = 2.6 * sc, bx0 = mastX + 4 * sc, rows = Math.ceil(Math.ceil(g / 25) / 3);
            blocks(api, s, bx0, deckY, g, blkW, blkH, 3);
            // the wind's push on the sail (the same at every mass)
            const fanR = 10 + 84 * 0.32;
            api.draw.arrow(s, fanR + 6, sailMid, sailL - 3, sailMid, '#40e080', '', { width: 4 });
            label(api, s, fanR + 6, sailMid - 12, 'wind push: ' + kid.forceShort(PUSH0), { color: '#40e080' });
            // weight presses the car down on its wheels (an arrow down onto the blocks); friction holds it back at the wheels
            const wx = bx0 + 1.5 * (blkW + 1), wTop = deckY - rows * (blkH + 1) - 3, wl = 10 + kid.clips(weightN(g)) * 0.2;
            api.draw.arrow(s, wx, wTop - wl, wx, wTop, '#7ad7ff', '', { width: 4 });
            const fl = Math.max(6, kid.clips(frictionN(g)) * 12);
            api.draw.arrow(s, carX + r, FL + 8, carX + r - fl, FL + 8, '#ffa040', '', { width: 4, head: 5 });
            label(api, s, 12, FL + 30, 'friction: ' + kid.forceShort(frictionN(g)), { color: '#ffa040' });
            label(api, s, W - 12, FL + 30, 'weight: ' + kid.forceShort(weightN(g)), { color: '#7ad7ff', anchor: 'end' });
            // how quickly it gains speed at the start line, with the 70 g car marked
            const bx = 12, bw = W - 24, by = FL + 62, k = bw / A_MAX;
            label(api, s, bx, by - 8, flip ? '⚠ Too light: it tips over!' : 'How fast it speeds up', { color: flip ? '#ff6060' : '#40e080' });
            api.svg('rect', { x: bx, y: by, width: bw, height: 12, rx: 6, fill: '#2a1a4a' }, s);
            api.svg('rect', { x: bx, y: by, width: Math.max(4, speedUp(g) * k), height: 12, rx: 6, fill: flip ? '#ff5050' : '#40e080' }, s);
            const rx = bx + speedUp(REF_G) * k;
            line(api, s, rx, by - 3, rx, by + 15, '#f0e6ff', { 'stroke-width': 2 });
            label(api, s, rx, by + 30, '▲ the ' + REF_G + ' g car', { anchor: 'middle', color: '#f0e6ff', bold: false });
            say(api, out, massReadout(g));
          }
          keepFitted(api, el, draw);
          draw();
        }
      },
      {
        title: 'Weigh your car: a mass budget',
        html:
          '<p>Engineers keep a <strong>mass budget</strong>. It lists every part and its mass. Then they add them all up. ' +
          'It shows where the grams come from before you build.</p>' +
          '<p>Here is a first-draft car. The masses are close, but your parts may be a little different. Use − and + to change the parts.</p>' +
          '<p>Careful! The fans push hard at the start line, so a car can be <em>too</em> light. The checklist tells you if the car would tip over.</p>',
        challenge: 'Trim this ' + tenths(START_TENTHS) + ' car to ' + tenths(BUDGET_GOAL) + ' or less. Keep every checklist item ✓. The simulator must say it won’t tip over.',
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
              api.h('td', { style: CELL }, [p.name, api.h('br'), api.h('span', { style: 'color:#9080b0;font-size:0.8rem', text: 'about ' + p.each + ' g each' })]),
              api.h('td', { style: CELL }, [btn('−', -1, 'One less'), cnt, btn('+', 1, 'One more')]), sub]));
            return { cnt: cnt, sub: sub };
          });
          const s = api.svg('svg', { role: 'img', 'aria-label': 'Bar showing where the grams in your car come from' }, el);
          const check = api.h('div', { class: 'sl-note sl-note-tip', 'aria-live': 'polite' });
          el.appendChild(check);
          api.ui.note(el, 'warn', '⚖️ Wheels and cardstock are the heavy parts. Hot glue adds up fast too: 20 dots is about 10 g!');
          function bar(byGrp, tot) {
            const W = boardWidth(el), cols = W < 440 ? 1 : 2, rows = Math.ceil(GROUPS.length / cols), H = 122 + rows * 24;
            startBoard(api, s, W, H);
            label(api, s, 14, 26, 'Where the grams are: ' + tenths(tot), { color: '#f0e6ff', size: 15 });
            const k = (W - 28) / Math.max(80, tot / 10);
            let x = 14;
            byGrp.forEach(function (t, i) { if (t) api.svg('rect', { x: x, y: 40, width: t / 10 * k, height: 34, fill: GROUPS[i][1], stroke: '#120826', 'stroke-width': 1.5 }, s); x += t / 10 * k; });
            const gx = 14 + BUDGET_GOAL / 10 * k;
            line(api, s, gx, 34, gx, 80, '#f0c040', { 'stroke-width': 3, 'stroke-dasharray': '5,4' });
            label(api, s, gx, 98, 'goal: ' + tenths(BUDGET_GOAL), { anchor: 'middle', color: '#f0c040' });
            GROUPS.forEach(function (gr, i) {
              const lx = 14 + (i % cols) * (W / 2 - 4), ly = 128 + Math.floor(i / cols) * 24;
              api.svg('rect', { x: lx, y: ly - 13, width: 15, height: 15, rx: 3, fill: gr[1] }, s);
              label(api, s, lx + 22, ly, gr[0] + ': ' + tenths(byGrp[i]), { bold: false });
            });
          }
          function update() {
            const byGrp = GROUPS.map(function () { return 0; });
            let tot = 0;
            parts.forEach(function (p, i) {
              const t = Math.round(p.each * 10) * p.n;
              cells[i].cnt.textContent = p.n; cells[i].sub.textContent = tenths(t);
              byGrp[p.grp] += t; tot += t;
            });
            totalCell.textContent = tenths(tot);
            bar(byGrp, tot);
            const c = parts.map(function (p) { return p.n; }), ok = complete(c);
            check.textContent = '';
            check.appendChild(api.h('strong', { text: ok ? '✅ Complete car! It has everything it needs:' : '🔧 Not a complete car yet. It needs:' }));
            check.appendChild(api.h('ul', { style: 'list-style:none;margin:6px 0 4px 4px' }, rules(c).map(function (r) {
              return api.h('li', { style: 'margin:0;color:' + (r[1] ? '#80f0b0' : '#ffb0b0'), text: (r[1] ? '✓ ' : '✗ ') + r[0] });
            })));
            if (ok) {
              say(api, check.appendChild(api.h('div')), budgetSim(tot).parts);
              if (checks.budget(tot, c)) api.done('A complete car at ' + tenths(BUDGET_GOAL) + ' or less that stays on its wheels! Small swaps add up: popsicle sticks for jumbo sticks, paper for cardstock, fewer glue dots.');
            }
          }
          keepFitted(api, el, update);
          update();
        }
      },
      {
        title: 'Hallway challenge: how light is best?',
        // only a neutral setup above the "Predict first" card: why light cars roll farther, and why too light tips,
        // come AFTER the runs (in the prediction's answer and the done message)
        html:
          '<p>Your car has a 20 × 20 cm sail and OK wheels. This time, you change only its <strong>mass</strong>.</p>' +
          '<p>Start at ' + MASS.start + ' g. Run the car. Then make it lighter and run it again.</p>' +
          (GOAL_IS_END ? '' : '<p>The goal is ' + GOAL_TXT + '. That is a little short of the end of the hall.</p>'),
        challenge: GOAL_IS_END ? 'Find a mass that rolls all the way to the end of the ' + HALL_TXT + ' hallway without tipping over.'
                               : 'Find a mass that rolls at least ' + GOAL_TXT + ' without tipping over.',
        render: function (el, api) {
          const runs = [];                                  // every run on this visit (the chart shows the last 30)
          const pred = api.ui.predict(el, { question: HALL_PREDICT.question, choices: HALL_PREDICT.choices,
            judge: function (r, v) { return hallJudge(runs.concat([hallEntry(r)]), v); } });
          // changing the mass clears the hallway, so a run with the old mass can't finish (and count) after the slider moves
          const massS = api.ui.slider(el, { label: 'Total mass of the car (20 × 20 cm sail, OK wheels):', min: MASS.min, max: MASS.max, step: MASS.step, value: MASS.start,
            format: function (v) { return v + ' g'; }, onInput: function () { sim.reset(); } });
          const sim = api.ui.trackSim(el, function () { return { mass: massS.get() / 1000 }; }, {
            scaleM: HALL.length,                            // the whole hallway, start line to end wall, every run — easy to compare
            needPrediction: pred,
            onResult: function (r) {
              runs.push(hallEntry(r));
              chart();
              if (checks.hall(r)) api.done(hallDone(r));
              showNext();
            }
          });
          api.onLeave(sim.stop);
          // the chart's top line is the end of the hallway: a run can't go past it
          const s = api.svg('svg', { role: 'img', 'aria-label': 'Chart of your runs: car mass and how far it rolled, up to the end of the hallway' }, el);
          const HALL_FT = HALL.length * FT;
          function chart() {
            const W = boardWidth(el), H = 262, XL = 54, XR = W - 26, YB = H - 44, YT = 64;
            function X(g) { return XL + (g - MASS.min) / (MASS.max - MASS.min) * (XR - XL); }
            function Y(f) { return YB - Math.min(f, HALL_FT) / HALL_FT * (YB - YT); }
            startBoard(api, s, W, H);
            label(api, s, 12, 26, 'Your runs', { color: '#f0e6ff', size: 15 });
            const lx = Math.max(104, W - 190);
            api.svg('circle', { cx: lx, cy: 21, r: 6, fill: '#40e080' }, s);
            label(api, s, lx + 11, 26, 'rolled', { bold: false });
            api.svg('path', { d: 'M ' + (lx + 64) + ',15 l 11,11 m 0,-11 l -11,11', stroke: '#ff5050', 'stroke-width': 3 }, s);
            label(api, s, lx + 82, 26, 'tipped over', { bold: false });
            // grid every 10 ft, leaving room for the labels of the end-of-hall and goal lines
            for (let f = 0; f < HALL_FT; f += 10) {
              if (f && (Y(f) - YT < 18 || (!GOAL_IS_END && Math.abs(Y(f) - Y(GOAL_FT)) < 18))) continue;
              line(api, s, XL, Y(f), XR, Y(f), f ? '#2a1a4a' : '#4a3a6a', { 'stroke-width': f ? 1 : 2 });
              label(api, s, XL - 8, Y(f) + 5, f + ' ft', { anchor: 'end', color: '#9080b0', bold: false });
            }
            for (let g = 50; g <= MASS.max; g += 50) label(api, s, X(g), YB + 22, g + ' g', { anchor: 'middle', color: '#9080b0', bold: false });
            label(api, s, XR, YB + 40, 'car mass →', { anchor: 'end', color: '#9080b0', bold: false });
            // the end of the hallway (the goal, when the best car makes it that far)
            line(api, s, XL, YT, XR, YT, GOAL_IS_END ? '#f0c040' : '#c8b8ea', { 'stroke-dasharray': GOAL_IS_END ? '6,5' : null });
            label(api, s, XR, YT - 8, (GOAL_IS_END ? 'goal: ' : '') + 'end of the hall: ' + kid.ft(HALL.length) + ' ft', { anchor: 'end', color: GOAL_IS_END ? '#f0c040' : '#c8b8ea' });
            if (!GOAL_IS_END) {
              line(api, s, XL, Y(GOAL_FT), XR, Y(GOAL_FT), '#f0c040', { 'stroke-dasharray': '6,5' });
              label(api, s, XR, Y(GOAL_FT) + 17, 'goal: at least ' + GOAL_FT + ' ft', { anchor: 'end', color: '#f0c040' });
            }
            if (!runs.length) label(api, s, (XL + XR) / 2, Y(22), 'Run the car to add a dot here.', { anchor: 'middle', color: '#9080b0', bold: false });
            runs.slice(-30).forEach(function (r, i, a) {
              const x = X(r.g), y = Y(r.d * FT), last = i === a.length - 1;
              if (r.tipped) api.svg('path', { d: 'M ' + (x - 6) + ',' + (y - 14) + ' l 12,12 m 0,-12 l -12,12', stroke: '#ff5050', 'stroke-width': last ? 4 : 3 }, s);
              else api.svg('circle', { cx: x, cy: y, r: last ? 7 : 5, fill: '#40e080', stroke: last ? '#fff' : 'none', 'stroke-width': 2 }, s);
            });
          }
          keepFitted(api, el, chart);
          chart();
          api.ui.note(el, 'tip', '💡 Each run adds a dot to the chart. Compare the dots as the car gets lighter. What pattern do you see?');
          // this one talks about tipping, so it waits until the student has seen a car tip (or finished the challenge)
          const next = api.ui.note(el, 'good', '🔮 <strong>Coming up in Module 6:</strong> tricks that stop a light car from tipping. Then it can be light AND safe.');
          function showNext() { next.hidden = !(api.isDone() || runs.some(function (e) { return e.tipped; })); }
          showNext();
        }
      },
      {
        title: 'Real build: light, but not too light',
        html:
          '<p>Here is how to use mass to help your real car.</p>' +
          '<ul><li><strong>Weigh it.</strong> Use a kitchen scale that reads grams. Weigh the parts before you glue them. No scale? Make a mass budget like the one in Step 3.</li>' +
          '<li><strong>Glue smart.</strong> A small dot of hot glue holds a joint fine. Big blobs just add grams.</li>' +
          '<li><strong>Trim the extras.</strong> Cut off stick ends that hang past the frame. Trim long skewer ends, but leave a little so the wheels stay on.</li>' +
          '<li><strong>Know your heavy parts.</strong> Wheels and cardstock are the heaviest. Try a paper sail. Use regular popsicle sticks where they are strong enough.</li>' +
          '<li><strong>Don’t go too light!</strong> Does your car tip onto its nose? Add a little weight near the <strong>back</strong> axle, like a coin. Or lower the sail.</li></ul>' +
          '<p><strong>Test it in the hallway:</strong></p>' +
          '<ol><li><strong>Flick test:</strong> Turn the fans off. Flick your car gently. Then tape 2 nickels on top (about 10&nbsp;g) and flick it the same way. Which one starts slower?</li>' +
          '<li><strong>Mass test:</strong> Run the car 3 times in front of the fans. Measure each run. Then do 3 more runs with the nickels on. How much distance did 10&nbsp;g cost you?</li>' +
          '<li><strong>Tip check:</strong> Watch from the side as you let go. Do the back wheels lift up? Then the car is too light for its sail. Add a little weight at the back.</li></ol>',
        render: function (el, api) {
          // one part per line (two columns when there is room)
          const list = ['Popsicle stick: 2 g', 'Jumbo stick: 4 g', 'Plastic wheel: 4 g', 'Skewer: 1 g', 'Straw: 0.5 g', 'Paper: 4.5 g a sheet',
                        'Cardstock: 10 g a sheet', 'Hot glue: 0.5 g a dot', 'Pipe cleaner: 1.5 g', 'Tape: 0.3 g for 10 cm'];
          api.ui.note(el, 'build', '🛠️ <strong>About how much parts weigh.</strong> Weigh yours to be sure!' +
            '<ul style="margin:6px 0 0 20px;columns:2 150px;column-gap:28px">' + list.map(function (t) { return '<li style="margin:0 0 2px">' + t + '</li>'; }).join('') + '</ul>');
        }
      }
    ],
    quiz: [
      // The options in each question are about the same length, and the wrong ones are ideas a 6th grader might really
      // hold, so "pick the longest" is no clue: the right answer is the single longest option in at most 3 of the 10
      // and the single shortest in at most 3, and on a 390 px phone the right answer is never the only option that
      // wraps to 2 lines (the check scripts count both). The lab shuffles the options.
      { q: 'What is mass?', options: ['How much stuff is in an object', 'How fast an object can move', 'How hard the wind pushes it', 'How much space it takes up'], answer: 0,
        why: 'Mass is how much stuff is in an object. We measure it in grams.' },
      { q: 'Two cars get the same push. Car A is 50 g. Car B is 100 g. What happens?', options: ['Car B speeds up faster', 'They both speed up the same', 'Car A speeds up faster', 'Only Car B starts to move'], answer: 2,
        why: 'Car A has less mass. The same push speeds up a lighter car faster.' },
      { q: 'A heavy car races a light car. How can the heavy car speed up just as fast?', options: ['Give it the same push', 'Give it a bigger push', 'Give it a smaller push', 'Make it even heavier'], answer: 1,
        why: 'More mass needs more push. A car with 3 times the mass needs 3 times the push.' },
      { q: 'What is inertia?', options: ['The push that makes things speed up', 'Objects keep doing what they are doing', 'How fast something is moving', 'The rubbing that slows things down'], answer: 1,
        why: 'A still object stays still, and a moving object keeps moving. More mass means more inertia.' },
      { q: 'A bowling ball and a soccer ball roll toward you at the same speed. Which is harder to stop?', options: ['The soccer ball', 'They are just as hard to stop', 'Neither, balls stop on their own', 'The bowling ball'], answer: 3,
        why: 'The bowling ball has more mass, so it has more inertia. More inertia makes it harder to stop.' },
      { q: 'Why does a heavier car have more friction?', options: ['It presses harder on its wheels', 'It has to push more air aside', 'Heavy parts are rougher', 'It moves faster, so it rubs more'], answer: 0,
        why: 'A heavier car presses harder on its wheels and axles, so they rub more. Twice the mass means twice the friction.' },
      { q: 'You make your car lighter, from 150 g to 45 g. The sail and wheels stay the same. What happens in the hallway?', options: ['It rolls about as far', 'It rolls much farther', 'It rolls less far', 'It is too light to get going'], answer: 1,
        why: 'In the simulator, it goes from ' + rolls(Q_MASS.heavy) + ' to ' + rolls(Q_MASS.light) + '. A light car speeds up faster and has less friction.' },
      { q: 'A super-light 25 g car flips onto its nose in front of the fans. Why?', options: ['Light cars have too much friction', 'It has too much inertia to roll', 'It is too light for its sail', 'It is going too fast to stay up'], answer: 2,
        why: 'The wind pushes high on the sail and tries to flip the car forward. With a 20 × 20 cm sail, a car lighter than about ' + Math.round(TIP_G) + ' g flips.' },
      { q: 'Your car has a cardstock sail. Which change takes the MOST mass off it?', options: ['Using two fewer strips of tape', 'Leaving out one of the straws', 'Cutting 1 cm off each skewer', 'Using plain paper for the sail'], answer: 3,
        why: 'Paper is about 4.5 g and cardstock is about 10 g. That swap saves about 5.5 g, more than all the others put together.' },
      { q: 'Your car rolls ' + kid.dist(Q_NICKEL.before.distance) + '. You tape on two nickels (10 g). Now it rolls ' + kid.dist(Q_NICKEL.after.distance) + '. What does this show?', options: ['More mass made it roll less far', 'Heavier cars roll farther', 'The nickels gave the car more push', 'Heavy cars have less friction'], answer: 0,
        why: 'Only the mass changed, so the extra 10 g made the runs shorter. Taking grams off should help, as long as the car doesn’t tip.' }
    ],
    // the numbers and rules behind the text, for checking (not used by the page)
    _model: { START: START, PUSH0: PUSH0, SAIL0: SAIL0, TIP_G: TIP_G, tips: tips, FAR_FT: FAR_FT, FAR_PUSH: FAR_PUSH, REF_G: REF_G, speedUp: speedUp,
              weightN: weightN, frictionN: frictionN, asMuch: asMuch, asFast: asFast, times: times, secs: secs,
              RACE: RACE, RACE_M: RACE_M, RACE_TXT: RACE_TXT, PUSH_S: PUSH_S, MASS_S: MASS_S, TIE_MIN_G: TIE_MIN_G, raceTime: raceTime, tie: tie,
              raceWinner: raceWinner, RACE_PREDICT: RACE_PREDICT, raceJudge: raceJudge, raceResult: raceResult, raceDone: raceDone,
              massReadout: massReadout, PARTS: PARTS, START_TENTHS: START_TENTHS, BUDGET_GOAL: BUDGET_GOAL, totalTenths: totalTenths, rules: rules,
              complete: complete, budgetSim: budgetSim, MASS: MASS, MARGIN_G: MARGIN_G, LIGHTEST: LIGHTEST, MARGIN_RUN: MARGIN_RUN,
              GOAL_IS_END: GOAL_IS_END, GOAL_FT: GOAL_FT, GOAL_TXT: GOAL_TXT, MARGIN_PASS: MARGIN_PASS, checks: checks, hallDone: hallDone,
              HALL_PREDICT: HALL_PREDICT, hallEntry: hallEntry, evidence: evidence, hallJudge: hallJudge, Q_MASS: Q_MASS, Q_NICKEL: Q_NICKEL }
  });
})();
