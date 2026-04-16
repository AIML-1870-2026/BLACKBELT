# LLM Switchboard — `spec.md`

## Overview

A single-page web application that lets a user query **Anthropic (Claude)** and **OpenAI (GPT)** models simultaneously and compare their responses side by side. The interface uses a **terminal / hacker aesthetic**: monospace fonts, scanline effects, phosphor-green and amber accents on a near-black background, glowing borders, and CRT-style animations.

---

## Tech Stack

- **Vanilla HTML + CSS + JS** (three separate files: `index.html`, `styles.css`, `script.js`, no build step)
- **Node.js + Express** local proxy (`server.js`) to handle CORS — required, not optional
- Google Fonts: `Share Tech Mono` (primary), `VT323` (display/headers)

---

## Layout — Two-Panel Split

```
┌──────────────────────────────────────────────────────────┐
│  ████ LLM SWITCHBOARD v1.0 ████   [ANTHROPIC] [OPENAI]  │  ← Header
├──────────────────────────────────────────────────────────┤
│  [API KEY CONFIG]  [MODEL SELECT]  [RESPONSE FORMAT]     │  ← Control Bar
├──────────────────────────────────────────────────────────┤
│  [PRESET PROMPTS ▼]                                      │  ← Prompt Presets
│  ┌────────────────────────────────────────────────────┐  │
│  │  > _  (query textarea)                             │  │  ← Query Input
│  └────────────────────────────────────────────────────┘  │
│                     [▶ TRANSMIT]                          │
├────────────────────┬─────────────────────────────────────┤
│  CLAUDE OUTPUT     │  GPT OUTPUT                         │  ← Side-by-side
│  (model: ...)      │  (model: ...)                       │     Response Panels
│                    │                                     │
│  [streaming text]  │  [streaming text]                   │
└────────────────────┴─────────────────────────────────────┘
│  STATUS BAR: tokens | latency | errors                   │  ← Footer
```

---

## Visual Design

### Color Palette (CSS Variables)
```css
--bg-primary:     #0a0a0a;   /* near-black */
--bg-panel:       #0f0f0f;   /* panel background */
--bg-surface:     #141414;   /* elevated surfaces */
--accent-green:   #00ff88;   /* phosphor green — primary accent */
--accent-amber:   #ffaa00;   /* amber — secondary accent */
--accent-red:     #ff3333;   /* error states */
--accent-cyan:    #00ccff;   /* info/links */
--text-primary:   #e0e0e0;
--text-dim:       #555555;
--border-color:   #1e3a1e;   /* dark green tint borders */
--glow-green:     0 0 8px #00ff8855, 0 0 20px #00ff8822;
--glow-amber:     0 0 8px #ffaa0055, 0 0 20px #ffaa0022;
```

### Typography
- **Headers / labels**: `VT323`, size 18–24px, letter-spacing 0.15em, uppercase
- **Body / code / responses**: `Share Tech Mono`, size 13–14px
- All text in monospace; terminal feel throughout

### Effects
- **Scanlines**: Full-page CSS `::before` overlay with repeating linear gradient (semi-transparent horizontal lines, 2px spacing), `pointer-events: none`
- **CRT Flicker**: Subtle `@keyframes flicker` on the main container, 0.5% opacity oscillation every few seconds
- **Glow borders**: Active panels and focused inputs get `box-shadow: var(--glow-green)` with CSS transition
- **Cursor blink**: Blinking `_` appended to streaming text while response loads
- **Boot sequence**: On page load, a brief terminal-style boot animation types "INITIALIZING SWITCHBOARD..." before revealing the UI (can be dismissed instantly by clicking)
- **Typing effect**: Query textarea has a blinking caret styled as a block cursor

---

## Sections & Components

### 1. Header Bar
- ASCII-art style title: `[ LLM SWITCHBOARD v1.0 ]`
- Two status indicators: `◉ ANTHROPIC` and `◉ OPENAI` — green when API key is set, dim/red otherwise
- Tagline: `> PARALLEL QUERY INTERFACE //`

