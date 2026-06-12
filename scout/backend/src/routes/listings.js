'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse and clamp pagination params.
 */
function parsePagination(queryParams) {
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(queryParams.limit, 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ─── GET /api/listings ─────────────────────────────────────────────────────────
// Query params: page, limit, scout_id, marketplace
router.get('/', async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { scout_id, marketplace } = req.query;

  try {
    // Build dynamic WHERE clause with parameterised values
    const conditions = ['s.user_id = $1'];
    const params = [req.user.id];
    let paramIndex = 2;

    if (scout_id) {
      conditions.push(`l.scout_id = $${paramIndex++}`);
      params.push(scout_id);
    }
    if (marketplace) {
      conditions.push(`l.marketplace = $${paramIndex++}`);
      params.push(marketplace);
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM listings l
       JOIN scouts s ON s.id = l.scout_id
       ${whereClause}`,
      params,
    );

    const rowsResult = await query(
      `SELECT l.*
       FROM listings l
       JOIN scouts s ON s.id = l.scout_id
       ${whereClause}
       ORDER BY l.found_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    const total = parseInt(countResult.rows[0].total, 10);

    return res.json({
      success: true,
      data: {
        listings: rowsResult.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error('[listings/GET /] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ─── GET /api/listings/scout/:scoutId ─────────────────────────────────────────
router.get('/scout/:scoutId', async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { scoutId } = req.params;

  try {
    // Verify scout ownership
    const scoutResult = await query(
      'SELECT id FROM scouts WHERE id = $1 AND user_id = $2',
      [scoutId, req.user.id],
    );
    if (scoutResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scout not found' });
    }

    const countResult = await query(
      'SELECT COUNT(*) AS total FROM listings WHERE scout_id = $1',
      [scoutId],
    );

    const rowsResult = await query(
      `SELECT * FROM listings
       WHERE scout_id = $1
       ORDER BY found_at DESC
       LIMIT $2 OFFSET $3`,
      [scoutId, limit, offset],
    );

    const total = parseInt(countResult.rows[0].total, 10);

    return res.json({
      success: true,
      data: {
        listings: rowsResult.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error('[listings/GET /scout/:scoutId] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ─── DELETE /api/listings/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    // Verify ownership through join
    const ownerCheck = await query(
      `SELECT l.id
       FROM listings l
       JOIN scouts s ON s.id = l.scout_id
       WHERE l.id = $1 AND s.user_id = $2`,
      [req.params.id, req.user.id],
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    await query('DELETE FROM listings WHERE id = $1', [req.params.id]);

    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('[listings/DELETE /:id] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Database error' });
  }
});

module.exports = router;
