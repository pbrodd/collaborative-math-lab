import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Database, Statement } from '../db/types.ts';
import { ApiError } from './api-error.ts';
import { applicationOrigin } from './origin.ts';

const SESSION_SECONDS = 60 * 60 * 24 * 14;
const COOKIE = 'lab_session';
const SCRYPT = { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 };
type UserRow = {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'student';
  password_hash: string;
  recovery_hash: string;
  credential_version: number;
};
export type Account = Pick<UserRow, 'id' | 'username' | 'name' | 'role'>;
export type AccountState = {
  user: Account | null;
  setupRequired: boolean;
  setupAvailable: boolean;
};
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');
const publicUser = ({ id, username, name, role }: UserRow): Account => ({
  id,
  username,
  name,
  role,
});
const secretCode = () =>
  randomBytes(20)
    .toString('hex')
    .match(/.{1,8}/g)!
    .join('-');
const normalizeCode = (value: unknown) =>
  typeof value === 'string' ? value.replace(/[\s-]/g, '').toLowerCase() : '';
const codeHash = (value: unknown) => digest(normalizeCode(value));
function username(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_]{3,24}$/.test(value.trim()))
    throw new ApiError('Use 3–24 letters, numbers, or underscores for your username.');
  return value.trim().toLowerCase();
}
function password(value: unknown) {
  if (typeof value !== 'string' || value.length < 15 || value.length > 128)
    throw new ApiError('Use a password or passphrase between 15 and 128 characters.');
  return value;
}
function name(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 24) : fallback;
}
async function derive(value: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(value, salt, 32, SCRYPT, (error, key) => (error ? reject(error) : resolve(key)));
  });
}
export async function hashPassword(value: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:16384:8:5:${salt}:${(await derive(value, salt)).toString('hex')}`;
}
export async function verifyPassword(value: string, encoded?: string) {
  // Missing accounts still do the same expensive operation as existing accounts.
  const match = encoded?.match(/^scrypt:16384:8:5:([a-f0-9]{32}):([a-f0-9]{64})$/);
  const result = await derive(value, match?.[1] ?? '0'.repeat(32));
  return timingSafeEqual(result, Buffer.from(match?.[2] ?? '0'.repeat(64), 'hex')) && !!match;
}
function cookie(request: Request, value: string, seconds = SESSION_SECONDS) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${applicationOrigin(request.url).startsWith('https:') ? '; Secure' : ''}`;
}
function sessionToken(request: Request) {
  return request.headers.get('cookie')?.match(/(?:^|;\s*)lab_session=([a-f0-9]{64})(?:;|$)/)?.[1];
}
export async function currentUser(db: Database, request: Request): Promise<UserRow | null> {
  const value = sessionToken(request);
  if (!value) return null;
  return db
    .prepare(
      `SELECT u.* FROM auth_users u JOIN auth_sessions s ON s.user_id=u.id
    WHERE s.token_hash=? AND s.expires_at>? AND s.credential_version=u.credential_version`,
    )
    .bind(digest(value), Date.now())
    .first<UserRow>();
}
export async function requireUser(db: Database, request: Request) {
  const user = await currentUser(db, request);
  if (!user) throw new ApiError('Sign in to open your workbooks.', 401);
  return user;
}
export async function accountState(db: Database, request: Request): Promise<AccountState> {
  const [user, setup] = await Promise.all([
    currentUser(db, request),
    db.prepare('SELECT id FROM auth_setup WHERE id=1').first(),
  ]);
  return {
    user: user ? publicUser(user) : null,
    setupRequired: !setup,
    setupAvailable: !setup && (process.env.AUTH_SETUP_TOKEN?.length ?? 0) >= 32,
  };
}
async function throttle(db: Database, action: string, subject: string) {
  const now = Date.now();
  await db
    .prepare('DELETE FROM auth_limits WHERE started_at<?')
    .bind(now - 86400000)
    .run();
  for (const [key, window, max] of [
    ['all', 60000, 120],
    [`${action}:${digest(subject)}`, 900000, 20],
  ] as const) {
    const result = await db
      .prepare(
        `INSERT INTO auth_limits (bucket,attempts,started_at) VALUES (?,1,?)
      ON CONFLICT(bucket) DO UPDATE SET
        attempts=CASE WHEN started_at<=? THEN 1 ELSE attempts+1 END,
        started_at=CASE WHEN started_at<=? THEN excluded.started_at ELSE started_at END
      RETURNING attempts`,
      )
      .bind(key, now, now - window, now - window)
      .first<{ attempts: number }>();
    if ((result?.attempts ?? max + 1) > max)
      throw new ApiError('Too many attempts. Please wait a few minutes before trying again.', 429);
  }
}
function sessionStatement(db: Database, value: string, userId: string, hash: string) {
  // A concurrent password reset cannot issue a session against old credentials.
  return db
    .prepare(
      `INSERT INTO auth_sessions (token_hash,user_id,credential_version,expires_at)
    SELECT ?,id,credential_version,? FROM auth_users WHERE id=? AND password_hash=?`,
    )
    .bind(digest(value), Date.now() + SESSION_SECONDS * 1000, userId, hash);
}
function claimLegacy(db: Database, request: Request, userId: string): Statement[] {
  const legacy = request.headers
    .get('cookie')
    ?.match(/(?:^|;\s*)discovery_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!legacy) return [];
  // Only registration claims legacy memberships: this is a new account, so no
  // existing account memberships or private contributions can be overwritten.
  return [
    db.prepare('UPDATE books SET owner=? WHERE owner=?').bind(userId, digest(legacy)),
    db.prepare('UPDATE members SET session_id=? WHERE session_id=?').bind(userId, digest(legacy)),
  ];
}
type Result = { data: Record<string, unknown>; cookies?: string[]; status?: number };
export async function accountAction(
  db: Database,
  request: Request,
  input: Record<string, unknown>,
): Promise<Result> {
  const action = input.action;
  if (request.headers.get('origin') !== applicationOrigin(request.url))
    throw new ApiError('Make changes from this application.', 403);
  if (action === 'logout') {
    const value = sessionToken(request);
    if (value)
      await db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(digest(value)).run();
    return { data: { user: null }, cookies: [cookie(request, '', 0)] };
  }
  if (action === 'register' || action === 'setup') {
    const handle = username(input.username);
    const secret = password(input.password);
    await throttle(db, 'register', handle);
    const isSetup = action === 'setup';
    const invitation = codeHash(input.invite);
    if (isSetup) {
      const configured = process.env.AUTH_SETUP_TOKEN;
      if (!configured || configured.length < 32)
        throw new ApiError('The host must configure the setup key first.', 503);
      const supplied = typeof input.setupToken === 'string' ? input.setupToken.trim() : '';
      if (
        !timingSafeEqual(
          Buffer.from(digest(supplied), 'hex'),
          Buffer.from(digest(configured), 'hex'),
        ) ||
        (await db.prepare('SELECT id FROM auth_setup WHERE id=1').first())
      )
        throw new ApiError('The setup key is invalid or setup is already complete.', 403);
    } else if (
      !(await db
        .prepare(
          'SELECT token_hash FROM auth_invites WHERE token_hash=? AND expires_at>? AND used_by IS NULL AND revoked=0',
        )
        .bind(invitation, Date.now())
        .first())
    ) {
      throw new ApiError('This invitation is invalid, expired, or already used.', 403);
    }
    if (await db.prepare('SELECT id FROM auth_users WHERE username=?').bind(handle).first())
      throw new ApiError('That username is already taken.', 409);
    const id = crypto.randomUUID(),
      hash = await hashPassword(secret),
      recovery = secretCode(),
      value = token();
    const displayName = name(input.name, handle);
    const statements = [
      db
        .prepare(
          `INSERT INTO auth_users (id,username,name,password_hash,recovery_hash,role,created_at)
      SELECT ?,?,?,?,?,?,? ${isSetup ? '' : 'WHERE EXISTS (SELECT 1 FROM auth_invites WHERE token_hash=? AND expires_at>? AND used_by IS NULL AND revoked=0)'}`,
        )
        .bind(
          id,
          handle,
          displayName,
          hash,
          codeHash(recovery),
          isSetup ? 'admin' : 'student',
          Date.now(),
          ...(isSetup ? [] : [invitation, Date.now()]),
        ),
      isSetup
        ? db.prepare('INSERT INTO auth_setup (id,user_id) VALUES (1,?)').bind(id)
        : db
            .prepare(
              'UPDATE auth_invites SET used_by=? WHERE token_hash=? AND used_by IS NULL AND revoked=0',
            )
            .bind(id, invitation),
      // The foreign key also makes a lost invitation race roll back the batch.
      db
        .prepare(
          'INSERT INTO auth_sessions (token_hash,user_id,credential_version,expires_at) VALUES (?,?,0,?)',
        )
        .bind(digest(value), id, Date.now() + SESSION_SECONDS * 1000),
      ...claimLegacy(db, request, id),
    ];
    try {
      await db.batch(statements);
    } catch (error) {
      if (/UNIQUE|FOREIGN KEY|constraint/i.test(String(error)))
        throw new ApiError('The username or invitation was just used. Please try another.', 409);
      throw error;
    }
    return {
      status: 201,
      data: {
        user: { id, username: handle, name: displayName, role: isSetup ? 'admin' : 'student' },
        recoveryCode: recovery,
      },
      cookies: [
        cookie(request, value),
        `discovery_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${applicationOrigin(request.url).startsWith('https:') ? '; Secure' : ''}`,
      ],
    };
  }
  if (action === 'login') {
    const handle = username(input.username);
    const secret = typeof input.password === 'string' ? input.password : '';
    if (secret.length > 128) throw new ApiError('Incorrect username or password.', 401);
    await throttle(db, 'login', handle);
    const user = await db
      .prepare('SELECT * FROM auth_users WHERE username=?')
      .bind(handle)
      .first<UserRow>();
    if (!(await verifyPassword(secret, user?.password_hash)) || !user)
      throw new ApiError('Incorrect username or password.', 401);
    const value = token();
    await db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').bind(Date.now()).run();
    const result = await sessionStatement(db, value, user.id, user.password_hash).run();
    if (!result.meta.changes)
      throw new ApiError('Your password changed. Please sign in again.', 401);
    return { data: { user: publicUser(user) }, cookies: [cookie(request, value)] };
  }
  if (action === 'recover' || action === 'password') {
    const signedIn = action === 'password' ? await requireUser(db, request) : null;
    const handle = signedIn?.username ?? username(input.username);
    const secret = password(input.newPassword);
    await throttle(db, 'recover', handle);
    const user =
      signedIn ??
      (await db.prepare('SELECT * FROM auth_users WHERE username=?').bind(handle).first<UserRow>());
    if (signedIn) {
      const old =
        typeof input.password === 'string' && input.password.length <= 128 ? input.password : '';
      if (!(await verifyPassword(old, signedIn.password_hash)))
        throw new ApiError('Your current password is incorrect.', 401);
    } else if (
      !user ||
      !timingSafeEqual(
        Buffer.from(user.recovery_hash, 'hex'),
        Buffer.from(codeHash(input.recoveryCode), 'hex'),
      )
    ) {
      throw new ApiError('The username or recovery code is incorrect.', 401);
    }
    if (!user) throw new ApiError('The username or recovery code is incorrect.', 401);
    const hash = await hashPassword(secret),
      recovery = secretCode(),
      nextRecovery = codeHash(recovery);
    const result = await db.batch([
      db
        .prepare(
          `UPDATE auth_users SET password_hash=?,recovery_hash=?,credential_version=credential_version+1
        WHERE id=? AND password_hash=? AND recovery_hash=?`,
        )
        .bind(hash, nextRecovery, user.id, user.password_hash, user.recovery_hash),
      db
        .prepare(
          `DELETE FROM auth_sessions WHERE user_id=? AND EXISTS
        (SELECT 1 FROM auth_users WHERE id=? AND recovery_hash=?)`,
        )
        .bind(user.id, user.id, nextRecovery),
    ]);
    if (!result[0].meta.changes)
      throw new ApiError('Your credentials changed. Please try again.', 409);
    return { data: { user: null, recoveryCode: recovery }, cookies: [cookie(request, '', 0)] };
  }
  const user = await requireUser(db, request);
  if (action === 'profile') {
    const displayName = name(input.name, user.username);
    await db.batch([
      db.prepare('UPDATE auth_users SET name=? WHERE id=?').bind(displayName, user.id),
      db.prepare('UPDATE members SET name=? WHERE session_id=?').bind(displayName, user.id),
    ]);
    return { data: { user: { ...publicUser(user), name: displayName } } };
  }
  if (user.role !== 'admin') throw new ApiError('Only the host can manage invitations.', 403);
  if (action === 'invite') {
    await throttle(db, 'invite', user.id);
    const invite = secretCode(),
      expiresAt = Date.now() + 7 * 86400000;
    await db
      .prepare(
        'INSERT INTO auth_invites (token_hash,created_by,label,created_at,expires_at) VALUES (?,?,?,?,?)',
      )
      .bind(
        codeHash(invite),
        user.id,
        name(input.label, 'Student invitation'),
        Date.now(),
        expiresAt,
      )
      .run();
    return { status: 201, data: { invite, expiresAt } };
  }
  if (action === 'invites') {
    const invites = await db
      .prepare(
        'SELECT token_hash AS id,label,created_at,expires_at,used_by IS NOT NULL AS used,revoked FROM auth_invites ORDER BY created_at DESC LIMIT 100',
      )
      .all();
    return { data: { invites: invites.results } };
  }
  if (action === 'revoke-invite') {
    if (typeof input.id !== 'string') throw new ApiError('Choose an invitation.');
    await db
      .prepare('UPDATE auth_invites SET revoked=1 WHERE token_hash=? AND used_by IS NULL')
      .bind(input.id)
      .run();
    return { data: { revoked: true } };
  }
  throw new ApiError('Choose an account action.');
}
