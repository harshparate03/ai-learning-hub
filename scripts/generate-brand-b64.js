const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const srcJpeg = path.join(root, 'src/assets/example files/bg_remove_logo.jpeg');
const pngPath = path.join(root, 'src/assets/brand-logo.png');
const out = path.join(root, 'src/app/core/services/brand-logo-b64.ts');
const psScript = path.join(__dirname, 'convert-logo-to-png.ps1');

if (!fs.existsSync(pngPath)) {
  execFileSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript, srcJpeg, pngPath],
    { stdio: 'inherit' }
  );
}

const pngBuf = fs.readFileSync(pngPath);
const b64 = pngBuf.toString('base64');

// Read PNG IHDR for dimensions (bytes 16–23).
const width = pngBuf.readUInt32BE(16);
const height = pngBuf.readUInt32BE(20);

fs.writeFileSync(
  out,
  `/** Auto-generated from bg_remove_logo.jpeg — run: node scripts/generate-brand-b64.js */
export const BRAND_LOGO_WIDTH = ${width};
export const BRAND_LOGO_HEIGHT = ${height};
export const BRAND_LOGO_FORMAT = 'PNG' as const;
export const BRAND_LOGO_B64 = \`data:image/png;base64,${b64}\`;
`,
  'utf8'
);

console.log(`[generate-brand-b64] OK (${width}x${height} PNG, transparent)`);
