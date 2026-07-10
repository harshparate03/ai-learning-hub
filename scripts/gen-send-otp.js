/**
 * Generates api/send-otp.js with the logo base64 properly embedded.
 * Run: node scripts/gen-send-otp.js
 */
const fs   = require('fs');
const path = require('path');

// Read and resize logo using pure Node (no native modules needed)
// We'll read the PNG as-is and embed the full-size version
// (already small enough at ~126KB original, but we resize via sharp if available)
const logoBytes = fs.readFileSync(path.join(__dirname, '../logo96.b64'));
const logoB64   = logoBytes.toString('ascii').trim();

console.log(`Logo base64 length: ${logoB64.length} chars`);
console.log(`Starts: ${logoB64.substring(0, 40)}`);

const output = `import tls from 'node:tls';

// Logo embedded as base64 constant (from src/assets/bg_remove_logo.png)
const LOGO_B64 = '${logoB64}';

/**
 * Vercel Serverless Function - POST /api/send-otp
 * Sends OTP via Gmail SMTP (TLS port 465).
 *
 * Required Vercel env vars:
 *   GMAIL_USER          - your Gmail address
 *   GMAIL_APP_PASSWORD  - 16-char Google App Password
 *   GMAIL_FROM_NAME     - (optional) display name
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, otp } = req.body || {};
  if (!email || !otp) return res.status(400).json({ error: 'email and otp are required' });
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
  if (!/^\\d{6}$/.test(String(otp))) return res.status(400).json({ error: 'OTP must be 6 digits' });

  const user = process.env.GMAIL_USER || '';
  const pass = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\\s+/g, '');
  if (!user || !pass) {
    return res.status(500).json({ error: 'email_service_not_configured', message: 'GMAIL_USER and GMAIL_APP_PASSWORD must be set in Vercel.' });
  }

  try {
    const id = await sendViaGmail({ user, pass, fromName: process.env.GMAIL_FROM_NAME || 'AI Learning Hub', to: email, otp: String(otp) });
    return res.status(200).json({ success: true, provider: 'gmail', id });
  } catch (err) {
    console.error('[send-otp] Gmail SMTP error:', err?.message || err);
    return res.status(500).json({ error: 'gmail_smtp_failed', message: 'Could not send email. Check GMAIL_USER and GMAIL_APP_PASSWORD.' });
  }
}

async function sendViaGmail({ user, pass, fromName, to, otp }) {
  const messageId = '<otp-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '@ai-learning-hub>';
  const safeName  = String(fromName).replace(/["\\r\\n]/g, '').trim() || 'AI Learning Hub';
  const year      = new Date().getFullYear();
  const subject   = 'Your OTP - AI Learning Hub Password Reset';
  const textBody  = 'AI Learning Hub OTP: ' + otp + '\\n\\nExpires in 10 minutes. Do not share.';
  const htmlBody  = buildEmailHtml(otp, year);
  const boundary  = 'boundary_' + Date.now();
  const mime = [
    'From: "' + safeName + '" <' + user + '>',
    'To: <' + to + '>',
    'Subject: ' + subject,
    'Message-ID: ' + messageId,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    textBody,
    '',
    '--' + boundary,
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
    '',
    '--' + boundary + '--',
  ].join('\\r\\n');
  await smtpSend({ user, pass, to, mime });
  return messageId;
}

function smtpSend({ user, pass, to, mime }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com' });
    let buffer = '', waiting;
    const fail = (e) => { socket.destroy(); reject(new Error(e)); };
    const next = () => {
      const m = buffer.match(/(?:^|\\r?\\n)(\\d{3}) ([^\\r\\n]*(?:\\r?\\n|$))/);
      if (!m) return null;
      buffer = buffer.slice(buffer.indexOf(m[0]) + m[0].length);
      return m[1] + ' ' + m[2];
    };
    const read = () => new Promise((r) => { const v = next(); if (v) r(v); else waiting = r; });
    const expect = async (c) => { const v = await read(); if (!v.startsWith(c)) throw new Error(v); };
    socket.setTimeout(30000, () => fail('Gmail SMTP timed out.'));
    socket.on('error', (e) => fail(e.message));
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (waiting) { const v = next(); if (v) { const w = waiting; waiting = undefined; w(v); } }
    });
    socket.on('secureConnect', async () => {
      try {
        await expect('220');
        socket.write('EHLO ai-learning-hub\\r\\n'); await expect('250');
        socket.write('AUTH PLAIN ' + Buffer.from('\\0' + user + '\\0' + pass).toString('base64') + '\\r\\n');
        await expect('235');
        socket.write('MAIL FROM:<' + user + '>\\r\\n'); await expect('250');
        socket.write('RCPT TO:<' + to + '>\\r\\n');    await expect('250');
        socket.write('DATA\\r\\n');                    await expect('354');
        socket.write(mime.replace(/\\r?\\n\\./g, '\\r\\n..') + '\\r\\n.\\r\\n');
        await expect('250');
        socket.write('QUIT\\r\\n'); socket.end(); resolve();
      } catch (e) { fail(e.message); }
    });
  });
}

function buildEmailHtml(otp, year) {
  const logoSrc = 'data:image/png;base64,' + LOGO_B64;
  return [
    '<!DOCTYPE html><html lang="en"><head>',
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Your OTP - AI Learning Hub</title></head>',
    '<body style="margin:0;padding:0;background:#F0EFFF;font-family:Inter,-apple-system,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0EFFF;padding:40px 16px 48px;">',
    '<tr><td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(79,70,229,.10);">',
    '<tr><td style="background:linear-gradient(135deg,#4F46E5 0%,#6366F1 60%,#818CF8 100%);padding:32px 40px 28px;text-align:center;">',
    '  <img src="' + logoSrc + '" alt="AI Learning Hub" width="100" height="100" style="display:block;margin:0 auto 14px;width:100px;height:100px;" />',
    '  <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">AI Learning Hub</h1>',
    '  <p style="margin:5px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Your AI-Powered Study Platform</p>',
    '</td></tr>',
    '<tr><td style="padding:40px 40px 28px;">',
    '  <h2 style="margin:0 0 8px;color:#111827;font-size:23px;font-weight:800;text-align:center;">Verify Your Identity</h2>',
    '  <p style="margin:0 0 28px;color:#6B7280;font-size:15px;text-align:center;line-height:1.65;">Hello,<br>Use the code below to reset your <strong style="color:#111827;">AI Learning Hub</strong> password.</p>',
    '  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;"><tr><td align="center">',
    '    <div style="display:inline-block;background:linear-gradient(135deg,#EEF2FF,#E0E7FF);border:2px solid #6366F1;border-radius:14px;padding:22px 44px;text-align:center;">',
    '      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6366F1;text-transform:uppercase;letter-spacing:0.12em;">One-Time Password</p>',
    '      <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:12px;color:#4F46E5;font-family:Courier New,monospace;line-height:1.15;">' + otp + '</p>',
    '    </div>',
    '  </td></tr></table>',
    '  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border-radius:12px;padding:20px 24px;margin-bottom:24px;"><tr><td>',
    '    <p style="margin:0 0 9px;font-size:13.5px;color:#374151;">&#9201; Valid for <strong>10 minutes</strong>.</p>',
    '    <p style="margin:0 0 9px;font-size:13.5px;color:#374151;">&#128274; Do not share this code.</p>',
    '    <p style="margin:0;font-size:13.5px;color:#374151;">&#128737; We will <strong>never</strong> ask for your OTP.</p>',
    '  </td></tr></table>',
    '  <p style="margin:0;font-size:13px;color:#9CA3AF;text-align:center;border-top:1px solid #F3F4F6;padding-top:20px;">If you did not request this, ignore this email.</p>',
    '</td></tr>',
    '<tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:22px 40px;text-align:center;">',
    '  <p style="margin:0 0 5px;font-size:13px;font-weight:600;color:#374151;">Regards, The AI Learning Hub Team</p>',
    '  <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; ' + year + ' AI Learning Hub. All Rights Reserved.</p>',
    '</td></tr>',
    '</table></td></tr></table></body></html>',
  ].join('\\n');
}
`;

fs.writeFileSync(path.join(__dirname, '../api/send-otp.js'), output, 'utf8');
console.log('send-otp.js generated successfully');
console.log('File size:', fs.statSync(path.join(__dirname, '../api/send-otp.js')).size, 'bytes');
