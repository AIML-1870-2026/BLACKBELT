# Science Experiment Generator — Full Build Spec

## Project Summary

Build a single-page web app that generates grade-appropriate science experiments using the OpenAI API. The user selects a grade band, enters available supplies, and the app first generates a few experiment options to choose from. Once the user selects one, the app expands it into a full detailed experiment plan.

A reference project lives in the `temp/` folder of this repo (the product review generator). It is a working app built with the same aesthetic, API pattern, and tech stack. Pull from it directly where noted — do not rewrite what already works. Do not modify anything inside `temp/`.

---

## File Structure

```
project/
├── index.html
├── style.css
├── script.js
└── temp/
    └── product-review-generator/   <- reference only, do not modify
        ├── index.html
        ├── style.css
        └── script.js
```

No build step, no npm, no bundler, no server. The app runs by opening `index.html` directly in a browser. No proxy needed — OpenAI allows direct browser fetch calls.

If deploying to GitHub Pages, copy `.gitignore` and `.nojekyll` from the reference project into the project root.

---

## No Proxy — Direct API Calls Only

The reference project calls `https://api.openai.com/v1/chat/completions` directly from the browser. This project does the same. Do not use any proxy, local server, or `/proxy/*` endpoint. OpenAI does not require one.

---

## CDN Dependencies

Load in `index.html` `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=VT323&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
```

At bottom of `<body>`:
```html
<script src="script.js" defer></script>
```

No other external scripts. Do not include markdown renderers, syntax highlighters, or DOMPurify.

---

## API Key Security

Store the key only in a plain JS `let` variable. Never use `localStorage`, `sessionStorage`, cookies, or any browser storage. The key lives in memory only for the lifetime of the tab.

```javascript
let apiKey = '';
```

---

## What to Reuse from `temp/product-review-generator/`

### From `style.css` — copy verbatim

- `:root` CSS variables (all color tokens and glow values)
- Global reset (`*, *::before, *::after` and `html, body`)
- Scanlines overlay (`.scanlines`)
- CRT flicker (`@keyframes flicker` and `#app` application)
- Boot screen (`#boot-screen`, `#boot-text`, `#boot-skip`, `@keyframes blink-anim`)
- `.ctrl-btn` and color variants (`.amber`, `.dim`)
- `.ctrl-label`
- `.terminal-select`
- `.terminal-input` including `.masked`, `.error-flash`, `@keyframes shake`
- `.eye-btn`
- `.key-good` / `.key-bad`
- `.transmit-btn`
- `.stream-cursor` and `@keyframes cursor-blink`
- `.copy-btn` and `.copy-btn.copied`
- `#status-bar`, `#status-left` (with `.transmitting`, `.error`), `#status-right`
- Scrollbar styles
- `.hidden` utility
- `@media (max-width: 760px)` — adapt for single-column layout

### From `script.js` — copy verbatim

- `$` and `$$` DOM helpers
- `runBoot()` — update `BOOT_LINES` to:
  ```javascript
  const BOOT_LINES = [
    'INITIALIZING EXPERIMENT ENGINE...',
    'LOADING CURRICULUM MODULES...',
    'CONNECTING TO OPENAI API...',
    'CALIBRATING GRADE MATRICES...',
    'WARMING UP HYPOTHESIS BUFFERS...',
    'SYSTEM READY.'
  ];
  ```
- `formatApiError(msg)`
- `setStatus(type, text)`
- `flashKeyError(inputId)` — remove any drawer-opening logic, this app has no drawer
- Eye-btn toggle logic (`.eye-btn` click handler toggling `.masked`)
- `callOpenAI(model, systemPrompt, userPrompt)` — direct fetch to `https://api.openai.com/v1/chat/completions`, no proxy
- `setGenStatus(type, message)`
- `updateStatusRight()`
- `escHtml(str)`
- `initKey()`

---

## Two-Phase Generation Flow

