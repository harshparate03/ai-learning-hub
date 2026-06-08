/**
 * Generates environment.prod.ts from Vercel / CI environment variables at build time.
 * Runs automatically via: npm run vercel-build
 *
 * Set in Vercel → Project → Settings → Environment Variables:
 *   GROQ_API_KEY
 *   GEMINI_API_KEYS   (comma-separated for key rotation)
 *   YOUTUBE_API_KEYS  (comma-separated, optional)
 */
const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '../src/environments/environment.prod.ts');

const groq    = process.env['GROQ_API_KEY']    || '';
const gemini  = (process.env['GEMINI_API_KEYS']  || '').split(',').map(k => k.trim()).filter(Boolean);
const youtube = (process.env['YOUTUBE_API_KEYS'] || '').split(',').map(k => k.trim()).filter(Boolean);

if (!groq)           console.warn('[generate-env] GROQ_API_KEY is empty');
if (!gemini.length)  console.warn('[generate-env] GEMINI_API_KEYS is empty');
if (!youtube.length) console.warn('[generate-env] YOUTUBE_API_KEYS is empty (using AI fallback)');

const content = `/**
 * Auto-generated at build time — do not edit manually.
 * Keys are injected from Vercel environment variables.
 */
export const environment = {
  production: true,
  groqApiKey: ${JSON.stringify(groq)},
  geminiApiKeys: ${JSON.stringify(gemini.length ? gemini : [''])},
  youtubeApiKeys: ${JSON.stringify(youtube.length ? youtube : [''])},
};
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('[generate-env] ✓ Wrote environment.prod.ts');
console.log(`  groq:    ${groq    ? '✓ set' : '✗ empty'}`);
console.log(`  gemini:  ${gemini.length  ? '✓ ' + gemini.length + ' key(s)' : '✗ empty'}`);
console.log(`  youtube: ${youtube.length ? '✓ ' + youtube.length + ' key(s)' : '✗ empty (using fallback)'}`);
