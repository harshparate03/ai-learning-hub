const fs   = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '../src/environments/environment.prod.ts');
const groq    = process.env['GROQ_API_KEY'] || '';

if (!groq) console.warn('[generate-env] GROQ_API_KEY is empty');

fs.writeFileSync(outPath, `/**
 * Auto-generated at build time — do not edit manually.
 */
export const environment = {
  production: true,
  groqApiKey: ${JSON.stringify(groq)},
};
`, 'utf8');

console.log(`[generate-env] ✓ groq: ${groq ? '✓ set' : '✗ empty'}`);
