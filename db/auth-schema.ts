// Additive tables preserve existing workbooks and their browser memberships.
export const authSchema = [
  `CREATE TABLE IF NOT EXISTS auth_users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL,
    credential_version INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL CHECK (role IN ('admin','student')), created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id),
    credential_version INTEGER NOT NULL, expires_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS auth_session_user ON auth_sessions(user_id)',
  `CREATE TABLE IF NOT EXISTS auth_invites (
    token_hash TEXT PRIMARY KEY, created_by TEXT NOT NULL REFERENCES auth_users(id),
    label TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    used_by TEXT REFERENCES auth_users(id), revoked INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS auth_setup (
    id INTEGER PRIMARY KEY CHECK (id=1), user_id TEXT NOT NULL REFERENCES auth_users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS auth_limits (
    bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, started_at INTEGER NOT NULL
  )`,
];
