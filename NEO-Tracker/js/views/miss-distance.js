// views/miss-distance.js — Miss Distance right panel

function renderMissDistance(panel) {
  panel.innerHTML = `
    <div class="panel-section">
      <div class="panel-eyebrow">ACTIVE VIEW</div>
      <h2 class="panel-title">How close is close?</h2>
      <div class="panel-subheading">Miss distance</div>
      <p class="panel-body">
        Each glowing dot represents a near-Earth object passing within the next 7 days.
        Distance is measured in Lunar Distances (LD) — the average gap between Earth and Moon.
        The Moon reference dot marks exactly 1 LD.
      </p>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section">
      <div class="panel-label">COLOR LEGEND</div>
      <div class="legend-row"><span class="legend-pip" style="background:#E24B4A"></span><span>&lt; 1 LD — very close pass</span></div>
      <div class="legend-row"><span class="legend-pip" style="background:#EF9F27"></span><span>1 – 5 LD — moderate distance</span></div>
      <div class="legend-row"><span class="legend-pip" style="background:#1D9E75"></span><span>&gt; 5 LD — safe distance</span></div>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section">
      <div class="panel-label">ORBIT LEGEND</div>
      <div class="legend-row">
        <span class="legend-dash-geo"></span>
        <span>GEO ring — geosynchronous orbit (~0.11 LD)</span>
      </div>
      <div class="legend-row">
        <span class="legend-leo-band"></span>
        <span>LEO band — low Earth orbit region</span>
      </div>
    </div>

    <div class="panel-divider"></div>

    <div class="hint-box">
      Drag to orbit &nbsp;·&nbsp; Scroll to zoom &nbsp;·&nbsp; Click an asteroid for details
    </div>`;
}
