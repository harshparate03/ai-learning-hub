const path = require('path');
const { spawn } = require('child_process');

// NODE_EXTRA_CA_CERTS must be present before the proxy Node process starts.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const child = spawn(process.execPath, ['--use-system-ca', path.join(__dirname, '..', 'api-proxy.js')], {
  cwd: path.join(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 1));
