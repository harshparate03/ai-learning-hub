const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../src/environments');
fs.mkdirSync(dir, { recursive: true });
for (const production of [false, true]) {
  fs.writeFileSync(path.join(dir, production ? 'environment.prod.ts' : 'environment.ts'),
    `// Public configuration only. Secrets are read by the server.\nexport const environment = { production: ${production}, groqApiKey: '', groqApiKeyFallback: '', youtubeApiKey: '' };\n`);
}
console.log('Public environment files generated; API secrets remain server-side.');