This app has two distinct generation phases:

### Phase 1 — Generate Options
User fills in grade band, supplies, and optional subject filter, then clicks `[ GENERATE OPTIONS ]`. The app calls the API and returns 3–4 short experiment concepts. Each option card shows a title, one-sentence description, and the core concept being explored. The user clicks one to proceed.

### Phase 2 — Expand Selected Experiment
When the user clicks an option card, the app calls the API again with the selected experiment title and the same grade/supplies context. It returns a full detailed experiment plan. This replaces the options view with a single detailed result card.

A `[ ← BACK ]` button lets the user return to the options view without re-calling the API (cache the options in a JS variable).

---

## What Is New

### App Container

Single-column, centered — same pattern as the reference:

```css
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  animation: flicker 10s infinite;
}

main {
  max-width: 900px;
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
  <title>LABGEN</title>
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
        <span class="title-text">LABGEN</span>
        <span class="bracket">]</span>
      </div>
      <div class="header-tagline">> K-12 SCIENCE EXPERIMENT GENERATOR //<span class="blink-cursor">|</span></div>
    </header>

    <main>

      <!-- Config Panel -->
      <div id="config-panel">

        <!-- API Key -->
        <div class="config-row">
          <label class="ctrl-label">> OPENAI_API_KEY</label>
          <div class="key-input-wrap">
            <input type="text" id="openai-key" class="terminal-input masked"
              placeholder="sk-..." autocomplete="off" data-lpignore="true" data-1p-ignore>
            <button class="eye-btn" data-target="openai-key">👁</button>
          </div>
          <span id="key-status" class="key-bad">[NO KEY]</span>
        </div>

        <!-- Grade Band -->
        <div class="config-row">
          <label class="ctrl-label">> GRADE BAND</label>
          <div class="grade-band-group">
            <button class="grade-btn active" data-band="K-2">K–2</button>
            <button class="grade-btn" data-band="3-5">3–5</button>
            <button class="grade-btn" data-band="6-8">6–8</button>
            <button class="grade-btn" data-band="9-12">9–12</button>
          </div>
        </div>

        <!-- Subject Filter (optional) -->
        <div class="config-row">
          <label class="ctrl-label">> SUBJECT</label>
          <select id="subject-select" class="terminal-select">
            <option value="any">Any</option>
            <option value="biology">Biology</option>
            <option value="chemistry">Chemistry</option>
            <option value="physics">Physics</option>
            <option value="earth science">Earth Science</option>
            <option value="environmental science">Environmental Science</option>
          </select>
        </div>

        <!-- Available Supplies -->
        <div class="config-row supplies-row">
          <label class="ctrl-label">> AVAILABLE SUPPLIES</label>
          <textarea id="supplies-input" class="terminal-input supplies-textarea"
            placeholder="e.g. baking soda, vinegar, food coloring, plastic cups, measuring tape..."></textarea>
        </div>

        <!-- Model -->
        <div class="config-row">
          <label class="ctrl-label">> MODEL</label>
          <select id="model-select" class="terminal-select">
            <option value="gpt-4o">gpt-4o</option>
            <option value="gpt-4o-mini" selected>gpt-4o-mini</option>
            <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
          </select>
        </div>

        <!-- Generate Button -->
        <button id="generate-btn" class="transmit-btn">▶ GENERATE OPTIONS</button>
      </div>

      <!-- Status Line -->
      <div id="gen-status"></div>

      <!-- Phase 1: Options -->
      <section id="options-section" class="hidden"></section>

      <!-- Phase 2: Expanded Experiment -->
      <section id="experiment-section" class="hidden">
        <button id="back-btn" class="ctrl-btn">&lt; BACK TO OPTIONS</button>
        <div id="experiment-card"></div>
      </section>

    </main>

    <footer id="status-bar">
      <span id="status-left">EXPERIMENT ENGINE READY</span>
      <span id="status-right">BAND: K-2 | MODEL: gpt-4o-mini</span>
    </footer>
  </div>

  <script src="script.js" defer></script>
</body>
</html>
```

