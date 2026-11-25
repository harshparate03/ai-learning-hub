import { randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { Store } from '../server/store.js';
import { accountKey } from '../server/auth.js';
dotenv.config({ path: '.env.production.local', quiet: true });
const base = process.argv[2];
if (!base || !base.startsWith('https://')) throw new Error('Pass the deployed HTTPS origin.');
const email = `qa-${randomBytes(8).toString('hex')}@example.invalid`;
const password = randomBytes(24).toString('hex');
const db = new Store();
const sessions = new Set();
let cookie = '';
async function request(route, body, { authenticated = true, origin = base } = {}) {
  const response = await fetch(base + route, {
    method: body ? 'POST' : 'GET',
    headers: { ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(authenticated && cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60000)
  });
  const next = response.headers.get('set-cookie')?.split(';')[0];
  if (next) {
    cookie = next;
    const token = next.split('=')[1];
    if (token) sessions.add('alh:session:' + createHash('sha256').update(token).digest('hex'));
    assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(response.headers.get('set-cookie'), /Secure/i);
  }
  const data = await response.json();
  return { response, data };
}
try {
  for (const route of ['/', '/login', '/signup', '/mindmap', '/youtube', '/summarizer/upload', '/summarizer/chat', '/history', '/vendor/pptxgen.bundle.js', '/pdf.worker.min.mjs']) {
    const response = await fetch(base + route, { signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, route);
    console.log('Route passed:', route);
  }
  assert.equal((await request('/api/groq', { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'hello' }] }, { authenticated: false })).response.status, 401);
  assert.equal((await request('/api/auth', { action: 'signup', email, password })).response.status, 201);
  assert.equal((await request('/api/auth')).data.email, email);
  assert.equal((await request('/api/auth', { action: 'reset-password', email, password, token: 'forged' })).response.status, 401);
  assert.equal((await request('/api/auth', { action: 'logout' }, { origin: 'https://other.example' })).response.status, 403);
  console.log('Authentication, secure cookie, forged reset and origin checks passed.');
  const ai = await request('/api/groq', { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'Reply with only the word ready.' }], max_tokens: 20 });
  assert.equal(ai.response.status, 200, 'AI HTTP ' + ai.response.status);
  assert.ok(ai.data.choices?.[0]?.message?.content);
  console.log('Live AI generation passed.');
  const youtube = await request('/api/youtube-search?q=angular%20tutorial&maxResults=1');
  assert.equal(youtube.response.status, 200, 'YouTube HTTP ' + youtube.response.status);
  assert.ok(youtube.data.items?.length);
  console.log('Live YouTube search passed.');
  const details = await request('/api/youtube-details?id=rfscVS0vtbw');
  assert.equal(details.response.status, 200);
  assert.ok(details.data.items?.length);
  console.log('Live video details passed.');
  await request('/api/auth', { action: 'logout' });
  assert.equal((await request('/api/auth')).data.email, '');
  assert.equal((await request('/api/auth', { action: 'login', email, password })).response.status, 200);
  assert.equal((await request('/api/auth', { action: 'change-password', email, currentPassword: password, password: password + 'new' })).response.status, 200);
  await request('/api/auth', { action: 'logout' });
  console.log('Live login, logout and password change passed.');
} finally {
  await db.del(accountKey(email));
  for (const key of sessions) await db.del(key);
  console.log('Temporary test account and sessions removed. No email was sent.');
}
