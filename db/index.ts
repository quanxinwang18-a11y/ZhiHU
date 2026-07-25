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
database.pragma("busy_timeout = 5000");
if (process.env.NODE_ENV !== "production") {
  globalForDatabase.qiuzhitaiDatabase = database;
}

export function ensureBusinessSchema() {
  database.exec(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "emailVerified" INTEGER NOT NULL,
      "image" TEXT,
      "createdAt" DATE NOT NULL,
      "updatedAt" DATE NOT NULL,
      "username" TEXT UNIQUE COLLATE NOCASE,
      "displayUsername" TEXT
    );
    CREATE TABLE IF NOT EXISTS "session" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "expiresAt" DATE NOT NULL,
      "token" TEXT NOT NULL UNIQUE,
      "createdAt" DATE NOT NULL,
      "updatedAt" DATE NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");
    CREATE TABLE IF NOT EXISTS "account" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" DATE,
      "refreshTokenExpiresAt" DATE,
      "scope" TEXT,
      "password" TEXT,
      "createdAt" DATE NOT NULL,
      "updatedAt" DATE NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
    CREATE TABLE IF NOT EXISTS "verification" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "identifier" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "expiresAt" DATE NOT NULL,
      "createdAt" DATE NOT NULL,
      "updatedAt" DATE NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "verification_identifier_idx"
      ON "verification" ("identifier");

    CREATE TABLE IF NOT EXISTS registration_codes (
      id TEXT PRIMARY KEY,
      username_normalized TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS registration_codes_username_idx
      ON registration_codes(username_normalized, created_at DESC);
    CREATE INDEX IF NOT EXISTS registration_codes_ip_idx
      ON registration_codes(ip_hash, created_at DESC);

    CREATE TABLE IF NOT EXISTS advice_packs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      question TEXT NOT NULL,
      problem_mirror TEXT,
      visual_spectrum TEXT NOT NULL DEFAULT 'obsidian'
        CHECK(visual_spectrum IN ('obsidian', 'lunar', 'ziwei', 'calamity', 'jade')),
      requested_card_count INTEGER NOT NULL CHECK(requested_card_count BETWEEN 1 AND 8),
      status TEXT NOT NULL CHECK(status IN ('generating', 'ready', 'empty')),
      selected_card_id TEXT,
      decision TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS advice_packs_user_idx
      ON advice_packs(user_id, updated_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS advice_packs_one_active_user_idx
      ON advice_packs(user_id) WHERE status = 'generating';

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      card_pack_id TEXT NOT NULL,
      advisor_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('generating', 'ready', 'failed')),
      initial_opinion TEXT,
      settled_order INTEGER,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY(card_pack_id) REFERENCES advice_packs(id) ON DELETE CASCADE,
      UNIQUE(card_pack_id, advisor_id),
      UNIQUE(card_pack_id, settled_order)
    );
    CREATE INDEX IF NOT EXISTS cards_pack_idx
      ON cards(card_pack_id, settled_order, started_at);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('generating', 'complete', 'stopped', 'failed')),
      created_at INTEGER NOT NULL,
      FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE,
      UNIQUE(card_id, sequence)
    );
    CREATE INDEX IF NOT EXISTS messages_card_idx
      ON messages(card_id, sequence);
  `);

  const packColumns = database
    .prepare("PRAGMA table_info(advice_packs)")
    .all() as { name: string }[];
  if (!packColumns.some((column) => column.name === "visual_spectrum")) {
    database.exec(`
      ALTER TABLE advice_packs
      ADD COLUMN visual_spectrum TEXT NOT NULL DEFAULT 'obsidian'
        CHECK(visual_spectrum IN ('obsidian', 'lunar', 'ziwei', 'calamity', 'jade'))
    `);
  }
}

ensureBusinessSchema();
