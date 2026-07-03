/**
 * Vercel Serverless Function — /api/groq
 * Proxies requests to Groq API keeping the key server-side.
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(503).json({ error: 'GROQ_API_KEY not configured on server' });
  }

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
        temperature: temperature ?? 0.3,
        max_tokens:  max_tokens  ?? 8192
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Groq Error]', response.status, data?.error?.message);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[Groq Proxy Error]', err.message);
    return res.status(500).json({ error: 'Internal proxy error', message: err.message });
  }
}
