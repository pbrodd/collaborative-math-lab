import { env } from 'cloudflare:workers';
import type { Database } from './types';

export function runtimeDatabase(): Database {
  const db = (env as unknown as { DB: Database }).DB;
  if (!db) throw new Error('Workbook storage is temporarily unavailable.');
  return db;
}
