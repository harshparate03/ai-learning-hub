/**
 * Vercel Serverless Function — POST /api/send-otp
 * Sends a password-reset OTP via the Resend email API.
 *
 * Body: { email: string, otp: string }
 *
 * NOTE — Resend free-tier restriction:
 *   With onboarding@resend.dev as sender, Resend only delivers to the account-owner email.
 *   To send to ANY user email, verify a custom domain at resend.com/domains
 *   then set env var: RESEND_FROM_EMAIL=AI Learning Hub <noreply@yourdomain.com>
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, otp } = req.body || {};
  if (!email || !otp)                               return res.status(400).json({ error: 'email and otp are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))   return res.status(400).json({ error: 'Invalid email address' });
  if (!/^\d{6}$/.test(String(otp)))                 return res.status(400).json({ error: 'OTP must be 6 digits' });

  const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_aQAQYWCW_AugvNvaottur1SF28JTAcE3n';
  const FROM = process.env.RESEND_FROM_EMAIL || 'AI Learning Hub <onboarding@resend.dev>';
  const YEAR = new Date().getFullYear();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: '🔐 Your OTP Code — AI Learning Hub',
        html: buildEmail(otp, YEAR),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[send-otp] Resend error:', data);
      if (response.status === 403 || String(data.message || '').toLowerCase().includes('domain')) {
        return res.status(403).json({ error: 'domain_not_verified', message: data.message });
      }
      return res.status(response.status).json({ error: data.message || 'Failed to send email' });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('[send-otp] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function buildEmail(otp, year) {
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

    <!-- Card -->
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(79,70,229,0.10),0 1px 4px rgba(0,0,0,0.06);">

      <!-- Header gradient bar -->
      <tr>
        <td style="background:linear-gradient(135deg,#4F46E5 0%,#6366F1 50%,#818CF8 100%);padding:36px 40px 32px;text-align:center;">
          <!-- Logo placeholder circle -->
          <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.18);border-radius:14px;line-height:56px;text-align:center;font-size:28px;margin-bottom:16px;">🎓</div>
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.03em;line-height:1.2;">AI Learning Hub</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;font-weight:500;">Your AI-Powered Study Platform</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:40px 40px 32px;">

          <!-- SVG illustration -->
          <div style="text-align:center;margin-bottom:28px;">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="40" fill="#EEF2FF"/>
              <rect x="22" y="20" width="36" height="40" rx="4" fill="#6366F1" opacity="0.15"/>
              <rect x="26" y="24" width="28" height="32" rx="3" fill="#6366F1" opacity="0.25"/>
              <rect x="30" y="30" width="20" height="3" rx="1.5" fill="#4F46E5"/>
              <rect x="30" y="37" width="14" height="3" rx="1.5" fill="#6366F1"/>
              <rect x="30" y="44" width="17" height="3" rx="1.5" fill="#6366F1"/>
              <circle cx="54" cy="54" r="12" fill="#4F46E5"/>
              <path d="M50 54l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <h2 style="margin:0 0 8px;color:#111827;font-size:24px;font-weight:800;text-align:center;letter-spacing:-0.02em;">Verify Your Identity</h2>
          <p style="margin:0 0 28px;color:#6B7280;font-size:15px;text-align:center;line-height:1.6;">Hello,<br>Use the code below to reset your <strong style="color:#111827;">AI Learning Hub</strong> password.</p>

          <!-- OTP Box -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td align="center">
                <div style="display:inline-block;background:linear-gradient(135deg,#EEF2FF,#E0E7FF);border:2px solid #6366F1;border-radius:14px;padding:24px 40px;text-align:center;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6366F1;text-transform:uppercase;letter-spacing:0.12em;">One-Time Password</p>
                  <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:12px;color:#4F46E5;font-family:'Courier New',Courier,monospace;line-height:1.2;">${otp}</p>
                </div>
              </td>
            </tr>
          </table>

          <!-- Info bullets -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:13.5px;color:#374151;line-height:1.6;">
                  <span style="color:#4F46E5;font-weight:700;">⏱</span>&nbsp; This OTP is valid for <strong style="color:#111827;">10 minutes</strong>.
                </p>
                <p style="margin:0 0 8px;font-size:13.5px;color:#374151;line-height:1.6;">
                  <span style="color:#4F46E5;font-weight:700;">🔒</span>&nbsp; Do not share this code with anyone.
                </p>
                <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
                  <span style="color:#4F46E5;font-weight:700;">🛡</span>&nbsp; Our team will <strong>never</strong> ask for your OTP.
                </p>
              </td>
            </tr>
          </table>

          <!-- Security notice -->
          <p style="margin:0;font-size:13px;color:#9CA3AF;text-align:center;line-height:1.6;border-top:1px solid #F3F4F6;padding-top:20px;">
            If you did not request this verification, you can safely ignore this email. Your account remains secure.
          </p>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:24px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;">Regards, The AI Learning Hub Team</p>
          <p style="margin:0;font-size:12px;color:#9CA3AF;">© ${year} AI Learning Hub. All Rights Reserved.</p>
          <p style="margin:8px 0 0;font-size:11.5px;color:#D1D5DB;">This is an automated email. Please do not reply.</p>
        </td>
      </tr>

    </table>
    <!-- /Card -->

  </td></tr>
</table>

</body>
</html>`;
}
