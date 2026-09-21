import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openSqlite } from '../db/sqlite.ts';
import { authSchema } from '../db/auth-schema.ts';
import {
  accountAction,
  accountState,
  currentUser,
  digest,
  hashPassword,
  verifyPassword,
} from '../lib/auth.ts';

const origin = 'https://math.example.test';
const setupToken = 'only-for-tests-setup-secret-at-least-32-characters';
const password = 'a long test passphrase 123';
function request(cookie = '', source: string | null = origin) {
  return new Request(`${origin}/api/account`, {
    method: 'POST',
    headers: {
      cookie,
      ...(source === null ? {} : { origin: source }),
    },
  });
}
const sessionCookie = (result: { cookies?: string[] }) =>
  result.cookies!.find((c) => c.startsWith('lab_session='))!.split(';')[0];
async function fixture() {
  const db = openSqlite(':memory:');
  await db.batch(authSchema.map((s) => db.prepare(s)));
  await db.batch([
    db.prepare('CREATE TABLE books (id TEXT PRIMARY KEY,owner TEXT NOT NULL)'),
    db.prepare(
      'CREATE TABLE members (id TEXT PRIMARY KEY,book_id TEXT,session_id TEXT,name TEXT,UNIQUE(book_id,session_id))',
    ),
  ]);
  process.env.AUTH_SETUP_TOKEN = setupToken;
  process.env.APP_ORIGIN = origin;
  const setup = await accountAction(db, request(), {
    action: 'setup',
    setupToken,
    username: 'Host',
    password,
    name: 'Host',
  });
  const host = request(sessionCookie(setup));
  return {
    db,
    setup,
    host,
    act: (input: Record<string, unknown>, req = host) => accountAction(db, req, input),
  };
}
test('passwords use salted scrypt, preserve spaces, and reject incorrect or malformed credentials', async () => {
  const first = await hashPassword(password),
    second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password + ' ', first), false);
  assert.equal(await verifyPassword(password, undefined), false);
});
test('first setup fails closed without a configured key and admits only one concurrent host', async () => {
  const db = openSqlite(':memory:');
  try {
    await db.batch(authSchema.map((sql) => db.prepare(sql)));
    process.env.APP_ORIGIN = origin;
    delete process.env.AUTH_SETUP_TOKEN;
    const input = { action: 'setup', username: 'host_one', password, setupToken };
    await assert.rejects(accountAction(db, request(), input), /configure the setup key/);
    process.env.AUTH_SETUP_TOKEN = setupToken;
    await assert.rejects(
      accountAction(db, request(), { ...input, setupToken: 'wrong' }),
      /invalid/,
    );
    const results = await Promise.allSettled(
      ['host_one', 'host_two'].map((username) =>
        accountAction(db, request(), { ...input, username }),
      ),
    );
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await db.prepare('SELECT * FROM auth_users').all()).results.length, 1);
  } finally {
    db.close();
  }
});
test('setup is protected and one-time; sessions persist across browsers and revoke on logout', async () => {
  const { db, setup, host, act } = await fixture();
  try {
    assert.match(setup.cookies![0], /HttpOnly; SameSite=Lax; Max-Age=1209600; Secure/);
    assert.equal((await accountState(db, host)).setupRequired, false);
    assert.equal((await currentUser(db, host))?.username, 'host');
    await assert.rejects(
      act({ action: 'setup', setupToken, username: 'other', password }, request()),
      /already complete/,
    );
    for (const badOrigin of [null, 'https://attacker.test'])
      await assert.rejects(
        act({ action: 'logout' }, request(sessionCookie(setup), badOrigin)),
        /this application/,
      );
    const login = await act({ action: 'login', username: 'HOST', password }, request());
    assert.notEqual(sessionCookie(login), sessionCookie(setup));
    assert.equal(
      (await currentUser(db, request(sessionCookie(login))))?.id,
      (await currentUser(db, host))?.id,
    );
    await act({ action: 'logout' });
    assert.equal(await currentUser(db, host), null);
    assert.ok(await currentUser(db, request(sessionCookie(login))));
    await db.prepare('UPDATE auth_sessions SET expires_at=0').run();
    assert.equal(await currentUser(db, request(sessionCookie(login))), null);
  } finally {
    db.close();
  }
});
test('invitations require a host, expire, revoke, and permit exactly one concurrent registration', async () => {
  const { db, act } = await fixture();
  try {
    await assert.rejects(act({ action: 'invite' }, request()), /Sign in/);
    const invite = (await act({ action: 'invite' })).data.invite;
    await assert.rejects(
      act({ action: 'register', username: 'invalid', password, invite: 'wrong' }, request()),
      /invitation/,
    );
    await assert.rejects(
      act({ action: 'register', username: 'weak', password: 'short', invite }, request()),
      /15 and 128/,
    );
    const results = await Promise.allSettled(
      ['student_a', 'student_b'].map((username) =>
        act({ action: 'register', username, password, invite, role: 'admin' }, request()),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const created = results.find((r) => r.status === 'fulfilled')!;
    assert.equal(created.status, 'fulfilled');
    if (created.status !== 'fulfilled') throw new Error('Expected one registration');
    const student = request(sessionCookie(created.value));
    assert.equal((await currentUser(db, student))?.role, 'student');
    await assert.rejects(act({ action: 'invite' }, student), /Only the host/);
    await assert.rejects(
      act({ action: 'register', username: 'again', password, invite }, request()),
      /invitation/,
    );
    const expired = (await act({ action: 'invite' })).data.invite;
    await db.prepare('UPDATE auth_invites SET expires_at=0 WHERE used_by IS NULL').run();
    await assert.rejects(
      act({ action: 'register', username: 'expired', password, invite: expired }, request()),
      /invitation/,
    );
    const revoked = (await act({ action: 'invite' })).data.invite as string;
    await act({ action: 'revoke-invite', id: digest(revoked.replaceAll('-', '')) });
    await assert.rejects(
      act({ action: 'register', username: 'revoked', password, invite: revoked }, request()),
      /invitation/,
    );
  } finally {
    db.close();
  }
});
test('recovery is single-use, changes the password, and revokes all sessions including stale credential versions', async () => {
  const { db, setup, host, act } = await fixture();
  try {
    const nextPassword = 'a completely different passphrase';
    const input = {
      action: 'recover',
      username: 'host',
      recoveryCode: setup.data.recoveryCode,
      newPassword: nextPassword,
    };
    await assert.rejects(act({ ...input, recoveryCode: 'wrong' }, request()), /incorrect/);
    const recovered = await act(input, request());
    assert.notEqual(recovered.data.recoveryCode, setup.data.recoveryCode);
    assert.equal(await currentUser(db, host), null);
    await assert.rejects(act(input, request()), /incorrect/);
    await assert.rejects(
      act({ action: 'login', username: 'host', password }, request()),
      /Incorrect/,
    );
    const login = await act(
      { action: 'login', username: 'host', password: nextPassword },
      request(),
    );
    const current = request(sessionCookie(login));
    assert.ok(await currentUser(db, current));
    const staleToken = 'a'.repeat(64);
    const user = await currentUser(db, current);
    await db
      .prepare('INSERT INTO auth_sessions VALUES (?,?,0,?)')
      .bind(digest(staleToken), user!.id, Date.now() + 99999)
      .run();
    assert.equal(await currentUser(db, request(`lab_session=${staleToken}`)), null);
    await assert.rejects(
      act({ action: 'password', password: 'wrong', newPassword: password }, current),
      /incorrect/,
    );
    await act({ action: 'password', password: nextPassword, newPassword: password }, current);
    assert.equal(await currentUser(db, current), null);
  } finally {
    db.close();
  }
});
test('registration claims legacy ownership and memberships only for the original browser', async () => {
  const { db, act } = await fixture();
  try {
    const legacy = 'b'.repeat(64),
      other = 'c'.repeat(64);
    await db.batch([
      db.prepare('INSERT INTO books VALUES (?,?)').bind('old', digest(legacy)),
      db.prepare('INSERT INTO books VALUES (?,?)').bind('other', digest(other)),
      db
        .prepare('INSERT INTO members VALUES (?,?,?,?)')
        .bind('old-member', 'old', digest(legacy), 'Original'),
    ]);
    const invite = (await act({ action: 'invite' })).data.invite;
    const result = await act(
      { action: 'register', username: 'student', password, invite },
      request(`discovery_session=${legacy}`),
    );
    const user = await currentUser(db, request(sessionCookie(result)));
    assert.equal(
      (await db.prepare('SELECT owner FROM books WHERE id=?').bind('old').first())!.owner,
      user!.id,
    );
    assert.equal(
      (await db.prepare('SELECT session_id FROM members WHERE id=?').bind('old-member').first())!
        .session_id,
      user!.id,
    );
    assert.equal(
      (await db.prepare('SELECT owner FROM books WHERE id=?').bind('other').first())!.owner,
      digest(other),
    );
    assert.equal(await currentUser(db, request(`discovery_session=${legacy}`)), null);
    assert.equal(
      (await db.prepare('SELECT password_hash FROM auth_users WHERE id=?').bind(user!.id).first())!
        .password_hash === password,
      false,
    );
  } finally {
    db.close();
  }
});
test('persistent throttling rejects repeated attempts without trusting forwarded client headers', async () => {
  const { db, act } = await fixture();
  try {
    await db
      .prepare('INSERT INTO auth_limits VALUES (?,20,?)')
      .bind(`login:${digest('host')}`, Date.now())
      .run();
    await assert.rejects(
      act({ action: 'login', username: 'host', password }, request()),
      /Too many/,
    );
  } finally {
    db.close();
  }
});
test('the host recovery command rotates the code and invalidates existing sessions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mathlab-recovery-'));
  const path = join(directory, 'test.sqlite');
  const db = openSqlite(path);
  try {
    await db.batch(authSchema.map((sql) => db.prepare(sql)));
    await db
      .prepare(
        'INSERT INTO auth_users (id,username,name,password_hash,recovery_hash,role,created_at) VALUES (?,?,?,?,?,?,?)',
      )
      .bind(
        'student-id',
        'student',
        'Student',
        await hashPassword(password),
        digest('old'),
        'student',
        Date.now(),
      )
      .run();
    const old = 'f'.repeat(64);
    await db
      .prepare('INSERT INTO auth_sessions VALUES (?,?,0,?)')
      .bind(digest(old), 'student-id', Date.now() + 99999)
      .run();
    const environment: NodeJS.ProcessEnv = { ...process.env, DATABASE_PATH: path };
    // The CLI is a plain subprocess, not another Node test-runner child.
    delete environment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['scripts/account-recovery.mjs', 'student'], {
      env: environment,
      encoding: 'utf8',
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const recoveryCode = result.stdout.match(/[a-f0-9]{8}(?:-[a-f0-9]{8}){4}/)?.[0];
    assert.ok(recoveryCode, 'The recovery command must print a one-use code.');
    assert.equal(await currentUser(db, request(`lab_session=${old}`)), null);
    await accountAction(db, request(), {
      action: 'recover',
      username: 'student',
      recoveryCode,
      newPassword: password,
    });
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
