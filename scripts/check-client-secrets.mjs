import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
const secrets = new Set();
for (const file of ['.env', '.env.production.local']) {
  try {
    const env = dotenv.parse(await readFile(file));
    for (const [key, value] of Object.entries(env)) if (/(?:KEY|TOKEN|PASSWORD)$/.test(key) && value.length > 16 && !/sensitive|redacted/i.test(value)) secrets.add(value);
  } catch {}
}
async function inspect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await inspect(file);
    else if (/\.(?:m?js|json|html)$/.test(file)) {
      const content = await readFile(file, 'utf8');
      for (const secret of secrets) if (content.includes(secret)) throw new Error('A configured secret was found in frontend output: ' + file);
    }
  }
}
await inspect('dist/ai-learning-hub/browser');
console.log('Frontend secret scan passed.');
