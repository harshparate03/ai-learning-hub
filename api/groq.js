import { requireUser } from '../server/auth.js';
/**
 * Vercel Serverless Function — /api/groq
 * Proxies requests to Groq API keeping the key server-side.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!await requireUser(req, res)) return;

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(503).json({ error: 'GROQ_API_KEY not configured on server' });
  }

  try {
    const MAX_GROQ_OUTPUT_TOKENS = 3072;
    const { model, messages, temperature, max_tokens } = req.body || {};

    if (!['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'meta-llama/llama-4-scout-17b-16e-instruct', 'qwen/qwen3-32b'].includes(model) || !Array.isArray(messages) || messages.length < 1 || messages.length > 30 || messages.some(m => !m || !['user', 'assistant', 'system'].includes(m.role) || typeof m.content !== 'string') || JSON.stringify(messages).length > 120000) {
      return res.status(400).json({ error: 'Missing model or messages' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      signal: AbortSignal.timeout(50000),
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.3,
        max_tokens:  Math.max(1, Math.min(Math.floor(Number(max_tokens)) || MAX_GROQ_OUTPUT_TOKENS, MAX_GROQ_OUTPUT_TOKENS))
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

