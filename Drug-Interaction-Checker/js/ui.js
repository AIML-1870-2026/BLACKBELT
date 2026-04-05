/* ============================================================
   Drug Safety Checker — UI / Card Rendering
   ============================================================ */

const UI = (() => {

  // ---- Utility ---- //

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function truncate(str, max = 1200) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  function firstItem(arr) {
    if (!arr) return null;
    return Array.isArray(arr) ? arr[0] ?? null : arr;
  }

  // Strip leading field-name labels that OpenFDA sometimes embeds in text
  // e.g. "DESCRIPTION Minocycline hydrochloride..." → "Minocycline hydrochloride..."
  function cleanFdaText(str) {
    if (!str) return str;
    return str.replace(
      /^(DESCRIPTION|CONTRAINDICATIONS|WARNINGS|INDICATIONS AND USAGE|BOXED WARNING|PRECAUTIONS)[:\s]+/i,
      ''
    ).trim();
  }

  // ---- Card Builder ---- //

  /**
   * Builds a collapsible card element.
   * @param {object} opts
   * @param {string} opts.headerClass - CSS modifier class for header colour
   * @param {string} opts.icon        - emoji or HTML for header icon
   * @param {string} opts.title       - card header title
   * @param {string} opts.popupId     - data-popup attribute value for the ? button
   * @param {string} opts.bodyHTML    - inner HTML of the card body
   * @param {boolean} [opts.fullWidth] - span both grid columns
   * @returns {HTMLElement}
   */
  function buildCard({ headerClass, icon, title, popupId, bodyHTML, fullWidth = false }) {
    const card = document.createElement('div');
    card.className = 'card' + (fullWidth ? ' full-width' : '');

    card.innerHTML = `
      <div class="card-header ${headerClass}">
        <div class="card-header-left">
          <span class="card-icon" aria-hidden="true">${icon}</span>
          <span class="card-title">${esc(title)}</span>
        </div>
        <div class="card-header-right">
          <button class="help-btn" data-popup="${esc(popupId)}" aria-label="Learn more about ${esc(title)}">?</button>
          <button class="card-collapse-btn" aria-label="Toggle section" aria-expanded="true">▾</button>
        </div>
      </div>
      <div class="card-body">
        ${bodyHTML}
      </div>
    `;

    // Collapse toggle
    const collapseBtn = card.querySelector('.card-collapse-btn');
    const body        = card.querySelector('.card-body');
    collapseBtn.addEventListener('click', () => {
      const expanded = collapseBtn.getAttribute('aria-expanded') === 'true';
      body.classList.toggle('collapsed', expanded);
      collapseBtn.setAttribute('aria-expanded', String(!expanded));
      collapseBtn.textContent = expanded ? '▸' : '▾';
    });

    // Run term highlighter on the body after content is set
    termHighlighter(body);

    return card;
  }

  // ---- Severity Bar ---- //

  function renderSeverityBar(container) {
    const pills = [
      { color: 'var(--color-danger)',  label: 'High',       desc: 'Potentially dangerous — avoid or use only under medical supervision' },
      { color: 'var(--color-warning)', label: 'Moderate',   desc: 'Use with caution — doctor may need to adjust treatment' },
      { color: 'var(--color-caution)', label: 'Low',        desc: 'Minor concern — mention to your pharmacist' },
      { color: 'var(--color-safe)',    label: 'None found',  desc: 'No known interactions — does not guarantee safety' },
    ];

    container.innerHTML = pills.map(p => `
      <div class="severity-bar-pill">
        <span class="severity-bar-dot" style="background:${p.color}"></span>
        <span class="severity-bar-label">${p.label}</span>
        <span>${esc(p.desc)}</span>
      </div>
    `).join('');
  }

  // ---- Drug Profile Card ---- //

  function renderDrugProfile(drugData, slot) {
    const { displayName, rxcui, properties, drugClass, labelData } = drugData;

    const genericName = properties?.synonym
      ?? firstItem(labelData?.openfda?.generic_name)
      ?? '';
    const brandName = firstItem(labelData?.openfda?.brand_name) ?? '';

    let titleDisplay = displayName;
    let subtitleDisplay = '';

    if (brandName && genericName && brandName.toLowerCase() !== genericName.toLowerCase()) {
      titleDisplay    = brandName;
      subtitleDisplay = genericName;
    } else if (genericName && genericName.toLowerCase() !== displayName.toLowerCase()) {
      subtitleDisplay = genericName;
    }

    const rawDesc   = firstItem(labelData?.description) ?? firstItem(labelData?.indications_and_usage) ?? '';
    const description = cleanFdaText(rawDesc);

    const bodyHTML = `
      <div class="drug-tag ${slot}">${slot === 'a' ? 'Drug A' : 'Drug B'}</div>
      <div class="drug-profile-name">${esc(titleDisplay)}</div>
      ${subtitleDisplay ? `<div class="drug-profile-generic">${esc(subtitleDisplay)}</div>` : ''}
      <div class="drug-meta-row">
        ${rxcui      ? `<span class="drug-meta-chip"><span class="chip-label">RxCUI</span>${esc(rxcui)}</span>` : ''}
        ${drugClass  ? `<span class="drug-meta-chip"><span class="chip-label">Class</span>${esc(drugClass)}</span>` : ''}
        ${!rxcui && !drugClass ? '<span class="drug-meta-chip">Limited RxNorm data</span>' : ''}
      </div>
      ${description ? `<div class="drug-description">${esc(truncate(description, 600))}</div>` : ''}
    `;

    return buildCard({
      headerClass: 'blue',
      icon: '💊',
      title: `Drug Profile — ${titleDisplay}`,
      popupId: 'drug-profile',
      bodyHTML,
    });
  }

  // ---- Black Box Warning Card ---- //

  function renderBlackBoxWarning(drugData) {
    const raw = firstItem(drugData?.labelData?.boxed_warning);
    if (!raw) return null;

    const bodyHTML = `
      <div class="blackbox-warning-text">${esc(truncate(cleanFdaText(raw), 1500))}</div>
      <div class="blackbox-note">
        ⚠ This drug carries an FDA Black Box Warning — the most serious warning type issued by the FDA.
      </div>
    `;

    return buildCard({
      headerClass: 'red',
      icon: '⬛',
      title: 'FDA Black Box Warning',
      popupId: 'blackbox',
      bodyHTML,
    });
  }

  // ---- Contraindications Card ---- //

  function renderContraindications(drugData) {
    const raw = firstItem(drugData?.labelData?.contraindications);
    const text = raw ? cleanFdaText(raw) : null;

    const bodyHTML = text
      ? `<div class="contraindications-text">${esc(truncate(text, 1200))}</div>`
      : `<p class="no-data-text">No contraindication data available from FDA label.</p>`;

    return buildCard({
      headerClass: 'orange',
      icon: '🚫',
      title: 'Contraindications',
      popupId: 'contraindications',
      bodyHTML,
    });
  }

  // ---- Adverse Events Card ---- //

  function renderAdverseEvents(drugData) {
    const events = drugData?.adverseEvents ?? [];

    let bodyHTML;
    if (events.length === 0) {
      bodyHTML = `<p class="no-data-text">No adverse event data available for this drug.</p>`;
    } else {
      const maxCount = events[0]?.count ?? 1;
      const items = events.map((ev, i) => {
        const pct = Math.round((ev.count / maxCount) * 100);
        return `
          <li class="adverse-item">
            <span class="adverse-rank">#${i + 1}</span>
            <span class="adverse-name">${esc((ev.term ?? '').toLowerCase())}</span>
            <div class="adverse-bar-wrap">
              <div class="adverse-bar" style="width:${pct}%"></div>
            </div>
            <span class="adverse-count">${ev.count.toLocaleString()} reports</span>
          </li>
        `;
      }).join('');

      bodyHTML = `
        <ul class="adverse-list">${items}</ul>
        <p class="adverse-disclaimer">
          Based on voluntary self-reports to FDA (FAERS). Frequency does not imply causation.
        </p>
      `;
    }

    return buildCard({
      headerClass: 'yellow',
      icon: '📊',
      title: 'Top Adverse Events (FAERS)',
      popupId: 'adverse-events',
      bodyHTML,
    });
  }

  // ---- Interaction Analysis Card ---- //

  function renderInteractions(interactions, drugA, drugB) {
    let headerClass, bodyHTML;

    if (!interactions || interactions.length === 0) {
      headerClass = 'green';
      bodyHTML = `
        <p class="no-interaction-msg">
          ✓ No known interactions found between <strong>${esc(drugA)}</strong> and <strong>${esc(drugB)}</strong>.
        </p>
        <p class="adverse-disclaimer" style="margin-top:12px;">
          Absence of data does not confirm safety. Always consult a healthcare provider.
        </p>
      `;
    } else {
      const severityOrder = { high: 3, moderate: 2, low: 1, unknown: 0 };
      const worst = interactions.reduce((best, item) => {
        return (severityOrder[item.severity] ?? 0) > (severityOrder[best] ?? 0) ? item.severity : best;
      }, 'unknown');

      const headerColorMap = { high: 'red', moderate: 'orange', low: 'yellow', unknown: 'gray' };
      headerClass = headerColorMap[worst] ?? 'gray';

      const items = interactions.map(item => `
        <div class="interaction-item">
          <div class="interaction-item-header">
            <span class="severity-badge ${item.severity}">
              ${esc(item.severity.toUpperCase())}
              <button class="help-btn" data-popup="severity-${item.severity}" aria-label="What does ${item.severity} severity mean?">?</button>
            </span>
            <span class="interaction-source">${esc(item.source)}</span>
          </div>
          <div class="interaction-description">${esc(item.description)}</div>
        </div>
      `).join('');

      bodyHTML = `<div class="interaction-list">${items}</div>`;
    }

    return buildCard({
      headerClass,
      icon: '⚡',
      title: `Interaction Analysis — ${drugA} + ${drugB}`,
      popupId: 'interactions',
      bodyHTML,
      fullWidth: true,
    });
  }

  // ---- Section Label ---- //

  function renderSectionLabel(text) {
    const el = document.createElement('div');
    el.className = 'results-section-label';
    el.textContent = text;
    return el;
  }

  // ---- Full Dashboard ---- //

  /**
   * Renders the full results dashboard.
   * Returns an array of card elements so the caller can stagger animations.
   */
  function renderDashboard(grid, severityBarEl, { drugAData, drugBData, interactions, singleMode }) {
    grid.innerHTML = '';

    // Populate severity bar
    renderSeverityBar(severityBarEl);

    const nameA = drugAData.displayName;
    const nameB = drugBData?.displayName ?? '';

    const cards = [];

    function append(el) {
      if (!el) return;
      grid.appendChild(el);
      if (el.classList.contains('card')) cards.push(el);
    }

    if (singleMode || !drugBData) {
      append(renderDrugProfile(drugAData, 'a'));
      append(renderBlackBoxWarning(drugAData));
      append(renderContraindications(drugAData));
      append(renderAdverseEvents(drugAData));
    } else {
      append(renderSectionLabel(`Drug A — ${nameA}`));
      append(renderDrugProfile(drugAData, 'a'));
      append(renderBlackBoxWarning(drugAData));
      append(renderContraindications(drugAData));
      append(renderAdverseEvents(drugAData));

      append(renderSectionLabel(`Drug B — ${nameB}`));
      append(renderDrugProfile(drugBData, 'b'));
      append(renderBlackBoxWarning(drugBData));
      append(renderContraindications(drugBData));
      append(renderAdverseEvents(drugBData));

      append(renderInteractions(interactions, nameA, nameB));
    }

    return cards;
  }

  return { renderDashboard };
})();

window.UI = UI;
