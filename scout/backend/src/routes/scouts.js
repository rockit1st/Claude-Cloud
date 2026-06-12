'use strict';

const express = require('express');
const { query } = require('../db');
const { addScoutJob, scoutQueue } = require('../queue');
const { scoutCreateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const VALID_MARKETPLACES = ['ebay', 'reddit', 'chrono24', 'facebook'];

// ─── GET /api/scouts ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM scouts WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id],
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[scouts/GET /] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ─── POST /api/scouts ──────────────────────────────────────────────────────────
router.post('/', scoutCreateLimiter, async (req, res) => {
  const { name, keywords, min_price, max_price, marketplaces, notifications_enabled } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'name is required' });
  }
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ success: false, error: 'keywords must be a non-empty array' });
  }
  if (!Array.isArray(marketplaces) || marketplaces.length === 0) {
    return res.status(400).json({ success: false, error: 'marketplaces must be a non-empty array' });
  }

  const invalidMp = marketplaces.filter((m) => !VALID_MARKETPLACES.includes(m));
  if (invalidMp.length > 0) {
    return res.status(400).json({ success: false, error: `Invalid marketplace(s): ${invalidMp.join(', ')}` });
  }

  try {
    const insertResult = await query(
      `INSERT INTO scouts (user_id, name, keywords, min_price, max_price, marketplaces, notifications_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.id,
        name.trim(),
        JSON.stringify(keywords),
        min_price != null ? Number(min_price) : null,
        max_price != null ? Number(max_price) : null,
        JSON.stringify(marketplaces),
        notifications_enabled !== false,
      ],
    );

    const newScout = insertResult.rows[0];

    // Schedule a recurring job for this scout
    await addScoutJob(newScout.id);

    return res.status(201).json({ success: true, data: newScout });
  } catch (err) {
    console.error('[scouts/POST /] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ─── GET /api/scouts/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM scouts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scout not found' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[scouts/GET /:id] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ─── PUT /api/scouts/:id ───────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const existingResult = await query(
      'SELECT * FROM scouts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id],
    );
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scout not found' });
    }

    const existing = existingResult.rows[0];
    const {
      name,
      keywords,
      min_price,
      max_price,
      marketplaces,
      active,
      notifications_enabled,
    } = req.body;

    // Fall back to existing values if not provided
    const updatedName = name != null ? name.trim() : existing.name;
    // JSONB columns come back as JS objects/arrays from pg
    const updatedKeywords = Array.isArray(keywords) ? JSON.stringify(keywords) : JSON.stringify(existing.keywords);
    const updatedMarketplaces = Array.isArray(marketplaces) ? JSON.stringify(marketplaces) : JSON.stringify(existing.marketplaces);
    const updatedMinPrice = min_price !== undefined ? (min_price != null ? Number(min_price) : null) : existing.min_price;
    const updatedMaxPrice = max_price !== undefined ? (max_price != null ? Number(max_price) : null) : existing.max_price;
    const updatedActive = active !== undefined ? Boolean(active) : existing.active;
    const updatedNotifications = notifications_enabled !== undefined ? Boolean(notifications_enabled) : existing.notifications_enabled;

    if (updatedName === '') {
      return res.status(400).json({ success: false, error: 'name cannot be empty' });
    }

    const updateResult = await query(
      `UPDATE scouts
       SET name = $1, keywords = $2, min_price = $3, max_price = $4,
           marketplaces = $5, active = $6, notifications_enabled = $7
       WHERE id = $8
       RETURNING *`,
      [
        updatedName,
        updatedKeywords,
        updatedMinPrice,
        updatedMaxPrice,
        updatedMarketplaces,
        updatedActive,
        updatedNotifications,
        req.params.id,
      ],
    );

    return res.json({ success: true, data: updateResult.rows[0] });
  } catch (err) {
    console.error('[scouts/PUT /:id] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ─── DELETE /api/scouts/:id ────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const existingResult = await query(
      'SELECT id FROM scouts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id],
    );
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scout not found' });
    }

    const scoutId = req.params.id;

    // Remove the repeating Bull job for this scout.
    // removeRepeatable(repeatOpts) matches the opts used in addScoutJob.
    try {
      const intervalMs = (parseInt(process.env.SEARCH_INTERVAL_MINUTES, 10) || 30) * 60 * 1000;
      await scoutQueue.removeRepeatable({ every: intervalMs, jobId: scoutId });
    } catch (queueErr) {
      console.warn(`[scouts/DELETE /:id] Could not remove queue job: ${queueErr.message}`);
    }

    // ON DELETE CASCADE handles listings removal in PostgreSQL
    await query('DELETE FROM scouts WHERE id = $1', [scoutId]);

    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('[scouts/DELETE /:id] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ─── POST /api/scouts/:id/run ─────────────────────────────────────────────────
router.post('/:id/run', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id FROM scouts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scout not found' });
    }

    const scoutId = req.params.id;

    // Count listings before enqueueing so we can report delta once job runs
    const countBefore = await query(
      'SELECT COUNT(*) AS cnt FROM listings WHERE scout_id = $1',
      [scoutId],
    );

    // Add a one-time job with a unique jobId so it doesn't collide with the repeating job
    await scoutQueue.add(
      { scoutId },
      { jobId: `manual-${scoutId}-${Date.now()}` },
    );

    const totalBefore = parseInt(countBefore.rows[0].cnt, 10);

    return res.json({
      success: true,
      data: {
        queued: true,
        total_listings_before: totalBefore,
      },
    });
  } catch (err) {
    console.error('[scouts/POST /:id/run] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Database error' });
  }
});

module.exports = router;
