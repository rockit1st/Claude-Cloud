'use strict';

require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_change_in_production';

/**
 * Express middleware — verifies Bearer JWT and attaches req.user = { id, email }
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Generate a signed JWT for the given user object
 * @param {{ id: string, email: string }} user
 * @returns {string}
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { authenticate, generateToken };
