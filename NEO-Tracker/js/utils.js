// utils.js — unit converters, formatters, helpers

function auToLD(au) {
  return au * 389.17;
}

function ldToKm(ld) {
  return ld * 384400;
}

function hToDiameter(h) {
  return (1329 / Math.sqrt(0.15)) * Math.pow(10, -h / 5);
}

// Maps LD to canvas px radius
// Moon at 1 LD = earthR * 1.6; max ~12 LD = canvasMin * 0.46
function ldToRadius(ld, earthR, canvasMin) {
  const moonR = earthR * 1.6;
  const maxR = canvasMin * 0.46;
  const maxLD = 12;
  // Linear interpolation: 0 LD → earthR edge, 1 LD → moonR, 12 LD → maxR
  if (ld <= 1) {
    return earthR + (moonR - earthR) * ld;
  }
  return moonR + (maxR - moonR) * Math.min((ld - 1) / (maxLD - 1), 1);
}

function isInsideGEO(ld) {
  return ld < 0.11;
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatNumber(n) {
  return Math.round(n).toLocaleString('en-US');
}

function getHazardColor(ld) {
  if (ld < 1) return '#E24B4A';
  if (ld <= 5) return '#EF9F27';
  return '#1D9E75';
}

function dotRadius(diameterM) {
  if (!diameterM || diameterM <= 0) return 3;
  const minD = 1, maxD = 2000;
  const minR = 3, maxR = 6;
  const logMin = Math.log(minD);
  const logMax = Math.log(maxD);
  const logD = Math.log(Math.max(minD, Math.min(maxD, diameterM)));
  return minR + (maxR - minR) * (logD - logMin) / (logMax - logMin);
}

function hashAngle(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  // Return a jitter in radians, spread ±0.35rad
  return ((h & 0xffff) / 0xffff - 0.5) * 0.7;
}

function showLoading(el) {
  el.innerHTML = `
    <div class="skeleton-wrap">
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>`;
}

function showError(el, msg) {
  el.innerHTML = `
    <div class="error-card">
      <span class="error-icon">⚠</span>
      <p>${msg}</p>
      <button class="retry-btn" onclick="location.reload()">Retry</button>
    </div>`;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
