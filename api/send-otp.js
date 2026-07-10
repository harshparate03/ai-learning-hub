import tls from 'node:tls';

/**
 * Vercel Serverless Function — POST /api/send-otp
 * Sends OTP via Gmail SMTP (TLS port 465).
 *
 * Required Vercel env vars:
 *   GMAIL_USER          — your Gmail address (e.g. you@gmail.com)
 *   GMAIL_APP_PASSWORD  — 16-char Google App Password (spaces stripped automatically)
 *   GMAIL_FROM_NAME     — (optional) display name, default "AI Learning Hub"
 *
 * Body: { email: string, otp: string }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { email, otp } = req.body || {};
  if (!email || !otp)                             return res.status(400).json({ error: 'email and otp are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (!/^\d{6}$/.test(String(otp)))               return res.status(400).json({ error: 'OTP must be 6 digits' });

  const user = process.env.GMAIL_USER || '';
  const pass = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!user || !pass) {
    return res.status(500).json({
      error: 'email_service_not_configured',
      message: 'GMAIL_USER and GMAIL_APP_PASSWORD must be set in Vercel environment variables.',
    });
  }

  try {
    const id = await sendViaGmail({
      user,
      pass,
      fromName: process.env.GMAIL_FROM_NAME || 'AI Learning Hub',
      to:       email,
      otp:      String(otp),
    });
    return res.status(200).json({ success: true, provider: 'gmail', id });
  } catch (err) {
    console.error('[send-otp] Gmail SMTP error:', err?.message || err);
    return res.status(500).json({
      error:   'gmail_smtp_failed',
      message: 'Could not send the password-reset email. Check GMAIL_USER and GMAIL_APP_PASSWORD in Vercel.',
    });
  }
}

// ── Gmail sender ────────────────────────────────────────────────────────────

async function sendViaGmail({ user, pass, fromName, to, otp }) {
  const messageId = `<otp-${Date.now()}-${Math.random().toString(36).slice(2)}@ai-learning-hub>`;
  const safeName  = String(fromName).replace(/["\r\n]/g, '').trim() || 'AI Learning Hub';
  const year      = new Date().getFullYear();

  const subject  = 'Your OTP — AI Learning Hub Password Reset';
  const htmlBody = buildEmailHtml(otp, year);
  const textBody = `Your AI Learning Hub password reset OTP is: ${otp}\n\nIt expires in 10 minutes.\nDo not share it with anyone.\n\nIf you did not request this, ignore this email.`;

  // Build MIME multipart message (text + HTML)
  const boundary = `boundary_${Date.now()}`;
  const mime = [
    `From: "${safeName}" <${user}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    textBody,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  await smtpSend({ user, pass, to, mime });
  return messageId;
}

// ── Raw SMTP over TLS (port 465) ────────────────────────────────────────────

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

    const read = () => new Promise((resolveRead) => {
      const response = next();
      if (response) resolveRead(response);
      else waiting = resolveRead;
    });

    const expect = async (code) => {
      const response = await read();
      if (!response.startsWith(code)) throw new Error(response);
    };

    socket.setTimeout(30000, () => fail('Gmail SMTP timed out.'));
    socket.on('error', (err) => fail(err.message));
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (waiting) {
        const response = next();
        if (response) { const r = waiting; waiting = undefined; r(response); }
      }
    });

    socket.on('secureConnect', async () => {
      try {
        await expect('220');
        socket.write('EHLO ai-learning-hub\r\n');        await expect('250');
        socket.write(`AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`).toString('base64')}\r\n`);
        await expect('235');
        socket.write(`MAIL FROM:<${user}>\r\n`);         await expect('250');
        socket.write(`RCPT TO:<${to}>\r\n`);             await expect('250');
        socket.write('DATA\r\n');                        await expect('354');
        socket.write(`${mime.replace(/\r?\n\./g, '\r\n..')}\r\n.\r\n`);
        await expect('250');
        socket.write('QUIT\r\n');
        socket.end();
        resolve();
      } catch (err) { fail(err.message); }
    });
  });
}

// ── Beautiful HTML email template ───────────────────────────────────────────

function buildEmailHtml(otp, year) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Your OTP — AI Learning Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#F0EFFF;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0EFFF;padding:40px 16px 48px;">
  <tr><td align="center">

    <!-- Outer card -->
    <table width="600" cellpadding="0" cellspacing="0" border="0"
      style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;
             box-shadow:0 4px 24px rgba(79,70,229,0.10),0 1px 4px rgba(0,0,0,0.06);">

      <!-- ── HEADER ── -->
      <tr>
        <td style="background:linear-gradient(135deg,#4F46E5 0%,#6366F1 60%,#818CF8 100%);padding:32px 40px 28px;text-align:center;">
          <img src="https://ai-learning-hub-vert.vercel.app/assets/bg_remove_logo.png"
               alt="AI Learning Hub"
               width="68" height="68"
               style="display:block;margin:0 auto 14px;width:68px;height:68px;object-fit:contain;border-radius:12px;" />
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.03em;line-height:1.2;">
            AI Learning Hub
          </h1>
          <p style="margin:5px 0 0;color:rgba(255,255,255,0.72);font-size:13px;font-weight:500;">
            Your AI-Powered Study Platform
          </p>
        </td>
      </tr>

      <!-- ── BODY ── -->
      <tr>
        <td style="padding:40px 40px 28px;">

          <!-- Illustration -->
          <div style="text-align:center;margin-bottom:26px;">
            <svg width="76" height="76" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="38" cy="38" r="38" fill="#EEF2FF"/>
              <rect x="20" y="18" width="36" height="40" rx="4" fill="#6366F1" opacity="0.15"/>
              <rect x="24" y="22" width="28" height="32" rx="3" fill="#6366F1" opacity="0.22"/>
              <rect x="28" y="28" width="20" height="3" rx="1.5" fill="#4F46E5"/>
              <rect x="28" y="35" width="14" height="3" rx="1.5" fill="#6366F1"/>
              <rect x="28" y="42" width="17" height="3" rx="1.5" fill="#6366F1"/>
              <circle cx="52" cy="52" r="12" fill="#4F46E5"/>
              <path d="M48 52l3 3 5-5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <h2 style="margin:0 0 8px;color:#111827;font-size:23px;font-weight:800;text-align:center;letter-spacing:-0.02em;">
            Verify Your Identity
          </h2>
          <p style="margin:0 0 28px;color:#6B7280;font-size:15px;text-align:center;line-height:1.65;">
            Hello,<br>
            Use the code below to reset your <strong style="color:#111827;">AI Learning Hub</strong> password.
          </p>

          <!-- OTP box -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td align="center">
                <div style="display:inline-block;background:linear-gradient(135deg,#EEF2FF 0%,#E0E7FF 100%);
                            border:2px solid #6366F1;border-radius:14px;padding:22px 44px;text-align:center;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6366F1;
                             text-transform:uppercase;letter-spacing:0.12em;">One-Time Password</p>
                  <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:12px;color:#4F46E5;
                             font-family:'Courier New',Courier,monospace;line-height:1.15;">
                    ${otp}
                  </p>
                </div>
              </td>
            </tr>
          </table>

          <!-- Info pills -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
            style="background:#F9FAFB;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
            <tr>
              <td>
                <p style="margin:0 0 9px;font-size:13.5px;color:#374151;line-height:1.6;">
                  ⏱&nbsp; This OTP is valid for <strong style="color:#111827;">10 minutes</strong>.
                </p>
                <p style="margin:0 0 9px;font-size:13.5px;color:#374151;line-height:1.6;">
                  🔒&nbsp; Do not share this code with anyone.
                </p>
                <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
                  🛡&nbsp; Our team will <strong>never</strong> ask for your OTP.
                </p>
              </td>
            </tr>
          </table>

          <!-- Security notice -->
          <p style="margin:0;font-size:13px;color:#9CA3AF;text-align:center;line-height:1.6;
                    border-top:1px solid #F3F4F6;padding-top:20px;">
            If you did not request this verification, you can safely ignore this email.<br>
            Your account remains secure.
          </p>

        </td>
      </tr>

      <!-- ── FOOTER ── -->
      <tr>
        <td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:22px 40px;text-align:center;">
          <p style="margin:0 0 5px;font-size:13px;font-weight:600;color:#374151;">
            Regards, The AI Learning Hub Team
          </p>
          <p style="margin:0;font-size:12px;color:#9CA3AF;">
            &copy; ${year} AI Learning Hub. All Rights Reserved.
          </p>
          <p style="margin:7px 0 0;font-size:11.5px;color:#D1D5DB;">
            This is an automated email. Please do not reply.
          </p>
        </td>
      </tr>

    </table>
    <!-- /card -->

  </td></tr>
</table>

</body>
</html>`;
}
