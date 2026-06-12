'use strict';

require('dotenv').config();
const Bull = require('bull');
const { query } = require('./db');
const { sendPushNotification } = require('./notifications');
const { searchEbay } = require('./integrations/ebay');
const { searchReddit } = require('./integrations/reddit');
const { searchChrono24 } = require('./integrations/chrono24');
const { searchFacebook } = require('./integrations/facebook');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SEARCH_INTERVAL_MINUTES = parseInt(process.env.SEARCH_INTERVAL_MINUTES, 10) || 30;

const INTEGRATION_MAP = {
  ebay: searchEbay,
  reddit: searchReddit,
  chrono24: searchChrono24,
  facebook: searchFacebook,
};

const scoutQueue = new Bull('scout-searches', REDIS_URL);

/**
 * Add (or refresh) a repeating job for a specific scout.
 * Using jobId = scoutId deduplicates so only one scheduled job exists per scout.
 *
 * @param {string} scoutId
 */
async function addScoutJob(scoutId) {
  await scoutQueue.add(
    { scoutId },
    {
      jobId: scoutId,
      repeat: { every: SEARCH_INTERVAL_MINUTES * 60 * 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
}

/**
 * Query DB for all active scouts and register a repeating job for each.
 */
async function scheduleAllScouts() {
  const { rows } = await query('SELECT id FROM scouts WHERE active = true');
  console.log(`[queue] Scheduling ${rows.length} active scout(s)`);

  for (const row of rows) {
    await addScoutJob(row.id);
  }
}

/**
 * Core processing logic — mirrors old processScout() from scheduler.js,
 * rewritten for async pg queries and JSONB columns (no JSON.parse needed).
 *
 * @param {string} scoutId
 * @returns {number} count of new listings inserted
 */
async function processScout(scoutId) {
  const { rows: scoutRows } = await query('SELECT * FROM scouts WHERE id = $1', [scoutId]);
  const scout = scoutRows[0];
  if (!scout) {
    console.warn(`[queue] Scout ${scoutId} not found — skipping`);
    return 0;
  }

  const { rows: userRows } = await query(
    'SELECT id, fcm_token, notifications_enabled FROM users WHERE id = $1',
    [scout.user_id],
  );
  const user = userRows[0];
  if (!user) {
    console.warn(`[queue] User for scout ${scoutId} not found — skipping`);
    return 0;
  }

  // keywords and marketplaces are JSONB — pg returns them as JS arrays already
  const keywords = scout.keywords;
  const marketplaces = scout.marketplaces;

  console.log(`[queue] Processing scout "${scout.name}" (${scout.id}) — marketplaces: ${marketplaces.join(', ')}`);

  const newListings = [];

  for (const marketplace of marketplaces) {
    const searchFn = INTEGRATION_MAP[marketplace];
    if (!searchFn) {
      console.warn(`[queue] Unknown marketplace: ${marketplace}`);
      continue;
    }

    try {
      const results = await searchFn(keywords, scout.min_price, scout.max_price);
      console.log(`[queue]   ${marketplace}: ${results.length} result(s)`);

      for (const item of results) {
        if (!item.url) continue;

        try {
          const insertResult = await query(
            `INSERT INTO listings (scout_id, marketplace, title, price, url, image_url, description, seller)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (scout_id, url) DO NOTHING
             RETURNING id`,
            [
              scout.id,
              item.marketplace,
              item.title,
              item.price ?? null,
              item.url,
              item.image_url ?? null,
              item.description ?? null,
              item.seller ?? null,
            ],
          );

          if (insertResult.rows.length > 0) {
            newListings.push({ ...item, id: insertResult.rows[0].id });
          }
        } catch (insertErr) {
          console.error(`[queue] Insert error for listing: ${insertErr.message}`);
        }
      }
    } catch (err) {
      console.error(`[queue] Integration "${marketplace}" threw an error: ${err.message}`);
    }
  }

  // Send push notifications if enabled
  const shouldNotify =
    user.notifications_enabled === true &&
    scout.notifications_enabled === true &&
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
      ...(newListings.length === 1 && {
        listing_id: newListings[0].id,
        listing_url: newListings[0].url,
        marketplace: newListings[0].marketplace,
      }),
    };

    await sendPushNotification(user.fcm_token, title, body, data);
  }

  console.log(`[queue] Scout "${scout.name}" done — ${newListings.length} new listing(s)`);
  return newListings.length;
}

/**
 * Register the Bull worker that processes scout-search jobs.
 */
function startWorker() {
  scoutQueue.process(async (job) => {
    const { scoutId } = job.data;
    try {
      const count = await processScout(scoutId);
      return { newListings: count };
    } catch (err) {
      // Log but do not rethrow — keeps worker alive
      console.error(`[queue] Unhandled error processing scout ${scoutId}: ${err.message}`);
      throw err; // Let Bull mark the job as failed for visibility
    }
  });

  scoutQueue.on('completed', (job, result) => {
    console.log(`[queue] Job ${job.id} completed — ${result.newListings} new listing(s)`);
  });

  scoutQueue.on('failed', (job, err) => {
    console.error(`[queue] Job ${job.id} failed: ${err.message}`);
  });

  console.log('[queue] Worker started');
}

module.exports = { scoutQueue, addScoutJob, scheduleAllScouts, startWorker };
