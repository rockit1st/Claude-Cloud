'use strict';

require('dotenv').config();
const admin = require('firebase-admin');

let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.warn('[notifications] Firebase env vars not set — push notifications disabled');
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        // Private key in env is often stored with literal \n; replace them
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail,
      }),
    });
    firebaseInitialized = true;
    console.log('[notifications] Firebase Admin SDK initialized');
  } catch (err) {
    console.error('[notifications] Failed to initialize Firebase:', err.message);
  }
}

// Initialize on module load
initFirebase();

/**
 * Send a push notification via FCM.
 * Swallows errors for stale / invalid tokens so the caller never crashes.
 *
 * @param {string} fcmToken   - Recipient device FCM token
 * @param {string} title      - Notification title
 * @param {string} body       - Notification body text
 * @param {object} [data={}]  - Optional key-value data payload
 */
async function sendPushNotification(fcmToken, title, body, data = {}) {
  if (!firebaseInitialized) {
    console.warn('[notifications] Skipping push — Firebase not initialized');
    return;
  }

  if (!fcmToken) {
    console.warn('[notifications] Skipping push — no FCM token provided');
    return;
  }

  const message = {
    token: fcmToken,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: 'high',
      notification: { sound: 'default' },
    },
    apns: {
      payload: {
        aps: { sound: 'default' },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`[notifications] Push sent successfully: ${response}`);
  } catch (err) {
    // Stale or invalid tokens should not bubble up and crash the scheduler
    const staleErrors = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
    ];
    if (staleErrors.includes(err.code)) {
      console.warn(`[notifications] Stale FCM token — skipping: ${err.message}`);
    } else {
      console.error(`[notifications] Failed to send push notification: ${err.message}`);
    }
  }
}

module.exports = { sendPushNotification };
