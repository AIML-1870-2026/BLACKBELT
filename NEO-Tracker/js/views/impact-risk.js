// views/impact-risk.js — Impact Risk right panel

function renderImpactRisk(panel) {
  panel.innerHTML = `
    <div class="panel-section">
      <h2 class="panel-title">Sentry impact monitor</h2>
    </div>
    <div id="sentry-list">
      <div class="skeleton-wrap">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>
    <div class="panel-footer">
      <a href="https://sentry.jpl.nasa.gov" target="_blank" rel="noopener" class="panel-link">
        ↗ sentry.jpl.nasa.gov
      </a>
    </div>`;

  fetchSentryData().then(data => {
    const list = document.getElementById('sentry-list');
    if (!list) return;

    const objects = data?.data;
    if (!objects || objects.length === 0) {
      list.innerHTML = `<div class="muted-text">No objects in Sentry database.</div>`;
      return;
    }

    // data.fields tells us column order
    const fields = data.fields || [];
    const idx = (name) => fields.indexOf(name);

    const iDes  = idx('des');
    const iFull = idx('fullname');
    const iIp   = idx('ip');
    const iPs   = idx('ps');
    const iTs   = idx('ts');
    const iRange= idx('range');
    const iDiam = idx('diameter');

    // Sort by Palermo scale descending (most dangerous first)
    const sorted = [...objects].sort((a, b) => {
      const pa = parseFloat(a[iPs]) || -99;
      const pb = parseFloat(b[iPs]) || -99;
      return pb - pa;
    });

    list.innerHTML = sorted.map(obj => {
      const ps = parseFloat(obj[iPs]);
      const ts = parseInt(obj[iTs]) || 0;
      const ip = obj[iIp] ? (parseFloat(obj[iIp]) * 100).toExponential(2) + '%' : '—';
      const name = obj[iFull] || obj[iDes] || '—';
      const range = obj[iRange] || '—';
      const diam = obj[iDiam] ? `${parseFloat(obj[iDiam]).toFixed(2)} km` : '—';

      let psColor = '#1D9E75';
      if (ps > 0) psColor = '#E24B4A';
      else if (ps > -2) psColor = '#EF9F27';

      let tsBg = 'rgba(29,158,117,0.15)';
      if (ts >= 4) tsBg = 'rgba(226,75,74,0.2)';
      else if (ts >= 1) tsBg = 'rgba(239,159,39,0.15)';

      return `
        <div class="sentry-card">
          <div class="sentry-card-header">
            <span class="sentry-name">${name}</span>
            <span class="sentry-ts-badge" style="background:${tsBg}">Torino ${ts}</span>
          </div>
          <div class="sentry-row">
            <span class="ast-label">PALERMO SCALE</span>
            <span class="sentry-ps" style="color:${psColor}">${isNaN(ps) ? '—' : ps.toFixed(2)}</span>
          </div>
          <div class="sentry-row">
            <span class="ast-label">IMPACT PROB.</span>
            <span class="ast-value-muted">${ip}</span>
          </div>
          <div class="sentry-row">
            <span class="ast-label">YEAR RANGE</span>
            <span class="ast-value-muted">${range}</span>
          </div>
          <div class="sentry-row">
            <span class="ast-label">DIAMETER</span>
            <span class="ast-value-muted">${diam}</span>
          </div>
        </div>`;
    }).join('');
  }).catch(() => {
    const list = document.getElementById('sentry-list');
    if (!list) return;
    list.innerHTML = `
      <div class="error-card">
        <span class="error-icon">⚠</span>
        <p>Could not load Sentry data</p>
        <button class="retry-btn" onclick="renderPanel('impact-risk')">Retry</button>
      </div>
      <div class="panel-footer" style="margin-top:8px">
        <a href="https://sentry.jpl.nasa.gov" target="_blank" rel="noopener" class="panel-link">
          ↗ View Sentry data directly
        </a>
      </div>`;
  });
}
