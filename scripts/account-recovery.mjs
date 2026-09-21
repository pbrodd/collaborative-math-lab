import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';

const username = process.argv[2]?.trim().toLowerCase();
if (!username || !/^[a-z0-9_]{3,24}$/.test(username))
  throw new Error('Usage: node scripts/account-recovery.mjs username');
const db = new DatabaseSync(process.env.DATABASE_PATH || './data/math-lab.sqlite');
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
try {
  const user = db.prepare('SELECT id FROM auth_users WHERE username=?').get(username);
  if (!user) throw new Error('Account not found. Check the username and database path.');
  const raw = randomBytes(20).toString('hex');
  const hash = createHash('sha256').update(raw).digest('hex');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      'UPDATE auth_users SET recovery_hash=?,credential_version=credential_version+1 WHERE id=?',
    ).run(hash, user.id);
    db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(user.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  console.log(`New one-use recovery code for ${username}: ${raw.match(/.{1,8}/g).join('-')}`);
  console.log('All sessions were revoked. Share this code privately with the account owner.');
} finally {
  db.close();
}
