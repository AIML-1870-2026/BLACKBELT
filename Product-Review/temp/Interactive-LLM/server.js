const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Helper: pipe an upstream HTTPS streaming request to the Express response
function proxyStream(req, res, hostname, urlPath, headers, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders();

  const options = {
    hostname,
    path: urlPath,
    method: 'POST',
    headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
  };

  const upstreamReq = https.request(options, (upstreamRes) => {
    upstreamRes.pipe(res);
    upstreamRes.on('end', () => res.end());
  });

  upstreamReq.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });

  upstreamReq.write(body);
  upstreamReq.end();
}

// Helper: proxy a non-streaming GET (model list fetches)
function proxyGet(res, hostname, urlPath, headers) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  https.get({ hostname, path: urlPath, headers }, (upstreamRes) => {
    let data = '';
    upstreamRes.on('data', chunk => data += chunk);
    upstreamRes.on('end', () => {
      try { res.json(JSON.parse(data)); }
      catch { res.status(500).json({ error: 'Parse error' }); }
    });
  }).on('error', err => res.status(500).json({ error: err.message }));
}

// CORS preflight
app.options('/proxy/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

// Anthropic — streaming chat
app.post('/proxy/anthropic', (req, res) => {
  const apiKey = req.body._apiKey;
  const payload = { ...req.body };
  delete payload._apiKey;
  const body = JSON.stringify(payload);
  proxyStream(req, res, 'api.anthropic.com', '/v1/messages', {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  }, body);
});

// OpenAI — streaming chat
app.post('/proxy/openai', (req, res) => {
  const apiKey = req.body._apiKey;
  const payload = { ...req.body };
  delete payload._apiKey;
  const body = JSON.stringify(payload);
  proxyStream(req, res, 'api.openai.com', '/v1/chat/completions', {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }, body);
});

// Anthropic — model list
app.get('/proxy/anthropic/models', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  proxyGet(res, 'api.anthropic.com', '/v1/models', {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  });
});

// OpenAI — model list
app.get('/proxy/openai/models', (req, res) => {
  const apiKey = req.headers['authorization'];
  proxyGet(res, 'api.openai.com', '/v1/models', {
    'Authorization': apiKey
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Switchboard proxy running on http://localhost:${PORT}`));
