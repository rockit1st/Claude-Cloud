// Tech Bucks: a token students earn for finishing things on the site.
//
// Load this after the Firebase scripts and auth.js:
//   <script src="techbucks.js"></script>
//
// What it gives a page (window.TechBucks):
//   award(key, reason, opts)  -> Promise. Never rejects, never throws. Resolves with a short word:
//                                'ok' (written), 'have' (already earned), 'queued' (will retry),
//                                'denied' (the database said no; kept to try again later),
//                                'full' (today's slots are used up), 'skipped' (not a student, or not an award).
//                                `key` is one of the fixed keys below, or a day-slot name such as
//                                'altitude_launch' (the first free slot for today is used).
//   awardFirstThenSlots(firstKey, slotName, reason, opts)  the first time pays `firstKey`, then day slots.
//   balance()                 -> the student's total, or null while it is not known (or not readable).
//   subscribe(cb)             -> calls cb({ ready, ok, balance, entries, shop, owned }) now and on every change; returns a function that stops it.
//                                shop: 'on' (spending works), 'wait' (the totals are being brought up to date),
//                                'off' (the database rules for the shop are not published yet) or 'unknown'.
//                                owned: { itemId: true } for everything the student has bought.
//   spend(itemId, opts)       -> Promise. Never rejects. Resolves { ok: true } or { ok: false, why, need? } with why one of
//                                'owned', 'poor' (need = how many more), 'unknown', 'off', 'wait', 'offline', 'error', 'skipped'.
//                                Price comes from window.Avatar.PRICES (avatar.js), the same list as priceFor() in firestore.rules.
//                                Any "buy_<itemId>" with a price in that one list works (games later). opts.equip = a map to save
//                                as the avatar in the same batch.
//   badge(el)                 -> keeps el's text as "🪙 N"; returns the stop function.
//   TABLE                     -> the list the "How to earn" page shows (same amounts as firestore.rules, amountFor()).
//
// STAGE B (the Avatar Shop). A running total techbucks_totals/{uid} = { uid, earned, spent, last, updatedAt } sits beside the
// ledger. It changes only in the same batch as one matching ledger change (the rules check that), so award() writes both
// together. An award the total already includes carries counted: true. Awards made before the total existed are counted by
// a quiet migration (below), one at a time. If the database does not accept the total yet (the old rules), everything falls
// back to exactly what stage A did: the ledger document alone; the balance is then the sum of the ledger.
//
// The amounts here MUST match amountFor() in firestore.rules. The database checks them again: a student
// cannot give themselves a different amount, or the same award twice (its id is uid_key).
//
// Written to be quiet: a refused or offline write is kept in this browser (localStorage) and tried again
// later; nothing is shown to the student except the happy "+10 Tech Bucks!" note. Teachers and any
// account that is not a student never earn.
(function () {
  'use strict';
  if (window.TechBucks) return;

  var OWNER = 'ncapellini@hhh.k12.ny.us';
  var PENDING_KEY = 'techbucks-pending-v1';
  var MAX_TRIES = 25, MAX_AGE_MS = 7 * 86400000, RETRY_EVERY_MS = 3 * 60000, WRITE_WAIT_MS = 10000;

  // ── what can be earned ──
  var QUIZ_MODULES = ['forces', 'thrust', 'drag', 'friction', 'mass', 'balance'];
  var SLOTS = {                                  // repeatable awards: name -> { amount, max a day }
    sailcar_run:     { amount: 2, max: 2 },
    altitude_launch: { amount: 2, max: 3 }
  };
  var FIXED = { sailcar_firstrun: 5, altitude_first: 10, rocket_build: 5 };
  var TABLE = [
    { icon: '🧠', text: 'Pass a Sail Car Lab quiz', amount: 10, note: 'Once for each of the 6 modules' },
    { icon: '⛵', text: 'Log your first real Sail Car run', amount: 5, note: 'Just one time' },
    { icon: '📏', text: 'Log another real Sail Car run', amount: 2, note: 'Up to 2 a day' },
    { icon: '🚀', text: 'Save your first launch in the Altitude Calculator', amount: 10, note: 'Just one time. It must not be waiting for a teacher check' },
    { icon: '📐', text: 'Save another launch', amount: 2, note: 'Up to 3 a day. It must not be waiting for a teacher check' },
    { icon: '🛠️', text: 'Pick the rocket you are building (Rocket Lab)', amount: 5, note: 'Just one time' },
    { icon: '🏁', text: 'Play in a Ruler Game race and score', amount: 2, note: 'Once for each race' },
    { icon: '⭐', text: 'A bonus from your teacher', amount: null, note: '1 to 50, for great work' }
  ];

  function utcDay(d) {
    d = d || new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return String(d.getUTCFullYear()) + p(d.getUTCMonth() + 1) + p(d.getUTCDate());
  }
  // the same table the database rules use; -1 means "not an award a student can earn"
  function amountFor(key) {
    if (typeof key !== 'string') return -1;
    var m;
    if ((m = /^sailcar_quiz_([a-z]+)$/.exec(key))) return QUIZ_MODULES.indexOf(m[1]) >= 0 ? 10 : -1;
    if (Object.prototype.hasOwnProperty.call(FIXED, key)) return FIXED[key];
    if ((m = /^(sailcar_run|altitude_launch)_(\d{8})_(\d)$/.exec(key))) {
      var s = SLOTS[m[1]], n = Number(m[3]);
      return m[2] === utcDay() && n >= 1 && n <= s.max ? s.amount : -1;
    }
    if (/^ruler_race_[A-Za-z0-9]{1,40}$/.test(key)) return 2;
    return -1;
  }

  // ── small helpers ──
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  var memStore = {};
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return memStore[k] || null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { memStore[k] = v; } }
  function readPending(uid) {
    var all = safe(function () { return JSON.parse(lsGet(PENDING_KEY) || '{}'); }, {});
    var list = all && all[uid];
    return Array.isArray(list) ? list.filter(function (x) { return x && typeof x.key === 'string'; }) : [];
  }
  function writePending(uid, list) {
    safe(function () {
      var all = safe(function () { return JSON.parse(lsGet(PENDING_KEY) || '{}'); }, {});
      if (!all || typeof all !== 'object') all = {};
      all[uid] = list.slice(-30);
      lsSet(PENDING_KEY, JSON.stringify(all));
    });
  }

  // ── state ──
  var S = {
    user: null, role: 'unknown',              // 'student' | 'other' once known
    ledger: {}, entries: [], ledgerOk: null,  // ledgerOk: null = not loaded, true = loaded, false = could not read
    totals: null, totalsLoaded: false, stageB: null, unsubT: null,   // stageB: null = not known, true = the totals can be read, false = the rules do not know them yet
    migrating: false, migBad: {}, migTries: 0, coupledOffUntil: 0, notifyTimer: null,
    inflight: {}, subs: [], unsub: null, classes: null, classesAt: 0,
    ready: null, resolveReady: null, retryTimer: null, started: false
  };
  function newReady() { S.ready = new Promise(function (res) { S.resolveReady = res; }); }
  newReady();
  setTimeout(function () { if (S.resolveReady) S.resolveReady(); }, 15000);     // never wait forever (no sign-in, slow network)

  function total() { return S.entries.reduce(function (n, e) { return n + (Number(e.amount) || 0); }, 0); }
  // awards (earn / bonus) the totals do not include yet
  function uncounted() { return S.entries.filter(function (e) { return e.amount > 0 && (e.kind === 'earn' || e.kind === 'bonus') && !e.counted; }); }
  // earned - spent from the totals when they exist and include every award; otherwise the sum of the ledger
  // (the same number, just slower to get: it is never smaller than what stage A showed).
  function balanceNow() {
    if (S.ledgerOk !== true) return null;
    if (S.stageB === true && S.totals && !uncounted().length) return S.totals.earned - S.totals.spent;
    return total();
  }
  function shopState() {
    if (S.stageB === false) return 'off';
    if (S.stageB !== true || S.ledgerOk !== true || !S.totalsLoaded) return 'unknown';
    return S.totals && !uncounted().length ? 'on' : 'wait';
  }
  function ownedMap() {
    var o = {};
    S.entries.forEach(function (e) { if (e.kind === 'spend' && /^buy_[a-z]+-[a-z]+$/.test(e.key)) o[e.key.slice(4)] = true; });
    return o;
  }
  function state() { return { ready: S.role !== 'unknown', ok: S.ledgerOk === true, balance: balanceNow(), entries: S.entries.slice(), shop: shopState(), owned: ownedMap() }; }
  function notifyNow() {
    S.notifyTimer = null;
    var st = state();
    S.subs.slice().forEach(function (cb) { safe(function () { cb(st); }); });
  }
  // the ledger and the totals arrive as two separate snapshots: tell the page once, after both
  function notify() { if (!S.notifyTimer) S.notifyTimer = setTimeout(notifyNow, 30); }

  // ── the toast ──
  var toastHost = null;
  function injectCss() {
    if (document.getElementById('techbucks-css')) return;
    var st = document.createElement('style');
    st.id = 'techbucks-css';
    st.textContent =
      '#techbucks-toasts{position:fixed;left:0;right:0;bottom:18px;z-index:2147483000;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;padding:0 12px}' +
      '.tb-toast{background:#2a1a00;color:#ffe08a;border:2px solid #f0c040;border-radius:14px;padding:12px 18px;font:700 1.05rem/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.45);max-width:92vw;text-align:center;opacity:0;transform:translateY(10px);transition:opacity .25s,transform .25s}' +
      '.tb-toast.show{opacity:1;transform:none}' +
      '@media (prefers-reduced-motion:reduce){.tb-toast{transition:none}}';
    (document.head || document.documentElement).appendChild(st);
  }
  function toast(text) {
    safe(function () {
      if (!document.body) return;
      injectCss();
      if (!toastHost) {
        toastHost = document.createElement('div');
        toastHost.id = 'techbucks-toasts';
        toastHost.setAttribute('role', 'status');
        toastHost.setAttribute('aria-live', 'polite');
        document.body.appendChild(toastHost);
      }
      var t = document.createElement('div');
      t.className = 'tb-toast';
      t.textContent = text;
      toastHost.appendChild(t);
      setTimeout(function () { t.classList.add('show'); }, 20);
      setTimeout(function () { t.classList.remove('show'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400); }, 5500);
    });
  }

  // ── who is this? ──
  function checkRole(user) {
    var email = String((user && user.email) || '').toLowerCase();
    if (!email) return Promise.resolve('other');
    if (email === OWNER) return Promise.resolve('other');
    var p;
    if (window.TeacherRole && typeof window.TeacherRole.check === 'function') p = Promise.resolve(window.TeacherRole.check(firebase.firestore(), user));
    else p = firebase.firestore().collection('teachers').doc(email).get().then(function (s) { return { isTeacher: !!(s && s.exists) }; });
    return Promise.race([p, new Promise(function (res) { setTimeout(function () { res({ isTeacher: false }); }, 8000); })])
      .then(function (r) { return r && r.isTeacher ? 'other' : 'student'; }, function () { return 'student'; });
  }

  // ── the student's own ledger ──
  function startLedger(user) {
    if (S.unsub) { safe(S.unsub); S.unsub = null; }
    var db = firebase.firestore();
    S.unsub = db.collection('techbucks').where('uid', '==', user.uid).onSnapshot(function (snap) {
      var led = {}, list = [];
      snap.docs.forEach(function (d) {
        var x = d.data() || {};
        var at = x.createdAt && typeof x.createdAt.toMillis === 'function' ? x.createdAt.toMillis() : (d.metadata.hasPendingWrites ? Date.now() : 0);
        led[String(x.key || d.id)] = true;
        list.push({ id: d.id, key: String(x.key || d.id), amount: Number(x.amount) || 0, kind: String(x.kind || 'earn'), reason: String(x.reason || ''), createdAt: at, by: x.by ? String(x.by) : '', counted: x.counted === true });
      });
      list.sort(function (a, b) { return b.createdAt - a.createdAt; });
      S.ledger = led; S.entries = list; S.ledgerOk = true;
      cleanPending(user.uid);
      if (S.resolveReady) S.resolveReady();
      notify();
      applyNavBadge();
      migrateSoon();
    }, function (err) {
      S.ledgerOk = false;
      safe(function () { console.warn('Tech Bucks: the ledger is not readable yet (' + (err && err.code) + ').'); });
      if (S.resolveReady) S.resolveReady();
      notify();
    });
  }

  // ── the student's running totals (stage B) ──
  // Reading the totals document is also the test for "are the new rules published?": the old rules refuse it.
  function startTotals(user) {
    if (S.unsubT) { safe(S.unsubT); S.unsubT = null; }
    S.unsubT = firebase.firestore().collection('techbucks_totals').doc(user.uid).onSnapshot(function (snap) {
      var x = snap.exists ? (snap.data() || {}) : null;
      S.totals = x && typeof x.earned === 'number' && typeof x.spent === 'number' ? { earned: x.earned, spent: x.spent } : null;
      S.totalsLoaded = true; S.stageB = true;
      notify(); applyNavBadge(); migrateSoon();
    }, function (err) {
      S.stageB = err && err.code === 'permission-denied' ? false : S.stageB;
      S.totals = null; S.totalsLoaded = true;
      notify();
    });
  }

  // The totals change goes in the same batch as its ledger change: earned goes up/down by exactly the amount.
  function totalsChange(db, uid, ledgerId, earnedBy, spentBy) {
    var fv = firebase.firestore.FieldValue;
    return { uid: uid, earned: fv.increment(earnedBy), spent: fv.increment(spentBy), last: ledgerId, updatedAt: fv.serverTimestamp() };
  }

  // ── bring the old ledger documents into the totals (quietly, once per session) ──
  // Each old award (made before the totals existed) is marked counted in the same batch as earned going up by
  // exactly its amount. One per batch: a totals change can name only one ledger document.
  function migrateSoon() { setTimeout(function () { safe(migrate); }, 600); }
  function migrate() {
    var user = S.user;
    if (!user || S.role !== 'student' || S.migrating || S.stageB !== true || S.ledgerOk !== true || !S.totalsLoaded) return;
    var db = firebase.firestore(), todo = uncounted().filter(function (e) { return !S.migBad[e.id] && e.id.indexOf(user.uid + '_') === 0; });
    if (!todo.length) {
      if (!S.totals && S.migTries < 3) {                      // nothing to count: just make the (zero) totals document
        S.migTries++; S.migrating = true;
        db.collection('techbucks_totals').doc(user.uid).set({ uid: user.uid, earned: 0, spent: 0, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
          .then(function () { S.migrating = false; }, function () { S.migrating = false; });
      }
      return;
    }
    if (S.migTries > 60) return;
    S.migrating = true;
    var fails = 0;
    (function next(i) {
      if (S.user !== user || i >= todo.length || fails >= 3) { S.migrating = false; return; }
      var e = todo[i], batch = db.batch();
      batch.update(db.collection('techbucks').doc(e.id), { counted: true });
      batch.set(db.collection('techbucks_totals').doc(user.uid), totalsChange(db, user.uid, e.id, e.amount, 0), { merge: true });
      S.migTries++;
      batch.commit().then(function () { next(i + 1); }, function (err) {
        fails++; S.migBad[e.id] = true;
        safe(function () { console.warn('Tech Bucks: could not count one award yet (' + (err && err.code) + ').'); });
        next(i + 1);
      });
    })(0);
  }

  // the classes this student has joined (to tag awards, so the teacher can see them)
  function myClasses(user) {
    if (S.classes && Date.now() - S.classesAt < 300000) return Promise.resolve(S.classes);
    return firebase.firestore().collection('enrollments').where('uid', '==', user.uid).get().then(function (snap) {
      var list = snap.docs.map(function (d) { var x = d.data() || {}; return { id: String(x.classId || ''), name: String(x.className || '') }; })
        .filter(function (c) { return /^[A-Za-z0-9]{1,40}$/.test(c.id); })
        .sort(function (a, b) { return a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1); });
      S.classes = list; S.classesAt = Date.now();
      return list;
    }, function () { return []; });
  }

  // ── pending list ──
  function addPending(uid, entry) {
    var list = readPending(uid);
    if (list.some(function (x) { return x.key === entry.key; })) return;
    list.push(entry);
    writePending(uid, list);
  }
  function dropPending(uid, key) {
    var list = readPending(uid), keep = list.filter(function (x) { return x.key !== key; });
    if (keep.length !== list.length) writePending(uid, keep);
  }
  function isPending(uid, key) { return readPending(uid).some(function (x) { return x.key === key; }); }
  // anything the ledger already shows, or that can never be accepted any more, leaves the list
  function cleanPending(uid) {
    var list = readPending(uid), now = Date.now();
    var keep = list.filter(function (x) {
      return !S.ledger[x.key] && amountFor(x.key) >= 0 && (now - (Number(x.at) || now)) < MAX_AGE_MS && (Number(x.tries) || 0) < MAX_TRIES;
    });
    if (keep.length !== list.length) writePending(uid, keep);
    return keep;
  }

  // ── writing an award ──
  // entry: { key, reason, classId? } ; resolves with a status word
  function write(user, entry) {
    var key = entry.key;
    S.inflight[key] = true;
    var settled = false;
    return new Promise(function (resolve) {
      function finish(word) { if (!settled) { settled = true; resolve(word); } }
      var wait = setTimeout(function () { finish('queued'); }, WRITE_WAIT_MS);       // offline: the write waits in the SDK's queue
      myClasses(user).then(function (classes) {
        var cid = '';
        if (entry.classId && classes.some(function (c) { return c.id === entry.classId; })) cid = entry.classId;
        else if (classes.length) cid = classes[0].id;
        var data = { uid: user.uid, key: key, amount: amountFor(key), kind: 'earn',
                     reason: String(entry.reason || 'Nice work').slice(0, 80),
                     createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (cid) data.classId = cid;
        var db = firebase.firestore(), ref = db.collection('techbucks').doc(user.uid + '_' + key);
        function ok() {
          clearTimeout(wait);
          delete S.inflight[key];
          dropPending(user.uid, key);
          S.ledger[key] = true;
          toast('+' + data.amount + ' Tech Bucks! (' + data.reason + ')');
          finish('ok');
        }
        function bad(err) {
          clearTimeout(wait);
          delete S.inflight[key];
          bumpPending(user.uid, key);
          safe(function () { console.warn('Tech Bucks: not saved yet (' + (err && err.code) + '); will try again later.'); });
          finish('denied');
        }
        // stage A: the ledger document alone, exactly as before
        function plain() { return ref.set(data).then(ok, bad); }
        if (S.stageB === false || Date.now() < S.coupledOffUntil) return plain();
        // stage B: the ledger document (counted) and the totals, in one batch
        var batch = db.batch(), counted = Object.assign({ counted: true }, data);
        batch.set(ref, counted);
        batch.set(db.collection('techbucks_totals').doc(user.uid), totalsChange(db, user.uid, user.uid + '_' + key, data.amount, 0), { merge: true });
        return batch.commit().then(ok, function (err) {
          if (err && err.code === 'permission-denied') {            // the old rules (or the totals are not allowed yet): fall back to stage A
            return ref.set(data).then(function () {
              S.coupledOffUntil = Date.now() + 180000;               // the plain one worked, so it was the totals that were refused: skip them for a few minutes
              ok();
            }, bad);
          }
          return bad(err);
        });
      }).catch(function () { clearTimeout(wait); delete S.inflight[key]; finish('denied'); });
    });
  }
  function bumpPending(uid, key) {
    var list = readPending(uid);
    list.forEach(function (x) { if (x.key === key) { x.tries = (Number(x.tries) || 0) + 1; x.last = Date.now(); } });
    writePending(uid, list);
  }

  function retryPending() {
    safe(function () {
      var user = S.user;
      if (!user || S.role !== 'student') return;
      if (S.ledgerOk === false) startLedger(user);       // maybe the new rules are live now
      if (S.stageB === false) startTotals(user);          // ...and the stage B ones
      S.migTries = Math.min(S.migTries, 30); migrate();
      var now = Date.now();
      cleanPending(user.uid).forEach(function (x) {
        if (S.inflight[x.key] || S.ledger[x.key]) return;
        if (x.last && now - x.last < 60000) return;
        x.last = now;
        write(user, x);
      });
    });
  }

  function pickSlot(name) {
    var s = SLOTS[name], day = utcDay();
    for (var n = 1; n <= s.max; n++) {
      var k = name + '_' + day + '_' + n;
      if (!S.ledger[k] && !S.inflight[k] && !(S.user && isPending(S.user.uid, k))) return k;
    }
    return null;
  }
  function taken(key) {
    return !!(S.ledger[key] || S.inflight[key] || (S.user && isPending(S.user.uid, key)));
  }

  function doAward(key, reason, opts) {
    var user = S.user;
    if (!user || S.role !== 'student') return 'skipped';
    if (Object.prototype.hasOwnProperty.call(SLOTS, key)) {
      key = pickSlot(key);
      if (!key) return 'full';
    }
    if (amountFor(key) < 0) return 'skipped';
    if (taken(key)) return 'have';
    var entry = { key: key, reason: String(reason || '').slice(0, 80) || 'Nice work', classId: opts && opts.classId ? String(opts.classId) : '', tries: 0, at: Date.now() };
    addPending(user.uid, entry);
    return write(user, entry);
  }

  function award(key, reason, opts) {
    try {
      return S.ready.then(function () { return doAward(String(key), reason, opts || {}); }).catch(function () { return 'skipped'; });
    } catch (e) { return Promise.resolve('skipped'); }
  }
  function awardFirstThenSlots(firstKey, slotName, reason, opts) {
    try {
      return S.ready.then(function () {
        if (S.user && S.role === 'student' && !taken(firstKey)) return doAward(firstKey, reason, opts || {});
        return doAward(slotName, reason, opts || {});
      }).catch(function () { return 'skipped'; });
    } catch (e) { return Promise.resolve('skipped'); }
  }

  function balance() { return balanceNow(); }

  // ── spending (stage B) ──
  // One purchase = one ledger document techbucks/{uid}_buy_{itemId} (kind "spend", amount = -price) + the totals' "spent" going
  // up by the price + (optionally) the avatar document, all in ONE batch. The database checks the price, the balance and that
  // the item was not bought before; the checks here only give a friendly answer first.
  function spend(itemId, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      function fin(r) { if (!done) { done = true; resolve(r); } }
      try {
        var user = S.user;
        if (!user || S.role !== 'student') return fin({ ok: false, why: 'skipped' });
        var price = window.Avatar && window.Avatar.priceOf ? window.Avatar.priceOf(itemId) : -1;
        if (!(price > 0)) return fin({ ok: false, why: 'unknown' });
        var st = shopState();
        if (st === 'off') return fin({ ok: false, why: 'off' });
        if (st !== 'on') return fin({ ok: false, why: 'wait' });
        if (ownedMap()[itemId]) return fin({ ok: false, why: 'owned' });
        var bal = balanceNow();
        if (bal == null || bal < price) return fin({ ok: false, why: 'poor', need: Math.max(1, price - (bal || 0)) });
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return fin({ ok: false, why: 'offline' });
        var item = window.Avatar.itemOf(itemId);
        var timer = setTimeout(function () { fin({ ok: false, why: 'error' }); }, 15000);
        myClasses(user).then(function (classes) {
          var db = firebase.firestore(), fv = firebase.firestore.FieldValue, id = user.uid + '_buy_' + itemId;
          var data = { uid: user.uid, key: 'buy_' + itemId, amount: -price, kind: 'spend', reason: ('Bought ' + (item ? item.name : itemId)).slice(0, 80), createdAt: fv.serverTimestamp() };
          if (classes.length) data.classId = classes[0].id;
          var b = db.batch();
          b.set(db.collection('techbucks').doc(id), data);
          b.set(db.collection('techbucks_totals').doc(user.uid), totalsChange(db, user.uid, id, 0, price), { merge: true });
          if (opts.equip && typeof opts.equip === 'object') b.set(db.collection('avatars').doc(user.uid), { uid: user.uid, equipped: opts.equip, updatedAt: fv.serverTimestamp() });
          return b.commit().then(function () { clearTimeout(timer); fin({ ok: true }); }, function (err) {
            clearTimeout(timer);
            safe(function () { console.warn('Tech Bucks: the purchase was refused (' + (err && err.code) + ').'); });
            fin({ ok: false, why: err && err.code === 'permission-denied' ? 'refused' : 'error' });
          });
        }).catch(function () { fin({ ok: false, why: 'error' }); });
      } catch (e) { fin({ ok: false, why: 'error' }); }
    });
  }
  function subscribe(cb) {
    if (typeof cb !== 'function') return function () {};
    S.subs.push(cb);
    safe(function () { cb(state()); });
    return function () { S.subs = S.subs.filter(function (f) { return f !== cb; }); };
  }
  function badge(el) {
    if (!el) return function () {};
    return subscribe(function (st) { el.textContent = st.balance == null ? '' : '🪙 ' + st.balance; });
  }
  // the nav link to the Tech Bucks page shows the balance
  var navBadge = null;
  function applyNavBadge() {
    safe(function () {
      var a = document.querySelector('a.nav-link[href="tech-bucks.html"]');
      if (!a || S.ledgerOk !== true) return;
      if (!navBadge || navBadge.parentNode !== a) {
        navBadge = document.createElement('span');
        navBadge.className = 'tb-nav-badge';
        navBadge.style.cssText = 'margin-left:6px;font-weight:700';
        a.appendChild(navBadge);
      }
      navBadge.textContent = String(balanceNow());
    });
  }

  // ── start ──
  function init() {
    if (S.started) return;
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) return;
    S.started = true;
    firebase.auth().onAuthStateChanged(function (user) {
      safe(function () {
        if (S.unsub) { safe(S.unsub); S.unsub = null; }
        if (S.unsubT) { safe(S.unsubT); S.unsubT = null; }
        S.user = user || null; S.role = 'unknown'; S.ledger = {}; S.entries = []; S.ledgerOk = null; S.classes = null;
        S.totals = null; S.totalsLoaded = false; S.stageB = null; S.migrating = false; S.migBad = {}; S.migTries = 0; S.coupledOffUntil = 0;
        if (!user) return;
        checkRole(user).then(function (role) {
          if (S.user !== user) return;
          S.role = role;
          if (role === 'student') {
            startLedger(user);
            startTotals(user);
            setTimeout(retryPending, 4000);
            if (!S.retryTimer) S.retryTimer = setInterval(retryPending, RETRY_EVERY_MS);
          } else if (S.resolveReady) S.resolveReady();
          notify();
        });
      });
    });
  }
  window.TechBucks = {
    award: award, awardFirstThenSlots: awardFirstThenSlots, balance: balance, subscribe: subscribe, badge: badge, spend: spend,
    TABLE: TABLE, amountFor: amountFor, utcDay: utcDay, isStudent: function () { return S.role === 'student'; }
  };
  safe(init);
  if (!S.started) {                                         // Firebase not loaded yet: try again once the page has
    safe(function () { window.addEventListener('load', function () { safe(init); }); });
  }
})();