---

### 2. API Key Config Panel
- Collapsible drawer toggled by `[API KEYS ▼]` button
- Two fields side by side:
  - `ANTHROPIC KEY:` → password input, placeholder `sk-ant-...`
  - `OPENAI KEY:` → password input, placeholder `sk-...`
- Keys stored in `sessionStorage` (cleared on tab close, never persisted)
- Show/hide toggle (eye icon) per field
- On key entry, immediately attempt to fetch model list (see Model Fetch)
- Status line: `KEY STATUS: [ANTHROPIC ✓] [OPENAI ✗]`

---

### 3. Model Selection
Two dropdowns, one per provider, each populated **dynamically** at runtime:

#### Anthropic Models
- Fetch from: `GET http://localhost:3000/proxy/anthropic/models`
  - Header: `x-api-key: <key>` (sent as request header, proxy forwards it)
- Sort by `created_at` descending, take the **5 most recent**
- Populate `<select id="anthropic-model">`

#### OpenAI Models
- Fetch from: `GET http://localhost:3000/proxy/openai/models`
  - Header: `Authorization: Bearer <key>` (sent as request header, proxy forwards it)
- Filter using `filterOpenAIModels()` (see API Call Logic section), take **5 most recent**
- Populate `<select id="openai-model">`

Both dropdowns styled as terminal selects: dark background, green border, monospace text, custom arrow `▼`.

---

### 4. Response Format Toggle
A segmented toggle (styled as terminal buttons) between two modes:

| Mode | Label | Behavior |
|------|-------|----------|
| Unstructured | `[FREE TEXT]` | Plain chat completion, render markdown (code blocks, bold, lists) |
| Structured | `[JSON MODE]` | Append to system prompt: instruct model to respond only with valid JSON. Display in a syntax-highlighted code block. |

When **Structured** is active:
- A schema hint textarea appears: `SCHEMA HINT (optional):` — user can describe the shape of JSON they want (e.g., `{ "summary": string, "keyPoints": string[] }`)
- The schema hint is appended to the system prompt sent to both models

---

### 5. Preset Prompts
A dropdown `[PRESET PROMPTS ▼]` that, when selected, populates the query textarea.

Include at least these 8 presets (editable by user after selection):

| Label | Prompt |
|-------|--------|
| Explain a concept | `Explain [topic] as if I'm a college student with no prior knowledge of it.` |
| Compare options | `Compare and contrast [option A] and [option B] across these dimensions: performance, cost, ease of use, and scalability.` |
| Debug code | `Here is my code: [paste code]. It's producing this error: [error]. Diagnose the issue and suggest a fix.` |
| Summarize text | `Summarize the following text in 3–5 bullet points: [paste text]` |
| Write a function | `Write a [language] function that [does X]. Include comments and error handling.` |
| Pros and cons | `List the pros and cons of [topic] in a structured format.` |
| Step-by-step plan | `Give me a step-by-step plan to [accomplish goal], including potential obstacles and how to address them.` |
| Socratic question | `What are the most important questions someone should ask when thinking about [topic]?` |

Preset items render in a styled dropdown panel (not native `<select>`), with category grouping and a monospace list.

---

### 6. Query Input
- Large `<textarea>` styled as a terminal prompt
- Prefix: `> ` in green, non-editable
- Placeholder: `ENTER QUERY_`
- Auto-grows with content (JS `input` event adjusts height)
- Character counter bottom-right: `[0 / 4096]`
- `[▶ TRANSMIT]` button below — green glow on hover, sends to both APIs simultaneously

---

### 7. Side-by-Side Response Panels

Two equal-width panels, separated by a vertical divider line.

