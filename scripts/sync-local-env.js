const fs   = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const outPath = path.join(__dirname, '../src/environments/environment.ts');

if (!fs.existsSync(envPath)) {
  console.error('[sync-local-env] .env file not found — copy from .env.example');
  process.exit(1);
}

const vars = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  vars[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const groq = vars['GROQ_API_KEY'] || '';
const youtube = vars['YOUTUBE_API_KEY'] || '';
if (!groq) console.warn('[sync-local-env] GROQ_API_KEY is empty — get one free at https://console.groq.com/keys');
if (!youtube) console.warn('[sync-local-env] YOUTUBE_API_KEY is empty — get one from https://console.cloud.google.com/apis/credentials');

fs.writeFileSync(outPath, `/** Auto-generated from .env — run: node scripts/sync-local-env.js */
export const environment = {
  production: false,
  groqApiKey: ${JSON.stringify(groq)},
  youtubeApiKey: ${JSON.stringify(youtube)},
};
`, 'utf8');

console.log(`[sync-local-env] ✓ environment.ts updated — groq: ${groq ? '✓ set' : '✗ empty'}, youtube: ${youtube ? '✓ set' : '✗ empty'}`);
