import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const databasePath =
  process.env.DATABASE_URL?.replace(/^file:/, "") ||
  path.join(dataDir, "qiuzhitai.db");

const globalForDatabase = globalThis as unknown as {
  qiuzhitaiDatabase?: Database.Database;
};

export const database =
  globalForDatabase.qiuzhitaiDatabase ?? new Database(databasePath);

database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
if (process.env.NODE_ENV !== "production") {
  globalForDatabase.qiuzhitaiDatabase = database;
}

export function ensureBusinessSchema() {
  database.exec(`
    CREATE TABLE IF NOT EXISTS registration_codes (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      ip TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS registration_codes_username_idx
      ON registration_codes(username, created_at);
    CREATE TABLE IF NOT EXISTS advice_packs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      question TEXT NOT NULL,
      advisor_ids TEXT NOT NULL,
      decision TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS advice_packs_user_idx
      ON advice_packs(user_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      pack_id TEXT NOT NULL,
      advisor_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(pack_id) REFERENCES advice_packs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS messages_pack_advisor_idx
      ON messages(pack_id, advisor_id, created_at);
  `);
}

ensureBusinessSchema();
