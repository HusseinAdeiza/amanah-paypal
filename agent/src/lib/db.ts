import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import { mkdirSync } from "fs";
import { logger } from "./logger.js";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;
  mkdirSync("./data", { recursive: true });
  db = await open({ filename: "./data/amanah.sqlite", driver: sqlite3.Database });
  await initSchema();
  return db;
}

export async function initSchema(): Promise<void> {
  const d = await getDb();
  await d.exec(`
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_ref TEXT, asset TEXT, amount TEXT, currency TEXT DEFAULT 'USD',
      usd_estimate REAL, paypal_order_id TEXT, tx_hash TEXT,
      receipt_cid TEXT, timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id TEXT, action TEXT, to_program TEXT,
      amount TEXT, usd_estimate REAL, reason TEXT, status TEXT DEFAULT 'pending',
      confirmed_by TEXT, confirmed_at TEXT, receipt_cid TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nonce TEXT, event_type TEXT, cid TEXT, hash TEXT,
      previous_hash TEXT, timestamp TEXT, payload TEXT
    );
    CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, budget_usd REAL, spent_usd REAL DEFAULT 0, status TEXT DEFAULT 'active'
    );
  `);
  logger.info("Database schema initialized");
}

export async function run(sql: string, params: unknown[] = []): Promise<{ lastID: number }> {
  const d = await getDb();
  const r = await d.run(sql, params as never);
  return { lastID: r.lastID ?? 0 };
}
export async function get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const d = await getDb();
  return (await d.get(sql, params as never)) as T | undefined;
}
export async function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const d = await getDb();
  return (await d.all(sql, params as never)) as T[];
}
