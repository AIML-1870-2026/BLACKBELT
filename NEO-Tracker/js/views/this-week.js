// views/this-week.js — This Week right panel

function renderThisWeek(panel) {
  panel.innerHTML = `
    <div class="panel-section">
      <h2 class="panel-title">This week's passes</h2>
    </div>
    <div id="this-week-list" class="panel-scroll-list">
      <div class="skeleton-wrap">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>`;

  getNeoData((err, data) => {
    const list = document.getElementById('this-week-list');
    if (!list) return;

    if (err) {
      list.innerHTML = `<div class="error-card"><span class="error-icon">⚠</span><p>Could not load data</p><button class="retry-btn" onclick="renderPanel('this-week')">Retry</button></div>`;
      return;
    }

    // Sort by close approach date ascending
    const sorted = [...data].sort((a, b) => {
      const da = a.close_approach_data?.[0]?.close_approach_date || '';
      const db = b.close_approach_data?.[0]?.close_approach_date || '';
      return da.localeCompare(db);
    });

    if (sorted.length === 0) {
      list.innerHTML = `<div class="muted-text">No passes found this week.</div>`;
      return;
    }

    list.innerHTML = sorted.map(neo => {
      const ca = neo.close_approach_data?.[0];
      const ld = ca ? parseFloat(ca.miss_distance.lunar) : 999;
      const color = getHazardColor(ld);
      const date = ca ? formatDate(ca.close_approach_date) : '—';
      return `
        <div class="week-row" onclick="selectAsteroidById('${neo.id}')" data-id="${neo.id}">
          <span class="week-pip" style="background:${color}"></span>
          <span class="week-name">${neo.name}</span>
          <span class="week-date">${date}</span>
          <span class="week-dist" style="color:${color}">${ld.toFixed(2)} LD</span>
        </div>`;
    }).join('');
  });
}
