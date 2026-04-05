/* ============================================================
   Drug Safety Checker — Glossary & Term Highlighter
   ============================================================ */

const GLOSSARY = {
  'QT prolongation':    'A change in heart rhythm that can lead to dangerous irregular heartbeats',
  'CYP450 / CYP3A4':   'Liver enzymes that break down drugs — if two drugs use the same enzyme, one can build up to dangerous levels',
  'CYP450':             'A group of liver enzymes responsible for breaking down many common drugs',
  'CYP3A4':             'A liver enzyme that breaks down many drugs — if two drugs share it, one can build up to dangerous levels',
  'contraindicated':    'Should not be used — the risks outweigh any benefit in this situation',
  'bradycardia':        'Abnormally slow heart rate',
  'tachycardia':        'Abnormally fast heart rate',
  'hepatotoxicity':     'Liver damage caused by a drug or chemical',
  'nephrotoxicity':     'Kidney damage caused by a drug or chemical',
  'hypotension':        'Abnormally low blood pressure',
  'hypertension':       'Abnormally high blood pressure',
  'serotonin syndrome': 'A potentially life-threatening reaction from too much serotonin activity, often from combining certain antidepressants',
  'anticoagulant':      'A drug that prevents blood clotting ("blood thinner")',
  'MAOI':               'A type of antidepressant that has many dangerous interactions with other drugs and foods',
  'NSAID':              'Non-steroidal anti-inflammatory drug — common pain relievers like ibuprofen and naproxen',
  'arrhythmia':         'Irregular heartbeat',
  'bioavailability':    'How much of a drug actually reaches the bloodstream after you take it',
};

/**
 * Scans text nodes inside `container` and wraps glossary terms with
 * <span class="term-tooltip" data-def="..."> for tooltip display.
 * Never double-wraps already-processed terms.
 */
function termHighlighter(container) {
  if (!container) return;

  // Sort terms longest-first so multi-word terms match before substrings
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

  function escAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Collect eligible text nodes (not inside .term-tooltip, not inside header)
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('.term-tooltip'))  return NodeFilter.FILTER_REJECT;
        if (parent.closest('.card-header'))   return NodeFilter.FILTER_REJECT;
        if (parent.closest('.drug-tag'))      return NodeFilter.FILTER_REJECT;
        if (parent.closest('.drug-meta-chip')) return NodeFilter.FILTER_REJECT;
        if (node.textContent.trim() === '')   return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (const node of textNodes) {
    let html = node.textContent;
    let modified = false;

    for (const term of terms) {
      const pattern = escapeRegex(term).replace(/\s+/g, '\\s+');
      const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');
      if (regex.test(html)) {
        const def = escAttr(GLOSSARY[term]);
        html = html.replace(regex, `<span class="term-tooltip" data-def="${def}" tabindex="0" role="button" aria-label="${term}: ${escAttr(GLOSSARY[term])}">$1</span>`);
        modified = true;
      }
    }

    if (modified) {
      const wrapper = document.createElement('span');
      wrapper.innerHTML = html;
      node.parentNode.replaceChild(wrapper, node);
    }
  }
}

window.GLOSSARY = GLOSSARY;
window.termHighlighter = termHighlighter;