---

### New CSS

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
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

/* Grade Band Toggle */
.grade-band-group {
  display: flex;
  gap: 0;
}

.grade-btn {
  font-family: 'VT323', monospace;
  font-size: 16px;
  letter-spacing: 0.08em;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-dim);
  padding: 3px 14px;
  cursor: pointer;
  margin-left: -1px;
  transition: all 0.2s;
}

.grade-btn:first-child { margin-left: 0; }

.grade-btn.active {
  background: rgba(0,255,136,0.06);
  color: var(--accent-green);
  border-color: var(--accent-green);
  box-shadow: var(--glow-green);
  z-index: 1;
  position: relative;
}

.grade-btn:hover { color: var(--accent-green); }

/* Supplies Textarea */
.supplies-row { align-items: flex-start; }

.supplies-textarea {
  width: 420px;
  height: 72px;
  resize: vertical;
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
}

/* Gen Status */
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

/* Option Cards (Phase 1) */
#options-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.option-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--accent-green);
  padding: 16px 20px;
  border-radius: 2px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  animation: cardIn 0.3s ease forwards;
  opacity: 0;
}

.option-card:hover {
  border-color: var(--accent-green);
  box-shadow: var(--glow-green);
  background: rgba(0,255,136,0.03);
}

.option-number {
  font-family: 'VT323', monospace;
  font-size: 13px;
  color: var(--accent-amber);
  margin-bottom: 4px;
  letter-spacing: 0.08em;
}

.option-title {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: 0.03em;
}

.option-concept {
  font-size: 12px;
  color: var(--accent-cyan);
  margin-bottom: 6px;
  letter-spacing: 0.04em;
}

.option-desc {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.55;
}

.option-select-hint {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 10px;
  letter-spacing: 0.05em;
}

/* Experiment Card (Phase 2) */
#back-btn {
  margin-bottom: 16px;
}

.experiment-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--accent-green);
  border-radius: 2px;
  overflow: hidden;
  animation: cardIn 0.3s ease forwards;
  opacity: 0;
}

.exp-header {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  padding: 16px 24px;
}

.exp-grade-badge {
  font-family: 'VT323', monospace;
  font-size: 13px;
  color: var(--accent-amber);
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}

.exp-title {
  font-family: 'VT323', monospace;
  font-size: 26px;
  color: var(--accent-green);
  text-shadow: var(--glow-green);
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}

.exp-concept {
  font-size: 12px;
  color: var(--accent-cyan);
  letter-spacing: 0.04em;
}

.exp-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.exp-section {
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 16px;
}

.exp-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.exp-section-label {
  font-family: 'VT323', monospace;
  font-size: 16px;
  color: var(--accent-amber);
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}

.exp-section-content {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.7;
}

.exp-section-content ol,
.exp-section-content ul {
  padding-left: 20px;
  margin: 0;
}

.exp-section-content li {
  margin-bottom: 4px;
}

.exp-section-content .safety-item {
  color: var(--accent-red);
}

