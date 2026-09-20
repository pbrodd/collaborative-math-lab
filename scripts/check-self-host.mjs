import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const origin = process.env.TEST_PUBLIC_ORIGIN || base;
const statePath = process.env.TEST_STATE_PATH;
if (!statePath) throw new Error('Set TEST_STATE_PATH to a temporary file outside the repository.');
const health = await fetch(`${base}/api/health`);
assert.equal(health.status, 200);
assert.equal((await health.json()).status, 'ok');
if (process.argv[2] === 'seed') {
  const page = await fetch(base);
  assert.equal(page.status, 200);
  const html = await page.text();
  const css = html.match(/href="([^"]+\.css(?:\?[^"]*)?)"/);
  assert.ok(css, 'HTML links a built stylesheet');
  const asset = await fetch(new URL(css[1], base));
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /text\/css/);
  const verification = await fetch(`${base}/verification`);
  assert.equal(verification.status, 200);
  assert.match(await verification.text(), /overkill/i);
  const rejected = await fetch(`${base}/api/books`, {
    method: 'POST',
    headers: { Origin: 'https://unrelated.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', kind: 'notebook' }),
  });
  assert.equal(rejected.status, 403, 'cross-origin writes are rejected');
  const response = await fetch(`${base}/api/books`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', kind: 'notebook', name: 'Persistence tester' }),
  });
  assert.equal(response.status, 201, await response.clone().text());
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.equal(setCookie.includes('; Secure'), origin.startsWith('https:'));
  const book = (await response.json()).book;
  const cookie = setCookie.split(';')[0];
  const document = {
    type: 'notebook',
    cells: [
      {
        id: 'saved',
        type: 'question',
        text: 'Survives replacement and backup restore.',
        expression: '3x=12',
      },
    ],
  };
  const update = await fetch(`${base}/api/books/${book.id}`, {
    method: 'PATCH',
    headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'document',
      document,
      title: 'Persistent test workbook',
      revision: 0,
    }),
  });
  assert.equal(update.status, 200, await update.clone().text());
  writeFileSync(statePath, JSON.stringify({ id: book.id, me: book.me, cookie, document }), {
    mode: 0o600,
  });
  console.log(
    '✓ Built pages/assets, storage health, proxy origin, cookie flags, and a saved workbook',
  );
} else if (process.argv[2] === 'verify') {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const response = await fetch(`${base}/api/books/${state.id}`, {
    headers: { Cookie: state.cookie },
  });
  assert.equal(response.status, 200);
  const book = (await response.json()).book;
  assert.deepEqual(book.document, state.document);
  assert.equal(book.me, state.me);
  assert.equal(book.isOwner, true);
  console.log('✓ Saved work and creator ownership survived');
} else throw new Error('Use seed or verify. Run only against a disposable test server.');
