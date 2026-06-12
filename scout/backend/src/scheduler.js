'use strict';

const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./db');
const { sendPushNotification } = require('./notifications');
const { searchEbay } = require('./integrations/ebay');
const { searchReddit } = require('./integrations/reddit');
const { searchChrono24 } = require('./integrations/chrono24');
const { searchFacebook } = require('./integrations/facebook');

const INTEGRATION_MAP = {
  ebay: searchEbay,
  reddit: searchReddit,
  chrono24: searchChrono24,
  facebook: searchFacebook,
};

/**
 * Run all enabled marketplace searches for a single scout,
 * persist new listings, and fire push notifications.
 *
 * @param {object} scout - Row from scouts table (keywords/marketplaces already parsed)
 */
async function processScout(scout) {
  const db = getDb();
  const keywords = JSON.parse(scout.keywords);
  const marketplaces = JSON.parse(scout.marketplaces);

  // Fetch owner for notification settings
  const user = db.prepare('SELECT id, fcm_token, notifications_enabled FROM users WHERE id = ?').get(scout.user_id);
  if (!user) return;

  console.log(`[scheduler] Processing scout "${scout.name}" (${scout.id}) — marketplaces: ${marketplaces.join(', ')}`);

  const newListings = [];

  for (const marketplace of marketplaces) {
    const searchFn = INTEGRATION_MAP[marketplace];
    if (!searchFn) {
      console.warn(`[scheduler] Unknown marketplace: ${marketplace}`);
      continue;
    }

    try {
      const results = await searchFn(keywords, scout.min_price, scout.max_price);
      console.log(`[scheduler]   ${marketplace}: ${results.length} result(s)`);

      for (const item of results) {
        if (!item.url) continue;

        // Deduplicate by (scout_id, url)
        const existing = db
          .prepare('SELECT id FROM listings WHERE scout_id = ? AND url = ?')
          .get(scout.id, item.url);

        if (existing) continue;

        const listingId = uuidv4();
        try {
          db.prepare(`
            INSERT INTO listings (id, scout_id, marketplace, title, price, url, image_url, description, seller)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            listingId,
            scout.id,
            item.marketplace,
            item.title,
            item.price ?? null,
            item.url,
            item.image_url ?? null,
            item.description ?? null,
            item.seller ?? null,
          );
          newListings.push({ ...item, id: listingId });
        } catch (insertErr) {
          // UNIQUE constraint race — safe to ignore
          if (!insertErr.message.includes('UNIQUE')) {
            console.error(`[scheduler] Insert error for listing: ${insertErr.message}`);
          }
        }
      }
    } catch (err) {
      console.error(`[scheduler] Integration "${marketplace}" threw an error: ${err.message}`);
    }
  }

  // Send push notifications for new listings if enabled
  const shouldNotify =
    user.notifications_enabled === 1 &&
    scout.notifications_enabled === 1 &&
    user.fcm_token;

  if (shouldNotify && newListings.length > 0) {
    const title = `Scout: ${scout.name}`;
    const body =
      newListings.length === 1
        ? `New listing: ${newListings[0].title}`
        : `${newListings.length} new listings found`;

    const data = {
      scout_id: scout.id,
      listing_count: String(newListings.length),
      // Include details for single-listing notifications
      ...(newListings.length === 1 && {
        listing_id: newListings[0].id,
        listing_url: newListings[0].url,
        marketplace: newListings[0].marketplace,
      }),
    };

    await sendPushNotification(user.fcm_token, title, body, data);
  }

  console.log(`[scheduler] Scout "${scout.name}" done — ${newListings.length} new listing(s)`);
}

/**
 * Run all active scouts. Called by the cron job (and can be triggered manually).
 */
async function runAllScouts() {
  const db = getDb();
  const timestamp = new Date().toISOString();
  console.log(`[scheduler] Run started at ${timestamp}`);

  const scouts = db.prepare('SELECT * FROM scouts WHERE active = 1').all();
  console.log(`[scheduler] Found ${scouts.length} active scout(s)`);

  // Process scouts sequentially to avoid hammering APIs
  for (const scout of scouts) {
    try {
      await processScout(scout);
    } catch (err) {
      console.error(`[scheduler] Unhandled error in scout "${scout.id}": ${err.message}`);
    }
  }

  console.log(`[scheduler] Run complete at ${new Date().toISOString()}`);
}

/**
 * Initialize and start the cron scheduler (every 30 minutes).
 */
function startScheduler() {
  console.log('[scheduler] Starting — cron job scheduled every 30 minutes');

  // '*/30 * * * *' = at minute 0 and 30 of every hour
  cron.schedule('*/30 * * * *', () => {
    runAllScouts().catch((err) => {
      console.error('[scheduler] Top-level error in runAllScouts:', err.message);
    });
  });
}

module.exports = { startScheduler, runAllScouts, processScout };
