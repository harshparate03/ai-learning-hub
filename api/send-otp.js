import tls from 'node:tls';

/**
 * Vercel Serverless Function â€” POST /api/send-otp
 * Sends OTP via Gmail SMTP (TLS port 465).
 *
 * Required Vercel env vars:
 *   GMAIL_USER          â€” your Gmail address (e.g. you@gmail.com)
 *   GMAIL_APP_PASSWORD  â€” 16-char Google App Password (spaces stripped automatically)
 *   GMAIL_FROM_NAME     â€” (optional) display name, default "AI Learning Hub"
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

// â”€â”€ Gmail sender â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Raw SMTP over TLS (port 465) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Beautiful HTML email template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

      <!-- â”€â”€ HEADER â”€â”€ -->
      <tr>
        <td style="background:linear-gradient(135deg,#4F46E5 0%,#6366F1 60%,#818CF8 100%);padding:32px 40px 28px;text-align:center;">
          <img src="data:image/png;base64,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"
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

      <!-- â”€â”€ BODY â”€â”€ -->
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
                  â±&nbsp; This OTP is valid for <strong style="color:#111827;">10 minutes</strong>.
                </p>
                <p style="margin:0 0 9px;font-size:13.5px;color:#374151;line-height:1.6;">
                  ðŸ”’&nbsp; Do not share this code with anyone.
                </p>
                <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
                  ðŸ›¡&nbsp; Our team will <strong>never</strong> ask for your OTP.
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

      <!-- â”€â”€ FOOTER â”€â”€ -->
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
