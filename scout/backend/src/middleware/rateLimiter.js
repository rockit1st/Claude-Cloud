'use strict';

const rateLimit = require('express-rate-limit');
const { query } = require('../db');

/**
 * General API rate limiter: 100 requests per 15 minutes per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});

/**
 * Per-user scout creation limiter.
 * Enforces MAX_SCOUTS_FREE env var by counting the user's existing scouts.
 * Must be used after the authenticate middleware (req.user must be set).
 */
async function scoutCreateLimiter(req, res, next) {
  const maxScouts = parseInt(process.env.MAX_SCOUTS_FREE, 10) || 10;

  try {
    const { rows } = await query(
      'SELECT COUNT(*) AS cnt FROM scouts WHERE user_id = $1',
      [req.user.id],
    );
    const currentCount = parseInt(rows[0].cnt, 10);

    if (currentCount >= maxScouts) {
      return res.status(429).json({
        success: false,
        error: `Scout limit reached (max ${maxScouts}). Delete an existing scout to create a new one.`,
      });
    }

    return next();
  } catch (err) {
    console.error('[rateLimiter/scoutCreateLimiter] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Database error' });
  }
}

module.exports = { apiLimiter, scoutCreateLimiter };
