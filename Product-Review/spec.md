# Product Review Generator — Full Build Spec

## Project Summary

Build a single-page web app that generates AI-powered product reviews using the OpenAI API. The user pastes their own OpenAI API key into the page, enters a product name, and the app generates multiple realistic, varied reviews rendered as styled cards.

A reference project lives in the `temp/Interactive-LLM/` folder of this repo. It is a working LLM comparison tool built with the same aesthetic and tech stack. Pull from it directly where noted — do not rewrite what already works. Do not modify anything inside `temp/`.

---

## File Structure

```
project/
├── index.html
├── style.css
├── script.js
└── temp/
    └── Interactive-LLM/   <- reference only, do not modify
        ├── index.html
        ├── styles.css
        └── script.js
```

No build step, no npm, no bundler. The app runs by opening `index.html` directly in a browser or serving it with a simple static server. No `server.js` or `package.json` needed.

If deploying to GitHub Pages, copy `.gitignore` and `.nojekyll` from `temp/Interactive-LLM/` into the project root.

---

## No Proxy — Direct API Calls Only

The reference project in `temp/Interactive-LLM/` routes ALL API calls through a local Express proxy server (`server.js`) at `/proxy/openai` and `/proxy/anthropic`. This was required because the Anthropic API blocks direct browser requests.

**This project does NOT use a proxy.** Do not use `server.js`, do not route through `/proxy/openai`, do not reference any local server endpoint.

OpenAI allows direct `fetch` calls from the browser. All API calls must go directly to:
```
https://api.openai.com/v1/chat/completions
```

With the `Authorization: Bearer <key>` header set directly in the fetch call. That is all that is needed.

---

## CDN Dependencies

Only load what is actually used. This project does NOT need markdown rendering, syntax highlighting, or DOMPurify — do not include those CDN scripts from the reference project.

Load in `index.html` `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=VT323&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
```

At bottom of `<body>`:
```html
<script src="script.js" defer></script>
```

That is all. No other external scripts.

---

## API Key Security

The OpenAI API key must NEVER be persisted anywhere. Do not use `localStorage`, `sessionStorage`, cookies, or any browser storage API. Store the key only in a plain JavaScript `let` variable declared at module scope:

```javascript
let apiKey = '';
```

This means the key exists only in memory for the lifetime of the tab. When the tab is closed, the key is gone. This prevents the key from being read via browser storage inspection, stolen by XSS, or accessed by other scripts.

Do NOT copy the `sessionStorage.setItem` / `sessionStorage.getItem` pattern from the reference project's key management — that approach persists the key and is explicitly avoided here.

---

## What to Reuse from `temp/Interactive-LLM/`

### From `styles.css` — copy these blocks verbatim

- **`:root` CSS variables** — exact same color tokens: `--bg-primary`, `--bg-panel`, `--bg-surface`, `--accent-green`, `--accent-amber`, `--accent-red`, `--accent-cyan`, `--text-primary`, `--text-dim`, `--border-color`, and all `--glow-*` variables

- **Global reset** — `*, *::before, *::after` and `html, body` blocks

- **Scanlines overlay** — `.scanlines` class and its `repeating-linear-gradient`

- **CRT flicker** — `@keyframes flicker` and its application on `#app`

- **Boot screen** — `#boot-screen`, `#boot-text`, `#boot-skip`, `@keyframes blink-anim`

- **`.ctrl-btn`** — button base style including hover and color variants (`.amber`, `.dim`)

- **`.ctrl-label`** — VT323 label style

- **`.terminal-select`** — styled dropdown with custom arrow SVG

- **`.terminal-input`** — base input style including `.masked`, `.error-flash`, `@keyframes shake`

- **`.eye-btn`** — show/hide toggle button

- **`.key-good` / `.key-bad`** — key status color classes

- **`.transmit-btn`** — the large bordered action button (reused for the generate button)

- **`.stream-cursor`** and `@keyframes cursor-blink`

- **`.copy-btn`** and `.copy-btn.copied`

- **Status bar** — `#status-bar`, `#status-left` (including `.transmitting` and `.error` states), `#status-right`

- **Scrollbar styles** — `::-webkit-scrollbar` block

- **`.hidden` utility**

- **`@media (max-width: 760px)`** — adapt as needed for single-column layout

### From `script.js` — copy these functions verbatim

- **`$` and `$$` DOM helpers**

- **`runBoot()`** — full boot sequence with typewriter and click-to-skip. Update `BOOT_LINES` to:
  ```javascript
  const BOOT_LINES = [
    'INITIALIZING REVIEW ENGINE...',
    'LOADING PRODUCT ANALYSIS MODULES...',
    'CONNECTING TO OPENAI API...',
    'CALIBRATING SENTIMENT MATRICES...',
    'WARMING UP GENERATION BUFFERS...',
    'SYSTEM READY.'
  ];
  ```