Each panel:
- Header: `◈ CLAUDE [model-name]` / `◈ GPT [model-name]` in accent color
- Status badge: `IDLE` → `TRANSMITTING...` → `COMPLETE` / `ERROR`
- Response area: scrollable `<div>` with monospace text
  - Unstructured mode: render markdown (use a lightweight lib like `marked.js` via CDN, or implement basic rendering for bold, code blocks, lists)
  - Structured mode: JSON syntax highlighted (use `highlight.js` via CDN or custom tokenizer)
- Streaming: use `fetch` with `ReadableStream` to stream tokens as they arrive; append to panel in real time with blinking cursor `█`
- Footer per panel:
  - `TOKENS: [in] → [out]` (from API response usage object)
  - `LATENCY: [Xms]` (time from TRANSMIT to first token)
  - `[⎘ COPY]` button — copies raw response text to clipboard

---

### 8. Status / Footer Bar
Fixed at bottom:
- Left: `SWITCHBOARD READY` / `TRANSMITTING...` / `ERROR: [message]`
- Right: `ANTHROPIC [model] | OPENAI [model]` showing current selections

---

## API Call Logic

### Shared System Prompt
```
You are a helpful AI assistant. Be clear, accurate, and concise.
```
Append if Structured mode:
```
Respond ONLY with valid JSON. Do not include any explanation or markdown. [schema hint if provided]
```

### Anthropic Call
```
POST http://localhost:3000/proxy/anthropic
Content-Type: application/json
Body:
{
  "model": "<selected>",
  "max_tokens": <maxTokens>,
  "stream": true,
  "system": "<system prompt>",
  "messages": [{ "role": "user", "content": "<query>" }]
}
```

#### Anthropic SSE Stream Parsing — Exact Format

The Anthropic streaming API sends named SSE events. Each chunk looks like:

```
event: message_start
data: {"type":"message_start","message":{"id":"...","usage":{"input_tokens":N}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":N}}

event: message_stop
data: {"type":"message_stop"}
```

Parse the stream as follows:

```js
async function streamAnthropic(body, panelEl) {
  const response = await fetch('/proxy/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controllers.anthropic.signal
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;

      let parsed;
      try { parsed = JSON.parse(jsonStr); } catch { continue; }

      if (parsed.type === 'message_start') {
        inputTokens = parsed.message?.usage?.input_tokens ?? 0;
      }
      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
        fullText += parsed.delta.text;
        appendToPanel(panelEl, parsed.delta.text);
      }
      if (parsed.type === 'message_delta') {
        outputTokens = parsed.usage?.output_tokens ?? 0;
      }
    }
  }
  return { fullText, inputTokens, outputTokens };
}
```

**Do NOT** rely on the `event:` line for filtering — parse `parsed.type` from the `data:` JSON instead. This is more robust to proxy buffering.

### OpenAI Call
```
POST http://localhost:3000/proxy/openai
Content-Type: application/json
Body:
{
  "model": "<selected>",
  "max_tokens": <maxTokens>,
  "stream": true,
  "stream_options": { "include_usage": true },
  "messages": [
    { "role": "system", "content": "<system prompt>" },
    { "role": "user", "content": "<query>" }
  ]
}
```

#### OpenAI SSE Stream Parsing — Exact Format

```js
async function streamOpenAI(body, panelEl) {
  const response = await fetch('/proxy/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controllers.openai.signal
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;

      let parsed;
      try { parsed = JSON.parse(jsonStr); } catch { continue; }

      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        appendToPanel(panelEl, delta);
      }
      // usage arrives in the final chunk when stream_options.include_usage is set
      if (parsed.usage) {
        inputTokens = parsed.usage.prompt_tokens ?? 0;
        outputTokens = parsed.usage.completion_tokens ?? 0;
      }
    }
  }
  return { fullText, inputTokens, outputTokens };
}
```

#### OpenAI Model Filtering — Exact Logic

The `/v1/models` endpoint returns 100+ entries including embeddings, TTS, image, and fine-tune models. Use this exact filter to get only chat-capable GPT models:

