import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const origin = process.env.TEST_PUBLIC_ORIGIN || base;
let host;
async function account(body, cookie = '') {
  const response = await fetch(`${base}/api/account`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  assert.ok(response.ok, data.error || 'Test account request failed');
  const setCookie = response.headers.getSetCookie().find((c) => c.startsWith('lab_session='));
  return { data, cookie: setCookie?.split(';')[0], setCookie };
}
async function testHost() {
  if (host) return host;
  const state = await (await fetch(`${base}/api/account`)).json();
  if (state.setupRequired && !process.env.TEST_SETUP_TOKEN)
    throw new Error(
      'Use a disposable test server and set TEST_SETUP_TOKEN to its AUTH_SETUP_TOKEN.',
    );
  host = await account({
    action: state.setupRequired ? 'setup' : 'login',
    setupToken: process.env.TEST_SETUP_TOKEN,
    username: process.env.TEST_ADMIN_USERNAME || 'test_host',
    password: process.env.TEST_ADMIN_PASSWORD || 'a temporary test host passphrase',
    name: 'Test host',
  });
  return host;
}
export async function createTestAccount() {
  const admin = await testHost();
  const invitation = await account({ action: 'invite', label: 'Automated test' }, admin.cookie);
  return account({
    action: 'register',
    username: `test_${randomBytes(6).toString('hex')}`,
    password: 'a temporary student passphrase',
    name: 'Test student',
    invite: invitation.data.invite,
  });
}
