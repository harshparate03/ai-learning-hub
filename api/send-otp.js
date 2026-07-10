import tls from 'node:tls';

/** Vercel endpoint: POST /api/send-otp with { email, otp }. */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, otp } = req.body || {};
  if (!email || !otp) return res.status(400).json({ error: 'email and otp are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (!/^\d{6}$/.test(String(otp))) return res.status(400).json({ error: 'OTP must be 6 digits' });

  const user = process.env.GMAIL_USER || '';
  const pass = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) return res.status(500).json({ error: 'email_service_not_configured', message: 'GMAIL_USER and GMAIL_APP_PASSWORD must be configured on the server.' });

  try {
    const id = await sendViaGmail({ user, pass, fromName: process.env.GMAIL_FROM_NAME || 'AI Learning Hub', to: email, otp: String(otp) });
    return res.status(200).json({ success: true, provider: 'gmail', id });
  } catch (err) {
    console.error('[send-otp] Gmail SMTP error:', err?.message || err);
    return res.status(500).json({ error: 'gmail_smtp_failed', message: 'Could not send the password-reset email. Check the Gmail App Password and server configuration.' });
  }
}

async function sendViaGmail({ user, pass, fromName, to, otp }) {
  const messageId = `<otp-${Date.now()}-${Math.random().toString(36).slice(2)}@ai-learning-hub>`;
  const subject = 'AI Learning Hub password reset code';
  const body = `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request this, no action is needed.`;
  const safeName = String(fromName).replace(/["\r\n]/g, '').trim() || 'AI Learning Hub';
  const mime = [`From: "${safeName}" <${user}>`, `To: <${to}>`, `Subject: ${subject}`, `Message-ID: ${messageId}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', '', body].join('\r\n');
  await smtpSend({ user, pass, to, mime });
  return messageId;
}

function smtpSend({ user, pass, to, mime }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com' });
    let buffer = '';
    let waiting;
    const fail = (error) => { socket.destroy(); reject(new Error(error)); };
    const next = () => {
      const match = buffer.match(/(?:^|\r?\n)(\d{3}) ([^\r\n]*(?:\r?\n|$))/);
      if (!match) return null;
      buffer = buffer.slice(buffer.indexOf(match[0]) + match[0].length);
      return `${match[1]} ${match[2]}`;
    };
    const read = () => new Promise((resolveRead) => { const response = next(); if (response) resolveRead(response); else waiting = resolveRead; });
    const expect = async (code) => { const response = await read(); if (!response.startsWith(code)) throw new Error(response); };
    socket.setTimeout(30000, () => fail('Gmail SMTP timed out.'));
    socket.on('error', (err) => fail(err.message));
    socket.on('data', (chunk) => { buffer += chunk.toString('utf8'); if (waiting) { const response = next(); if (response) { const resolveRead = waiting; waiting = undefined; resolveRead(response); } } });
    socket.on('secureConnect', async () => {
      try {
        await expect('220'); socket.write('EHLO ai-learning-hub\r\n'); await expect('250');
        socket.write(`AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`).toString('base64')}\r\n`); await expect('235');
        socket.write(`MAIL FROM:<${user}>\r\n`); await expect('250'); socket.write(`RCPT TO:<${to}>\r\n`); await expect('250');
        socket.write('DATA\r\n'); await expect('354'); socket.write(`${mime.replace(/\r?\n\./g, '\r\n..')}\r\n.\r\n`); await expect('250');
        socket.write('QUIT\r\n'); socket.end(); resolve();
      } catch (err) { fail(err.message); }
    });
  });
}