```js
function filterOpenAIModels(models) {
  const CHAT_PREFIXES = ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
  const EXCLUDED_SUFFIXES = [
    'instruct', 'vision-preview', '0301', '0314', '0613',
    'audio', 'realtime', 'search', 'mini-tts', 'transcribe'
  ];

  return models
    .filter(m => {
      const id = m.id.toLowerCase();
      const matchesPrefix = CHAT_PREFIXES.some(p => id.startsWith(p));
      const isExcluded = EXCLUDED_SUFFIXES.some(s => id.includes(s));
      return matchesPrefix && !isExcluded;
    })
    .sort((a, b) => b.created - a.created)
    .slice(0, 5);
}
```

This prevents stale preview models and non-chat endpoints from appearing in the dropdown.

### Parallel Execution

Both stream functions must fire simultaneously — do not await one before starting the other:

```js
// CORRECT — truly parallel
const anthropicPromise = streamAnthropic(anthropicBody, anthropicPanel);
const openaiPromise = streamOpenAI(openaiBody, openaiPanel);
await Promise.all([anthropicPromise, openaiPromise]);
```

---

## CORS & Local Proxy

Direct browser calls to `api.anthropic.com` are blocked by CORS. Claude Code must scaffold a `server.js` Express proxy. All frontend `fetch()` calls target `http://localhost:3000/proxy/...`.

### `server.js` — Complete Implementation Pattern

Use Node's built-in `https` module to pipe the upstream SSE response back to the client without buffering. **Do not use `node-fetch` for streaming proxy routes** — it buffers. Use `https.request()` with direct pipe instead.

```js
const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname))); // serves index.html, styles.css, script.js

// Helper: pipe an upstream HTTPS streaming request to the Express response
function proxyStream(req, res, hostname, path, headers, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders(); // critical — send headers immediately before stream starts

  const options = {
    hostname,
    path,
    method: 'POST',
    headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
  };

  const upstreamReq = https.request(options, (upstreamRes) => {
    upstreamRes.pipe(res); // direct pipe — no buffering
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
function proxyGet(res, hostname, path, headers) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  https.get({ hostname, path, headers }, (upstreamRes) => {
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
  const apiKey = req.body._apiKey;       // client sends key in body under _apiKey
  const payload = { ...req.body };
  delete payload._apiKey;                // strip before forwarding
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

app.listen(3000, () => console.log('Switchboard proxy running on http://localhost:3000'));
```

### Key Rules for `server.js`
- API keys travel from the client in the request: in the body as `_apiKey` for POST routes, in headers for GET routes. Keys are never stored in `server.js`.
- `res.flushHeaders()` must be called before piping — without it, Express buffers the response and streaming breaks
- Disable Express compression middleware if added — it will break SSE chunking
- `upstreamRes.pipe(res)` is a direct byte-level pipe; no JSON parsing happens server-side for streaming routes

### Client-Side Key Passing

In `script.js`, include the key in the POST body:

```js
// Anthropic
body: JSON.stringify({ _apiKey: state.keys.anthropic, ...anthropicPayload })

// OpenAI
body: JSON.stringify({ _apiKey: state.keys.openai, ...openaiPayload })
```

For model GET fetches, pass keys in headers:

```js
// Anthropic models
fetch('/proxy/anthropic/models', { headers: { 'x-api-key': state.keys.anthropic } })

// OpenAI models
fetch('/proxy/openai/models', { headers: { 'Authorization': `Bearer ${state.keys.openai}` } })
```

### `package.json`
```json
{
  "name": "llm-switchboard",
  "version": "1.0.0",
  "scripts": { "start": "node server.js" },
  "dependencies": { "express": "^4.18.2" }
}
```
Note: `node-fetch` is NOT needed — use Node's built-in `https` module for proxying.

---

## Abort / Cancel

Both response panels must support mid-stream cancellation.

