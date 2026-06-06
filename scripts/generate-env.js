/**
 * Generates environment.prod.ts from Vercel / CI environment variables at build time.
 *
 * Set in Vercel → Project → Settings → Environment Variables:
 *   GROQ_API_KEY
 *   GEMINI_API_KEYS   (comma-separated)
 *   YOUTUBE_API_KEYS  (comma-separated)
 */
const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '../src/environments/environment.prod.ts');

const groqApiKey = process.env.GROQ_API_KEY || '';
const geminiApiKeys = (process.env.GEMINI_API_KEYS || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);
const youtubeApiKeys = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

const content = `/**
 * Auto-generated at build time — do not edit manually.
 * Keys are injected from Vercel environment variables.
 */
export const environment = {
  production: true,
  groqApiKey: ${JSON.stringify(groqApiKey)},
  geminiApiKeys: ${JSON.stringify(geminiApiKeys)},
  youtubeApiKeys: ${JSON.stringify(youtubeApiKeys)},
};
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('[generate-env] Wrote environment.prod.ts');
console.log(`  groq: ${groqApiKey ? 'set' : 'missing'}`);
console.log(`  gemini keys: ${geminiApiKeys.length}`);
console.log(`  youtube keys: ${youtubeApiKeys.length}`);
