import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from './store.js';
import { createAuthHandler } from '../api/auth.js';
import { accountKey, otpKey, matchesPassword } from './auth.js';

async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'alh-auth-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const db = new Store({ AUTH_LOCAL_STORE: path.join(dir, 'accounts.json') });
  const deliveries = [];
  const handler = createAuthHandler(db, async (email, code) => deliveries.push({ email, code }));
  let cookie = '';
  const request = async (body, method = 'POST', overrideCookie) => {
    const req = { method, body, headers: { host: 'localhost:4200', origin: 'http://localhost:4200', cookie: overrideCookie ?? cookie }, socket: { remoteAddress: '127.0.0.1' } };
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handler(req, res);
    if (res.headers['Set-Cookie']) cookie = res.headers['Set-Cookie'].split(';')[0];
    return res;
  };
  return { db, deliveries, request, handler, get cookie() { return cookie; } };
}
const email = 'student@example.com';
const password = 'Learning123!';

test('signup uses salted hashes and HttpOnly sessions; flags cannot bypass authentication', async t => {
  const f = await fixture(t);
  const created = await f.request({ action: 'signup', email, password });
  assert.equal(created.code, 201);
  assert.match(created.headers['Set-Cookie'], /HttpOnly; SameSite=Lax/);
  const user = await f.db.get(accountKey(email));
  assert.notEqual(user.passwordHash, password);
  assert.equal(await matchesPassword(password, user.passwordHash), true);
  assert.equal((await f.request({}, 'GET')).data.email, email);
  assert.equal((await f.request({}, 'GET', 'alh_loggedIn=true')).data.email, '');
  await f.request({ action: 'logout' });
  assert.equal((await f.request({}, 'GET')).data.email, '');
  assert.equal((await f.request({ action: 'login', email, password: 'wrong' })).code, 401);
  assert.equal((await f.request({ action: 'login', email, password })).code, 200);
});

test('OTP and reset grants are generated server-side, expire and are single-use', async t => {
  const f = await fixture(t);
  await f.request({ action: 'signup', email, password });
  const oldSession = f.cookie;
  await f.request({ action: 'send-otp', email, otp: '111111' });
  assert.equal(f.deliveries.length, 1);
  assert.match(f.deliveries[0].code, /^\d{6}$/);
  assert.equal((await f.db.get(otpKey(email))).otp, undefined);
  assert.equal((await f.request({ action: 'verify-otp', email, otp: '000000' })).code, 400);
  const verified = await f.request({ action: 'verify-otp', email, otp: f.deliveries[0].code });
  assert.equal(verified.code, 200);
  assert.equal((await f.request({ action: 'verify-otp', email, otp: f.deliveries[0].code })).code, 400);
  assert.equal((await f.request({ action: 'reset-password', email, password: 'NewPassword1', token: 'forged' })).code, 401);
  assert.equal((await f.request({ action: 'reset-password', email, password: 'NewPassword1', token: verified.data.token })).code, 200);
  assert.equal((await f.request({}, 'GET', oldSession)).data.email, '');
  assert.equal((await f.request({ action: 'reset-password', email, password, token: verified.data.token })).code, 401);
});

test('failed resend preserves the usable code and does not claim delivery', async t => {
  const f = await fixture(t);
  await f.request({ action: 'signup', email, password });
  await f.request({ action: 'send-otp', email });
  const existing = await f.db.get(otpKey(email));
  await f.db.del('alh:otp:cooldown:' + accountKey(email));
  const handler = createAuthHandler(f.db, async () => { throw new Error('SMTP unavailable'); });
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await handler({ method: 'POST', body: { action: 'send-otp', email }, headers: {} }, res);
  assert.equal(res.code, 503);
  assert.deepEqual(await f.db.get(otpKey(email)), existing);
});

test('duplicate signup, password changes and cross-origin requests are enforced server-side', async t => {
  const f = await fixture(t);
  await f.request({ action: 'signup', email, password });
  assert.equal((await f.request({ action: 'signup', email, password })).code, 409);
  assert.equal((await f.request({ action: 'change-password', email, password: 'NewPassword1', currentPassword: 'wrong' })).code, 401);
  assert.equal((await f.request({ action: 'change-password', email, password: 'NewPassword1', currentPassword: password })).code, 200);
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await f.handler({ method: 'POST', headers: { host: 'example.com', origin: 'https://other.com' }, body: { action: 'logout' } }, res);
  assert.equal(res.code, 403);
});

test('production never silently uses temporary file storage', async () => {
  await assert.rejects(new Store({ VERCEL: '1' }).get('user'), /not configured/);
});

test('rate counters and expirations work in local development storage', async t => {
  const f = await fixture(t);
  await f.db.limit('test-rate', 1, 60);
  await assert.rejects(f.db.limit('test-rate', 1, 60), /Too many requests/);
  await f.db.set('expired', { value: true }, -1);
  assert.equal(await f.db.get('expired'), null);
});
