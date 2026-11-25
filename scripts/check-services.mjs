import dotenv from 'dotenv';
import { Store } from '../server/store.js';
dotenv.config({ path: process.argv[2] || '.env.production.local', quiet: true });
const db = new Store();
try {
  const key = 'alh:health:' + Date.now();
  await db.set(key, { ok: true }, 60);
  if (!(await db.get(key))?.ok) throw new Error('Read did not match write');
  await db.del(key);
  console.log('Database: read/write/delete passed');
} catch (error) { console.log('Database: FAILED (' + error.message + ')'); process.exitCode = 1; }
for (const [name, url, headers] of [
  ['Groq', 'https://api.groq.com/openai/v1/models', { Authorization: 'Bearer ' + process.env.GROQ_API_KEY }],
  ['YouTube', 'https://www.googleapis.com/youtube/v3/videos?' + new URLSearchParams({ id: 'rfscVS0vtbw', part: 'snippet', key: process.env.YOUTUBE_API_KEY || '' }), {}]
]) {
  if (name === 'YouTube' && /sensitive|redacted/i.test(process.env.YOUTUBE_API_KEY || '')) {
    console.log('YouTube: Vercel redacted this secret; verify on the deployed server.');
    continue;
  }
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    console.log(name + ': HTTP ' + response.status + (response.ok ? ' passed' : ' (' + (data.error?.message || 'service error') + ')'));
    if (!response.ok) process.exitCode = 1;
  } catch (error) { console.log(name + ': FAILED (' + error.message + ')'); process.exitCode = 1; }
}
console.log('Email: ' + (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? 'SMTP credentials configured (no email sent)' : 'SMTP credentials missing'));
