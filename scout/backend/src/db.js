'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve('./scout.db');

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    fcm_token TEXT,
    notifications_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scouts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    keywords TEXT NOT NULL,
    min_price REAL,
    max_price REAL,
    marketplaces TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    notifications_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    scout_id TEXT NOT NULL REFERENCES scouts(id),
    marketplace TEXT NOT NULL,
    title TEXT NOT NULL,
    price REAL,
    url TEXT NOT NULL,
    image_url TEXT,
    description TEXT,
    seller TEXT,
    found_at TEXT DEFAULT (datetime('now')),
    UNIQUE(scout_id, url)
  );
`);

function getDb() {
  return db;
}

module.exports = { db, getDb };
