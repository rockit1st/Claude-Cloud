'use strict';

const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse and clamp pagination params.
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ─── GET /api/listings ─────────────────────────────────────────────────────────
// Query params: page, limit, scout_id, marketplace
router.get('/', (req, res) => {
  const db = getDb();
  const { page, limit, offset } = parsePagination(req.query);
  const { scout_id, marketplace } = req.query;

  try {
    // Build query — listings that belong to this user's scouts
    let where = 'WHERE s.user_id = ?';
    const params = [req.user.id];

    if (scout_id) {
      where += ' AND l.scout_id = ?';
      params.push(scout_id);
    }
    if (marketplace) {
      where += ' AND l.marketplace = ?';
      params.push(marketplace);
    }

    const countRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM listings l
      JOIN scouts s ON s.id = l.scout_id
      ${where}
    `).get(...params);

    const rows = db.prepare(`
      SELECT l.*
      FROM listings l
      JOIN scouts s ON s.id = l.scout_id
      ${where}
      ORDER BY l.found_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return res.json({
      success: true,
      data: {
        listings: rows,
        pagination: {
          page,
          limit,
          total: countRow.total,
          pages: Math.ceil(countRow.total / limit),
        },
      },
    });
  } catch (err) {
    console.error('[listings/GET /] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch listings' });
  }
});

// ─── GET /api/listings/scout/:scoutId ─────────────────────────────────────────
router.get('/scout/:scoutId', (req, res) => {
  const db = getDb();
  const { page, limit, offset } = parsePagination(req.query);
  const { scoutId } = req.params;

  try {
    // Verify scout ownership
    const scout = db
      .prepare('SELECT id FROM scouts WHERE id = ? AND user_id = ?')
      .get(scoutId, req.user.id);

    if (!scout) {
      return res.status(404).json({ success: false, error: 'Scout not found' });
    }

    const countRow = db
      .prepare('SELECT COUNT(*) as total FROM listings WHERE scout_id = ?')
      .get(scoutId);

    const rows = db.prepare(`
      SELECT * FROM listings
      WHERE scout_id = ?
      ORDER BY found_at DESC
      LIMIT ? OFFSET ?
    `).all(scoutId, limit, offset);

    return res.json({
      success: true,
      data: {
        listings: rows,
        pagination: {
          page,
          limit,
          total: countRow.total,
          pages: Math.ceil(countRow.total / limit),
        },
      },
    });
  } catch (err) {
    console.error('[listings/GET /scout/:scoutId] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch listings' });
  }
});

// ─── DELETE /api/listings/:id ──────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const db = getDb();

  try {
    // Verify ownership through join
    const row = db.prepare(`
      SELECT l.id
      FROM listings l
      JOIN scouts s ON s.id = l.scout_id
      WHERE l.id = ? AND s.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!row) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    db.prepare('DELETE FROM listings WHERE id = ?').run(req.params.id);

    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('[listings/DELETE /:id] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete listing' });
  }
});

module.exports = router;
