'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');

const { query } = require('../db');
const { generateToken, authenticate } = require('../auth');

const router = express.Router();

// ─── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Valid email is required' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const insertResult = await query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email`,
      [normalizedEmail, passwordHash],
    );

    const user = insertResult.rows[0];
    const token = generateToken({ id: user.id, email: user.email });

    return res.status(201).json({
      success: true,
      data: { token, user: { id: user.id, email: user.email } },
    });
  } catch (err) {
    console.error('[auth/register] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  try {
    const result = await query(
      'SELECT id, email, password_hash, fcm_token, notifications_enabled, created_at FROM users WHERE email = $1',
      [email.toLowerCase().trim()],
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, row.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = {
      id: row.id,
      email: row.email,
      fcm_token: row.fcm_token,
      notifications_enabled: row.notifications_enabled,
      created_at: row.created_at,
    };

    const token = generateToken({ id: user.id, email: user.email });

    return res.json({
      success: true,
      data: { token, user },
    });
  } catch (err) {
    console.error('[auth/login] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// ─── PUT /api/auth/fcm-token  (auth required) ─────────────────────────────────
router.put('/fcm-token', authenticate, async (req, res) => {
  const { fcm_token } = req.body;

  if (!fcm_token || typeof fcm_token !== 'string') {
    return res.status(400).json({ success: false, error: 'fcm_token is required' });
  }

  try {
    await query('UPDATE users SET fcm_token = $1 WHERE id = $2', [fcm_token, req.user.id]);
    return res.json({ success: true, data: { fcm_token } });
  } catch (err) {
    console.error('[auth/fcm-token] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update FCM token' });
  }
});

// ─── PUT /api/auth/notification-settings  (auth required) ─────────────────────
router.put('/notification-settings', authenticate, async (req, res) => {
  const { notifications_enabled } = req.body;

  if (typeof notifications_enabled !== 'boolean') {
    return res.status(400).json({ success: false, error: 'notifications_enabled (boolean) is required' });
  }

  try {
    await query(
      'UPDATE users SET notifications_enabled = $1 WHERE id = $2',
      [notifications_enabled, req.user.id],
    );
    return res.json({ success: true, data: { notifications_enabled } });
  } catch (err) {
    console.error('[auth/notification-settings] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update notification settings' });
  }
});

module.exports = router;
