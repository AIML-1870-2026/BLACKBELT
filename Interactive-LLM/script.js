'use strict';

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
const state = {
  keys: {
    anthropic: sessionStorage.getItem('key_anthropic') || '',
    openai:    sessionStorage.getItem('key_openai')    || ''
  },
  format:        'free',   // 'free' | 'json'
  convMode:      'single', // 'single' | 'chat'
  maxTokens:     2048,
  isTransmitting: false,
  diffActive:    false,
  panels: {
    anthropic: { text: '', inputTokens: 0, outputTokens: 0 },
    openai:    { text: '', inputTokens: 0, outputTokens: 0 }
  }
};

const history = {
  anthropic: [],
  openai:    []
};

const controllers = { anthropic: null, openai: null };

// Fallback model text inputs (created if model fetch fails)
const modelFallbacks = { anthropic: null, openai: null };

// ═══════════════════════════════════════════════
// DOM HELPERS
// ═══════════════════════════════════════════════
const $  = (id)  => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ═══════════════════════════════════════════════
// BOOT SEQUENCE
// ═══════════════════════════════════════════════
const BOOT_LINES = [
  'INITIALIZING SWITCHBOARD...',
  'LOADING NEURAL INTERFACE MODULES...',
  'CONNECTING TO API ENDPOINTS...',
  'CALIBRATING RESPONSE MATRICES...',
  'WARMING UP STREAM BUFFERS...',
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

// ═══════════════════════════════════════════════
// API KEY MANAGEMENT
// ═══════════════════════════════════════════════
function initKeys() {
  const antInput = $('anthropic-key');
  const oaiInput = $('openai-key');

  if (state.keys.anthropic) antInput.value = state.keys.anthropic;
  if (state.keys.openai)    oaiInput.value = state.keys.openai;

  updateKeyIndicators();

  antInput.addEventListener('blur', () => {
    state.keys.anthropic = antInput.value.trim();
    sessionStorage.setItem('key_anthropic', state.keys.anthropic);
    updateKeyIndicators();
    if (state.keys.anthropic) fetchAnthropicModels();
  });

  oaiInput.addEventListener('blur', () => {
    state.keys.openai = oaiInput.value.trim();
    sessionStorage.setItem('key_openai', state.keys.openai);
    updateKeyIndicators();
    if (state.keys.openai) fetchOpenAIModels();
  });

  // Eye toggle
  $$('.eye-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = $(btn.dataset.target);
      inp.classList.toggle('masked');
    });
  });

  // Drawer toggle
  $('api-keys-toggle').addEventListener('click', () => {
    const drawer = $('api-keys-drawer');
    drawer.classList.toggle('open');
    $('api-keys-toggle').textContent = drawer.classList.contains('open')
      ? 'API KEYS ▲' : 'API KEYS ▼';
  });

  // Fetch models if keys already present
  if (state.keys.anthropic) fetchAnthropicModels();
  if (state.keys.openai)    fetchOpenAIModels();
}

function updateKeyIndicators() {
  const hasAnt = !!state.keys.anthropic;
  const hasOai = !!state.keys.openai;

  $('indicator-anthropic').classList.toggle('active', hasAnt);
  $('indicator-openai').classList.toggle('active', hasOai);

  const antEl = $('key-status-anthropic');
  antEl.textContent = hasAnt ? '[ANTHROPIC ✓]' : '[ANTHROPIC ✗]';
  antEl.className   = hasAnt ? 'key-good' : 'key-bad';

  const oaiEl = $('key-status-openai');
  oaiEl.textContent = hasOai ? '[OPENAI ✓]' : '[OPENAI ✗]';
  oaiEl.className   = hasOai ? 'key-good' : 'key-bad';

  updateStatusRight();
}

// ═══════════════════════════════════════════════
// MODEL FETCHING
// ═══════════════════════════════════════════════
async function fetchAnthropicModels() {
  const sel = $('anthropic-model');
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': state.keys.anthropic,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data   = await res.json();
    const models = (data.data || [])
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, 5);

    sel.innerHTML = '';
    if (models.length === 0) {
      sel.innerHTML = '<option value="">-- NO MODELS --</option>';
    } else {
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id; opt.textContent = m.id;
        sel.appendChild(opt);
      });
    }
    updateStatusRight();
  } catch {
    showModelFallback('anthropic', sel);
  }
}

