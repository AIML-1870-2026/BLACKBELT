// views/schedule.js — Schedule right panel

function renderSchedule(panel) {
  panel.innerHTML = `
    <div class="panel-section">
      <h2 class="panel-title">Approach schedule</h2>
    </div>
    <div id="schedule-list">
      <div class="skeleton-wrap">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
      </div>
    </div>`;

  getNeoData((err, data) => {
    const list = document.getElementById('schedule-list');
    if (!list) return;

    if (err) {
      list.innerHTML = `<div class="error-card"><span class="error-icon">⚠</span><p>Could not load data</p><button class="retry-btn" onclick="renderPanel('schedule')">Retry</button></div>`;
      return;
    }

    // Group by date
    const byDate = {};
    for (const neo of data) {
      const ca = neo.close_approach_data?.[0];
      if (!ca) continue;
      const date = ca.close_approach_date;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(neo);
    }

    const today = new Date().toISOString().slice(0, 10);
    const dates = Object.keys(byDate).sort();

    if (dates.length === 0) {
      list.innerHTML = `<div class="muted-text">No passes found.</div>`;
      return;
    }

    list.innerHTML = dates.map(date => {
      const isToday = date === today;
      const neos = byDate[date];
      const rows = neos.map(neo => {
        const ca = neo.close_approach_data[0];
        const ld = parseFloat(ca.miss_distance.lunar);
        const color = getHazardColor(ld);
        const time = ca.close_approach_date_full?.slice(11, 16) || '—';
        return `
          <div class="sched-row">
            <span class="sched-name">${neo.name}</span>
            <span class="sched-time">${time} UTC</span>
            <span class="sched-dist" style="color:${color}">${ld.toFixed(2)} LD</span>
          </div>`;
      }).join('');

      return `
        <div class="sched-day ${isToday ? 'sched-today' : ''}">
          <div class="sched-day-header">${formatDate(date)}${isToday ? '<span class="today-badge">TODAY</span>' : ''}</div>
          ${rows || '<div class="muted-text sched-empty">No passes</div>'}
        </div>`;
    }).join('');
  });
}
