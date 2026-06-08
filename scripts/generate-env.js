const fs   = require('fs');
const path = require('path');
const dir  = path.join(__dirname, '../src/environments');

const groq = process.env['GROQ_API_KEY'] || '';
if (!groq) console.warn('[generate-env] GROQ_API_KEY is empty');

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

console.log(`[generate-env] ✓ wrote environment.ts + environment.prod.ts — groq: ${groq ? '✓ set' : '✗ empty'}`);
