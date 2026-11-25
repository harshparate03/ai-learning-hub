import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Production uses shared durable Redis. Never fall back to ephemeral Vercel disk.
export class Store {
  constructor(env = process.env) { this.env = env; this.queue = Promise.resolve(); }
  async command(...args) {
    const url = this.env.KV_REST_API_URL || this.env.UPSTASH_REDIS_REST_URL;
    const token = this.env.KV_REST_API_TOKEN || this.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
      const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error('Account database unavailable.');
      return data.result;
    }
    if (this.env.VERCEL || this.env.NODE_ENV === 'production') {
      throw Object.assign(new Error('Account database is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.'), { status: 503 });
    }
    // Serialized, atomic local storage for development only.
    const operation = this.queue.then(async () => {
      const file = this.env.AUTH_LOCAL_STORE || path.resolve('.local/accounts.json');
      let db = {};
      try { db = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const [cmd, key, value, ...options] = args;
      const now = Date.now();
      for (const k of Object.keys(db)) if (db[k].expires && db[k].expires <= now) delete db[k];
      let result;
      if (cmd === 'GET') return db[key]?.value ?? null;
      if (cmd === 'GETDEL') { result = db[key]?.value ?? null; delete db[key]; }
      else if (cmd === 'DEL') { result = db[key] ? 1 : 0; delete db[key]; }
      else if (cmd === 'SET') {
        if (options.includes('NX') && db[key]) return null;
        const ex = options.indexOf('EX');
        db[key] = { value, expires: ex >= 0 ? now + Number(options[ex + 1]) * 1000 : 0 }; result = 'OK';
      } else if (cmd === 'EVAL') {
        // Fixed-window counter; equivalent to the atomic Redis script below.
        const counterKey = args[3], ttl = Number(args[4]);
        const entry = db[counterKey] || { value: 0, expires: now + ttl * 1000 };
        entry.value = Number(entry.value) + 1; db[counterKey] = entry; result = entry.value;
      } else throw new Error('Unsupported local store command.');
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file + '.tmp', JSON.stringify(db), { mode: 0o600 });
      await rename(file + '.tmp', file);
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async get(key) { const value = await this.command('GET', key); return value ? JSON.parse(value) : null; }
  async take(key) { const value = await this.command('GETDEL', key); return value ? JSON.parse(value) : null; }
  async set(key, value, ttl, nx = false) { return this.command('SET', key, JSON.stringify(value), ...(ttl ? ['EX', ttl] : []), ...(nx ? ['NX'] : [])); }
  async del(key) { return this.command('DEL', key); }
  async limit(key, max, seconds) {
    const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n";
    if (Number(await this.command('EVAL', script, 1, key, seconds)) > max) throw Object.assign(new Error('Too many requests. Please try again later.'), { status: 429 });
  }
}
export const store = new Store();
