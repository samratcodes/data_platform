import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const globalDatabase = globalThis as unknown as { filemarketDatabase?: DatabaseSync };

export function database() {
  if (!globalDatabase.filemarketDatabase) {
    const path = process.env.FILEMARKET_DB_PATH || join(process.cwd(), ".data", "filemarket.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    const db = new DatabaseSync(path);
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS access_requests (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), operator_slug TEXT NOT NULL,
        purpose TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, operator_slug)
      );
      CREATE TABLE IF NOT EXISTS saved_operators (
        user_id TEXT NOT NULL REFERENCES users(id), operator_slug TEXT NOT NULL,
        PRIMARY KEY(user_id, operator_slug)
      );
      CREATE TABLE IF NOT EXISTS auth_attempts (
        key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL
      );
    `);
    globalDatabase.filemarketDatabase = db;
  }
  return globalDatabase.filemarketDatabase;
}
