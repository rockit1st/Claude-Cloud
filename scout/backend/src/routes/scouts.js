'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { getDb } = require('../db');
const { processScout } = require('../scheduler');

const router = express.Router();

/**
 * Parse JSON fields and cast integer booleans for a scout row.
 */
function parseScout(row) {
  return {
    ...row,
    keywords: JSON.parse(row.keywords),
    marketplaces: JSON.parse(row.marketplaces),
    active: row.active === 1,
    notifications_enabled: row.notifications_enabled === 1,
  };
}

// ─── GET /api/scouts ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT * FROM scouts WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    return res.json({ success: true, data: rows.map(parseScout) });
  } catch (err) {
    console.error('[scouts/GET /] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch scouts' });
  }
});

// ─── POST /api/scouts ──────────────────────────────────────────────────────────
router.post('/', (req, res) => {
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

  const validMarketplaces = ['ebay', 'reddit', 'chrono24', 'facebook'];
  const invalidMp = marketplaces.filter((m) => !validMarketplaces.includes(m));
  if (invalidMp.length > 0) {
    return res.status(400).json({ success: false, error: `Invalid marketplace(s): ${invalidMp.join(', ')}` });
  }

  const db = getDb();
  const scoutId = uuidv4();

  try {
    db.prepare(`
      INSERT INTO scouts (id, user_id, name, keywords, min_price, max_price, marketplaces, notifications_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      scoutId,
      req.user.id,
      name.trim(),
      JSON.stringify(keywords),
      min_price != null ? Number(min_price) : null,
      max_price != null ? Number(max_price) : null,
      JSON.stringify(marketplaces),
      notifications_enabled === false ? 0 : 1,
    );

    const row = db.prepare('SELECT * FROM scouts WHERE id = ?').get(scoutId);
    return res.status(201).json({ success: true, data: parseScout(row) });
  } catch (err) {
    console.error('[scouts/POST /] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create scout' });
  }
});

// ─── GET /api/scouts/:id ───────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM scouts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Scout not found' });
    }
    return res.json({ success: true, data: parseScout(row) });
  } catch (err) {
    console.error('[scouts/GET /:id] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch scout' });
  }
});

// ─── PUT /api/scouts/:id ───────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const db = getDb();

  const existing = db.prepare('SELECT * FROM scouts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Scout not found' });
  }

  const {
    name,
    keywords,
    min_price,
    max_price,
    marketplaces,
    active,
    notifications_enabled,
  } = req.body;

  // Build update values — fall back to existing if not provided
  const updatedName = name != null ? name.trim() : existing.name;
  const updatedKeywords = Array.isArray(keywords) ? JSON.stringify(keywords) : existing.keywords;
  const updatedMarketplaces = Array.isArray(marketplaces) ? JSON.stringify(marketplaces) : existing.marketplaces;
  const updatedMinPrice = min_price !== undefined ? (min_price != null ? Number(min_price) : null) : existing.min_price;
  const updatedMaxPrice = max_price !== undefined ? (max_price != null ? Number(max_price) : null) : existing.max_price;
  const updatedActive = active !== undefined ? (active ? 1 : 0) : existing.active;
  const updatedNotifications = notifications_enabled !== undefined
    ? (notifications_enabled ? 1 : 0)
    : existing.notifications_enabled;

  if (updatedName === '') {
    return res.status(400).json({ success: false, error: 'name cannot be empty' });
  }

  try {
    db.prepare(`
      UPDATE scouts
      SET name = ?, keywords = ?, min_price = ?, max_price = ?,
          marketplaces = ?, active = ?, notifications_enabled = ?
      WHERE id = ?
    `).run(
      updatedName,
      updatedKeywords,
      updatedMinPrice,
      updatedMaxPrice,
      updatedMarketplaces,
      updatedActive,
      updatedNotifications,
      req.params.id,
    );

    const row = db.prepare('SELECT * FROM scouts WHERE id = ?').get(req.params.id);
    return res.json({ success: true, data: parseScout(row) });
  } catch (err) {
    console.error('[scouts/PUT /:id] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update scout' });
  }
});

// ─── DELETE /api/scouts/:id ────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM scouts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Scout not found' });
  }

  try {
    // Delete dependent listings first (foreign key cascade would handle this,
    // but better-sqlite3 requires explicit delete when ON DELETE CASCADE is not set)
    db.prepare('DELETE FROM listings WHERE scout_id = ?').run(req.params.id);
    db.prepare('DELETE FROM scouts WHERE id = ?').run(req.params.id);

    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('[scouts/DELETE /:id] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete scout' });
  }
});

// ─── POST /api/scouts/:id/run ─────────────────────────────────────────────────
router.post('/:id/run', async (req, res) => {
  const db = getDb();

  const row = db.prepare('SELECT * FROM scouts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) {
    return res.status(404).json({ success: false, error: 'Scout not found' });
  }

  // Count listings before run so we can report new ones
  const countBefore = db
    .prepare('SELECT COUNT(*) as cnt FROM listings WHERE scout_id = ?')
    .get(req.params.id).cnt;

  try {
    await processScout(row);

    const countAfter = db
      .prepare('SELECT COUNT(*) as cnt FROM listings WHERE scout_id = ?')
      .get(req.params.id).cnt;

    return res.json({
      success: true,
      data: {
        new_listings: countAfter - countBefore,
        total_listings: countAfter,
      },
    });
  } catch (err) {
    console.error('[scouts/POST /:id/run] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Scout run failed' });
  }
});

module.exports = router;