async function fetchOpenAIModels() {
  const sel = $('openai-model');
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${state.keys.openai}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data   = await res.json();
    const all    = data.data || [];
    const models = filterOpenAIModels(all);

    sel.innerHTML = '';
    if (models.length === 0) {
      sel.innerHTML = '<option value="">-- NO MODELS --</option>';
    } else {
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id; opt.textContent = m.id;
        sel.appendChild(opt);
      });
    }
    updateStatusRight();
  } catch {
    showModelFallback('openai', sel);
  }
}

function filterOpenAIModels(models) {
  // Block non-chat model types by keyword — any chat model (gpt-4, gpt-5, o3, o4, etc.) passes through
  const BLOCKED = [
    'embedding', 'tts', 'whisper', 'dall-e', 'davinci', 'babbage', 'ada', 'curie',
    'moderation', 'audio', 'realtime', 'transcribe', 'search', 'mini-tts',
    'instruct', 'vision-preview', '0301', '0314', '0613'
  ];
  return models
    .filter(m => {
      const id = m.id.toLowerCase();
      return !BLOCKED.some(b => id.includes(b));
    })
    .sort((a, b) => b.created - a.created)
    .slice(0, 5);
}

function showModelFallback(provider, selectEl) {
  if (modelFallbacks[provider]) return; // already created
  const inp   = document.createElement('input');
  inp.type    = 'text';
  inp.className = 'terminal-input';
  inp.placeholder = 'FETCH FAILED — ENTER MODEL MANUALLY';
  inp.style.width = '240px';
  inp.id      = `${provider}-model-fallback`;
  selectEl.style.display = 'none';
  selectEl.parentElement.appendChild(inp);
  modelFallbacks[provider] = inp;
  inp.addEventListener('change', updateStatusRight);
}

function getModel(provider) {
  if (modelFallbacks[provider]) return modelFallbacks[provider].value.trim();
  const sel = $(`${provider}-model`);
  return sel ? sel.value : '';
}

// ═══════════════════════════════════════════════
// FORMAT TOGGLE
// ═══════════════════════════════════════════════
function initFormatToggle() {
  $$('.fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.fmt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.format = btn.dataset.mode;
      $('schema-hint-area').classList.toggle('hidden', state.format !== 'json');
    });
  });
}

// ═══════════════════════════════════════════════
// CONVERSATION MODE
// ═══════════════════════════════════════════════
function initConvToggle() {
  $$('.conv-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.conv-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.convMode = btn.dataset.mode;
      $('history-log').classList.toggle('hidden', state.convMode !== 'chat');
    });
  });

  $('clear-history-btn').addEventListener('click', () => {
    history.anthropic = [];
    history.openai    = [];
    renderHistoryLog();
  });
}

// ═══════════════════════════════════════════════
// HISTORY LOG
// ═══════════════════════════════════════════════
function renderHistoryLog() {
  const content = $('history-log-content');
  content.innerHTML = '';
  // Show anthropic history as representative view
  history.anthropic.forEach(msg => {
    const div = document.createElement('div');
    div.className = `history-entry ${msg.role === 'user' ? 'user' : 'assistant'}`;
    const prefix    = msg.role === 'user' ? '[U]' : '[A]';
    const truncated = msg.content.length > 80
      ? msg.content.slice(0, 80) + '…'
      : msg.content;
    div.textContent = `${prefix} ${truncated}`;
    content.appendChild(div);
  });
  content.scrollTop = content.scrollHeight;
}

// ═══════════════════════════════════════════════
// HISTORY SANITIZATION (Anthropic strict alternation)
// ═══════════════════════════════════════════════
function sanitizeHistory(messages) {
  if (messages.length === 0) return [];
  const result = [];
  let lastRole  = null;

  for (const msg of messages) {
    if (msg.role === lastRole) {
      result[result.length - 1].content += '\n' + msg.content;
    } else {
      result.push({ ...msg });
      lastRole = msg.role;
    }
  }

  // Must start with 'user'
  if (result[0]?.role !== 'user') result.shift();
  // Must end just before 'user' (current query appended after)
  while (result.length && result[result.length - 1].role === 'user') result.pop();

  return result;
}

