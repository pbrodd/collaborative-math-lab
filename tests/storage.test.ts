import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSqlite } from '../db/sqlite.ts';
import { applicationOrigin } from '../lib/origin.ts';

test('SQLite keeps workbook data across reopen and reports optimistic-write conflicts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mathlab-storage-'));
  const path = join(directory, 'lab.sqlite');
  let db = openSqlite(path);
  try {
    await db
      .prepare('CREATE TABLE sample (id TEXT PRIMARY KEY, revision INTEGER, value TEXT)')
      .run();
    const insert = db.prepare('INSERT INTO sample VALUES (?,0,?)');
    await insert.bind('a', 'first').run();
    await insert.bind('b', 'second').run();
    const update = db.prepare(
      'UPDATE sample SET revision=revision+1,value=? WHERE id=? AND revision=?',
    );
    assert.equal((await update.bind('saved', 'a', 0).run()).meta.changes, 1);
    assert.equal((await update.bind('stale', 'a', 0).run()).meta.changes, 0);
    db.close();
    db = openSqlite(path);
    assert.equal(
      (await db.prepare('SELECT value FROM sample WHERE id=?').bind('a').first<{ value: string }>())
        ?.value,
      'saved',
    );
    assert.equal(
      (await db.prepare('SELECT value FROM sample WHERE id=?').bind('b').first<{ value: string }>())
        ?.value,
      'second',
    );
    assert.equal(await db.prepare('SELECT * FROM sample WHERE id=?').bind('missing').first(), null);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('SQLite rolls back a failed batch and enforces room foreign keys', async () => {
  const db = openSqlite(':memory:');
  try {
    await db.batch([
      db.prepare('CREATE TABLE rooms (id TEXT PRIMARY KEY)'),
      db.prepare('CREATE TABLE members (id TEXT PRIMARY KEY, room TEXT REFERENCES rooms(id))'),
      db.prepare('CREATE INDEX member_room ON members(room)'),
    ]);
    await assert.rejects(
      db.batch([
        db.prepare('INSERT INTO rooms VALUES (?)').bind('room'),
        db.prepare('INSERT INTO members VALUES (?,?)').bind('member', 'missing'),
      ]),
    );
    assert.equal(await db.prepare('SELECT * FROM rooms').first(), null);
    await db.batch([
      db.prepare('INSERT INTO rooms VALUES (?)').bind('room'),
      db.prepare('INSERT INTO members VALUES (?,?)').bind('member', 'room'),
    ]);
    assert.equal((await db.prepare('SELECT * FROM members').all()).results.length, 1);
    assert.deepEqual(await db.batch([]), []);
    assert.throws(() => db.prepare('SELECT ?').bind(undefined));
  } finally {
    db.close();
  }
});

test('configured HTTPS origin is independent of the internal proxy URL', () => {
  assert.equal(
    applicationOrigin('http://app:3000/api/books', 'https://math.example.org'),
    'https://math.example.org',
  );
  assert.equal(applicationOrigin('https://example.org/api/books', ''), 'https://example.org');
  for (const value of [
    'https://user:pass@example.org',
    'https://example.org/path',
    'file:///tmp',
    'https://example.org/?x=1',
  ]) {
    assert.throws(() => applicationOrigin('http://localhost', value));
  }
});
