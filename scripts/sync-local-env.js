/**
 * Sync .env → src/environments/environment.ts for local ng serve.
 * Usage: node scripts/sync-local-env.js
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const outPath = path.join(__dirname, '../src/environments/environment.ts');

if (!fs.existsSync(envPath)) {
  console.error('[sync-local-env] Missing .env — copy from .env.example');
  process.exit(1);
}

const vars = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const i = trimmed.indexOf('=');
  if (i === -1) continue;
  vars[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
}

const groq = vars.GROQ_API_KEY || '';
const gemini = (vars.GEMINI_API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean);
const youtube = (vars.YOUTUBE_API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean);

const content = `/** Auto-generated from .env — run: node scripts/sync-local-env.js */
export const environment = {
  production: false,
  groqApiKey: ${JSON.stringify(groq)},
  geminiApiKeys: ${JSON.stringify(gemini)},
  youtubeApiKeys: ${JSON.stringify(youtube)},
};
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('[sync-local-env] Updated environment.ts from .env');