// ═══════════════════════════════════════════════
// PRESET PROMPTS
// ═══════════════════════════════════════════════
function initPresets() {
  const toggle   = $('preset-toggle');
  const dropdown = $('preset-dropdown');

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
    toggle.textContent = dropdown.classList.contains('hidden')
      ? 'PRESET PROMPTS ▼' : 'PRESET PROMPTS ▲';
  });

  document.addEventListener('click', () => {
    dropdown.classList.add('hidden');
    toggle.textContent = 'PRESET PROMPTS ▼';
  });

  $$('.preset-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      const ta = $('query-input');
      ta.value = item.dataset.prompt;
      autoGrow(ta);
      updateCharCounter();
      dropdown.classList.add('hidden');
      toggle.textContent = 'PRESET PROMPTS ▼';
      ta.focus();
    });
  });
}

// ═══════════════════════════════════════════════
// QUERY INPUT
// ═══════════════════════════════════════════════
function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.max(80, el.scrollHeight) + 'px';
}

function updateCharCounter() {
  const maxChars = state.maxTokens * 4;
  const len      = $('query-input').value.length;
  $('char-counter').textContent = `[${len} / ${maxChars}]`;
}

function initQueryInput() {
  const ta = $('query-input');
  ta.addEventListener('input', () => { autoGrow(ta); updateCharCounter(); });

  $('max-tokens').addEventListener('change', () => {
    const v        = parseInt($('max-tokens').value) || 2048;
    state.maxTokens = Math.min(4096, Math.max(256, v));
    $('max-tokens').value = state.maxTokens;
    updateCharCounter();
  });

  updateCharCounter();
}

// ═══════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════
function buildSystemPrompt() {
  let sys = 'You are a helpful AI assistant. Be clear, accurate, and concise.';
  if (state.format === 'json') {
    sys += '\nRespond ONLY with valid JSON. Do not include any explanation or markdown.';
    const hint = $('schema-hint').value.trim();
    if (hint) sys += ' ' + hint;
  }
  return sys;
}

// ═══════════════════════════════════════════════
// PANEL HELPERS
// ═══════════════════════════════════════════════
function setBadge(provider, cssClass, text) {
  const badge = $(`badge-${provider}`);
  badge.className  = `panel-badge ${cssClass}`;
  badge.textContent = text;
}

function clearPanel(provider) {
  $(`output-${provider}`).innerHTML   = '';
  $(`tokens-${provider}`).textContent  = 'TOKENS: -- → --';
  $(`latency-${provider}`).textContent = 'LATENCY: --';
  $(`diff-summary-${provider}`).classList.add('hidden');
  state.panels[provider].text         = '';
  state.panels[provider].inputTokens  = 0;
  state.panels[provider].outputTokens = 0;
}

function renderResponse(panel, text, format) {
  panel.innerHTML = '';
  if (!text) return;

  if (format === 'json') {
    const pre  = document.createElement('pre');
    const code = document.createElement('code');
    code.className = 'language-json';
    try {
      code.textContent = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      code.textContent = text;
    }
    pre.appendChild(code);
    panel.appendChild(pre);
    if (window.hljs) hljs.highlightElement(code);
  } else {
    const div = document.createElement('div');
    if (window.marked) {
      const rawHtml = marked.parse(text);
      div.innerHTML = window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;
    } else {
      div.style.whiteSpace = 'pre-wrap';
      div.style.wordBreak  = 'break-word';
      div.textContent      = text;
    }
    panel.appendChild(div);
  }
}

function appendStreamText(panel, text) {
  let textDiv = panel.querySelector('.stream-text');
  if (!textDiv) {
    textDiv = document.createElement('div');
    textDiv.className       = 'stream-text';
    textDiv.style.whiteSpace = 'pre-wrap';
    textDiv.style.wordBreak  = 'break-word';
    panel.insertBefore(textDiv, panel.querySelector('.stream-cursor'));
  }
  textDiv.textContent += text;
}

function formatApiError(msg) {
  if (msg.includes('429')) return '[HTTP 429] RATE LIMITED — RETRY LATER';
  if (msg.includes('401')) return '[HTTP 401] UNAUTHORIZED — CHECK API KEY';
  if (msg.includes('403')) return '[HTTP 403] FORBIDDEN';
  if (msg.includes('500')) return '[HTTP 500] SERVER ERROR';
  if (msg.includes('503')) return '[HTTP 503] SERVICE UNAVAILABLE';
  return `ERROR: ${msg}`;
}

