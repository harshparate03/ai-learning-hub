const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const express = require('express');
const app = express();
app.use(express.json({ limit: '150kb' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
// Load the same handlers as Vercel to keep local and production behavior equal.
for (const route of ['auth', 'groq', 'send-otp', 'youtube-search', 'youtube-details', 'youtube-oembed']) {
  app.all('/api/' + route, async (req, res, next) => {
    try { await (await import('./api/' + route + '.js')).default(req, res); }
    catch (error) { next(error); }
  });
}
app.use((error, req, res, next) => {
  console.error('[api]', error.message);
  res.status(error.status || 500).json({ error: 'Could not process request.' });
});
app.listen(process.env.API_PROXY_PORT || 3001, '127.0.0.1', () => console.log('API listening on http://127.0.0.1:' + (process.env.API_PROXY_PORT || 3001)));
