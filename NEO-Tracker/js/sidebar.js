// sidebar.js — tab switching and sidebar state

const TABS = ['miss-distance', 'this-week', 'size-speed', 'schedule', 'impact-risk'];

let activeTab = localStorage.getItem('neo_active_tab') || 'miss-distance';
let currentAsteroid = null;

function initSidebar() {
  TABS.forEach(tab => {
    const el = document.getElementById(`tab-${tab}`);
    if (el) el.addEventListener('click', () => switchTab(tab));
  });
  switchTab(activeTab, true);
}

function switchTab(tab, silent) {
  activeTab = tab;
  localStorage.setItem('neo_active_tab', tab);

  TABS.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.classList.toggle('active', t === tab);
  });

  renderPanel(tab);
}

function renderPanel(tab) {
  const panel = document.getElementById('context-panel');
  showLoading(panel);

  switch (tab) {
    case 'miss-distance':   renderMissDistance(panel); break;
    case 'this-week':       renderThisWeek(panel); break;
    case 'size-speed':      renderSizeSpeed(panel); break;
    case 'schedule':        renderSchedule(panel); break;
    case 'impact-risk':     renderImpactRisk(panel); break;
  }
}

// Called on hover — shows basic NeoWs data immediately, no extra fetch
function setHoveredAsteroid(ast) {
  currentAsteroid = ast;
  renderAsteroidCardHover(ast);
}

// Called on click — shows basic data + fetches SBDB orbital elements
function setSelectedAsteroid(ast) {
  currentAsteroid = ast;
  renderAsteroidCardHover(ast);
  fetchOrbitalElements(ast);
}

function clearSelectedAsteroid() {
  currentAsteroid = null;
  const card = document.getElementById('asteroid-card');
  if (card) card.innerHTML = '';
}

function renderAsteroidCardHover(ast) {
  const card = document.getElementById('asteroid-card');
  if (!card) return;
  const insideGEO = isInsideGEO(ast.ld);
  card.innerHTML = `
    <div class="ast-card">
      <div class="ast-card-header">
        <span class="ast-pip" style="background:${ast.hazardColor};box-shadow:0 0 5px ${ast.hazardColor}"></span>
        <span class="ast-name">${ast.name}</span>
      </div>
      <div class="ast-row"><span class="ast-label">DISTANCE</span><span class="ast-value" style="color:${ast.hazardColor}">${ast.ld.toFixed(2)} LD</span></div>
      <div class="ast-row"><span class="ast-label">SIZE</span><span class="ast-value" style="color:${ast.hazardColor}">~${Math.round(ast.diameterM)} m</span></div>
      <div class="ast-row"><span class="ast-label">SPEED</span><span class="ast-value" style="color:${ast.hazardColor}">${ast.speed.toFixed(1)} km/s</span></div>
      ${insideGEO ? `<div class="ast-warning">⚠ passes inside satellite orbit zone</div>` : ''}
      <div id="orbital-section"></div>
    </div>`;
}

function fetchOrbitalElements(ast) {
  const section = document.getElementById('orbital-section');
  if (!section) return;

  // Show loading skeleton
  section.innerHTML = `
    <div class="ast-divider"></div>
    <div class="ast-orbital-label">ORBITAL ELEMENTS</div>
    <div class="skeleton-wrap compact">
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>`;

  // Strip parentheses from designation for the API query
  const des = ast.name.replace(/[()]/g, '').trim();

  fetchSBDB(des).then(data => {
    const section = document.getElementById('orbital-section');
    if (!section) return;

    const elements = data?.orbit?.elements;
    if (!elements || !Array.isArray(elements)) {
      section.innerHTML = `
        <div class="ast-divider"></div>
        <div class="ast-orbital-label">ORBITAL ELEMENTS</div>
        <div class="ast-orbital-na">orbital data unavailable</div>`;
      return;
    }

    const get = (label) => {
      const el = elements.find(e => e.label === label || e.name === label);
      return el ? parseFloat(el.value) : null;
    };

    const a = get('a');
    const e = get('e');
    const i = get('i');
    const per = get('per');

    section.innerHTML = `
      <div class="ast-divider"></div>
      <div class="ast-orbital-label">ORBITAL ELEMENTS</div>
      <div class="ast-row muted">${a !== null ? `<span class="ast-label">SEMI-MAJOR AXIS</span><span class="ast-value-muted">${a.toFixed(3)} AU</span>` : ''}</div>
      <div class="ast-row muted">${e !== null ? `<span class="ast-label">ECCENTRICITY</span><span class="ast-value-muted">${e.toFixed(3)}</span>` : ''}</div>
      <div class="ast-row muted">${i !== null ? `<span class="ast-label">INCLINATION</span><span class="ast-value-muted">${i.toFixed(1)}°</span>` : ''}</div>
      <div class="ast-row muted">${per !== null ? `<span class="ast-label">ORBITAL PERIOD</span><span class="ast-value-muted">${Math.round(per)} days</span>` : ''}</div>`;
  }).catch(() => {
    const section = document.getElementById('orbital-section');
    if (!section) return;
    section.innerHTML = `
      <div class="ast-divider"></div>
      <div class="ast-orbital-label">ORBITAL ELEMENTS</div>
      <div class="ast-orbital-na">orbital data unavailable</div>`;
  });
}

function updateThisWeekBadge(count) {
  const badge = document.getElementById('badge-this-week');
  if (badge) badge.textContent = count !== null ? count : '···';
}
