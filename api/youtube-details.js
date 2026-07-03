/**
 * Vercel Serverless Function — /api/youtube-details
 * Proxies YouTube Data API v3 video details, keeping the key server-side.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

  try {
    const { id, part = 'snippet,statistics,contentDetails' } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing parameter: id' });

    // If no API key, return empty so caller falls back to oEmbed
    if (!YOUTUBE_API_KEY) {
      return res.status(200).json({ items: [] });
    }

    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('id',   id);
    url.searchParams.set('part', part);
    url.searchParams.set('key',  YOUTUBE_API_KEY);

    const response = await fetch(url.toString());
    const data     = await response.json();

    if (!response.ok) {
      console.error('[YouTube Details Error]', response.status, data?.error?.message);
      return res.status(200).json({ items: [] }); // graceful fallback
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[YouTube Details Proxy Error]', err.message);
    return res.status(200).json({ items: [] }); // graceful fallback
  }
}
