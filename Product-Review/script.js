'use strict';

// API key lives in memory only — never written to any browser storage
let apiKey = '';

// ═══════════════════════════════════════════════════════════════
// DOM HELPERS (from reference)
// ═══════════════════════════════════════════════════════════════
const $  = (id)  => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ═══════════════════════════════════════════════════════════════
// BOOT SEQUENCE (from reference, updated lines)
// ═══════════════════════════════════════════════════════════════
const BOOT_LINES = [
  'INITIALIZING REVIEW ENGINE...',
  'LOADING PRODUCT ANALYSIS MODULES...',
  'CONNECTING TO OPENAI API...',
  'CALIBRATING SENTIMENT MATRICES...',
  'WARMING UP GENERATION BUFFERS...',
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
// KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════
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

  // Eye-btn toggle (from reference)
  $$('.eye-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = $(btn.dataset.target);
      inp.classList.toggle('masked');
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// OPENAI API CALL — direct, no proxy
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
// SENTIMENT SLIDERS
// ═══════════════════════════════════════════════════════════════
const SLIDERS = [
  { id: 'sl-positivity', valId: 'val-positivity' },
  { id: 'sl-variance',   valId: 'val-variance'   },
  { id: 'sl-detail',     valId: 'val-detail'     },
  { id: 'sl-price',      valId: 'val-price'      },
  { id: 'sl-features',   valId: 'val-features'   },
  { id: 'sl-usability',  valId: 'val-usability'  }
];

function getSliderValues() {
  return {
    positivity:          parseInt($(SLIDERS[0].id).value),
    variance:            parseInt($(SLIDERS[1].id).value),
    detail:              parseInt($(SLIDERS[2].id).value),
    price_sentiment:     parseInt($(SLIDERS[3].id).value),
    feature_satisfaction:parseInt($(SLIDERS[4].id).value),
    usability:           parseInt($(SLIDERS[5].id).value)
  };
}

function updateSliderFill(input) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--fill', `${pct}%`);
}

function initSliders() {
  SLIDERS.forEach(({ id, valId }) => {
    const input = $(id);
    const label = $(valId);
    // Initial fill
    updateSliderFill(input);
    input.addEventListener('input', () => {
      label.textContent = `[${input.value}]`;
      updateSliderFill(input);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════
function buildPrompts(product, count, sentiment) {
  const system = `You are a product review generator. Generate realistic, human-sounding customer reviews that vary in rating, length, tone, and vocabulary. Avoid marketing language. Sound like real people writing on Amazon or Best Buy. You will receive sentiment parameters that MUST shape the output — follow them strictly.

Respond with ONLY a valid JSON array. No markdown, no code blocks, no explanation.`;

  // Translate 0–100 slider values into plain-English instructions the model can act on
  const positivityDesc   = sentiment.positivity >= 70  ? 'skew heavily toward 4–5 star reviews'
                         : sentiment.positivity <= 30  ? 'skew heavily toward 1–2 star reviews'
                         : 'use a balanced mix of 1–5 star ratings';

  const varianceDesc     = sentiment.variance >= 70    ? 'spread ratings widely from 1 to 5'
                         : sentiment.variance <= 30    ? 'cluster ratings tightly near the average'
                         : 'use moderate rating variety';

  const detailDesc       = sentiment.detail >= 70      ? 'write long, detailed bodies with specific product observations (4–6 sentences)'
                         : sentiment.detail <= 30      ? 'write short, vague bodies (1–2 sentences)'
                         : 'write medium-length bodies (2–4 sentences)';

  const priceDesc        = sentiment.price_sentiment >= 70 ? 'reviewers feel the product is great value for money'
                         : sentiment.price_sentiment <= 30 ? 'reviewers feel the product is overpriced'
                         : 'reviewers are neutral about the price';

  const featureDesc      = sentiment.feature_satisfaction >= 70 ? 'reviewers are impressed by the feature set'
                         : sentiment.feature_satisfaction <= 30 ? 'reviewers find the product lacking or missing key features'
                         : 'reviewers are neutral about the features';

  const usabilityDesc    = sentiment.usability >= 70   ? 'reviewers praise ease of use and intuitive design'
                         : sentiment.usability <= 30   ? 'reviewers mention a steep learning curve or confusing setup'
                         : 'reviewers are neutral about usability';

  const user = `Generate ${count} customer reviews for: ${product}

Each review must be a JSON object with these exact fields:
- "reviewer": string (realistic fake full name)
- "rating": integer 1–5
- "title": string (short review headline, max 10 words)
- "body": string (honest review body — length per detail parameter below)
- "verified": boolean
- "date": string (realistic past date within 2 years, format: "Month DD, YYYY")
- "helpful": integer (0–50)

You MUST follow these sentiment parameters exactly:
- Rating distribution: ${positivityDesc}
- Rating spread: ${varianceDesc}
- Review detail: ${detailDesc}
- Price perception: ${priceDesc}
- Feature satisfaction: ${featureDesc}
- Usability: ${usabilityDesc}

Return only the JSON array. No other text.`;

  return { system, user };
}

// ═══════════════════════════════════════════════════════════════
// GENERATE REVIEWS
// ═══════════════════════════════════════════════════════════════
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
    const sentiment = getSliderValues();
    const { system, user } = buildPrompts(product, count, sentiment);
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

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════
const BORDER_COLORS = {
  5: '#00e676',
  4: '#69f0ae',
  3: '#ffd740',
  2: '#ff6d00',
  1: '#ff4444'
};

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
      <span>[helpful: ${Number(review.helpful) || 0}]</span>
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

// ═══════════════════════════════════════════════════════════════
// GEN STATUS / STATUS RIGHT
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
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
  initSliders();
  initGenerate();
  updateStatusRight();
}

document.addEventListener('DOMContentLoaded', () => {
  runBoot();
  init();
});
