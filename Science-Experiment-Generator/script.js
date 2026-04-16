'use strict';

// ═══════════════════════════════════════════════════════════════
// MODULE-LEVEL STATE
// ═══════════════════════════════════════════════════════════════
let apiKey       = '';       // in-memory only, never stored anywhere
let selectedBand = 'K-2';   // active grade band
let cachedOptions = null;   // cache Phase 1 results so back button doesn't re-call API

// ═══════════════════════════════════════════════════════════════
// DOM HELPERS (from reference)
// ═══════════════════════════════════════════════════════════════
const $  = (id)  => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ═══════════════════════════════════════════════════════════════
// BOOT SEQUENCE (from reference, updated lines)
// ═══════════════════════════════════════════════════════════════
const BOOT_LINES = [
  'INITIALIZING EXPERIMENT ENGINE...',
  'LOADING CURRICULUM MODULES...',
  'CONNECTING TO OPENAI API...',
  'CALIBRATING GRADE MATRICES...',
  'WARMING UP HYPOTHESIS BUFFERS...',
  'SYSTEM READY.'
];

function runBoot() {
  const bootText   = $('boot-text');
  const bootScreen = $('boot-screen');
  let done = false;

  function reveal() {
    if (done) return;
    done = true;
    bootScreen.style.transition = 'opacity 0.45s ease';
    bootScreen.style.opacity    = '0';
    setTimeout(() => { bootScreen.style.display = 'none'; }, 450);
    $('app').classList.remove('hidden');
  }

  bootScreen.addEventListener('click', reveal);

  let lineIdx = 0, charIdx = 0, accumulated = '';

  function typeNext() {
    if (done) return;
    if (lineIdx >= BOOT_LINES.length) { setTimeout(reveal, 600); return; }

    const line = BOOT_LINES[lineIdx];
    if (charIdx < line.length) {
      accumulated += line[charIdx++];
      bootText.textContent = accumulated + '█';
      setTimeout(typeNext, 28 + Math.random() * 28);
    } else {
      accumulated += '\n';
      bootText.textContent = accumulated;
      lineIdx++; charIdx = 0;
      setTimeout(typeNext, 220);
    }
  }

  typeNext();
}

// ═══════════════════════════════════════════════════════════════
// STATUS HELPERS (from reference)
// ═══════════════════════════════════════════════════════════════
function setStatus(type, text) {
  const el = $('status-left');
  el.textContent = text;
  el.className   = type;
}

function flashKeyError(inputId) {
  const el = $(inputId);
  el.classList.add('error-flash');
  setTimeout(() => el.classList.remove('error-flash'), 2000);
}

// ═══════════════════════════════════════════════════════════════
// API ERROR FORMATTER (from reference)
// ═══════════════════════════════════════════════════════════════
function formatApiError(msg) {
  if (msg.includes('401')) return 'invalid api key';
  if (msg.includes('429')) return 'rate limit exceeded';
  if (msg.includes('network') || msg.includes('fetch'))
                             return 'network error — check connection';
  return `openai error — ${msg}`;
}

