import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { store } from './store.js';

const scrypt = promisify(scryptCallback);
const SESSION_SECONDS = 30 * 86400;
const digest = value => createHash('sha256').update(value).digest('hex');
export const accountKey = email => 'alh:user:' + digest(email);
export const normalizeEmail = email => typeof email === 'string' ? email.trim().toLowerCase() : '';
export const validEmail = email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export function validPassword(password) { return typeof password === 'string' && password.length >= 8 && password.length <= 128; }
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await scrypt(password, salt, 64)).toString('hex');
}
export async function matchesPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128 || typeof encoded !== 'string') return false;
  const [salt, hex] = encoded.split(':');
  if (!salt || !hex || hex.length !== 128) return false;
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(hex, 'hex'));
}
function cookie(req, name) {
  return String(req.headers?.cookie || '').split(';').map(p => p.trim()).find(p => p.startsWith(name + '='))?.slice(name.length + 1) || '';
}
function setCookie(req, res, token, age) {
  res.setHeader('Set-Cookie', `alh_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.VERCEL || req.headers?.['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
}
export async function sessionUser(req, db = store) {
  const token = cookie(req, 'alh_session');
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.get('alh:session:' + digest(token));
  if (!session) return null;
  const user = await db.get(accountKey(session.email));
  return user && user.version === session.version ? user : null;
}
export async function createSession(req, res, user, db = store) {
  const old = cookie(req, 'alh_session');
  if (old) await db.del('alh:session:' + digest(old));
  const token = randomBytes(32).toString('hex');
  await db.set('alh:session:' + digest(token), { email: user.email, version: user.version }, SESSION_SECONDS);
  setCookie(req, res, token, SESSION_SECONDS);
}
export async function logout(req, res, db = store) {
  const token = cookie(req, 'alh_session');
  if (token) await db.del('alh:session:' + digest(token));
  setCookie(req, res, '', 0);
}
export function checkOrigin(req) {
  const origin = req.headers?.origin;
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  let sameOrigin = true;
  try { sameOrigin = !origin || (!!host && new URL(origin).host === host); } catch { sameOrigin = false; }
  if (!sameOrigin) throw Object.assign(new Error('Request origin not allowed.'), { status: 403 });
}
export async function requireUser(req, res) {
  try {
    checkOrigin(req);
    const user = await sessionUser(req);
    if (!user) { res.status(401).json({ error: 'Please sign in to continue.' }); return null; }
    await store.limit('alh:api:' + digest(user.email), 60, 60);
    return user;
  } catch (error) { res.status(error.status || 503).json({ error: error.message }); return null; }
}
export function newOtp() { return String(randomInt(100000, 1000000)); }
export const otpKey = email => 'alh:otp:' + digest(email);
export const otpDigest = (email, otp) => digest(email + ':' + otp);
export const resetKey = token => 'alh:reset:' + digest(token);
