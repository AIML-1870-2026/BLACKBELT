// views/impact-risk.js — Impact Risk right panel
// Sentry API (Sentry-II) returns named object properties, not field-indexed arrays.
// Current fields: des, fullname, h, diameter, v_inf, ps_cum, ps_max, n_imp, range, last_obs

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

    // Sort by cumulative Palermo scale descending (most dangerous first)
    const sorted = [...objects].sort((a, b) => {
      const pa = parseFloat(a.ps_cum) || -99;
      const pb = parseFloat(b.ps_cum) || -99;
      return pb - pa;
    });

    list.innerHTML = sorted.map(obj => {
      const ps   = parseFloat(obj.ps_cum);
      const name = obj.fullname || obj.des || '—';
      const range = obj.range   || '—';
      const nImp  = obj.n_imp   ? parseInt(obj.n_imp).toLocaleString() : '—';
      const diam  = obj.diameter
        ? `${parseFloat(obj.diameter) < 1
            ? (parseFloat(obj.diameter) * 1000).toFixed(0) + ' m'
            : parseFloat(obj.diameter).toFixed(2) + ' km'}`
        : '—';
      const vel   = obj.v_inf   ? `${parseFloat(obj.v_inf).toFixed(1)} km/s` : '—';

      let psColor = '#1D9E75';
      if (ps > 0)  psColor = '#E24B4A';
      else if (ps > -2) psColor = '#EF9F27';

      return `
        <div class="sentry-card">
          <div class="sentry-card-header">
            <span class="sentry-name">${name}</span>
            <span class="sentry-ts-badge" style="background:rgba(29,158,117,0.15)">
              ${nImp} impact${nImp === '1' ? '' : 's'}
            </span>
          </div>
          <div class="sentry-row">
            <span class="ast-label">PALERMO SCALE</span>
            <span class="sentry-ps" style="color:${psColor}">${isNaN(ps) ? '—' : ps.toFixed(2)}</span>
          </div>
          <div class="sentry-row">
            <span class="ast-label">YEAR RANGE</span>
            <span class="ast-value-muted">${range}</span>
          </div>
          <div class="sentry-row">
            <span class="ast-label">DIAMETER</span>
            <span class="ast-value-muted">${diam}</span>
          </div>
          <div class="sentry-row">
            <span class="ast-label">IMPACT VEL.</span>
            <span class="ast-value-muted">${vel}</span>
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
