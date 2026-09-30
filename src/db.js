'use strict';

// Neon PostgreSQL connection — single pool shared across the process.
// Uses NOVA_DATABASE_URL with fallback to AICHATT_DATABASE_URL.
// Schema is auto-created on first connect.

const { Pool } = require('pg');

let _pool = null;

function pool() {
  if (_pool) return _pool;
  const url = process.env.NOVA_DATABASE_URL || process.env.AICHATT_DATABASE_URL;
  if (!url) throw new Error('No database URL — set NOVA_DATABASE_URL in .env');
  _pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 5 });
  _pool.on('error', err => console.error('[DB] Pool error:', err.message));
  return _pool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS novai_calls (
  id                  SERIAL PRIMARY KEY,
  call_id             TEXT UNIQUE NOT NULL,
  phone_from          TEXT,
  phone_to            TEXT,
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ DEFAULT NOW(),
  duration_sec        INTEGER,
  turn_count          INTEGER,
  hangup_cause        TEXT,
  transcript          JSONB,
  stt_provider        TEXT,
  tts_provider        TEXT,
  llm_provider        TEXT,
  direction           TEXT DEFAULT 'incoming',
  variables           JSONB,
  summary             TEXT,
  structured_data     JSONB,
  success_evaluation  TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_novai_calls_created ON novai_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_novai_calls_phone   ON novai_calls(phone_from);
CREATE INDEX IF NOT EXISTS idx_novai_calls_hangup  ON novai_calls(hangup_cause);

-- Migrate existing tables (safe — IF NOT EXISTS patterns)
ALTER TABLE novai_calls ADD COLUMN IF NOT EXISTS direction          TEXT DEFAULT 'incoming';
ALTER TABLE novai_calls ADD COLUMN IF NOT EXISTS variables          JSONB;
ALTER TABLE novai_calls ADD COLUMN IF NOT EXISTS summary            TEXT;
ALTER TABLE novai_calls ADD COLUMN IF NOT EXISTS structured_data    JSONB;
ALTER TABLE novai_calls ADD COLUMN IF NOT EXISTS success_evaluation TEXT;
ALTER TABLE novai_calls ADD COLUMN IF NOT EXISTS sentiment_turns    JSONB;
ALTER TABLE novai_calls ADD COLUMN IF NOT EXISTS cost_usd           NUMERIC(8,4);
ALTER TABLE novai_calls ADD COLUMN IF NOT EXISTS recording_url      TEXT;
`;

async function initSchema() {
  try {
    await pool().query(SCHEMA);
    console.log('[DB] Schema ready');
  } catch (err) {
    console.error('[DB] Schema init failed:', err.message);
  }
}

async function query(sql, params) {
  return pool().query(sql, params);
}

module.exports = { pool, query, initSchema };