- Each API call is wrapped in an `AbortController`; the signal is passed to `fetch()`
- While either panel is `TRANSMITTING`, the `[▶ TRANSMIT]` button is replaced by `[■ ABORT]` (styled in red/amber)
- Clicking `[■ ABORT]` calls `.abort()` on both controllers simultaneously
- Aborted panels show status `ABORTED` and retain whatever partial text was received
- After abort, button reverts to `[▶ TRANSMIT]`

Store both controllers on a shared object:
```js
const controllers = { anthropic: null, openai: null };
```

---

## Conversation Mode

A toggle in the control bar switches between two modes:

| Mode | Label | Behavior |
|------|-------|----------|
| Single-shot | `[SINGLE]` | Each TRANSMIT sends only the current query; history is not retained |
| Multi-turn | `[CHAT]` | Full conversation history is maintained per provider and sent with each request |

### History State Structure

```js
const history = {
  anthropic: [],  // array of { role: 'user' | 'assistant', content: string }
  openai: []      // same shape
};
```

### Role Alternation Safety (Critical for Anthropic)

Anthropic's API strictly requires messages to alternate `user` → `assistant` → `user`. Violating this causes a `400` error. Enforce the following rules on every TRANSMIT:

```js
function sanitizeHistory(messages) {
  if (messages.length === 0) return messages;
  const result = [];
  let lastRole = null;

  for (const msg of messages) {
    if (msg.role === lastRole) {
      // Merge consecutive same-role messages (shouldn't happen, but defensive)
      result[result.length - 1].content += '\n' + msg.content;
    } else {
      result.push({ ...msg });
      lastRole = msg.role;
    }
  }

  // Anthropic requires first message to be 'user'
  if (result[0]?.role !== 'user') result.shift();
  // Must end with 'user' (the current query is appended after sanitization)
  while (result.length && result[result.length - 1].role === 'user') result.pop();

  return result;
}
```

Call `sanitizeHistory()` on both arrays before building the messages payload for each API call.

### Handling Aborted Turns

If a stream is aborted mid-response, **do not append** the partial assistant response to the history array. Only append complete responses (i.e., stream reached `message_stop` / `[DONE]`). Track completion with a boolean flag per provider set inside the stream function's `finally` block.

### Building the Payload in Multi-Turn Mode

```js
// For Anthropic
const messages = [
  ...sanitizeHistory(history.anthropic),
  { role: 'user', content: currentQuery }
];

// For OpenAI (system message goes in the messages array, not a separate field)
const messages = [
  { role: 'system', content: systemPrompt },
  ...sanitizeHistory(history.openai),
  { role: 'user', content: currentQuery }
];
```

After a successful (non-aborted) response, append both turns:
```js
history.anthropic.push({ role: 'user', content: currentQuery });
history.anthropic.push({ role: 'assistant', content: fullResponseText });
```

### UI

- History is shown as a scrollable log above the query input: `[U] user message` / `[A] assistant message`, each truncated to 80 chars with `…`
- A `[CLEAR HISTORY]` button appears next to the mode toggle — wipes both arrays and clears the log
- In `[SINGLE]` mode (default), history arrays are always emptied before each call and the log is hidden

In **single-shot** mode (default), conversation arrays are always reset before each call.

---

## Max Tokens Control

A numeric input in the control bar:
- Label: `MAX TOKENS:`
- Input: `<input type="number">`, min `256`, max `4096`, step `256`, default `2048`
- Styled as a terminal input field (same aesthetic as API key fields)
- Value is read at TRANSMIT time and used in both API call bodies
- Character counter in the query textarea updates its limit to match: `[0 / {maxTokens * 4}]` (rough char estimate)

---

## Clear / Reset

A `[⟳ CLEAR]` button in the control bar:
- Wipes both response panel contents
- Resets both status badges to `IDLE`
- Clears token counts and latency displays
- Clears the query textarea
- Does NOT clear API keys, model selections, or conversation history (use `[CLEAR HISTORY]` for that)
- Aborts any active streams before clearing

