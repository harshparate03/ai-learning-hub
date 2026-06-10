const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pngPath = path.join(root, 'src/assets/example files/project_logo.png');
const out = path.join(root, 'src/app/core/services/brand-logo-b64.ts');

if (!fs.existsSync(pngPath)) {
  console.error(`Error: File not found at ${pngPath}`);
  process.exit(1);
}

const pngBuf = fs.readFileSync(pngPath);
const b64 = pngBuf.toString('base64');

// Read PNG IHDR for dimensions (bytes 16–23).
const width = pngBuf.readUInt32BE(16);
const height = pngBuf.readUInt32BE(20);

fs.writeFileSync(
  out,
  `/** Auto-generated from project_logo.png — run: node scripts/generate-project-logo-b64.js */
export const BRAND_LOGO_WIDTH = ${width};
export const BRAND_LOGO_HEIGHT = ${height};
export const BRAND_LOGO_FORMAT = 'PNG' as const;
export const BRAND_LOGO_B64 = \`data:image/png;base64,${b64}\`;
`,
  'utf8'
);

console.log(`[generate-project-logo-b64] OK (${width}x${height} PNG)`);
