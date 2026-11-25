import { randomBytes } from 'node:crypto';
import { store } from '../server/store.js';
import { sendOtpEmail } from '../server/email.js';
import { accountKey, normalizeEmail, validEmail, validPassword, hashPassword, matchesPassword, sessionUser, createSession, logout, checkOrigin, newOtp, otpKey, otpDigest, resetKey } from '../server/auth.js';

export function createAuthHandler(db = store, sendEmail = sendOtpEmail) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      checkOrigin(req);
      if (req.method === 'GET') {
        const user = await sessionUser(req, db);
        return res.status(200).json({ email: user?.email || '' });
      }
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { action, password, currentPassword, otp, token } = req.body || {};
      if (action === 'logout') { await logout(req, res, db); return res.status(200).json({ success: true }); }
      const email = normalizeEmail(req.body?.email);
      if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
      // Both per-account and per-IP limits are shared across serverless instances.
      const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      await db.limit('alh:auth:ip:' + ip, 50, 900);
      await db.limit('alh:auth:' + action + ':' + accountKey(email), action === 'send-otp' ? 5 : 15, 900);
      let user = await db.get(accountKey(email));
      if (action === 'signup') {
        if (!validPassword(password)) return res.status(400).json({ error: 'Password must contain 8 to 128 characters.' });
        user = { email, passwordHash: await hashPassword(password), version: randomBytes(16).toString('hex') };
        if (!await db.set(accountKey(email), user, 0, true)) return res.status(409).json({ error: 'Email already registered. Please sign in.' });
        await createSession(req, res, user, db);
        return res.status(201).json({ email });
      }
      if (action === 'login') {
        // Derive a hash even for unknown accounts to reduce account enumeration by timing.
        const hash = user?.passwordHash || await hashPassword('invalid-account-password');
        if (!await matchesPassword(password, hash) || !user) return res.status(401).json({ error: 'Invalid email or password.' });
        await createSession(req, res, user, db);
        return res.status(200).json({ email });
      }
      if (action === 'send-otp') {
        // Do not disclose whether the email has an account.
        if (user) {
          const cooldown = 'alh:otp:cooldown:' + accountKey(email);
          if (!await db.set(cooldown, true, 60, true)) return res.status(429).json({ error: 'Please wait 60 seconds before requesting another code.' });
          const code = newOtp();
          const record = { digest: otpDigest(email, code), version: user.version };
          // A failed delivery must not replace the current usable code.
          try {
            await sendEmail(email, code);
            await db.set(otpKey(email), record, 600);
            await db.del('alh:otp:attempts:' + accountKey(email));
          } catch (error) { await db.del(cooldown); throw error; }
        }
        return res.status(200).json({ success: true, expires: Date.now() + 600000 });
      }
      if (action === 'verify-otp') {
        if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Enter the six-digit code.' });
        await db.limit('alh:otp:attempts:' + accountKey(email), 5, 600);
        const record = await db.get(otpKey(email));
        if (!record || !user || record.version !== user.version || record.digest !== otpDigest(email, otp)) return res.status(400).json({ error: 'Incorrect or expired code. Request a new code if needed.' });
        // Consume atomically so concurrent verification cannot reuse a code.
        const consumed = await db.take(otpKey(email));
        if (!consumed || consumed.digest !== record.digest) return res.status(400).json({ error: 'Code already used. Please request another.' });
        const resetToken = randomBytes(32).toString('hex');
        await db.set(resetKey(resetToken), { email, version: user.version }, 600);
        return res.status(200).json({ token: resetToken, expires: Date.now() + 600000 });
      }
      if (action === 'reset-password' || action === 'change-password') {
        if (!validPassword(password)) return res.status(400).json({ error: 'Password must contain 8 to 128 characters.' });
        if (action === 'change-password') {
          const signedIn = await sessionUser(req, db);
          if (!signedIn || signedIn.email !== email || !await matchesPassword(currentPassword, signedIn.passwordHash)) return res.status(401).json({ error: 'Current password is incorrect or your session expired.' });
          user = signedIn;
        } else {
          if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Password reset verification required.' });
          const verification = await db.take(resetKey(token));
          if (!verification || !user || verification.email !== email || verification.version !== user.version) return res.status(401).json({ error: 'Password reset verification expired. Please start again.' });
        }
        user.passwordHash = await hashPassword(password);
        user.version = randomBytes(16).toString('hex');
        await db.set(accountKey(email), user);
        await db.del(otpKey(email));
        await createSession(req, res, user, db);
        return res.status(200).json({ email });
      }
      return res.status(400).json({ error: 'Unknown authentication action.' });
    } catch (error) {
      console.error('[auth]', error.message);
      const status = error.status || 503;
      if (['email_not_configured', 'email_auth_failed', 'email_delivery_failed'].includes(error.code)) {
        return res.status(503).json({ error: error.message, code: error.code });
      }
      return res.status(status).json({ error: status === 429 ? error.message : status === 403 ? 'Request origin not allowed.' : 'Account service unavailable. Please try again later.' });
    }
  };
}
export default createAuthHandler();
