import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// Single-file SQLite, matching the KFastTrack pattern: one process, one file, no server to run.
// This demo is single-business (per the brief), so most tables have no tenant/business_id key.

function dbPath(): string {
  return process.env.KS_DB_PATH?.trim() || path.join(process.cwd(), "data", "app.db");
}

// Cached per resolved path on globalThis so next dev's HMR doesn't reopen the file.
type DbPool = Map<string, DatabaseSync>;
const globalForDb = globalThis as unknown as { __ksDbPool?: DbPool };
const pool: DbPool = globalForDb.__ksDbPool ?? (globalForDb.__ksDbPool = new Map());

export function getDb(): DatabaseSync {
  const p = dbPath();
  const cached = pool.get(p);
  if (cached) return cached;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const db = new DatabaseSync(p);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  pool.set(p, db);
  return db;
}

function migrate(d: DatabaseSync): void {
  d.exec(`
CREATE TABLE IF NOT EXISTS business_config (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  name                TEXT NOT NULL,
  logo_url            TEXT,
  points_per_dollar    REAL NOT NULL DEFAULT 1,
  redemption_rules    TEXT NOT NULL DEFAULT '',
  allowed_emails_json TEXT NOT NULL DEFAULT '[]',
  mint_address        TEXT,
  mint_authority_json TEXT,
  updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name       TEXT NOT NULL,
  email              TEXT,
  wallet_pubkey      TEXT NOT NULL UNIQUE,
  wallet_secret_json TEXT NOT NULL,
  created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('award','redeem')),
  points        REAL NOT NULL,
  dollar_amount REAL,
  tx_signature  TEXT NOT NULL,
  merchant_note TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  email       TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_customer ON ledger(customer_id, created_at);
`);
}
