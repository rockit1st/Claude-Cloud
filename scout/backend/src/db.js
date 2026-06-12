'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Thin wrapper around pool.query for convenience.
 * @param {string} text - SQL query string
 * @param {Array} [params] - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Create all tables if they don't exist.
 * Must be called once at application startup before serving requests.
 */
async function initDb() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      fcm_token TEXT,
      notifications_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      keywords JSONB NOT NULL,
      min_price NUMERIC,
      max_price NUMERIC,
      marketplaces JSONB NOT NULL,
      active BOOLEAN DEFAULT true,
      notifications_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS listings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scout_id UUID NOT NULL REFERENCES scouts(id) ON DELETE CASCADE,
      marketplace TEXT NOT NULL,
      title TEXT NOT NULL,
      price NUMERIC,
      url TEXT NOT NULL,
      image_url TEXT,
      description TEXT,
      seller TEXT,
      found_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(scout_id, url)
    )
  `);

  console.log('[db] Tables initialized');
}

module.exports = { pool, query, initDb };
