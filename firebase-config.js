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
  apiKey:            "PASTE_YOUR_API_KEY_HERE",
  authDomain:        "your-project-id.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project-id.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "1:000000000000:web:0000000000000000000000"
};

// Teacher accounts — only these emails can view the dashboard.
export const TEACHER_EMAILS = [
  "npcap724@gmail.com",
  "ncapellini@hhh.k12.ny.us"
];
