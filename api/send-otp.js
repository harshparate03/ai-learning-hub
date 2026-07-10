import tls from 'node:tls';

// Logo embedded as base64 constant (from src/assets/bg_remove_logo.png)
const LOGO_B64 = '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';

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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
  if (!/^\d{6}$/.test(String(otp))) return res.status(400).json({ error: 'OTP must be 6 digits' });

  const user = process.env.GMAIL_USER || '';
  const pass = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
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
  const safeName  = String(fromName).replace(/["\r\n]/g, '').trim() || 'AI Learning Hub';
  const year      = new Date().getFullYear();
  const subject   = 'Your OTP - AI Learning Hub Password Reset';
  const textBody  = 'AI Learning Hub OTP: ' + otp + '\n\nExpires in 10 minutes. Do not share.';
  const htmlBody  = buildEmailHtml(otp, year);
  const boundary = 'related_' + Date.now();
  const altBoundary = 'alternative_' + Date.now();
  const logoData = LOGO_B64.match(/.{1,76}/g).join('\r\n');
  const mime = [
    'From: "' + safeName + '" <' + user + '>',
    'To: <' + to + '>',
    'Subject: ' + subject,
    'Message-ID: ' + messageId,
    'MIME-Version: 1.0',
    'Content-Type: multipart/related; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: multipart/alternative; boundary="' + altBoundary + '"',
    '',
    '--' + altBoundary,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    textBody,
    '',
    '--' + altBoundary,
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
    '',
    '--' + altBoundary + '--',
    '',
    '--' + boundary,
    'Content-Type: image/png; name="ai-learning-hub-logo.png"',
    'Content-Transfer-Encoding: base64',
    'Content-ID: <alh-logo>',
    'Content-Disposition: inline; filename="ai-learning-hub-logo.png"',
    '',
    logoData,
    '',
    '--' + boundary + '--',
  ].join('\r\n');
  await smtpSend({ user, pass, to, mime });
  return messageId;
}

function smtpSend({ user, pass, to, mime }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com' });
    let buffer = '', waiting;
    const fail = (e) => { socket.destroy(); reject(new Error(e)); };
    const next = () => {
      const m = buffer.match(/(?:^|\r?\n)(\d{3}) ([^\r\n]*(?:\r?\n|$))/);
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
        socket.write('EHLO ai-learning-hub\r\n'); await expect('250');
        socket.write('AUTH PLAIN ' + Buffer.from('\0' + user + '\0' + pass).toString('base64') + '\r\n');
        await expect('235');
        socket.write('MAIL FROM:<' + user + '>\r\n'); await expect('250');
        socket.write('RCPT TO:<' + to + '>\r\n');    await expect('250');
        socket.write('DATA\r\n');                    await expect('354');
        socket.write(mime.replace(/\r?\n\./g, '\r\n..') + '\r\n.\r\n');
        await expect('250');
        socket.write('QUIT\r\n'); socket.end(); resolve();
      } catch (e) { fail(e.message); }
    });
  });
}

function buildEmailHtml(otp, year) {
  const logoSrc = 'cid:alh-logo';
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
  ].join('\n');
}
