import { DatabaseSync, backup } from 'node:sqlite';
import { resolve } from 'node:path';

const source = process.env.DATABASE_PATH || './data/math-lab.sqlite';
const destination = process.argv[2];
if (!destination || resolve(source) === resolve(destination)) {
  throw new Error('Supply a different destination: node scripts/backup.mjs /data/backup.sqlite');
}
const database = new DatabaseSync(source, { readOnly: true });
try {
  await backup(database, destination);
  console.log(`Saved a consistent SQLite backup to ${destination}`);
} finally {
  database.close();
}
