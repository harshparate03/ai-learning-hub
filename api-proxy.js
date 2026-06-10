const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.API_PROXY_PORT || 3001;

// Always use env key first, fallback to hardcoded key
const GROQ_API_KEY = process.env.GROQ_API_KEY || 'GROQ_API_KEY_PLACEHOLDER';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// â”€â”€â”€ GROQ API PROXY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        max_tokens: max_tokens || 8192
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

// â”€â”€â”€ YOUTUBE API PROXY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ YOUTUBE VIDEO DETAILS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// Start server
app.listen(PORT, () => {
  console.log(`\nâœ… API Proxy Server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Groq proxy: POST http://localhost:${PORT}/api/groq`);
  console.log(`   YouTube search: GET http://localhost:${PORT}/api/youtube-search?q=...`);
  console.log(`   YouTube details: GET http://localhost:${PORT}/api/youtube-details?id=...`);
  console.log(`\n   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Groq API Key: ${GROQ_API_KEY && GROQ_API_KEY.length > 5 ? 'âœ“ Set' : 'âœ— Missing'}`);
  console.log(`   YouTube API Key: ${YOUTUBE_API_KEY && YOUTUBE_API_KEY.length > 5 ? 'âœ“ Set' : 'âœ— Missing'}\n`);
});

