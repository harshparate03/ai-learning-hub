/**
 * Sync .env → src/environments/environment.ts for local ng serve.
 * Runs automatically via: npm start
 * Or manually: node scripts/sync-local-env.js
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const outPath = path.join(__dirname, '../src/environments/environment.ts');

if (!fs.existsSync(envPath)) {
  console.error('[sync-local-env] .env file not found — copy from .env and fill in your keys.');
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

const groq    = vars['GROQ_API_KEY']    || '';
const gemini  = (vars['GEMINI_API_KEYS']  || '').split(',').map(k => k.trim()).filter(Boolean);
const youtube = (vars['YOUTUBE_API_KEYS'] || '').split(',').map(k => k.trim()).filter(Boolean);

// Warn about missing keys but don't crash — app handles missing keys gracefully
if (!groq)           console.warn('[sync-local-env] GROQ_API_KEY is empty   → get one free at https://console.groq.com/keys');
if (!gemini.length)  console.warn('[sync-local-env] GEMINI_API_KEYS is empty → get one free at https://aistudio.google.com/app/apikey');
if (!youtube.length) console.warn('[sync-local-env] YOUTUBE_API_KEYS is empty → app will use AI fallback for video search (optional)');

const content = `/** Auto-generated from .env — run: node scripts/sync-local-env.js */
export const environment = {
  production: false,
  groqApiKey: ${JSON.stringify(groq)},
  geminiApiKeys: ${JSON.stringify(gemini.length ? gemini : [''])},
  youtubeApiKeys: ${JSON.stringify(youtube.length ? youtube : [''])},
};
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('[sync-local-env] ✓ environment.ts updated');
console.log(`  groq:    ${groq    ? '✓ set' : '✗ empty'}`);
console.log(`  gemini:  ${gemini.length  ? '✓ ' + gemini.length + ' key(s)' : '✗ empty'}`);
console.log(`  youtube: ${youtube.length ? '✓ ' + youtube.length + ' key(s)' : '✗ empty (using fallback)'}`);
