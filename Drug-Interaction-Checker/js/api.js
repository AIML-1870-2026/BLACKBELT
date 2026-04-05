/* ============================================================
   Drug Safety Checker — API Layer
   RxNorm · RxNav Interactions · OpenFDA
   ============================================================ */

const RXNAV_BASE = 'https://rxnav.nlm.nih.gov/REST';
const OPENFDA_BASE = 'https://api.fda.gov/drug';

// ---- Helpers ---- //

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

// Normalise a drug name for use in URL path segments
function encodeDrugName(name) {
  return encodeURIComponent(name.trim());
}

// ---- RxNorm ---- //

/**
 * Returns up to 10 spelling suggestion strings for the given query.
 */
async function rxnormAutocomplete(query) {
  if (!query || query.length < 2) return [];
  try {
    const url = `${RXNAV_BASE}/spellingsuggestions.json?name=${encodeDrugName(query)}`;
    const data = await fetchJSON(url);
    return data?.suggestionGroup?.suggestionList?.suggestion ?? [];
  } catch {
    return [];
  }
}

/**
 * Resolves a drug name to an RxCUI.
 * Returns null if not found.
 */
async function rxnormResolveName(name) {
  try {
    const url = `${RXNAV_BASE}/rxcui.json?name=${encodeDrugName(name)}&search=1`;
    const data = await fetchJSON(url);
    const rxcui = data?.idGroup?.rxnormId?.[0];
    return rxcui ?? null;
  } catch {
    return null;
  }
}

/**
 * Gets display properties for a given RxCUI.
 */
async function rxnormGetProperties(rxcui) {
  try {
    const url = `${RXNAV_BASE}/rxcui/${rxcui}/properties.json`;
    const data = await fetchJSON(url);
    return data?.properties ?? null;
  } catch {
    return null;
  }
}

/**
 * Gets drug class information for a given RxCUI.
 */
async function rxnormGetDrugClass(rxcui) {
  try {
    const url = `${RXNAV_BASE}/rxclass/class/byRxcui.json?rxcui=${rxcui}`;
    const data = await fetchJSON(url);
    const classes = data?.rxclassDrugInfoList?.rxclassDrugInfo;
    if (!classes || classes.length === 0) return null;
    // Prefer EPC (established pharmacologic class) or MoA
    const epc = classes.find(c => c.rxclassMinConceptItem?.classType === 'EPC');
    const moa = classes.find(c => c.rxclassMinConceptItem?.classType === 'MoA');
    const target = epc || moa || classes[0];
    return target?.rxclassMinConceptItem?.className ?? null;
  } catch {
    return null;
  }
}

// ---- RxNav Interactions ---- //

/**
 * Fetches known interactions for a single RxCUI.
 */
async function rxnavSingleInteractions(rxcui) {
  try {
    const url = `${RXNAV_BASE}/interaction/interaction.json?rxcui=${rxcui}`;
    const data = await fetchJSON(url);
    return data?.interactionTypeGroup ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetches interactions between two RxCUIs.
 * Returns a flat array of interaction objects.
 */
async function rxnavPairInteractions(rxcuiA, rxcuiB) {
  try {
    const url = `${RXNAV_BASE}/interaction/list.json?rxcuis=${rxcuiA}+${rxcuiB}`;
    const data = await fetchJSON(url);
    const groups = data?.fullInteractionTypeGroup ?? [];
    const interactions = [];
    for (const group of groups) {
      const source = group.sourceName ?? 'RxNav';
      for (const typeGroup of (group.fullInteractionType ?? [])) {
        for (const pair of (typeGroup.interactionPair ?? [])) {
          interactions.push({
            description: pair.description ?? '',
            severity: normalizeSeverity(pair.severity),
            source,
          });
        }
      }
    }
    return interactions;
  } catch {
    return [];
  }
}

function normalizeSeverity(raw) {
  if (!raw) return 'unknown';
  const s = raw.toLowerCase();
  if (s.includes('high') || s.includes('major')) return 'high';
  if (s.includes('moderate')) return 'moderate';
  if (s.includes('low') || s.includes('minor')) return 'low';
  return 'unknown';
}

// ---- OpenFDA ---- //

/**
 * Fetches FDA label data (warnings, contraindications, boxed warnings).
 * Falls back to brand_name search if generic_name returns nothing.
 */
async function openfdaLabel(drugName) {
  const searches = [
    `openfda.generic_name:"${encodeDrugName(drugName)}"`,
    `openfda.brand_name:"${encodeDrugName(drugName)}"`,
    `openfda.substance_name:"${encodeDrugName(drugName)}"`,
  ];

  for (const search of searches) {
    try {
      const url = `${OPENFDA_BASE}/label.json?search=${search}&limit=1`;
      const data = await fetchJSON(url);
      if (data?.results?.[0]) return data.results[0];
    } catch {
      // try next search variant
    }
  }
  return null;
}

/**
 * Fetches top 10 adverse events from FAERS for a drug name.
 */
async function openfdaAdverseEvents(drugName) {
  try {
    const search = `patient.drug.medicinalproduct:"${encodeDrugName(drugName)}"`;
    const count = 'patient.reaction.reactionmeddrapt.exact';
    const url = `${OPENFDA_BASE}/event.json?search=${search}&count=${count}&limit=10`;
    const data = await fetchJSON(url);
    return data?.results ?? [];
  } catch {
    return [];
  }
}

// ---- High-level Drug Data Fetcher ---- //

/**
 * Resolves a drug name to RxCUI then fetches all relevant data.
 * Returns a structured drug data object.
 */
async function fetchDrugData(name) {
  // Step 1: Resolve RxCUI
  let rxcui = await rxnormResolveName(name);

  // Step 2: Get RxNorm properties
  let properties = null;
  let drugClass = null;
  if (rxcui) {
    [properties, drugClass] = await Promise.all([
      rxnormGetProperties(rxcui),
      rxnormGetDrugClass(rxcui),
    ]);
  }

  // Display name: prefer properties name, else the user-supplied name
  const displayName = properties?.name ?? name;

  // Step 3: Fetch FDA data in parallel
  const [labelData, adverseEvents] = await Promise.all([
    openfdaLabel(displayName),
    openfdaAdverseEvents(displayName),
  ]);

  // If still no rxcui and we have label data, try to use it
  if (!rxcui && !labelData) {
    throw new Error(`Could not find '${name}' — try a different spelling or brand name`);
  }

  return {
    inputName: name,
    displayName,
    rxcui,
    properties,
    drugClass,
    labelData,
    adverseEvents,
  };
}

// Export to global scope for use in app.js / ui.js
window.API = {
  rxnormAutocomplete,
  rxnormResolveName,
  rxnavPairInteractions,
  rxnavSingleInteractions,
  fetchDrugData,
};
