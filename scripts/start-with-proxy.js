const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const root = path.join(__dirname, '..');
const isWin = process.platform === 'win32';

function run(name, cmd, args) {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[start-with-proxy] ${name} exited with code ${code}`);
      process.exit(code);
    }
  });
  return child;
}

require('./sync-local-env.js');

const proxy = run('api-proxy', 'node', ['--use-system-ca', 'api-proxy.js']);
const ng = run('ng', 'npx', ['ng', 'serve']);

function shutdown() {
  proxy.kill();
  ng.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
