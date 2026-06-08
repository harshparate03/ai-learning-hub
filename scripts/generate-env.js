const fs   = require('fs');
const path = require('path');
const dir  = path.join(__dirname, '../src/environments');

const groq = process.env['GROQ_API_KEY'] || '';

console.log('[generate-env] GROQ_API_KEY present:', !!groq);
console.log('[generate-env] GROQ_API_KEY length:', groq.length);
console.log('[generate-env] GROQ_API_KEY prefix:', groq.slice(0, 7));

if (!groq) {
  console.error('[generate-env] ERROR: GROQ_API_KEY env var is not set in Vercel!');
  console.error('[generate-env] Go to Vercel → Project → Settings → Environment Variables and add GROQ_API_KEY');
  process.exit(1); // fail the build so it's obvious
}

const content = (production) => `/**
 * Auto-generated at build time — do not edit manually.
 */
export const environment = {
  production: ${production},
  groqApiKey: ${JSON.stringify(groq)},
};
`;

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'environment.ts'),      content(false), 'utf8');
fs.writeFileSync(path.join(dir, 'environment.prod.ts'), content(true),  'utf8');

console.log('[generate-env] ✓ Wrote both environment files with groq key');