---

## Response Diff Mode

A toggle button `[◈ DIFF]` appears in the control bar after both panels have completed responses.

When active:
- Performs a word-level diff between the two responses
- Words present in Claude's response but not GPT's are highlighted with a subtle green background
- Words present in GPT's response but not Claude's are highlighted with a subtle amber background
- Words present in both are unstyled
- A summary line appears above each panel: `+N unique / -N missing vs other`
- Diff is computed client-side using a simple LCS algorithm (no external lib required)
- Toggle off restores normal rendering

Diff only activates when both panels show `COMPLETE` status. Button is dimmed/disabled otherwise.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Transmit query (same as clicking `[▶ TRANSMIT]`) |
| `Escape` | Abort active streams |
| `Ctrl+L` | Clear panels (same as `[⟳ CLEAR]`) |
| `Ctrl+K` | Focus / open API key drawer |

Display a keyboard shortcut hint below the TRANSMIT button: `CTRL+ENTER TO TRANSMIT · ESC TO ABORT`

---

## Error Handling
- If API key is missing when TRANSMIT is clicked: flash the API key field border red, show `ERROR: NO KEY PROVIDED` in the relevant panel
- If model fetch fails: show `FETCH FAILED — ENTER MODEL MANUALLY` and show a text input instead of dropdown
- HTTP errors from API: display `[HTTP 429] RATE LIMITED — RETRY IN Xs` etc. in the panel
- Stream errors: catch and display in panel, do not crash other panel

---

## File Structure
```
index.html       ← markup and CDN link tags only
styles.css       ← all styling, CSS variables, animations, effects
script.js        ← all logic: API calls, streaming, state, DOM manipulation
server.js        ← local Express proxy (handles CORS, forwards API calls)
package.json     ← dependencies: express, node-fetch; start script
README.md        ← setup instructions (npm install → npm start → open localhost:3000)
```

`index.html` links both files:
```html
<link rel="stylesheet" href="styles.css">
<script src="script.js" defer></script>
```

CDN links (in `index.html` `<head>`) — use pinned versions for stability:
```html
<!-- Markdown rendering -->
<script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"></script>
<!-- Syntax highlighting -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/base16/green-screen.min.css">
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/core.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/languages/json.min.js"></script>
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=VT323&display=swap" rel="stylesheet">
```

---

## Implementation Notes for Claude Code

1. Build the boot sequence animation first, then reveal the full UI
2. Implement the API key drawer as a collapsible `<div>` with CSS `max-height` transition
3. Model fetch should fire on `blur` of each key field (not on every keystroke); target the proxy endpoints
4. Both response panels must stream independently — do not `await` one before starting the other
5. The scanline overlay must be `pointer-events: none` and `position: fixed; z-index: 9999`
6. Use CSS custom properties for all colors — never hardcode hex values in component styles
7. The structured/unstructured toggle should store state in a JS variable and re-render the schema hint field accordingly
8. Copy button should use `navigator.clipboard.writeText()` with a brief `COPIED!` feedback state (1.5s)
9. Token counts and latency should update after the stream closes (read from final API response chunk)
10. Preset prompt dropdown should be a custom `<div>`-based dropdown, not a native `<select>`, so it can be fully styled
11. Store both `AbortController` instances on a shared `controllers` object; always nullify after use
12. The `[■ ABORT]` button should replace (not sit beside) the `[▶ TRANSMIT]` button during active streams
13. Diff mode: implement a simple word-tokenized LCS diff client-side; wrap differing words in `<span class="diff-add">` / `<span class="diff-remove">`
14. Multi-turn history arrays must be keyed per provider (`history.anthropic[]`, `history.openai[]`) and never cross-contaminated
15. `server.js` must pipe the raw SSE byte stream back to the client without buffering — use `res.write()` in a stream pipeline, not `res.json()`
16. Keyboard shortcuts should be bound on `document` with `e.preventDefault()` to avoid browser conflicts
