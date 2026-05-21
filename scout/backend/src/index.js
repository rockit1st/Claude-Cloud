'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { authenticate } = require('./auth');
const { startScheduler } = require('./scheduler');

const authRoutes = require('./routes/auth');
const scoutRoutes = require('./routes/scouts');
const listingRoutes = require('./routes/listings');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Global middleware ─────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Public routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ─── Protected routes (JWT required) ───────────────────────────────────────────
app.use('/api/scouts', authenticate, scoutRoutes);
app.use('/api/listings', authenticate, listingRoutes);

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] Scout backend listening on port ${PORT}`);
  startScheduler();
});

module.exports = app;
