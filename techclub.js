// Tech Club helper (window.TechClub). Pages load it after the Firebase scripts and auth.js.
//
// The club is members only. A student joins with the club code (clubCodes/{CODE}); that writes
// clubMembers/{uid}. The news (clubPosts) can only be read by members and the owner: the database
// rules enforce that. The lessons on the build and code pages are page text: those pages send
// non-members back to techclub.html, but that is a soft gate, not a secret.
//
//   TechClub.status(user)          Promise -> { isOwner, isMember, denied }. A failed read counts as "not a member".
//   TechClub.join(code, user)      Promise. Rejects with an error whose .friendly is the text to show.
//   TechClub.leave(user)           Promise. Deletes the student's own member entry.
//   TechClub.requireMember(onOk)   Content pages: shows nothing until the account is a member (or the owner),
//                                  then calls onOk(user, status). Anyone else goes to techclub.html.
//   TechClub.friendly(e)           The text to show a student for a failed club action.
// Owner only (the database refuses everyone else):
//   getCode(), newCode(), listMembers(), removeMember(uid), listPosts(), addPost(user, p), deletePost(id)
(function () {
  var OWNER = (window.TeacherRole && window.TeacherRole.OWNER) || 'ncapellini@hhh.k12.ny.us';
  var CODE_RE = /^[A-Z0-9]{8}$/;
  // 31 letters and digits that cannot be mixed up when read aloud or off a screen (no 0/O, 1/I/L)
  var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var BAD_CODE = 'That code did not work. Check it and try again.';
  var NOT_READY = 'The Tech Club is not ready yet. Ask Mr. Capellini.';
  var NEEDS_RULES = 'The Tech Club needs the new rules. They publish automatically on release.';

  function db() { return firebase.firestore(); }
  function emailOf(user) { return String((user && user.email) || '').toLowerCase(); }
  function isOwnerUser(user) { return emailOf(user) === OWNER; }
  function isDenied(e) { return !!e && (e.code === 'permission-denied' || e.code === 'club/not-ready'); }

  function fail(code, friendly) { var e = new Error(friendly); e.code = code; e.friendly = friendly; return e; }
  function friendly(e) {
    if (e && e.friendly) return e.friendly;
    if (isDenied(e)) return NOT_READY;
    return 'Something went wrong. Try again.';
  }

  function status(user) {
    var out = { isOwner: isOwnerUser(user), isMember: false, denied: false };
    if (!user) return Promise.resolve(out);
    return db().collection('clubMembers').doc(user.uid).get().then(function (s) {
      out.isMember = !!(s && s.exists);
      return out;
    }, function (e) {
      out.denied = isDenied(e);       // any failed read: treat as "not a member"
      return out;
    });
  }

  function cleanCode(code) { return String(code == null ? '' : code).trim().toUpperCase(); }

  function join(code, user) {
    var c = cleanCode(code);
    if (!user) return Promise.reject(fail('club/no-user', 'Sign in first.'));
    if (!CODE_RE.test(c)) return Promise.reject(fail('club/bad-code', BAD_CODE));
    return db().collection('clubCodes').doc(c).get().then(function (s) {
      if (!s.exists) throw fail('club/bad-code', BAD_CODE);
      return db().collection('clubMembers').doc(user.uid).set({
        uid: user.uid,
        name: String(user.displayName || user.email || 'Member').slice(0, 80),
        email: emailOf(user),
        code: c,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }).catch(function (e) {
      if (e && e.friendly) throw e;
      throw fail(isDenied(e) ? 'club/not-ready' : (e && e.code) || 'club/error', friendly(e));
    });
  }

  function leave(user) {
    return db().collection('clubMembers').doc(user.uid).delete();
  }

  // The content pages (build, code). Everything inside #tc-content stays hidden until this passes.
  function requireMember(onOk) {
    var done = false;
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user || done) return;          // auth.js sends signed-out people to the login page
      done = true;
      status(user).then(function (st) {
        if (st.isOwner || st.isMember) {
          var c = document.getElementById('tc-content'); if (c) c.style.display = 'block';
          var w = document.getElementById('tc-wait'); if (w) w.style.display = 'none';
          if (onOk) onOk(user, st);
        } else {
          window.location.replace('techclub.html');
        }
      });
    });
  }

  // ── owner only ──
  function makeCode() {
    var r = new Uint32Array(8), s = '', i;
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(r);
    else for (i = 0; i < r.length; i++) r[i] = Math.floor(Math.random() * 4294967296);
    for (i = 0; i < r.length; i++) s += ALPHABET[r[i] % ALPHABET.length];
    return s;
  }
  // the active code, or '' when there is none
  function getCode() {
    return db().collection('clubCodes').get().then(function (snap) {
      var ids = snap.docs.map(function (d) { return d.id; }).sort();
      return ids.length ? ids[ids.length - 1] : '';
    });
  }
  // Delete every old code and make the new one in ONE batch: there is never more than one active code.
  function newCode() {
    var code = makeCode();
    return db().collection('clubCodes').get().then(function (snap) {
      var b = db().batch();
      snap.docs.forEach(function (d) { b.delete(d.ref); });
      b.set(db().collection('clubCodes').doc(code), { clubId: 'techclub', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      return b.commit();
    }).then(function () { return code; });
  }
  function listMembers() {
    return db().collection('clubMembers').get().then(function (snap) {
      return snap.docs.map(function (d) { var x = d.data(); x.uid = d.id; return x; });
    });
  }
  function removeMember(uid) { return db().collection('clubMembers').doc(uid).delete(); }

  // Posts newest first: [{ id, title, body, kind, meetingDate, createdAt (ms) }]
  function listPosts() {
    return db().collection('clubPosts').orderBy('createdAt', 'desc').limit(100).get().then(function (snap) {
      return snap.docs.map(function (d) {
        var x = d.data();
        return { id: d.id, title: String(x.title || ''), body: String(x.body || ''), kind: x.kind === 'meeting' ? 'meeting' : 'news',
                 meetingDate: typeof x.meetingDate === 'string' ? x.meetingDate : '',
                 createdAt: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0 };
      });
    });
  }
  function postId() {
    var r = new Uint32Array(16), s = '', i;
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(r);
    else for (i = 0; i < r.length; i++) r[i] = Math.floor(Math.random() * 4294967296);
    for (i = 0; i < r.length; i++) s += ALPHABET[r[i] % ALPHABET.length].toLowerCase();
    return s;
  }
  function addPost(user, p) {
    var d = { title: p.title, body: p.body, kind: p.kind, createdAt: firebase.firestore.FieldValue.serverTimestamp(), by: user.email };
    if (p.kind === 'meeting' && p.meetingDate) d.meetingDate = p.meetingDate;
    return db().collection('clubPosts').doc(postId()).set(d);
  }
  function deletePost(id) { return db().collection('clubPosts').doc(id).delete(); }

  window.TechClub = {
    OWNER: OWNER, BAD_CODE: BAD_CODE, NOT_READY: NOT_READY, NEEDS_RULES: NEEDS_RULES,
    cleanCode: cleanCode, isDenied: isDenied, friendly: friendly,
    status: status, join: join, leave: leave, requireMember: requireMember,
    getCode: getCode, newCode: newCode, listMembers: listMembers, removeMember: removeMember,
    listPosts: listPosts, addPost: addPost, deletePost: deletePost
  };
})();
