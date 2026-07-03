/**
 * Vercel Serverless Function — /api/youtube-search
 * Proxies YouTube Data API v3 search keeping the key server-side.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  if (!YOUTUBE_API_KEY) {
    return res.status(503).json({ error: 'YOUTUBE_API_KEY not configured on server' });
  }

  try {
    const { q, type = 'video', maxResults = '12' } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query parameter: q' });

    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part',       'snippet');
    url.searchParams.set('q',          q);
    url.searchParams.set('type',       type);
    url.searchParams.set('maxResults', maxResults);
    url.searchParams.set('key',        YOUTUBE_API_KEY);

    const response = await fetch(url.toString());
    const data     = await response.json();

    if (!response.ok) {
      console.error('[YouTube Search Error]', response.status, data?.error?.message);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[YouTube Search Proxy Error]', err.message);
    return res.status(500).json({ error: 'Internal proxy error', message: err.message });
  }
}
