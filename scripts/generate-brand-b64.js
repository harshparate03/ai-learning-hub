const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/assets/brand-logo.jpeg');
const out = path.join(__dirname, '../src/app/core/services/brand-logo-b64.ts');
const b64 = fs.readFileSync(src).toString('base64');

fs.writeFileSync(
  out,
  `/** Auto-generated from src/assets/brand-logo.jpeg — run: node scripts/generate-brand-b64.js */\nexport const BRAND_LOGO_B64 = \`data:image/jpeg;base64,${b64}\`;\n`,
  'utf8'
);
console.log('[generate-brand-b64] OK');
