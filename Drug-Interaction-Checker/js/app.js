/* ============================================================
   Drug Safety Checker — App Logic
   ============================================================ */

(() => {
  // ---- State ---- //
  const state = {
    singleMode: false,
    drugA: null,   // { name, rxcui }
    drugB: null,
  };

  // ---- DOM Refs ---- //
  const singleToggle  = document.getElementById('single-drug-toggle');
  const searchGrid    = document.getElementById('search-grid');
  const analyzeBtn    = document.getElementById('analyze-btn');
  const loadingState  = document.getElementById('loading-state');
  const loadingText   = document.getElementById('loading-text');
  const errorState    = document.getElementById('error-state');
  const errorMessage  = document.getElementById('error-message');
  const retryBtn      = document.getElementById('retry-btn');
  const resultsDash   = document.getElementById('results-dashboard');
  const resultsGrid   = document.getElementById('results-grid');
  const severityBar   = document.getElementById('severity-bar');

  const inputs = {
    a: {
      input:        document.getElementById('drug-a-input'),
      autocomplete: document.getElementById('drug-a-autocomplete'),
      clearBtn:     document.getElementById('drug-a-clear'),
      selected:     document.getElementById('drug-a-selected'),
      selectedName: document.getElementById('drug-a-selected-name'),
      selectedRxcui:document.getElementById('drug-a-selected-rxcui'),
      wrapper:      document.getElementById('drug-a-wrapper'),
    },
    b: {
      input:        document.getElementById('drug-b-input'),
      autocomplete: document.getElementById('drug-b-autocomplete'),
      clearBtn:     document.getElementById('drug-b-clear'),
      selected:     document.getElementById('drug-b-selected'),
      selectedName: document.getElementById('drug-b-selected-name'),
      selectedRxcui:document.getElementById('drug-b-selected-rxcui'),
      wrapper:      document.getElementById('drug-b-wrapper'),
    },
  };

  // ============================================================
  // MODE TOGGLE
  // ============================================================

  singleToggle.addEventListener('change', () => {
    state.singleMode = singleToggle.checked;
    searchGrid.classList.toggle('single-mode', state.singleMode);
    if (state.singleMode) clearDrug('b');
    updateAnalyzeButton();
  });

  // ============================================================
  // AUTOCOMPLETE
  // ============================================================

  const debounceTimers  = { a: null, b: null };
  const highlightIndex  = { a: -1,   b: -1   };

  function setupAutocomplete(slot) {
    const { input, autocomplete, clearBtn } = inputs[slot];

    input.addEventListener('input', () => {
      const val = input.value.trim();
      clearBtn.hidden = val.length === 0;

      if (state[`drug${slot.toUpperCase()}`]) clearDrug(slot, true);

      clearTimeout(debounceTimers[slot]);
      if (val.length < 2) { closeAutocomplete(slot); return; }
      debounceTimers[slot] = setTimeout(() => fetchSuggestions(slot, val), 280);
    });

    input.addEventListener('keydown', (e) => {
      const items = autocomplete.querySelectorAll('.autocomplete-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightIndex[slot] = Math.min(highlightIndex[slot] + 1, items.length - 1);
        updateHighlight(slot, items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightIndex[slot] = Math.max(highlightIndex[slot] - 1, 0);
        updateHighlight(slot, items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const idx = highlightIndex[slot];
        if (idx >= 0 && items[idx]) {
          items[idx].click();
        } else if (input.value.trim()) {
          selectDrug(slot, input.value.trim(), null);
        }
      } else if (e.key === 'Escape') {
        closeAutocomplete(slot);
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => closeAutocomplete(slot), 200);
    });

    clearBtn.addEventListener('click', () => clearDrug(slot));
  }

  function updateHighlight(slot, items) {
    items.forEach((item, i) => item.classList.toggle('highlighted', i === highlightIndex[slot]));
  }

  async function fetchSuggestions(slot, query) {
    const suggestions = await API.rxnormAutocomplete(query);
    const { autocomplete } = inputs[slot];
    autocomplete.innerHTML = '';
    highlightIndex[slot] = -1;

    if (suggestions.length === 0) { closeAutocomplete(slot); return; }

    for (const name of suggestions.slice(0, 8)) {
      const li = document.createElement('li');
      li.className = 'autocomplete-item';
      li.setAttribute('role', 'option');
      li.innerHTML = `<div class="autocomplete-item-name">${escHTML(name)}</div>`;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectDrug(slot, name, null);
      });
      autocomplete.appendChild(li);
    }
  }

  function closeAutocomplete(slot) {
    inputs[slot].autocomplete.innerHTML = '';
    highlightIndex[slot] = -1;
  }

  function escHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ============================================================
  // DRUG SELECTION
  // ============================================================

  function selectDrug(slot, name, rxcui) {
    const key = `drug${slot.toUpperCase()}`;
    state[key] = { name, rxcui };

    const { input, selected, selectedName, selectedRxcui, clearBtn } = inputs[slot];
    input.value = name;
    clearBtn.hidden = false;
    selectedName.textContent  = name;
    selectedRxcui.textContent = rxcui ? `RxCUI: ${rxcui}` : '';
    selected.hidden = false;

    closeAutocomplete(slot);
    if (slot === 'a' && !state.singleMode) inputs.b.wrapper.classList.remove('dimmed');
    updateAnalyzeButton();
  }

  function clearDrug(slot, keepText = false) {
    const key = `drug${slot.toUpperCase()}`;
    state[key] = null;

    const { input, selected, clearBtn } = inputs[slot];
    if (!keepText) { input.value = ''; clearBtn.hidden = true; }
    selected.hidden = true;

    if (slot === 'a' && !state.singleMode) {
      inputs.b.wrapper.classList.add('dimmed');
      clearDrug('b');
    }

    closeAutocomplete(slot);
    updateAnalyzeButton();
    hideResults();
  }

  function updateAnalyzeButton() {
    const hasA = !!state.drugA;
    const hasB = !!state.drugB;
    analyzeBtn.disabled = !hasA || (!state.singleMode && !hasB);
  }

  // Drug B starts dimmed
  inputs.b.wrapper.classList.add('dimmed');

  // ============================================================
  // ANALYZE
  // ============================================================

  analyzeBtn.addEventListener('click', runAnalysis);
  retryBtn.addEventListener('click', runAnalysis);

  async function runAnalysis() {
    const { drugA, drugB, singleMode } = state;
    if (!drugA) return;

    const label = drugA.name + ((!singleMode && drugB) ? ` + ${drugB.name}` : '');
    showLoading(`Analyzing ${label}…`);
    hideError();
    hideResults();

    try {
      const fetchA = API.fetchDrugData(drugA.name);
      const fetchB = (!singleMode && drugB) ? API.fetchDrugData(drugB.name) : Promise.resolve(null);
      const [drugAData, drugBData] = await Promise.all([fetchA, fetchB]);

      let interactions = null;
      if (drugBData) {
        const rxA = drugAData.rxcui;
        const rxB = drugBData.rxcui;
        if (rxA && rxB) interactions = await API.rxnavPairInteractions(rxA, rxB);
      }

      hideLoading();
      showResults();

      const cards = UI.renderDashboard(resultsGrid, severityBar, {
        drugAData,
        drugBData,
        interactions,
        singleMode: singleMode || !drugBData,
      });

      // Stagger card-visible class (CSS transitions handle animation)
      cards.forEach((card, i) => {
        setTimeout(() => card.classList.add('card-visible'), i * 50);
      });

      resultsDash.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
      hideLoading();
      showError(err?.message ?? 'Unable to reach drug database — check your connection.');
      console.error('[Drug Safety Checker]', err);
    }
  }

  // ============================================================
  // UI STATE HELPERS
  // ============================================================

  function showLoading(text) { loadingText.textContent = text; loadingState.hidden = false; }
  function hideLoading()     { loadingState.hidden = true; }
  function showError(msg)    { errorMessage.textContent = msg; errorState.hidden = false; }
  function hideError()       { errorState.hidden = true; }
  function showResults()     { resultsDash.hidden = false; }
  function hideResults()     { resultsDash.hidden = true; resultsGrid.innerHTML = ''; }

  // ============================================================
  // ? POPUP SYSTEM
  // ============================================================

  const POPUP_CONTENT = {
    'drug-profile': {
      title: 'Drug Profile',
      body:  'This shows basic identifying information about the drug — its official name, the ID number used by the US government to track it, and what category of medication it belongs to.',
    },
    'blackbox': {
      title: 'Black Box Warning',
      body:  "A Black Box Warning is the FDA's most serious warning. It means the drug has risks serious enough that doctors and patients must be clearly informed before use. Not all drugs have one — seeing this means extra caution is warranted.",
    },
    'contraindications': {
      title: 'Contraindications',
      body:  'Contraindications are situations where this drug should NOT be used — for example, if you have a certain condition or are taking another medication. Always review these with a doctor or pharmacist.',
    },
    'adverse-events': {
      title: 'Adverse Events',
      body:  "These are side effects that people voluntarily reported to the FDA after taking this drug. They are not proven to be caused by the drug — just reported alongside its use. More reports means it was reported more often, not necessarily that it's more dangerous.",
    },
    'interactions': {
      title: 'Drug Interactions',
      body:  'A drug interaction means two drugs may affect each other when taken together. This can make one drug stronger, weaker, or cause unexpected side effects. Always tell your doctor or pharmacist about every medication you take.',
    },
    'severity-high': {
      title: 'High Severity',
      body:  'High severity means this interaction is considered clinically significant and potentially dangerous. These combinations are often avoided entirely or require very careful monitoring by a doctor.',
    },
    'severity-moderate': {
      title: 'Moderate Severity',
      body:  'Moderate severity means the interaction may cause problems for some people. A doctor or pharmacist may need to adjust doses or monitor you more closely.',
    },
    'severity-low': {
      title: 'Low Severity',
      body:  'Low severity means the interaction exists but is unlikely to cause serious harm for most people. Still worth mentioning to your healthcare provider.',
    },
    'severity-unknown': {
      title: 'Unknown Severity',
      body:  'Interaction data exists but severity has not been fully established. Treat with caution and consult a professional.',
    },
  };

  const modalOverlay = document.getElementById('modal-overlay');
  const modalCard    = document.getElementById('modal-card');
  const modalTitle   = document.getElementById('modal-title');
  const modalBody    = document.getElementById('modal-body');
  const modalClose   = document.getElementById('modal-close');

  function openPopup(popupId) {
    const content = POPUP_CONTENT[popupId];
    if (!content) return;

    modalTitle.textContent = content.title;
    modalBody.textContent  = content.body;
    modalOverlay.hidden    = false;

    // Focus trap — find focusable elements inside modal
    trapFocus(modalCard);
    modalClose.focus();
  }

  function closePopup() {
    modalOverlay.hidden = true;
    releaseFocusTrap();
  }

  // Event delegation: any .help-btn click opens popup
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.help-btn');
    if (btn) {
      e.stopPropagation();
      openPopup(btn.dataset.popup);
      return;
    }

    // Clicking overlay background closes modal
    if (e.target === modalOverlay) closePopup();
  });

  modalClose.addEventListener('click', closePopup);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.hidden) closePopup();
  });

  // ---- Focus Trap ---- //
  let _trapCleanup = null;

  function trapFocus(container) {
    releaseFocusTrap();

    const focusable = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const els = [...container.querySelectorAll(focusable)].filter(el => !el.closest('[hidden]'));
      if (els.length === 0) return;
      const first = els[0];
      const last  = els[els.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handler);
    _trapCleanup = () => document.removeEventListener('keydown', handler);
  }

  function releaseFocusTrap() {
    if (_trapCleanup) { _trapCleanup(); _trapCleanup = null; }
  }

  // ============================================================
  // TOOLTIP SYSTEM
  // ============================================================

  const tooltipEl = document.getElementById('tooltip-bubble');
  let tooltipTimer    = null;
  let currentTermEl   = null;

  function showTooltip(termEl) {
    tooltipEl.textContent = termEl.dataset.def;

    // Position off-screen first so we can measure
    tooltipEl.style.left = '-9999px';
    tooltipEl.style.top  = '-9999px';
    tooltipEl.classList.add('visible');

    const rect = termEl.getBoundingClientRect();
    const tr   = tooltipEl.getBoundingClientRect();

    let top  = rect.top  - tr.height - 8;
    let left = rect.left + rect.width / 2 - tr.width / 2;

    // Flip below if not enough space above
    if (top < 8) top = rect.bottom + 8;

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));

    tooltipEl.style.top  = `${top}px`;
    tooltipEl.style.left = `${left}px`;

    currentTermEl = termEl;
  }

  function hideTooltip() {
    tooltipEl.classList.remove('visible');
    currentTermEl = null;
  }

  // Desktop: hover with 150ms delay
  document.addEventListener('mouseover', (e) => {
    const term = e.target.closest('.term-tooltip');
    if (!term) return;
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => showTooltip(term), 150);
  });

  document.addEventListener('mouseout', (e) => {
    const term = e.target.closest('.term-tooltip');
    if (!term) return;
    clearTimeout(tooltipTimer);
    // Only hide if we're leaving the term element itself
    if (!term.contains(e.relatedTarget)) hideTooltip();
  });

  // Mobile: tap to toggle, tap elsewhere to dismiss
  document.addEventListener('click', (e) => {
    const term = e.target.closest('.term-tooltip');
    if (term) {
      e.stopPropagation();
      clearTimeout(tooltipTimer);
      if (currentTermEl === term && tooltipEl.classList.contains('visible')) {
        hideTooltip();
      } else {
        showTooltip(term);
      }
      return;
    }
    // Tap elsewhere dismisses tooltip
    if (!tooltipEl.contains(e.target)) {
      clearTimeout(tooltipTimer);
      hideTooltip();
    }
  });

  // Keyboard accessibility for term tooltips
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tooltipEl.classList.contains('visible')) {
      hideTooltip();
    }
  });

  // ============================================================
  // INIT
  // ============================================================

  setupAutocomplete('a');
  setupAutocomplete('b');
})();