function setErrorPanel(panel, msg) {
  panel.innerHTML = '';
  const span = document.createElement('span');
  span.style.color = 'var(--accent-red)';
  span.textContent = msg;
  panel.appendChild(span);
}

// ═══════════════════════════════════════════════
// STREAM — ANTHROPIC
// ═══════════════════════════════════════════════
async function streamAnthropic(body) {
  const panel     = $('output-anthropic');
  const startTime = Date.now();
  let fullText    = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let completed   = false;
  let firstToken  = false;

  setBadge('anthropic', 'transmitting', 'TRANSMITTING...');
  $('panel-anthropic').classList.add('active');
  panel.innerHTML = '';

  // Add blinking cursor
  const cursor = document.createElement('span');
  cursor.className = 'stream-cursor';
  panel.appendChild(cursor);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': body._apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body:   JSON.stringify((({ _apiKey, ...rest }) => rest)(body)),
      signal: controllers.anthropic.signal
    });

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errData = await response.json();
        errMsg = errData.error?.message || errMsg;
      } catch { /* ignore */ }
      throw new Error(errMsg);
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

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
          if (!firstToken) {
            firstToken = true;
            $('latency-anthropic').textContent = `LATENCY: ${Date.now() - startTime}ms`;
          }
          const chunk = parsed.delta.text;
          fullText   += chunk;
          appendStreamText(panel, chunk);
          panel.scrollTop = panel.scrollHeight;
        }
        if (parsed.type === 'message_delta') {
          outputTokens = parsed.usage?.output_tokens ?? 0;
        }
        if (parsed.type === 'message_stop') {
          completed = true;
        }
      }
    }

    // Remove cursor, do final render
    cursor.remove();
    state.panels.anthropic.text         = fullText;
    state.panels.anthropic.inputTokens  = inputTokens;
    state.panels.anthropic.outputTokens = outputTokens;
    $('tokens-anthropic').textContent   = `TOKENS: ${inputTokens} → ${outputTokens}`;
    renderResponse(panel, fullText, state.format);
    setBadge('anthropic', 'complete', 'COMPLETE');
    $('panel-anthropic').classList.remove('active');

    return { fullText, inputTokens, outputTokens, completed };

  } catch (err) {
    cursor.remove();
    $('panel-anthropic').classList.remove('active');

    if (err.name === 'AbortError') {
      state.panels.anthropic.text = fullText;
      if (fullText) renderResponse(panel, fullText, state.format);
      setBadge('anthropic', 'aborted', 'ABORTED');
      return { fullText, inputTokens, outputTokens, completed: false };
    }

    setErrorPanel(panel, formatApiError(err.message));
    setBadge('anthropic', 'error', 'ERROR');
    return { fullText: '', inputTokens: 0, outputTokens: 0, completed: false };
  }
}