- **`formatApiError(msg)`** — maps HTTP status codes to terminal-style error strings

- **`setStatus(type, text)`** — updates `#status-left` with class and text

- **`flashKeyError(inputId)`** — adds `.error-flash` to an input. Remove any logic that opens an API key drawer — this app has no drawer.

- **Eye-btn toggle logic** — the `.eye-btn` click handler that toggles `.masked` on the target input

---

## What Is New (not in the reference project)

### App Container

The app is single-column and centered. Add to `style.css`:

```css
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  animation: flicker 10s infinite;
}

main {
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 16px;
  flex: 1;
}
```

### New `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>REVIEWAI</title>
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=VT323&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <div id="boot-screen">
    <div id="boot-text"></div>
    <div id="boot-skip">[ CLICK TO SKIP ]</div>
  </div>

  <div id="app" class="hidden">
    <div class="scanlines"></div>

    <header id="header">
      <div class="header-title">
        <span class="bracket">[</span>
        <span class="title-text">REVIEWAI</span>
        <span class="bracket">]</span>
      </div>
      <div class="header-tagline">> PRODUCT REVIEW GENERATOR //<span class="blink-cursor">|</span></div>
    </header>

    <main>
      <div id="config-panel">

        <div class="config-row">
          <label class="ctrl-label">> OPENAI_API_KEY</label>
          <div class="key-input-wrap">
            <input type="text" id="openai-key" class="terminal-input masked"
              placeholder="sk-..." autocomplete="off" data-lpignore="true" data-1p-ignore>
            <button class="eye-btn" data-target="openai-key">👁</button>
          </div>
          <span id="key-status" class="key-bad">[NO KEY]</span>
        </div>

        <div class="config-row">
          <label class="ctrl-label">> PRODUCT</label>
          <input type="text" id="product-input" class="terminal-input"
            placeholder="e.g. Sony WH-1000XM5 Headphones" style="width: 360px;">
        </div>

        <div class="config-row">
          <label class="ctrl-label">> MODEL</label>
          <select id="model-select" class="terminal-select">
            <option value="gpt-4o">gpt-4o</option>
            <option value="gpt-4o-mini" selected>gpt-4o-mini</option>
            <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
          </select>
        </div>

        <div class="config-row">
          <label class="ctrl-label">> COUNT</label>
          <select id="count-select" class="terminal-select">
            <option value="3">3</option>
            <option value="5" selected>5</option>
            <option value="8">8</option>
          </select>
        </div>

        <button id="generate-btn" class="transmit-btn">▶ GENERATE REVIEWS</button>
      </div>

      <div id="gen-status"></div>
      <section id="results"></section>
    </main>

    <footer id="status-bar">
      <span id="status-left">REVIEW ENGINE READY</span>
      <span id="status-right">MODEL: gpt-4o-mini | COUNT: 5</span>
    </footer>
  </div>

  <script src="script.js" defer></script>
</body>
</html>
```

### New CSS (add to `style.css`)

```css
/* Header */
#header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-panel);
}

.header-title {
  font-family: 'VT323', monospace;
  font-size: 30px;
  letter-spacing: 0.15em;
  color: var(--accent-green);
  text-shadow: var(--glow-green);
}

.bracket    { color: var(--accent-amber); }
.title-text { color: var(--accent-green); }

.header-tagline {
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 0.12em;
  margin-top: 2px;
}

.blink-cursor {
  animation: blink-anim 1.2s step-end infinite;
  color: var(--accent-green);
}

/* Config Panel */
#config-panel {
  margin-bottom: 24px;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

/* Gen Status Line */
#gen-status {
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  min-height: 20px;
  margin-bottom: 16px;
  letter-spacing: 0.05em;
}

#gen-status.status-loading { color: var(--accent-amber); }
#gen-status.status-success { color: var(--accent-green); }
#gen-status.status-error   { color: var(--accent-red);   }

