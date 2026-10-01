// Shared helper: swap a game's Period picker for a Class picker based on the
// classes the signed-in student has joined.
//
// Usage on a game page (after firebase + auth.js are loaded):
//   setupClassPicker('player-class', 'player-period');
// and at save time:
//   var g = getGroupSelection('player-class', 'player-period');
//   // g = { classId, className, period }  (period only set in the fallback)
//
// Behaviour:
//  - If the student has joined >=1 class, the class <select> is populated and
//    shown, and the period <select> is hidden. Scores are tagged with the class.
//  - If the student has joined none, OR the enrollments read fails (e.g. the
//    Firestore rule isn't set yet), the original Period picker stays visible so
//    gameplay and posting are never broken. Those scores keep a period, no class.

(function () {
  window.getGroupSelection = function (classSelId, periodSelId) {
    var cs = document.getElementById(classSelId);
    if (cs && cs.style.display !== 'none' && cs.value) {
      var opt = cs.options[cs.selectedIndex];
      return { classId: cs.value, className: opt ? opt.textContent : '', period: '' };
    }
    var ps = document.getElementById(periodSelId);
    return { classId: '', className: '', period: (ps && ps.value) || '—' };
  };

  window.setupClassPicker = function (classSelId, periodSelId) {
    if (typeof firebase === 'undefined') return;
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) return;
      var cs = document.getElementById(classSelId);
      var ps = document.getElementById(periodSelId);
      firebase.firestore().collection('enrollments').where('uid', '==', user.uid).get()
        .then(function (snap) {
          var classes = snap.docs.map(function (d) { var x = d.data(); return { classId: x.classId, className: x.className }; })
            .filter(function (c) { return c.classId; })
            .sort(function (a, b) { return String(a.className || '').localeCompare(String(b.className || '')); });
          if (classes.length && cs) {
            cs.innerHTML = '';
            classes.forEach(function (c) {
              var o = document.createElement('option');
              o.value = c.classId;
              o.textContent = c.className || 'Class';
              cs.appendChild(o);
            });
            cs.style.display = '';
            if (ps) ps.style.display = 'none';
          } else {
            if (cs) cs.style.display = 'none';
            if (ps) ps.style.display = '';
          }
        })
        .catch(function (e) {
          console.error(e);
          if (cs) cs.style.display = 'none';
          if (ps) ps.style.display = '';
        });
    });
  };
})();