// ═══════════════════════════════════════════════
// STREAM — OPENAI
// ═══════════════════════════════════════════════
async function streamOpenAI(body) {
  const panel     = $('output-openai');
  const startTime = Date.now();
  let fullText    = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let completed   = false;
  let firstToken  = false;

  setBadge('openai', 'transmitting', 'TRANSMITTING...');
  $('panel-openai').classList.add('active');
  panel.innerHTML = '';

  const cursor = document.createElement('span');
  cursor.className = 'stream-cursor';
  panel.appendChild(cursor);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${body._apiKey}`
      },
      body:   JSON.stringify((({ _apiKey, ...rest }) => rest)(body)),
      signal: controllers.openai.signal
    });

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errData = await response.json();
        errMsg = errData.error?.message || errMsg;
      } catch { /* ignore */ }
      throw new Error(errMsg);
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        if (jsonStr === '[DONE]') { completed = true; continue; }

        let parsed;
        try { parsed = JSON.parse(jsonStr); } catch { continue; }

        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          if (!firstToken) {
            firstToken = true;
            $('latency-openai').textContent = `LATENCY: ${Date.now() - startTime}ms`;
          }
          fullText += delta;
          appendStreamText(panel, delta);
          panel.scrollTop = panel.scrollHeight;
        }
        // Usage arrives in the final chunk with stream_options.include_usage
        if (parsed.usage) {
          inputTokens  = parsed.usage.prompt_tokens     ?? 0;
          outputTokens = parsed.usage.completion_tokens ?? 0;
        }
      }
    }

    cursor.remove();
    state.panels.openai.text         = fullText;
    state.panels.openai.inputTokens  = inputTokens;
    state.panels.openai.outputTokens = outputTokens;
    $('tokens-openai').textContent   = `TOKENS: ${inputTokens} → ${outputTokens}`;
    renderResponse(panel, fullText, state.format);
    setBadge('openai', 'complete', 'COMPLETE');
    $('panel-openai').classList.remove('active');

    return { fullText, inputTokens, outputTokens, completed };

  } catch (err) {
    cursor.remove();
    $('panel-openai').classList.remove('active');

    if (err.name === 'AbortError') {
      state.panels.openai.text = fullText;
      if (fullText) renderResponse(panel, fullText, state.format);
      setBadge('openai', 'aborted', 'ABORTED');
      return { fullText, inputTokens, outputTokens, completed: false };
    }

    setErrorPanel(panel, formatApiError(err.message));
    setBadge('openai', 'error', 'ERROR');
    return { fullText: '', inputTokens: 0, outputTokens: 0, completed: false };
  }
}

// ═══════════════════════════════════════════════
// TRANSMIT
// ═══════════════════════════════════════════════
async function transmit() {
  const query = $('query-input').value.trim();
  if (!query || state.isTransmitting) return;

  const antModel = getModel('anthropic');
  const oaiModel = getModel('openai');

  // Validate
  let hasError = false;
  if (!state.keys.anthropic) {
    flashKeyError('anthropic-key');
    setErrorPanel($('output-anthropic'), 'ERROR: NO KEY PROVIDED');
    setBadge('anthropic', 'error', 'ERROR');
    hasError = true;
  }
  if (!state.keys.openai) {
    flashKeyError('openai-key');
    setErrorPanel($('output-openai'), 'ERROR: NO KEY PROVIDED');
    setBadge('openai', 'error', 'ERROR');
    hasError = true;
  }
  if (hasError) return;

  if (!antModel) {
    setErrorPanel($('output-anthropic'), 'ERROR: NO MODEL SELECTED');
    setBadge('anthropic', 'error', 'ERROR');
    return;
  }
  if (!oaiModel) {
    setErrorPanel($('output-openai'), 'ERROR: NO MODEL SELECTED');
    setBadge('openai', 'error', 'ERROR');
    return;
  }

  // Reset diff
  $('diff-bar').classList.add('hidden');
  $('diff-toggle').textContent = '◈ DIFF';
  state.diffActive = false;

  // Set transmitting
  state.isTransmitting = true;
  const btn = $('transmit-btn');
  btn.textContent = '■ ABORT';
  btn.classList.add('abort');
  setStatus('transmitting', 'TRANSMITTING...');

  controllers.anthropic = new AbortController();
  controllers.openai    = new AbortController();

  const systemPrompt   = buildSystemPrompt();
  const currentQuery   = query;

  // Build message arrays
  let anthropicMessages, openaiMessages;

  if (state.convMode === 'chat') {
    const santAnt = sanitizeHistory(history.anthropic);
    const santOai = sanitizeHistory(history.openai);
    anthropicMessages = [...santAnt, { role: 'user', content: currentQuery }];
    openaiMessages    = [
      { role: 'system', content: systemPrompt },
      ...santOai,
      { role: 'user', content: currentQuery }
    ];
  } else {
    history.anthropic = [];
    history.openai    = [];
    anthropicMessages = [{ role: 'user', content: currentQuery }];
    openaiMessages    = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: currentQuery }
    ];
  }

  const anthropicBody = {
    _apiKey:    state.keys.anthropic,
    model:      antModel,
    max_tokens: state.maxTokens,
    stream:     true,
    system:     systemPrompt,
    messages:   anthropicMessages
  };

  const openaiBody = {
    _apiKey:        state.keys.openai,
    model:          oaiModel,
    max_tokens:     state.maxTokens,
    stream:         true,
    stream_options: { include_usage: true },
    messages:       openaiMessages
  };

  // Fire both simultaneously
  const [antResult, oaiResult] = await Promise.all([
    streamAnthropic(anthropicBody),
    streamOpenAI(openaiBody)
  ]);

  // Update history if chat mode and completed
  if (state.convMode === 'chat') {
    if (antResult.completed && antResult.fullText) {
      history.anthropic.push({ role: 'user',      content: currentQuery });
      history.anthropic.push({ role: 'assistant', content: antResult.fullText });
    }
    if (oaiResult.completed && oaiResult.fullText) {
      history.openai.push({ role: 'user',      content: currentQuery });
      history.openai.push({ role: 'assistant', content: oaiResult.fullText });
    }
    renderHistoryLog();
  }

  // Show diff button if both complete with text
  if (antResult.completed && oaiResult.completed &&
      antResult.fullText  && oaiResult.fullText) {
    $('diff-bar').classList.remove('hidden');
  }

  // Update panel titles
  $('panel-anthropic-title').textContent = `◈ CLAUDE ${antModel}`;
  $('panel-openai-title').textContent    = `◈ GPT ${oaiModel}`;

  // Reset
  state.isTransmitting  = false;
  controllers.anthropic = null;
  controllers.openai    = null;
  btn.textContent       = '▶ TRANSMIT';
  btn.classList.remove('abort');
  setStatus('ready', 'SWITCHBOARD READY');
  updateStatusRight();
}

// ═══════════════════════════════════════════════
// ABORT
// ═══════════════════════════════════════════════
function abort() {
  if (!state.isTransmitting) return;
  if (controllers.anthropic) controllers.anthropic.abort();
  if (controllers.openai)    controllers.openai.abort();
}

// ═══════════════════════════════════════════════
// CLEAR ALL
// ═══════════════════════════════════════════════
function clearAll() {
  abort();

  clearPanel('anthropic');
  clearPanel('openai');
  setBadge('anthropic', 'idle', 'IDLE');
  setBadge('openai',    'idle', 'IDLE');
  $('panel-anthropic').classList.remove('active');
  $('panel-openai').classList.remove('active');

  const ta = $('query-input');
  ta.value = '';
  autoGrow(ta);
  updateCharCounter();

  $('diff-bar').classList.add('hidden');
  $('diff-toggle').textContent = '◈ DIFF';
  state.diffActive = false;

  $('panel-anthropic-title').textContent = '◈ CLAUDE';
  $('panel-openai-title').textContent    = '◈ GPT';

  setStatus('ready', 'SWITCHBOARD READY');
}

// ═══════════════════════════════════════════════
// STATUS HELPERS
// ═══════════════════════════════════════════════
function setStatus(type, text) {
  const el = $('status-left');
  el.textContent = text;
  el.className   = type;
}

function updateStatusRight() {
  const ant = getModel('anthropic') || '--';
  const oai = getModel('openai')    || '--';
  $('status-right').textContent = `ANTHROPIC ${ant} | OPENAI ${oai}`;
}

function flashKeyError(inputId) {
  const el = $(inputId);
  el.classList.add('error-flash');
  // Open drawer
  $('api-keys-drawer').classList.add('open');
  $('api-keys-toggle').textContent = 'API KEYS ▲';
  setTimeout(() => el.classList.remove('error-flash'), 2000);
}

// ═══════════════════════════════════════════════
// COPY
// ═══════════════════════════════════════════════
function initCopy() {
  ['anthropic', 'openai'].forEach(provider => {
    $(`copy-${provider}`).addEventListener('click', async () => {
      const text = state.panels[provider].text;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const btn = $(`copy-${provider}`);
        const orig = btn.textContent;
        btn.textContent = 'COPIED!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
      } catch { /* clipboard not available */ }
    });
  });
}

// ═══════════════════════════════════════════════
// DIFF MODE (word-level LCS)
// ═══════════════════════════════════════════════
function tokenize(text) {
  // Split on whitespace boundaries, keeping whitespace as tokens
  return text.match(/\S+|\s+/g) || [];
}

function lcsBacktrack(a, b) {
  const m = a.length, n = b.length;
  // For large texts, limit to avoid O(m*n) freeze
  if (m * n > 500000) return null;

  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }

  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i-1] === b[j-1]) {
      result.unshift({ type: 'common',  value: a[i-1] }); i--; j--;
    } else if (dp[i-1][j] >= dp[i][j-1]) {
      result.unshift({ type: 'only-a', value: a[i-1] }); i--;
    } else {
      result.unshift({ type: 'only-b', value: b[j-1] }); j--;
    }
  }
  while (i > 0) { result.unshift({ type: 'only-a', value: a[i-1] }); i--; }
  while (j > 0) { result.unshift({ type: 'only-b', value: b[j-1] }); j--; }
  return result;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function applyDiff() {
  const textA  = state.panels.anthropic.text;
  const textB  = state.panels.openai.text;
  const wordsA = tokenize(textA);
  const wordsB = tokenize(textB);
  const diff   = lcsBacktrack(wordsA, wordsB);

  if (!diff) {
    // Too large — just show note
    $('diff-summary-anthropic').textContent = 'DIFF: TEXT TOO LARGE FOR WORD DIFF';
    $('diff-summary-anthropic').classList.remove('hidden');
    $('diff-summary-openai').textContent = 'DIFF: TEXT TOO LARGE FOR WORD DIFF';
    $('diff-summary-openai').classList.remove('hidden');
    return;
  }

  let htmlClaude = '', htmlGPT = '';
  let uniqueClaude = 0, uniqueGPT = 0;

  diff.forEach(item => {
    const e = esc(item.value);
    if (item.type === 'common') {
      htmlClaude += e;
      htmlGPT    += e;
    } else if (item.type === 'only-a') {
      htmlClaude += `<span class="diff-add">${e}</span>`;
      uniqueClaude++;
    } else {
      htmlGPT += `<span class="diff-remove">${e}</span>`;
      uniqueGPT++;
    }
  });

  $('output-anthropic').innerHTML =
    `<div style="white-space:pre-wrap;word-break:break-word">${htmlClaude}</div>`;
  $('output-openai').innerHTML    =
    `<div style="white-space:pre-wrap;word-break:break-word">${htmlGPT}</div>`;

  const sumAnt = $('diff-summary-anthropic');
  sumAnt.textContent = `+${uniqueClaude} unique / -${uniqueGPT} missing vs GPT`;
  sumAnt.classList.remove('hidden');

  const sumOai = $('diff-summary-openai');
  sumOai.textContent = `+${uniqueGPT} unique / -${uniqueClaude} missing vs CLAUDE`;
  sumOai.classList.remove('hidden');
}

function initDiff() {
  $('diff-toggle').addEventListener('click', () => {
    state.diffActive = !state.diffActive;
    $('diff-toggle').textContent = state.diffActive ? '◈ DIFF ON' : '◈ DIFF';

    if (state.diffActive) {
      applyDiff();
    } else {
      renderResponse($('output-anthropic'), state.panels.anthropic.text, state.format);
      renderResponse($('output-openai'),    state.panels.openai.text,    state.format);
      $('diff-summary-anthropic').classList.add('hidden');
      $('diff-summary-openai').classList.add('hidden');
    }
  });
}

// ═══════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (!state.isTransmitting) transmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      abort();
    }
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      clearAll();
    }
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      $('api-keys-drawer').classList.add('open');
      $('api-keys-toggle').textContent = 'API KEYS ▲';
      $('anthropic-key').focus();
    }
  });
}

// ═══════════════════════════════════════════════
// TRANSMIT + CLEAR BUTTONS
// ═══════════════════════════════════════════════
function initButtons() {
  $('transmit-btn').addEventListener('click', () => {
    state.isTransmitting ? abort() : transmit();
  });

  $('clear-btn').addEventListener('click', clearAll);
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
function init() {
  if (window.marked) {
    marked.setOptions({ breaks: true, gfm: true });
  }
  // Register hljs JSON language if available (CDN language file auto-registers)
  if (window.hljs) {
    try { hljs.configure({ languages: ['json'] }); } catch { /* ignore */ }
  }

  initKeys();
  initFormatToggle();
  initConvToggle();
  initPresets();
  initQueryInput();
  initCopy();
  initDiff();
  initKeyboard();
  initButtons();
}

document.addEventListener('DOMContentLoaded', () => {
  runBoot();
  init();
});