.exp-section-content .discussion-item {
  color: var(--text-primary);
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

### New `script.js`

#### Module-level state

```javascript
'use strict';

let apiKey      = '';       // in-memory only, never stored anywhere
let selectedBand = 'K-2';  // active grade band
let cachedOptions = null;   // cache Phase 1 results so back button doesn't re-call API
```

#### `buildOptionsPrompts(band, subject, supplies)`

```javascript
function buildOptionsPrompts(band, subject, supplies) {
  const subjectLine = subject === 'any' ? '' : ` focused on ${subject}`;
  const suppliesLine = supplies.trim()
    ? `The student has access to these supplies: ${supplies.trim()}.`
    : 'Assume only basic household or classroom supplies are available.';

  const system = `You are a science curriculum expert. Generate age-appropriate science experiment ideas for K-12 students. Experiments must be safe, engaging, and achievable in a typical classroom or at home. Use grade-appropriate vocabulary and complexity.

Respond with ONLY a valid JSON array. No markdown, no code blocks, no explanation.`;

  const user = `Generate 4 science experiment options${subjectLine} for grade band ${band} students.
${suppliesLine}

Each option must be a JSON object with these exact fields:
- "title": string (short experiment name)
- "concept": string (the core science concept being explored, e.g. "Acid-base reactions")
- "description": string (one sentence describing what the student will do and observe)
- "difficulty": string ("Easy", "Medium", or "Challenging" — relative to the grade band)

Return only the JSON array. No other text.`;

  return { system, user };
}
```

#### `buildExpandPrompts(band, subject, supplies, experimentTitle)`

```javascript
function buildExpandPrompts(band, subject, supplies, experimentTitle) {
  const suppliesLine = supplies.trim()
    ? `Available supplies: ${supplies.trim()}.`
    : 'Assume basic household or classroom supplies.';

  const system = `You are a science curriculum expert. Write detailed, age-appropriate science experiment plans for K-12 students. Use vocabulary and complexity appropriate for the specified grade band. Experiments must be safe, clearly explained, and engaging.

Respond with ONLY a valid JSON object. No markdown, no code blocks, no explanation.`;

  const user = `Write a full science experiment plan for the following:

Experiment: "${experimentTitle}"
Grade band: ${band}
${suppliesLine}

Return a JSON object with these exact fields:
- "title": string
- "concept": string (core science concept)
- "grade_band": string
- "hypothesis": string (a clear, testable hypothesis written at grade level)
- "materials": array of strings (specific items needed)
- "steps": array of strings (numbered procedure steps, clear and detailed)
- "expected_results": string (what should happen and why, explained at grade level)
- "safety_notes": array of strings (safety considerations — return empty array if none)
- "discussion_questions": array of strings (3–5 questions to prompt reflection)

Return only the JSON object. No other text.`;

  return { system, user };
}
```

#### `generateOptions()`

```javascript
async function generateOptions() {
  const supplies = $('supplies-input').value.trim();
  const subject  = $('subject-select').value;
  const model    = $('model-select').value;

  if (!apiKey) {
    flashKeyError('openai-key');
    setGenStatus('error', 'ERR: api key required');
    return;
  }

  cachedOptions = null;
  $('options-section').classList.add('hidden');
  $('options-section').innerHTML = '';
  $('experiment-section').classList.add('hidden');

  const btn = $('generate-btn');
  btn.disabled    = true;
  btn.textContent = '[ GENERATING... ]';
  setGenStatus('loading', `> generating experiment options for grade ${selectedBand}... ▌`);
  setStatus('transmitting', 'GENERATING...');

  try {
    const { system, user } = buildOptionsPrompts(selectedBand, subject, supplies);
    const raw = await callOpenAI(model, system, user);

    let options;
    try {
      options = JSON.parse(raw);
    } catch {
      console.error('Raw response:', raw);
      throw new Error('PARSE_FAIL');
    }

    cachedOptions = options;
    renderOptions(options, supplies, subject, model);
    setGenStatus('success', `> ${options.length} experiments generated — select one to expand`);
    setStatus('ready', 'EXPERIMENT ENGINE READY');
    $('options-section').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    const msg = err.message === 'PARSE_FAIL'
      ? 'ERR: failed to parse response — check console'
      : `ERR: ${formatApiError(err.message)}`;
    setGenStatus('error', msg);
    setStatus('error', 'ERROR');
  } finally {
    btn.disabled    = false;
    btn.textContent = '▶ GENERATE OPTIONS';
  }
}
```

#### `renderOptions(options, supplies, subject, model)`

```javascript
function renderOptions(options, supplies, subject, model) {
  const section = $('options-section');
  section.innerHTML = '';
  section.classList.remove('hidden');

  options.forEach((opt, i) => {
    const card = document.createElement('div');
    card.className = 'option-card';
    card.style.animationDelay = `${i * 0.08}s`;

    card.innerHTML = `
      <div class="option-number">// OPTION ${String(i + 1).padStart(2, '0')}</div>
      <div class="option-title">${escHtml(opt.title)}</div>
      <div class="option-concept">[ ${escHtml(opt.concept)} ]</div>
      <div class="option-desc">${escHtml(opt.description)}</div>
      <div class="option-select-hint">> click to expand</div>
    `;

    card.addEventListener('click', () => expandExperiment(opt.title, supplies, subject, model));
    section.appendChild(card);
  });
}
```

#### `expandExperiment(title, supplies, subject, model)`

```javascript
async function expandExperiment(title, supplies, subject, model) {
  $('options-section').classList.add('hidden');
  $('experiment-section').classList.remove('hidden');
  $('experiment-card').innerHTML = '';

  setGenStatus('loading', `> loading full experiment: "${title}"... ▌`);
  setStatus('transmitting', 'LOADING...');

  try {
    const { system, user } = buildExpandPrompts(selectedBand, subject, supplies, title);
    const raw = await callOpenAI(model, system, user);

    let exp;
    try {
      exp = JSON.parse(raw);
    } catch {
      console.error('Raw response:', raw);
      throw new Error('PARSE_FAIL');
    }

    renderExperiment(exp);
    setGenStatus('success', `> experiment loaded`);
    setStatus('ready', 'EXPERIMENT ENGINE READY');
    $('experiment-section').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    const msg = err.message === 'PARSE_FAIL'
      ? 'ERR: failed to parse response — check console'
      : `ERR: ${formatApiError(err.message)}`;
    setGenStatus('error', msg);
    setStatus('error', 'ERROR');
  }
}
```

#### `renderExperiment(exp)`

```javascript
function renderExperiment(exp) {
  const container = $('experiment-card');

  const safetyHtml = exp.safety_notes.length
    ? `<ul>${exp.safety_notes.map(n => `<li class="safety-item">${escHtml(n)}</li>`).join('')}</ul>`
    : '<span style="color:var(--accent-green)">No special safety precautions required.</span>';

  container.innerHTML = `
    <div class="experiment-card">
      <div class="exp-header">
        <div class="exp-grade-badge">// GRADE BAND: ${escHtml(exp.grade_band)}</div>
        <div class="exp-title">${escHtml(exp.title)}</div>
        <div class="exp-concept">[ ${escHtml(exp.concept)} ]</div>
      </div>
      <div class="exp-body">

        <div class="exp-section">
          <div class="exp-section-label">> HYPOTHESIS</div>
          <div class="exp-section-content">${escHtml(exp.hypothesis)}</div>
        </div>

        <div class="exp-section">
          <div class="exp-section-label">> MATERIALS</div>
          <div class="exp-section-content">
            <ul>${exp.materials.map(m => `<li>${escHtml(m)}</li>`).join('')}</ul>
          </div>
        </div>

        <div class="exp-section">
          <div class="exp-section-label">> PROCEDURE</div>
          <div class="exp-section-content">
            <ol>${exp.steps.map(s => `<li>${escHtml(s)}</li>`).join('')}</ol>
          </div>
        </div>

        <div class="exp-section">
          <div class="exp-section-label">> EXPECTED RESULTS</div>
          <div class="exp-section-content">${escHtml(exp.expected_results)}</div>
        </div>

        <div class="exp-section">
          <div class="exp-section-label">> SAFETY NOTES</div>
          <div class="exp-section-content">${safetyHtml}</div>
        </div>

        <div class="exp-section">
          <div class="exp-section-label">> DISCUSSION QUESTIONS</div>
          <div class="exp-section-content">
            <ol>${exp.discussion_questions.map(q => `<li class="discussion-item">${escHtml(q)}</li>`).join('')}</ol>
          </div>
        </div>

      </div>
    </div>
  `;
}
```

#### `initGradeBand()`

```javascript
function initGradeBand() {
  $$('.grade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.grade-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedBand = btn.dataset.band;
      updateStatusRight();
    });
  });
}
```

#### `updateStatusRight()`

```javascript
function updateStatusRight() {
  const model = $('model-select').value;
  $('status-right').textContent = `BAND: ${selectedBand} | MODEL: ${model}`;
}
```

#### `init()`

```javascript
function initGenerate() {
  $('generate-btn').addEventListener('click', generateOptions);

  $('back-btn').addEventListener('click', () => {
    $('experiment-section').classList.add('hidden');
    $('options-section').classList.remove('hidden');
    setGenStatus('', '');
  });

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      generateOptions();
    }
  });

  $('model-select').addEventListener('change', updateStatusRight);
}

function init() {
  initKey();
  initGradeBand();
  initGenerate();
  updateStatusRight();
}

document.addEventListener('DOMContentLoaded', () => {
  runBoot();
  init();
});
```

---

## Error Handling

| Scenario | Message |
|---|---|
| No API key | `ERR: api key required` |
| No supplies entered | Allowed — prompt falls back to basic supplies |
| HTTP 401 | `ERR: invalid api key` |
| HTTP 429 | `ERR: rate limit exceeded` |
| Other HTTP | `ERR: openai error {status}` |
| JSON parse fail | `ERR: failed to parse response — check console` |
| Network failure | `ERR: network error — check connection` |

---

## Status Bar

- `#status-left`: `EXPERIMENT ENGINE READY` (idle) / `GENERATING...` (loading) / `LOADING...` (expanding) / `ERROR` (error)
- `#status-right`: `BAND: K-2 | MODEL: gpt-4o-mini` — updates on grade band or model change

---

## Stretch Features (optional)

1. **Download Experiment** — `[ ⬇ DOWNLOAD ]` button on the expanded experiment card. Generates a plain `.txt` file of the full experiment and triggers a browser download using a temporary `<a>` element with a `blob:` URL. Filename should be slugified from the experiment title e.g. `volcano-reaction-experiment.txt`. No libraries needed — use `URL.createObjectURL(new Blob([text], { type: 'text/plain' }))`.

2. **Substitute Suggestions** — a `[ ↔ SUGGEST SUBSTITUTES ]` button on the expanded experiment card. When clicked, makes a third API call passing the materials list and the user's available supplies, and asks the model to suggest realistic substitutions for any materials the user may not have. Returns a JSON array of objects with `"original"` and `"substitute"` fields. Render results as a small table below the materials section with terminal styling — two columns labeled `MATERIAL` and `SUBSTITUTE`. If all materials are likely available given the supplies provided, the model should say so.

3. **Difficulty Ratings** — display the `"difficulty"` field from Phase 1 on each option card as a colored badge:
   - `Easy` → `var(--accent-green)` with green border
   - `Medium` → `var(--accent-amber)` with amber border
   - `Challenging` → `var(--accent-red)` with red border

   Also include difficulty in the expanded experiment header (pulled from the Phase 2 JSON — add `"difficulty"` to the expand prompt schema). Display as `// DIFFICULTY: MEDIUM` in the same style as the grade band badge.

4. **Regenerate Options** — `[ ↺ NEW OPTIONS ]` button that re-calls Phase 1 without clearing the form.

5. **Time Estimate** — add `"duration_minutes"` to the expand prompt schema (e.g. `30`, `45`, `60`) and display in the experiment header as `// EST. TIME: 45 MIN`.

6. **Copy Experiment** — `[ ⎘ COPY ]` button (`.copy-btn` style) on the expanded card. Copies the full experiment as plain text to clipboard.
