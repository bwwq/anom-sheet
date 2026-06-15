import { getD1 } from "./index";

let migrationPromise: Promise<void> | null = null;

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE INDEX IF NOT EXISTS users_role_idx ON users (role)",
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)",
  "CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at)",
  `CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    personnel_code TEXT NOT NULL,
    rank TEXT NOT NULL,
    status TEXT NOT NULL,
    photo_key TEXT,
    photo_content_type TEXT,
    photo_data TEXT,
    share_token TEXT UNIQUE,
    share_expires_at TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE INDEX IF NOT EXISTS cards_owner_id_idx ON cards (owner_id)",
  "ALTER TABLE cards ADD COLUMN photo_key TEXT",
  "ALTER TABLE cards ADD COLUMN photo_content_type TEXT",
  "ALTER TABLE cards ADD COLUMN photo_data TEXT",
  "ALTER TABLE cards ADD COLUMN share_token TEXT",
  "ALTER TABLE cards ADD COLUMN share_expires_at TEXT",
  "CREATE UNIQUE INDEX IF NOT EXISTS cards_share_token_unique ON cards (share_token)",
  "CREATE INDEX IF NOT EXISTS cards_share_token_idx ON cards (share_token)",
  "CREATE INDEX IF NOT EXISTS cards_updated_at_idx ON cards (updated_at)",
  `CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

export async function ensureDatabase() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const d1 = getD1();
      for (const statement of statements) {
        try {
          await d1.prepare(statement).run();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes("duplicate column name")) {
            throw error;
          }
        }
      }
    })();
  }

  await migrationPromise;
}
