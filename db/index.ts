import { env } from 'cloudflare:workers';
export type SqlResult<T = Record<string, unknown>> = { results: T[]; meta: { changes: number } };
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<SqlResult<T>>;
  run(): Promise<SqlResult>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<SqlResult[]>;
}
let initialized: Promise<void> | undefined;
export async function getDatabase(): Promise<Database> {
  const db = (env as unknown as { DB: Database }).DB;
  if (!db) throw new Error('Workbook storage is temporarily unavailable.');
  if (!initialized)
    initialized = db
      .batch([
        db.prepare(
          'CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,title TEXT NOT NULL,creator TEXT NOT NULL,owner TEXT NOT NULL,source TEXT,document TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)',
        ),
        db.prepare(
          'CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY,book_id TEXT NOT NULL REFERENCES books(id),session_id TEXT NOT NULL,name TEXT NOT NULL,last_seen INTEGER NOT NULL)',
        ),
        db.prepare(
          'CREATE UNIQUE INDEX IF NOT EXISTS member_session ON members(book_id,session_id)',
        ),
        db.prepare(
          'CREATE TABLE IF NOT EXISTS contributions (book_id TEXT NOT NULL REFERENCES books(id),task_id TEXT NOT NULL,owner_id TEXT,work TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,book_revision INTEGER NOT NULL DEFAULT 0,published INTEGER NOT NULL DEFAULT 0,reviewer_id TEXT,updated_at INTEGER NOT NULL,PRIMARY KEY(book_id,task_id))',
        ),
        db.prepare(
          'CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY,book_id TEXT NOT NULL REFERENCES books(id),task_id TEXT NOT NULL,member_id TEXT NOT NULL,work_revision INTEGER NOT NULL,verdict TEXT NOT NULL,note TEXT NOT NULL,created_at INTEGER NOT NULL)',
        ),
      ])
      .then(() => {})
      .catch((e) => {
        initialized = undefined;
        throw e;
      });
  await initialized;
  return db;
}
