// Who is a teacher on this site?
//   - the owner (hard-coded below), or
//   - anyone the owner added on the Classes page (a teachers/{email} record).
// Pages load this after the Firebase scripts and call TeacherRole.check(...).
// Any failed or denied read counts as "not a teacher" (students see the student view).
(function () {
  var OWNER = 'ncapellini@hhh.k12.ny.us';

  function check(db, user) {
    var email = String((user && user.email) || '').toLowerCase();
    if (!email) return Promise.resolve({ isOwner: false, isTeacher: false, email: '' });
    if (email === OWNER) return Promise.resolve({ isOwner: true, isTeacher: true, email: email });
    return db.collection('teachers').doc(email).get().then(function (s) {
      return { isOwner: false, isTeacher: !!(s && s.exists), email: email };
    }, function () {
      return { isOwner: false, isTeacher: false, email: email };
    });
  }

  window.TeacherRole = { OWNER: OWNER, check: check };
})();
