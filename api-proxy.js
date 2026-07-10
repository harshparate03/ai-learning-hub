const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.API_PROXY_PORT || 3001;

// Always use env key first, fallback to hardcoded key
const GROQ_API_KEY = process.env.GROQ_API_KEY || 'GROQ_API_KEY_PLACEHOLDER';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'AI Learning Hub <onboarding@resend.dev>';
const MAX_GROQ_OUTPUT_TOKENS = 3072;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- GROQ API PROXY ---------------------------------------------------------
app.post('/api/groq', async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens } = req.body;

    if (!model || !messages) {
      return res.status(400).json({ error: 'Missing model or messages' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature || 0.3,
        max_tokens: Math.min(Number(max_tokens) || MAX_GROQ_OUTPUT_TOKENS, MAX_GROQ_OUTPUT_TOKENS)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Groq Error]', response.status, data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    console.error('[Groq Proxy Error]', err.message);
    res.status(500).json({ 
      error: 'Failed to process request',
      message: err.message
    });
  }
});

// --- YOUTUBE API PROXY ------------------------------------------------------
app.get('/api/youtube-search', async (req, res) => {
  try {
    const { q, maxResults, type, videoEmbeddable, order, relevanceLanguage, videoCategoryId } = req.query;

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ 
        error: 'YOUTUBE_API_KEY not configured on server',
        details: 'Please ensure YOUTUBE_API_KEY is set in .env'
      });
    }

    if (!q) {
      return res.status(400).json({ error: 'Missing search query (q parameter)' });
    }

    const params = new URLSearchParams({
      part: 'snippet',
      q,
      key: YOUTUBE_API_KEY,
      maxResults: maxResults || 20,
      type: type || 'video',
      videoEmbeddable: videoEmbeddable !== undefined ? videoEmbeddable : 'true',
      order: order || 'relevance',
      relevanceLanguage: relevanceLanguage || 'en',
      ...(videoCategoryId && { videoCategoryId })
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await response.json();

    if (!response.ok) {
      console.error('[YouTube Error]', response.status, data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    console.error('[YouTube Proxy Error]', err.message);
    res.status(500).json({ 
      error: 'Failed to search YouTube',
      message: err.message
    });
  }
});

// --- YOUTUBE VIDEO DETAILS --------------------------------------------------
app.get('/api/youtube-details', async (req, res) => {
  try {
    const { id, part } = req.query;

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ error: 'YOUTUBE_API_KEY not configured' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Missing video id parameter' });
    }

    const params = new URLSearchParams({
      part: part || 'snippet,statistics,contentDetails',
      id,
      key: YOUTUBE_API_KEY
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    const data = await response.json();

    if (!response.ok) {
      console.error('[YouTube Details Error]', response.status, data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    console.error('[YouTube Details Proxy Error]', err.message);
    res.status(500).json({ 
      error: 'Failed to get video details',
      message: err.message
    });
  }
});

// --- YOUTUBE OEMBED PROXY (avoids browser CORS) -----------------------------
app.get('/api/youtube-oembed', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(String(url))}&format=json`;
    const response = await fetch(oembedUrl);
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (err) {
    console.error('[YouTube oEmbed Proxy Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch oEmbed', message: err.message });
  }
});

// --- PASSWORD RESET OTP EMAIL ----------------------------------------------
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email, otp } = req.body || {};

    if (!email || !otp) return res.status(400).json({ error: 'email and otp are required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
    if (!/^\d{6}$/.test(String(otp))) return res.status(400).json({ error: 'OTP must be 6 digits' });

    if (!RESEND_API_KEY) {
      console.error('[send-otp] RESEND_API_KEY is not configured.');
      return res.status(500).json({
        error: 'email_service_not_configured',
        message: 'RESEND_API_KEY is not configured on the local API proxy.',
      });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject: 'Your OTP - AI Learning Hub Password Reset',
        html: buildOtpEmailHtml(otp),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[send-otp] Resend API error:', data);
      const resendMessage = data?.message || data?.error || 'Failed to send email';
      const lowerMessage = String(resendMessage).toLowerCase();
      if (
        response.status === 403 ||
        lowerMessage.includes('domain') ||
        lowerMessage.includes('verify') ||
        lowerMessage.includes('testing emails') ||
        lowerMessage.includes('own email')
      ) {
        return res.status(403).json({
          error: 'resend_sender_not_verified',
          message: 'Resend rejected this recipient/sender. Verify a custom domain and set RESEND_FROM_EMAIL, or send only to the Resend account email while using onboarding@resend.dev.',
          providerMessage: resendMessage,
        });
      }
      return res.status(response.status).json({ error: 'resend_send_failed', message: resendMessage });
    }

    res.json({ success: true, id: data.id });
  } catch (err) {
    console.error('[send-otp] Unexpected error:', err.message);
    res.status(500).json({ error: 'email_send_exception', message: err?.message || 'Internal server error' });
  }
});

function buildOtpEmailHtml(otp) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 16px;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:20px;border:1px solid rgba(99,102,241,.3);overflow:hidden;max-width:480px;width:100%;">
      <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;text-align:center;">
        <div style="display:inline-block;width:52px;height:52px;background:rgba(255,255,255,.15);border-radius:14px;line-height:52px;text-align:center;font-size:18px;font-weight:800;color:#fff;">ALH</div>
        <h1 style="color:#fff;margin:12px 0 0;font-size:22px;font-weight:700;">AI Learning Hub</h1>
      </td></tr>
      <tr><td style="padding:32px;">
        <h2 style="color:#e2e8f0;margin:0 0 10px;font-size:18px;font-weight:600;text-align:center;">Password Reset OTP</h2>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;text-align:center;margin:0 0 28px;">Use the code below to reset your password. It expires in <strong style="color:#e2e8f0;">10 minutes</strong>.</p>
        <div style="background:#1e293b;border:2px solid #6366f1;border-radius:14px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#818cf8;font-family:'Courier New',monospace;display:inline-block;">${otp}</span>
        </div>
        <p style="color:#64748b;font-size:12px;text-align:center;margin:0;">If you did not request this, you can safely ignore this email.</p>
      </td></tr>
      <tr><td style="background:#0a0f1e;padding:16px 32px;text-align:center;border-top:1px solid rgba(255,255,255,.06);">
        <p style="color:#475569;font-size:11px;margin:0;">AI Learning Hub - Automated message, do not reply</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
// Start server
app.listen(PORT, () => {
  console.log(`\nAPI Proxy Server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Groq proxy: POST http://localhost:${PORT}/api/groq`);
  console.log(`   YouTube search: GET http://localhost:${PORT}/api/youtube-search?q=...`);
  console.log(`   YouTube details: GET http://localhost:${PORT}/api/youtube-details?id=...`);
  console.log(`\n   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Groq API Key: ${GROQ_API_KEY && GROQ_API_KEY.length > 5 ? 'Set' : 'Missing'}`);
  console.log(`   YouTube API Key: ${YOUTUBE_API_KEY && YOUTUBE_API_KEY.length > 5 ? 'Set' : 'Missing'}`);
  console.log(`   Resend API Key: ${RESEND_API_KEY && RESEND_API_KEY.length > 5 ? 'Set' : 'Missing'}`);

});