/* Review Cards */
.review-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-left: 3px solid;
  padding: 20px 24px;
  margin-bottom: 12px;
  border-radius: 2px;
  animation: cardIn 0.3s ease forwards;
  opacity: 0;
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.card-stars .filled { color: #f5c518; }
.card-stars .empty  { color: #333333; }

.card-badge {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  color: var(--accent-green);
  border: 1px solid #00e67660;
  padding: 1px 6px;
}

.card-date {
  font-size: 11px;
  color: var(--text-dim);
  margin-left: auto;
}

.card-title {
  font-size: 15px;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: 0.03em;
}

.card-body {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.65;
  margin-bottom: 12px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--text-dim);
  border-top: 1px solid var(--border-color);
  padding-top: 8px;
}
```

**Left border color by rating** — set via `card.style.borderLeftColor` in JS:

| Rating | Color |
|---|---|
| 5 | `#00e676` |
| 4 | `#69f0ae` |
| 3 | `#ffd740` |
| 2 | `#ff6d00` |
| 1 | `#ff4444` |

### New `script.js`

#### Module-level state

```javascript
'use strict';

// API key lives in memory only — never written to any browser storage
let apiKey = '';
```

#### `callOpenAI(model, systemPrompt, userPrompt)`

```javascript
async function callOpenAI(model, systemPrompt, userPrompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}
```

#### `buildPrompts(product, count)`

```javascript
function buildPrompts(product, count) {
  const system = `You are a product review generator. Generate realistic, human-sounding customer reviews that vary in rating, length, tone, and vocabulary. Include a natural distribution of ratings — not all positive. Avoid marketing language. Sound like real people writing on Amazon or Best Buy.

Respond with ONLY a valid JSON array. No markdown, no code blocks, no explanation.`;

  const user = `Generate ${count} customer reviews for: ${product}

Each review must be a JSON object with these exact fields:
- "reviewer": string (realistic fake full name)
- "rating": integer 1–5
- "title": string (short review headline, max 10 words)
- "body": string (2–4 sentences, honest review)
- "verified": boolean
- "date": string (realistic past date within 2 years, format: "Month DD, YYYY")
- "helpful": integer (0–50)

Return only the JSON array. No other text.`;

  return { system, user };
}
```

#### `generateReviews()`

```javascript
async function generateReviews() {
  const product = $('product-input').value.trim();
  const model   = $('model-select').value;
  const count   = parseInt($('count-select').value);

  if (!apiKey) {
    flashKeyError('openai-key');
    setGenStatus('error', 'ERR: api key required');
    return;
  }
  if (!product) {
    $('product-input').classList.add('error-flash');
    setTimeout(() => $('product-input').classList.remove('error-flash'), 2000);
    setGenStatus('error', 'ERR: product name required');
    return;
  }

  const btn = $('generate-btn');
  btn.disabled    = true;
  btn.textContent = '[ GENERATING... ]';
  setGenStatus('loading', `> generating ${count} reviews for "${product}"... ▌`);
  setStatus('transmitting', 'GENERATING...');
  $('results').innerHTML = '';

  try {
    const { system, user } = buildPrompts(product, count);
    const raw = await callOpenAI(model, system, user);

    let reviews;
    try {
      reviews = JSON.parse(raw);
    } catch {
      console.error('Raw response:', raw);
      throw new Error('PARSE_FAIL');
    }

    renderReviews(reviews);
    setGenStatus('success', `> ${reviews.length} reviews generated`);
    setStatus('ready', 'REVIEW ENGINE READY');
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    const msg = err.message === 'PARSE_FAIL'
      ? 'ERR: failed to parse response — check console'
      : `ERR: ${formatApiError(err.message)}`;
    setGenStatus('error', msg);
    setStatus('error', 'ERROR');
  } finally {
    btn.disabled    = false;
    btn.textContent = '▶ GENERATE REVIEWS';
  }
}
```

#### `renderReviews` / `renderCard` / helpers

```javascript
const BORDER_COLORS = { 5: '#00e676', 4: '#69f0ae', 3: '#ffd740', 2: '#ff6d00', 1: '#ff4444' };

function renderReviews(reviews) {
  const section = $('results');
  section.innerHTML = '';
  reviews.forEach((review, i) => section.appendChild(renderCard(review, i)));
}

function renderCard(review, index) {
  const card = document.createElement('div');
  card.className = 'review-card';
  card.style.borderLeftColor = BORDER_COLORS[review.rating] || '#555';
  card.style.animationDelay  = `${index * 0.08}s`;

  card.innerHTML = `
    <div class="card-header">
      ${buildStars(review.rating)}
      ${review.verified ? '<span class="card-badge">[verified purchase]</span>' : ''}
      <span class="card-date">${escHtml(review.date)}</span>
    </div>
    <div class="card-title">${escHtml(review.title)}</div>
    <div class="card-body">${escHtml(review.body)}</div>
    <div class="card-footer">
      <span>— ${escHtml(review.reviewer)}</span>
      <span>[helpful: ${review.helpful}]</span>
    </div>
  `;

  return card;
}

function buildStars(rating) {
  let html = '<div class="card-stars">';
  for (let i = 1; i <= 5; i++) {
    html += i <= rating
      ? '<span class="filled">★</span>'
      : '<span class="empty">☆</span>';
  }
  return html + '</div>';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

#### `setGenStatus` / `updateStatusRight`

```javascript
function setGenStatus(type, message) {
  const el = $('gen-status');
  el.textContent = message;
  el.className   = type ? `status-${type}` : '';
}

function updateStatusRight() {
  const model = $('model-select').value;
  const count = $('count-select').value;
  $('status-right').textContent = `MODEL: ${model} | COUNT: ${count}`;
}
```

#### `initKey()`

```javascript
function initKey() {
  const input = $('openai-key');

  input.addEventListener('blur', () => {
    apiKey = input.value.trim(); // in-memory only, never stored anywhere
    const statusEl = $('key-status');
    if (apiKey) {
      statusEl.textContent = '[KEY SET ✓]';
      statusEl.className   = 'key-good';
    } else {
      statusEl.textContent = '[NO KEY]';
      statusEl.className   = 'key-bad';
    }
  });

  $$('.eye-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = $(btn.dataset.target);
      inp.classList.toggle('masked');
    });
  });
}
```

#### `init()`

```javascript
function initGenerate() {
  $('generate-btn').addEventListener('click', generateReviews);
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      generateReviews();
    }
  });
  $('model-select').addEventListener('change', updateStatusRight);
  $('count-select').addEventListener('change', updateStatusRight);
}

