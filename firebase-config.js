// ─────────────────────────────────────────────────────────────
//  STEP 1 — Create a free Firebase project at https://console.firebase.google.com
//  STEP 2 — Enable "Google" as a sign-in provider under Authentication → Sign-in method
//  STEP 3 — Add your GitHub Pages domain (e.g. yourusername.github.io) to
//            Authentication → Settings → Authorized domains
//  STEP 4 — Go to Project Settings → Your apps → Add web app, copy the config
//            object below and replace the placeholder values.
//  STEP 5 — TEACHER_EMAILS is already set to your two accounts below.
// ─────────────────────────────────────────────────────────────

export const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBKGSWItkS0HkZcYCTc30C_fTugw1SoymI",
  authDomain:        "techno-teacher-6d631.firebaseapp.com",
  projectId:         "techno-teacher-6d631",
  storageBucket:     "techno-teacher-6d631.firebasestorage.app",
  messagingSenderId: "270196601225",
  appId:             "1:270196601225:web:07efb1169c2b0492313158"
};

// Teacher accounts — only these emails can view the dashboard.
export const TEACHER_EMAILS = [
  "npcap724@gmail.com",
  "ncapellini@hhh.k12.ny.us"
];
