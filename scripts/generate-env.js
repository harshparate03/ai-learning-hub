/**
 * generate-env.js
 * Runs at Vercel build time to inject API keys from environment variables.
 * Set in Vercel → Project → Settings → Environment Variables:
 *   GROQ_API_KEY         — primary key (https://console.groq.com/keys)
 *   GROQ_API_KEY_FALLBACK — optional second key for failover
 *   YOUTUBE_API_KEY       — (https://console.cloud.google.com/apis/credentials)
 */
const fs   = require('fs');
const path = require('path');
const dir  = path.join(__dirname, '../src/environments');

const groq         = process.env['GROQ_API_KEY']          || '';
const groqFallback = process.env['GROQ_API_KEY_FALLBACK']  || '';
const youtube      = process.env['YOUTUBE_API_KEY']        || '';

console.log('[generate-env] GROQ_API_KEY         :', groq         ? '✓ set' : '✗ not set');
console.log('[generate-env] GROQ_API_KEY_FALLBACK :', groqFallback ? '✓ set' : '✗ not set (optional)');
console.log('[generate-env] YOUTUBE_API_KEY       :', youtube      ? '✓ set' : '✗ not set — YouTube search uses curated fallback');

if (!groq) {
  console.warn('[generate-env] WARNING: GROQ_API_KEY missing — AI features will not work on Vercel.');
  console.warn('[generate-env] Add it: Vercel → Project → Settings → Environment Variables → GROQ_API_KEY');
}

const content = (production) => `/**
 * Auto-generated at build time by scripts/generate-env.js
 * DO NOT edit manually or commit real keys here.
 */
export const environment = {
  production: ${production},
  groqApiKey: ${JSON.stringify(groq)},
  groqApiKeyFallback: ${JSON.stringify(groqFallback)},
  youtubeApiKey: ${JSON.stringify(youtube)},
};
`;

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'environment.ts'),      content(false), 'utf8');
fs.writeFileSync(path.join(dir, 'environment.prod.ts'), content(true),  'utf8');
console.log('[generate-env] ✓ environment files written');
