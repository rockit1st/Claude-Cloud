'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { getDb } = require('../db');
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

  const db = getDb();

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    db.prepare(`
      INSERT INTO users (id, email, password_hash)
      VALUES (?, ?, ?)
    `).run(userId, email.toLowerCase().trim(), passwordHash);

    const user = { id: userId, email: email.toLowerCase().trim() };
    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      data: { token, user },
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

  const db = getDb();

  try {
    const row = db
      .prepare('SELECT id, email, password_hash, fcm_token, notifications_enabled, created_at FROM users WHERE email = ?')
      .get(email.toLowerCase().trim());

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
      notifications_enabled: row.notifications_enabled === 1,
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
router.put('/fcm-token', authenticate, (req, res) => {
  const { fcm_token } = req.body;

  if (!fcm_token || typeof fcm_token !== 'string') {
    return res.status(400).json({ success: false, error: 'fcm_token is required' });
  }

  const db = getDb();

  try {
    db.prepare('UPDATE users SET fcm_token = ? WHERE id = ?').run(fcm_token, req.user.id);
    return res.json({ success: true, data: { fcm_token } });
  } catch (err) {
    console.error('[auth/fcm-token] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update FCM token' });
  }
});

// ─── PUT /api/auth/notification-settings  (auth required) ─────────────────────
router.put('/notification-settings', authenticate, (req, res) => {
  const { notifications_enabled } = req.body;

  if (typeof notifications_enabled !== 'boolean') {
    return res.status(400).json({ success: false, error: 'notifications_enabled (boolean) is required' });
  }

  const db = getDb();

  try {
    db.prepare('UPDATE users SET notifications_enabled = ? WHERE id = ?')
      .run(notifications_enabled ? 1 : 0, req.user.id);

    return res.json({ success: true, data: { notifications_enabled } });
  } catch (err) {
    console.error('[auth/notification-settings] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update notification settings' });
  }
});

module.exports = router;
