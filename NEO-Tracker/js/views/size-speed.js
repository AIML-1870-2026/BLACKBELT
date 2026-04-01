// views/size-speed.js — Size & Speed right panel

let sizeSpeedMode = 'diameter'; // 'diameter' | 'velocity'

function renderSizeSpeed(panel) {
  sizeSpeedMode = 'diameter';
  panel.innerHTML = `
    <div class="panel-section">
      <h2 class="panel-title">Size &amp; speed</h2>
      <div class="pill-toggle">
        <button id="pill-diameter" class="pill active" onclick="setSizeSpeedMode('diameter')">Diameter</button>
        <button id="pill-velocity" class="pill" onclick="setSizeSpeedMode('velocity')">Velocity</button>
      </div>
    </div>
    <div id="size-speed-chart" class="bar-chart">
      <div class="skeleton-wrap">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>`;

  getNeoData((err, data) => {
    renderBarChart(err, data);
  });
}

function setSizeSpeedMode(mode) {
  sizeSpeedMode = mode;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  const btn = document.getElementById(`pill-${mode}`);
  if (btn) btn.classList.add('active');

  getNeoData((err, data) => renderBarChart(err, data));
}

function renderBarChart(err, data) {
  const chart = document.getElementById('size-speed-chart');
  if (!chart) return;

  if (err) {
    chart.innerHTML = `<div class="error-card"><span class="error-icon">⚠</span><p>Could not load data</p><button class="retry-btn" onclick="renderPanel('size-speed')">Retry</button></div>`;
    return;
  }

  const isDiam = sizeSpeedMode === 'diameter';
  const sorted = [...data].sort((a, b) => {
    if (isDiam) {
      const da = a.estimated_diameter?.meters?.estimated_diameter_max || 0;
      const db = b.estimated_diameter?.meters?.estimated_diameter_max || 0;
      return db - da;
    } else {
      const va = parseFloat(a.close_approach_data?.[0]?.relative_velocity?.kilometers_per_second || 0);
      const vb = parseFloat(b.close_approach_data?.[0]?.relative_velocity?.kilometers_per_second || 0);
      return vb - va;
    }
  }).slice(0, 20); // top 20

  const maxVal = Math.max(...sorted.map(neo => {
    if (isDiam) return neo.estimated_diameter?.meters?.estimated_diameter_max || 0;
    return parseFloat(neo.close_approach_data?.[0]?.relative_velocity?.kilometers_per_second || 0);
  }));

  chart.innerHTML = sorted.map(neo => {
    const ca = neo.close_approach_data?.[0];
    const ld = ca ? parseFloat(ca.miss_distance.lunar) : 999;
    const color = getHazardColor(ld);
    const val = isDiam
      ? (neo.estimated_diameter?.meters?.estimated_diameter_max || 0)
      : parseFloat(ca?.relative_velocity?.kilometers_per_second || 0);
    const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
    const label = isDiam ? `${Math.round(val)} m` : `${val.toFixed(1)} km/s`;

    return `
      <div class="bar-row" data-id="${neo.id}"
           onmouseenter="selectAsteroidById('${neo.id}')"
           onmouseleave="">
        <div class="bar-name">${neo.name.replace(/[()]/g, '').trim().slice(0, 18)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
          <span class="bar-value" style="color:${color}">${label}</span>
        </div>
      </div>`;
  }).join('');
}