function init() {
  initKey();
  initGenerate();
  updateStatusRight();
}

document.addEventListener('DOMContentLoaded', () => {
  runBoot();
  init();
});
```

---

## Error Handling Reference

| Scenario | Message shown |
|---|---|
| No API key | `ERR: api key required` |
| No product | `ERR: product name required` |
| HTTP 401 | `ERR: invalid api key` |
| HTTP 429 | `ERR: rate limit exceeded` |
| Other HTTP error | `ERR: openai error {status}` |
| JSON parse fail | `ERR: failed to parse response — check console` |
| Network failure | `ERR: network error — check connection` |

---

## Stretch Features (optional)

1. **Copy All** — `[ ⎘ COPY ALL ]` button (`.copy-btn` style) appears after generation. Copies all reviews as plain text to clipboard.
2. **Regenerate Single** — small `[↺]` button in each card footer. Re-calls the API for just that one review and swaps the card in place.
3. **Tone Selector** — `> TONE` config row with options `Balanced` / `Mostly Positive` / `Critical` / `Detailed`. Injects tone bias into the system prompt.
4. **Clear** — `[ ⟳ CLEAR ]` button (`.ctrl-btn.amber` style) that wipes `#results` and resets status.
5. **Sentiment Sliders** — a `> SENTIMENT` config section with two or three range sliders that give the user fine-grained control over the review distribution. Suggested sliders:

   - **Positivity** `[0 ──────●────── 100]` — controls the average rating skew. Low = more 1–2 star reviews, high = more 4–5 star reviews. Default: 50 (balanced).
   - **Variance** `[0 ──────●────── 100]` — controls how spread out the ratings are. Low = all reviews cluster around the average, high = wide spread from 1 to 5. Default: 70.
   - **Detail Level** `[0 ──────●────── 100]` — controls review body length and specificity. Low = short and vague, high = long and detailed with specific product observations. Default: 50.
   - **Price Sentiment** `[0 ──────●────── 100]` — controls how reviewers feel about value for money. Low = reviewers think it's overpriced, high = reviewers think it's great value. Default: 50.
   - **Feature Satisfaction** `[0 ──────●────── 100]` — controls how satisfied reviewers are with the product's features and capabilities. Low = reviewers find it lacking or missing key features, high = reviewers are impressed by the feature set. Default: 50.
   - **Usability** `[0 ──────●────── 100]` — controls how easy reviewers find the product to use. Low = reviewers mention a steep learning curve, poor UX, or confusing setup, high = reviewers praise ease of use and intuitive design. Default: 50.

   Display current value next to each slider in terminal style: `[72]`

   Inject slider values into the user prompt as additional instructions, e.g.:
   ```
   Sentiment parameters (each 0–100):
   - positivity={value} (overall rating skew)
   - variance={value} (rating spread)
   - detail={value} (review length and specificity)
   - price_sentiment={value} (perceived value for money)
   - feature_satisfaction={value} (satisfaction with features)
   - usability={value} (ease of use)
   Use these to shape the tone, distribution, and focus areas of the reviews accordingly.
   ```

   Style sliders to match the terminal aesthetic — use the accent green for the thumb and track fill, dark background for the track. Override default browser range input styles in CSS.
