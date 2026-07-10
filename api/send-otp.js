/**
 * Vercel Serverless Function — POST /api/send-otp
 *
 * Sends a password-reset OTP via the Resend email API.
 *
 * IMPORTANT — Resend free-tier restriction:
 *   When using onboarding@resend.dev as the sender (no custom domain),
 *   Resend only delivers to the email address that owns the Resend account.
 *   To send to ANY email, add and verify a custom domain at resend.com/domains,
 *   then set RESEND_FROM_EMAIL env var to "YourApp <you@yourdomain.com>".
 *
 * Body: { email: string, otp: string }
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, otp } = req.body || {};

  if (!email || !otp) return res.status(400).json({ error: 'email and otp are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (!/^\d{6}$/.test(String(otp))) return res.status(400).json({ error: 'OTP must be 6 digits' });

  const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_aQAQYWCW_AugvNvaottur1SF28JTAcE3n';

  // Use custom from-address if domain is verified, else use onboarding@resend.dev
  const FROM = process.env.RESEND_FROM_EMAIL || 'AI Learning Hub <onboarding@resend.dev>';

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
        subject: 'Your OTP — AI Learning Hub Password Reset',
        html: buildEmailHtml(otp),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[send-otp] Resend API error:', data);

      // Resend returns 403 when sending to unverified recipients without a custom domain
      if (response.status === 403 || (data.message || '').toLowerCase().includes('domain')) {
        return res.status(403).json({
          error: 'domain_not_verified',
          message: 'Email sending requires a verified custom domain in Resend. Add RESEND_FROM_EMAIL env var with your verified domain email.',
        });
      }

      return res.status(response.status).json({ error: data.message || 'Failed to send email' });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('[send-otp] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function buildEmailHtml(otp) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 16px;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:20px;border:1px solid rgba(99,102,241,.3);overflow:hidden;max-width:480px;width:100%;">
      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;text-align:center;">
          <div style="display:inline-block;width:52px;height:52px;background:rgba(255,255,255,.15);border-radius:14px;line-height:52px;text-align:center;font-size:26px;">🔐</div>
          <h1 style="color:#fff;margin:12px 0 0;font-size:22px;font-weight:700;letter-spacing:-.02em;">AI Learning Hub</h1>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:32px;">
          <h2 style="color:#e2e8f0;margin:0 0 10px;font-size:18px;font-weight:600;text-align:center;">Password Reset OTP</h2>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;text-align:center;margin:0 0 28px;">
            Use the code below to reset your password. It expires in <strong style="color:#e2e8f0;">10 minutes</strong>.
          </p>
          <!-- OTP box -->
          <div style="background:#1e293b;border:2px solid #6366f1;border-radius:14px;padding:24px;text-align:center;margin-bottom:24px;">
            <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#818cf8;font-family:'Courier New',monospace;display:inline-block;">${otp}</span>
          </div>
          <p style="color:#64748b;font-size:12px;text-align:center;margin:0;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:#0a0f1e;padding:16px 32px;text-align:center;border-top:1px solid rgba(255,255,255,.06);">
          <p style="color:#475569;font-size:11px;margin:0;">AI Learning Hub · Automated message, do not reply</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
