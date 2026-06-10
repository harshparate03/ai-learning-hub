/**
 * generate-env.js
 * Runs at Vercel build time to inject API keys from environment variables
 * into Angular's environment.ts files.
 *
 * Set these in Vercel → Project → Settings → Environment Variables:
 *   GROQ_API_KEY      — from https://console.groq.com/keys
 *   YOUTUBE_API_KEY   — from https://console.cloud.google.com/apis/credentials
 */
const fs   = require('fs');
const path = require('path');
const dir  = path.join(__dirname, '../src/environments');

const groq    = process.env['GROQ_API_KEY']    || '';
const youtube = process.env['YOUTUBE_API_KEY'] || '';

console.log('[generate-env] GROQ_API_KEY    :', groq    ? '✓ set' : '✗ not set — AI features will be limited');
console.log('[generate-env] YOUTUBE_API_KEY :', youtube ? '✓ set' : '✗ not set — YouTube will use curated fallback');

// Never fail the build — warn only
if (!groq) {
  console.warn('[generate-env] WARNING: GROQ_API_KEY is missing.');
  console.warn('[generate-env] Add it in Vercel → Project → Settings → Environment Variables');
}

const content = (production) => `/**
 * Auto-generated at build time by scripts/generate-env.js
 * DO NOT edit manually or commit real keys here.
 */
export const environment = {
  production: ${production},
  groqApiKey: ${JSON.stringify(groq)},
  youtubeApiKey: ${JSON.stringify(youtube)},
};
`;

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'environment.ts'),      content(false), 'utf8');
fs.writeFileSync(path.join(dir, 'environment.prod.ts'), content(true),  'utf8');

console.log('[generate-env] ✓ environment files written successfully');
