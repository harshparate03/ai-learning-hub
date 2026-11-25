import { requireUser } from '../server/auth.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!await requireUser(req, res)) return;
  try {
    const video = new URL(String(req.query?.url || ''));
    const id = video.searchParams.get('v');
    if (!['www.youtube.com', 'youtube.com'].includes(video.hostname) || !/^[\w-]{11}$/.test(id || '')) return res.status(400).json({ error: 'Invalid YouTube video URL.' });
    const response = await fetch('https://www.youtube.com/oembed?' + new URLSearchParams({ url: 'https://www.youtube.com/watch?v=' + id, format: 'json' }), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return res.status(404).json({ error: 'Video not found.' });
    return res.status(200).json(await response.json());
  } catch { return res.status(502).json({ error: 'Video details unavailable.' }); }
}
