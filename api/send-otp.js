/**
 * Vercel Serverless Function — POST /api/send-otp
 * Sends a password-reset OTP via the Resend email API.
 *
 * Body: { email: string, otp: string }
 */
export default async function handler(req, res) {
  // CORS pre-flight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, otp } = req.body || {};

  if (!email || !otp) {
    return res.status(400).json({ error: 'email and otp are required' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  if (!/^\d{6}$/.test(String(otp))) {
    return res.status(400).json({ error: 'OTP must be 6 digits' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_aQAQYWCW_AugvNvaottur1SF28JTAcE3n';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AI Learning Hub <onboarding@resend.dev>',
        to: [email],
        subject: 'Your OTP — AI Learning Hub Password Reset',
        html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;border-radius:16px;color:#e2e8f0;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#6366f1,#38bdf8);border-radius:14px;"></div>
  </div>
  <h2 style="color:#38bdf8;margin:0 0 8px;font-size:22px;text-align:center;">Password Reset OTP</h2>
  <p style="color:#94a3b8;text-align:center;margin:0 0 28px;font-size:14px;">
    Use the code below to reset your <strong style="color:#e2e8f0;">AI Learning Hub</strong> password.
  </p>
  <div style="background:#1e293b;border:2px solid #38bdf8;border-radius:14px;padding:28px;text-align:center;margin-bottom:24px;">
    <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#38bdf8;font-family:monospace;">${otp}</span>
  </div>
  <p style="color:#94a3b8;font-size:13px;text-align:center;margin:0 0 8px;">
    This OTP expires in <strong style="color:#e2e8f0;">10 minutes</strong>.
  </p>
  <p style="color:#64748b;font-size:12px;text-align:center;margin:0;">
    If you did not request this, ignore this email — your account is safe.
  </p>
</div>`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[send-otp] Resend error:', data);
      return res.status(response.status).json({ error: data.message || 'Failed to send OTP' });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('[send-otp] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
