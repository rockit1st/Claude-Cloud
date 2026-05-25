// ── Firebase config ──────────────────────────────────────────────────────────
// After creating your Firebase project, replace ALL values below with the ones
// from: Firebase Console → Project Settings → Your Apps → SDK setup & config
const firebaseConfig = {
  apiKey:            "AIzaSyBKGSWItkS0HkZcYCTc30C_fTugw1SoymI",
  authDomain:        "techno-teacher-6d631.firebaseapp.com",
  projectId:         "techno-teacher-6d631",
  storageBucket:     "techno-teacher-6d631.firebasestorage.app",
  messagingSenderId: "270196601225",
  appId:             "1:270196601225:web:07efb1169c2b0492313158"
};

const ALLOWED_DOMAIN = "hhh.k12.ny.us";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

firebase.auth().onAuthStateChanged(function (user) {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  const domain = user.email.split("@")[1];
  if (domain !== ALLOWED_DOMAIN) {
    firebase.auth().signOut().then(function () {
      window.location.replace("login.html?error=domain");
    });
    return;
  }

  // Authenticated + correct domain → show the page
  document.body.style.visibility = "visible";

  var nameEl = document.getElementById("nav-user-name");
  var areaEl = document.getElementById("nav-user-area");
  if (nameEl) nameEl.textContent = user.displayName || user.email;
  if (areaEl) areaEl.style.display = "flex";
});

function signOut() {
  firebase.auth().signOut().then(function () {
    window.location.replace("login.html");
  });
}