// ═══════════════════════════════════════════════════════════════
// KEY MANAGEMENT (from reference, no drawer logic)
// ═══════════════════════════════════════════════════════════════
function initKey() {
  const input = $('openai-key');

  input.addEventListener('blur', () => {
    apiKey = input.value.trim();
    const statusEl = $('key-status');
    if (apiKey) {
      statusEl.textContent = '[KEY SET ✓]';
      statusEl.className   = 'key-good';
    } else {
      statusEl.textContent = '[NO KEY]';
      statusEl.className   = 'key-bad';
    }
  });

  // Eye-btn toggle (from reference)
  $$('.eye-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = $(btn.dataset.target);
      inp.classList.toggle('masked');
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// OPENAI API CALL — direct, no proxy (from reference)
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// GEN STATUS / STATUS RIGHT (from reference)
// ═══════════════════════════════════════════════════════════════
function setGenStatus(type, message) {
  const el = $('gen-status');
  el.textContent = message;
  el.className   = type ? `status-${type}` : '';
}

function updateStatusRight() {
  const model = $('model-select').value;
  $('status-right').textContent = `BAND: ${selectedBand} | MODEL: ${model}`;
}

// ═══════════════════════════════════════════════════════════════
// HTML ESCAPE (from reference)
// ═══════════════════════════════════════════════════════════════
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════════════
// PROMPT BUILDERS
// ═══════════════════════════════════════════════════════════════
function buildOptionsPrompts(band, subject, supplies) {
  const subjectLine  = subject === 'any' ? '' : ` focused on ${subject}`;
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
- "difficulty": string ("Easy", "Medium", or "Challenging" — relative to the grade band)
- "duration_minutes": integer (estimated minutes to complete, e.g. 30, 45, 60)
- "hypothesis": string (a clear, testable hypothesis written at grade level)
- "materials": array of strings (specific items needed)
- "steps": array of strings (numbered procedure steps, clear and detailed)
- "expected_results": string (what should happen and why, explained at grade level)
- "safety_notes": array of strings (safety considerations — return empty array if none)
- "discussion_questions": array of strings (3–5 questions to prompt reflection)

Return only the JSON object. No other text.`;

  return { system, user };
}

function buildSubstitutePrompts(materials, supplies, experimentTitle) {
  const system = `You are a science curriculum expert helping students find substitute materials. Be practical and grade-appropriate.

Respond with ONLY a valid JSON array. No markdown, no code blocks, no explanation.`;

  const suppliesCtx = supplies.trim()
    ? `The student has these supplies available: ${supplies.trim()}.`
    : 'The student has access to basic household or classroom supplies.';

  const user = `For the experiment "${experimentTitle}", the required materials are:
${materials.map(m => `- ${m}`).join('\n')}

${suppliesCtx}

For any materials the student may not have, suggest a realistic substitute. If all materials are likely covered by the available supplies, note that for the relevant items.

Return a JSON array of objects. Each object must have exactly these fields:
- "original": string (the required material)
- "substitute": string (a practical substitute, or "Likely already available" if it is covered)

Return only the JSON array. No other text.`;

  return { system, user };
}

// ═══════════════════════════════════════════════════════════════
// PHASE 1 — GENERATE OPTIONS
// ═══════════════════════════════════════════════════════════════
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

function renderOptions(options, supplies, subject, model) {
  const section = $('options-section');
  section.innerHTML = '';
  section.classList.remove('hidden');

  options.forEach((opt, i) => {
    const card = document.createElement('div');
    card.className = 'option-card';
    card.style.animationDelay = `${i * 0.08}s`;

    const diffClass = difficultyClass(opt.difficulty);

    card.innerHTML = `
      <div class="option-number">// OPTION ${String(i + 1).padStart(2, '0')}</div>
      <div class="difficulty-badge ${diffClass}">${escHtml(opt.difficulty || 'Unknown')}</div>
      <div class="option-title">${escHtml(opt.title)}</div>
      <div class="option-concept">[ ${escHtml(opt.concept)} ]</div>
      <div class="option-desc">${escHtml(opt.description)}</div>
      <div class="option-select-hint">> click to expand</div>
    `;

    card.addEventListener('click', () => expandExperiment(opt.title, supplies, subject, model));
    section.appendChild(card);
  });

  // Regenerate button row
  const actionsRow = document.createElement('div');
  actionsRow.className = 'options-actions';
  actionsRow.innerHTML = `<button class="ctrl-btn amber" id="regen-btn">&#8635; NEW OPTIONS</button>`;
  section.appendChild(actionsRow);
  $('regen-btn').addEventListener('click', generateOptions);
}

function difficultyClass(difficulty) {
  if (!difficulty) return '';
  const d = difficulty.toLowerCase();
  if (d === 'easy')        return 'difficulty-easy';
  if (d === 'medium')      return 'difficulty-medium';
  if (d === 'challenging') return 'difficulty-challenging';
  return '';
}

// ═══════════════════════════════════════════════════════════════
// PHASE 2 — EXPAND SELECTED EXPERIMENT
// ═══════════════════════════════════════════════════════════════
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

    renderExperiment(exp, supplies, model);
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

function renderExperiment(exp, supplies, model) {
  const container = $('experiment-card');

  const safetyHtml = exp.safety_notes && exp.safety_notes.length
    ? `<ul>${exp.safety_notes.map(n => `<li class="safety-item">${escHtml(n)}</li>`).join('')}</ul>`
    : '<span style="color:var(--accent-green)">No special safety precautions required.</span>';

  const diffClass  = difficultyClass(exp.difficulty);
  const diffBadge  = exp.difficulty
    ? `<div class="exp-grade-badge">// DIFFICULTY: <span class="${diffClass}" style="border:none;padding:0">${escHtml(exp.difficulty.toUpperCase())}</span></div>`
    : '';
  const timeBadge  = exp.duration_minutes
    ? `<div class="exp-grade-badge">// EST. TIME: ${escHtml(String(exp.duration_minutes))} MIN</div>`
    : '';

  container.innerHTML = `
    <div class="experiment-card">
      <div class="exp-header">
        <div class="exp-grade-badge">// GRADE BAND: ${escHtml(exp.grade_band || selectedBand)}</div>
        ${diffBadge}
        ${timeBadge}
        <div class="exp-title">${escHtml(exp.title)}</div>
        <div class="exp-concept">[ ${escHtml(exp.concept)} ]</div>
        <div class="exp-header-actions">
          <button class="copy-btn" id="copy-exp-btn">&#8968; COPY</button>
          <button class="ctrl-btn dim" id="download-exp-btn">&#8595; DOWNLOAD</button>
          <button class="ctrl-btn dim" id="sub-btn">&#8596; SUGGEST SUBSTITUTES</button>
        </div>
      </div>
      <div class="exp-body">

        <div class="exp-section">
          <div class="exp-section-label">> HYPOTHESIS</div>
          <div class="exp-section-content">${escHtml(exp.hypothesis)}</div>
        </div>

        <div class="exp-section" id="materials-section">
          <div class="exp-section-label">> MATERIALS</div>
          <div class="exp-section-content">
            <ul>${(exp.materials || []).map(m => `<li>${escHtml(m)}</li>`).join('')}</ul>
          </div>
        </div>

        <div class="exp-section">
          <div class="exp-section-label">> PROCEDURE</div>
          <div class="exp-section-content">
            <ol>${(exp.steps || []).map(s => `<li>${escHtml(s)}</li>`).join('')}</ol>
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
            <ol>${(exp.discussion_questions || []).map(q => `<li class="discussion-item">${escHtml(q)}</li>`).join('')}</ol>
          </div>
        </div>

      </div>
    </div>
  `;

  wireExperimentActions(exp, supplies, model);
}

// ═══════════════════════════════════════════════════════════════
// EXPERIMENT CARD ACTIONS (stretch features)
// ═══════════════════════════════════════════════════════════════
function wireExperimentActions(exp, supplies, model) {
  // Copy to clipboard
  $('copy-exp-btn').addEventListener('click', () => {
    const text = buildPlainText(exp);
    navigator.clipboard.writeText(text).then(() => {
      const btn = $('copy-exp-btn');
      btn.textContent = '✓ COPIED';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '⌈ COPY';
        btn.classList.remove('copied');
      }, 2000);
    });
  });

  // Download as .txt
  $('download-exp-btn').addEventListener('click', () => {
    const text = buildPlainText(exp);
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = slugify(exp.title) + '-experiment.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Suggest substitutes
  $('sub-btn').addEventListener('click', async () => {
    const btn = $('sub-btn');
    btn.disabled = true;
    btn.textContent = '[ LOADING... ]';

    const materialsSection = $('materials-section');
    let subArea = materialsSection.querySelector('.sub-area');
    if (!subArea) {
      subArea = document.createElement('div');
      subArea.className = 'sub-area';
      materialsSection.appendChild(subArea);
    }
    subArea.innerHTML = '<div class="sub-loading">> fetching substitute suggestions... ▌</div>';

    try {
      const { system, user } = buildSubstitutePrompts(exp.materials || [], supplies, exp.title);
      const raw = await callOpenAI(model, system, user);
      let subs;
      try { subs = JSON.parse(raw); } catch { throw new Error('PARSE_FAIL'); }

      subArea.innerHTML = `
        <table class="sub-table">
          <tr><th>MATERIAL</th><th>SUBSTITUTE</th></tr>
          ${subs.map(s => `<tr><td>${escHtml(s.original)}</td><td>${escHtml(s.substitute)}</td></tr>`).join('')}
        </table>
      `;
      btn.textContent = '&#8596; SUGGEST SUBSTITUTES';
    } catch (err) {
      subArea.innerHTML = `<div class="sub-loading" style="color:var(--accent-red)">ERR: ${escHtml(formatApiError(err.message))}</div>`;
      btn.textContent = '&#8596; SUGGEST SUBSTITUTES';
    } finally {
      btn.disabled = false;
    }
  });
}

function buildPlainText(exp) {
  const lines = [];
  lines.push(`LABGEN — Science Experiment`);
  lines.push(`${'='.repeat(50)}`);
  lines.push(`TITLE: ${exp.title}`);
  lines.push(`GRADE BAND: ${exp.grade_band || selectedBand}`);
  if (exp.difficulty)       lines.push(`DIFFICULTY: ${exp.difficulty}`);
  if (exp.duration_minutes) lines.push(`EST. TIME: ${exp.duration_minutes} MIN`);
  lines.push(`CONCEPT: ${exp.concept}`);
  lines.push('');
  lines.push('HYPOTHESIS');
  lines.push(exp.hypothesis);
  lines.push('');
  lines.push('MATERIALS');
  (exp.materials || []).forEach((m, i) => lines.push(`  ${i + 1}. ${m}`));
  lines.push('');
  lines.push('PROCEDURE');
  (exp.steps || []).forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
  lines.push('');
  lines.push('EXPECTED RESULTS');
  lines.push(exp.expected_results);
  lines.push('');
  if (exp.safety_notes && exp.safety_notes.length) {
    lines.push('SAFETY NOTES');
    exp.safety_notes.forEach(n => lines.push(`  - ${n}`));
    lines.push('');
  }
  lines.push('DISCUSSION QUESTIONS');
  (exp.discussion_questions || []).forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
  return lines.join('\n');
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ═══════════════════════════════════════════════════════════════
// GRADE BAND TOGGLE
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
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
