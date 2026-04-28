// auth.js — shared Firebase Auth + Firestore helpers
import { FIREBASE_CONFIG, TEACHER_EMAILS } from './firebase-config.js';

import { initializeApp }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged }
                                 from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp }
                                 from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app  = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Auth state → update nav ───────────────────────────────────
onAuthStateChanged(auth, user => {
  const btn    = document.getElementById('auth-btn');
  const avatar = document.getElementById('auth-avatar');
  const name   = document.getElementById('auth-name');
  if (!btn) return;

  const isTeacher = user && TEACHER_EMAILS.includes(user.email);

  if (user) {
    btn.onclick = doSignOut;
    btn.title   = 'Sign out';
    if (avatar) { avatar.src = user.photoURL || ''; avatar.style.display = 'inline-block'; }
    if (name)   name.textContent = user.displayName?.split(' ')[0] || user.email;
    btn.classList.add('signed-in');
  } else {
    btn.onclick = doSignIn;
    btn.title   = 'Sign in with your school Google account';
    if (avatar) avatar.style.display = 'none';
    if (name)   name.textContent = 'Sign In';
    btn.classList.remove('signed-in');
  }

  // Show/hide teacher dashboard link in nav
  const navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    let dashLink = document.getElementById('nav-dashboard');
    if (isTeacher && !dashLink) {
      dashLink = document.createElement('a');
      dashLink.id        = 'nav-dashboard';
      dashLink.href      = 'dashboard.html';
      dashLink.className = 'nav-link';
      dashLink.textContent = '📊 Dashboard';
      navLinks.appendChild(dashLink);
    } else if (!isTeacher && dashLink) {
      dashLink.remove();
    }
  }

  // Expose current user globally so games can read it
  window.currentUser = user || null;
});

async function doSignIn() {
  try {
    await signInWithRedirect(auth, new GoogleAuthProvider());
  } catch (e) {
    console.error('Sign-in failed', e);
  }
}

// Handle return from Google redirect
getRedirectResult(auth).catch(e => console.error('Redirect result error', e));

async function doSignOut() {
  await signOut(auth);
}

// ── Score saving ──────────────────────────────────────────────
// Call this from any game when a round ends.
// game: string identifier e.g. 'ruler-game'
// data: plain object with score fields (e.g. { score, mode, difficulty })
window.saveScore = async function(game, data) {
  const user = auth.currentUser;
  if (!user) return; // not signed in — silently skip
  try {
    await addDoc(collection(db, 'scores'), {
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName || user.email,
      game,
      ...data,
      ts: serverTimestamp()
    });
  } catch (e) {
    console.error('saveScore failed', e);
  }
};

// ── Teacher guard ─────────────────────────────────────────────
// Call on dashboard.html to redirect non-teachers away.
window.requireTeacher = function(onReady) {
  onAuthStateChanged(auth, user => {
    if (!user) {
      doSignIn().then(() => onAuthStateChanged(auth, u => {
        if (u && TEACHER_EMAILS.includes(u.email)) onReady(u, db);
        else document.getElementById('dash-status').textContent = 'Access denied.';
      }));
    } else if (TEACHER_EMAILS.includes(user.email)) {
      onReady(user, db);
    } else {
      document.getElementById('dash-status').textContent =
        `Signed in as ${user.email} — this page is for teachers only.`;
    }
  });
};
