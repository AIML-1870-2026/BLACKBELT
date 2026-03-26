const API_KEY = '90bcec9d6f263b92dab1408d59dcff0c';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEO_URL = 'https://api.openweathermap.org/geo/1.0';

// ==================== DOM REFS ====================
const cityInput     = document.getElementById('city-input');
const searchBtn     = document.getElementById('search-btn');
const locationBtn   = document.getElementById('location-btn');
const locationError = document.getElementById('location-error');
const searchError   = document.getElementById('search-error');
const alertBanner   = document.getElementById('alert-banner');
const weatherContent = document.getElementById('weather-content');
const loadingState  = document.getElementById('loading-state');
const mainCard      = document.getElementById('main-card');

// ==================== BACKGROUND CANVAS ====================
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx    = bgCanvas.getContext('2d');

let animationId  = null;
let particles    = [];
let frame        = 0;
let thunderTimer = 180;
let thunderFlash = 0;

function resizeCanvas() {
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resizeCanvas(); });
resizeCanvas();

function getConditionType(id, isDay) {
  if (!id) return 'default';
  if (id >= 200 && id < 300) return 'thunderstorm';
  if (id >= 300 && id < 600) return 'rain';
  if (id >= 600 && id < 700) return 'snow';
  if (id >= 700 && id < 800) return 'fog';
  if (id === 800) return isDay ? 'clear-day' : 'clear-night';
  if (id > 800) return 'clouds';
  return 'default';
}

function initParticles(type) {
  particles = [];
  const w = bgCanvas.width;
  const h = bgCanvas.height;

  if (type === 'rain' || type === 'thunderstorm') {
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * (w + 80),
        y: Math.random() * h,
        len: Math.random() * 20 + 10,
        speed: Math.random() * 8 + 6,
        opacity: Math.random() * 0.4 + 0.3
      });
    }
  } else if (type === 'snow') {
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 4 + 2,
        speed: Math.random() * 1.5 + 0.5,
        phase: Math.random() * Math.PI * 2,
        opacity: Math.random() * 0.6 + 0.4
      });
    }
  } else if (type === 'clear-night') {
    for (let i = 0; i < 200; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.85,
        r: Math.random() * 1.5 + 0.3,
        base: Math.random() * 0.8 + 0.2,
        phase: Math.random() * Math.PI * 2,
        rate: Math.random() * 0.025 + 0.005
      });
    }
  } else if (type === 'clouds') {
    for (let i = 0; i < 7; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * (h * 0.5) + 40,
        speed: Math.random() * 0.35 + 0.1,
        size: Math.random() * 100 + 60,
        opacity: Math.random() * 0.09 + 0.04
      });
    }
  } else if (type === 'fog') {
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: Math.random() * 0.4 + 0.1,
        rw: Math.random() * 300 + 200,
        rh: Math.random() * 60 + 30,
        opacity: Math.random() * 0.055 + 0.02
      });
    }
  } else if (type === 'clear-day') {
    for (let i = 0; i < 8; i++) {
      particles.push({
        angle: (Math.PI * 2 / 8) * i,
        drift: Math.random() * 0.002 + 0.001,
        len: Math.random() * 200 + 160,
        opacity: Math.random() * 0.055 + 0.02
      });
    }
  } else {
    // default: floating orbs
    for (let i = 0; i < 14; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 90 + 40,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        opacity: Math.random() * 0.07 + 0.02
      });
    }
  }
}

function drawBackground(type) {
  const w = bgCanvas.width;
  const h = bgCanvas.height;

  const grad = bgCtx.createLinearGradient(0, 0, 0, h);
  if (type === 'clear-day') {
    grad.addColorStop(0, '#1a6fad');
    grad.addColorStop(1, '#f0a030');
  } else if (type === 'clear-night') {
    grad.addColorStop(0, '#010a18');
    grad.addColorStop(1, '#0c1830');
  } else if (type === 'clouds') {
    grad.addColorStop(0, '#3e5068');
    grad.addColorStop(1, '#28384e');
  } else if (type === 'rain') {
    grad.addColorStop(0, '#1c3c3c');
    grad.addColorStop(1, '#18283a');
  } else if (type === 'thunderstorm') {
    grad.addColorStop(0, '#160620');
    grad.addColorStop(1, '#0a0614');
  } else if (type === 'snow') {
    grad.addColorStop(0, '#a0bcd0');
    grad.addColorStop(1, '#ccdce8');
  } else if (type === 'fog') {
    grad.addColorStop(0, '#606e7c');
    grad.addColorStop(1, '#8494a0');
  } else {
    grad.addColorStop(0, '#1a2a4a');
    grad.addColorStop(1, '#253a5c');
  }
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, w, h);
}

function drawParticles(type) {
  const w = bgCanvas.width;
  const h = bgCanvas.height;

  if (type === 'rain' || type === 'thunderstorm') {
    if (type === 'thunderstorm') {
      thunderTimer--;
      if (thunderTimer <= 0) {
        thunderTimer = Math.floor(Math.random() * 220 + 80);
        thunderFlash = 10;
      }
      if (thunderFlash > 0) {
        bgCtx.fillStyle = `rgba(190, 160, 255, ${thunderFlash * 0.028})`;
        bgCtx.fillRect(0, 0, w, h);
        thunderFlash--;
      }
    }
    bgCtx.strokeStyle = 'rgba(180, 220, 255, 0.55)';
    bgCtx.lineWidth = 1;
    for (const p of particles) {
      bgCtx.globalAlpha = p.opacity;
      bgCtx.beginPath();
      bgCtx.moveTo(p.x, p.y);
      bgCtx.lineTo(p.x - 3, p.y + p.len);
      bgCtx.stroke();
      p.y += p.speed;
      p.x -= 1.5;
      if (p.y > h) { p.y = -p.len; p.x = Math.random() * (w + 80); }
    }
    bgCtx.globalAlpha = 1;

  } else if (type === 'snow') {
    bgCtx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const p of particles) {
      bgCtx.globalAlpha = p.opacity;
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      bgCtx.fill();
      p.y += p.speed;
      p.x += Math.sin(frame * 0.012 + p.phase) * 0.6;
      if (p.y > h + p.r) { p.y = -p.r; p.x = Math.random() * w; }
    }
    bgCtx.globalAlpha = 1;

  } else if (type === 'clear-night') {
    bgCtx.fillStyle = '#ffffff';
    for (const p of particles) {
      const op = p.base * (0.5 + 0.5 * Math.sin(frame * p.rate + p.phase));
      bgCtx.globalAlpha = op;
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      bgCtx.fill();
    }
    bgCtx.globalAlpha = 1;

  } else if (type === 'clouds') {
    for (const p of particles) {
      bgCtx.globalAlpha = p.opacity;
      const s = p.size;
      bgCtx.fillStyle = '#e8f0f8';
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, s * 0.5, 0, Math.PI * 2);
      bgCtx.arc(p.x + s * 0.4, p.y - s * 0.08, s * 0.36, 0, Math.PI * 2);
      bgCtx.arc(p.x - s * 0.35, p.y + s * 0.06, s * 0.3, 0, Math.PI * 2);
      bgCtx.fill();
      p.x += p.speed;
      if (p.x > w + s) p.x = -s;
    }
    bgCtx.globalAlpha = 1;

  } else if (type === 'fog') {
    for (const p of particles) {
      bgCtx.globalAlpha = p.opacity;
      const fg = bgCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rw / 2);
      fg.addColorStop(0, 'rgba(200,210,220,1)');
      fg.addColorStop(1, 'rgba(200,210,220,0)');
      bgCtx.fillStyle = fg;
      bgCtx.beginPath();
      bgCtx.ellipse(p.x, p.y, p.rw / 2, p.rh / 2, 0, 0, Math.PI * 2);
      bgCtx.fill();
      p.x += p.speed;
      if (p.x > w + p.rw / 2) p.x = -p.rw / 2;
    }
    bgCtx.globalAlpha = 1;

  } else if (type === 'clear-day') {
    const sunX = w * 0.5, sunY = h * 0.22;
    for (const p of particles) {
      p.angle += p.drift;
      const ex = sunX + Math.cos(p.angle) * p.len;
      const ey = sunY + Math.sin(p.angle) * p.len;
      const rg = bgCtx.createLinearGradient(sunX, sunY, ex, ey);
      rg.addColorStop(0, `rgba(255,230,140,${p.opacity * 3})`);
      rg.addColorStop(1, 'rgba(255,230,140,0)');
      bgCtx.strokeStyle = rg;
      bgCtx.lineWidth = 22;
      bgCtx.globalAlpha = p.opacity;
      bgCtx.beginPath();
      bgCtx.moveTo(sunX, sunY);
      bgCtx.lineTo(ex, ey);
      bgCtx.stroke();
    }
    bgCtx.globalAlpha = 1;

  } else {
    // default orbs
    for (const p of particles) {
      const og = bgCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      og.addColorStop(0, `rgba(168,216,240,${p.opacity * 2.5})`);
      og.addColorStop(1, 'rgba(168,216,240,0)');
      bgCtx.fillStyle = og;
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      bgCtx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -p.r) p.x = w + p.r;
      if (p.x > w + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = h + p.r;
      if (p.y > h + p.r) p.y = -p.r;
    }
  }
}

function startAnimation(type) {
  if (animationId) cancelAnimationFrame(animationId);
  frame = 0;
  thunderTimer = 180;
  thunderFlash = 0;
  initParticles(type);

  function loop() {
    frame++;
    drawBackground(type);
    drawParticles(type);
    animationId = requestAnimationFrame(loop);
  }
  loop();
}

// Start with default
startAnimation('default');

// ==================== UTILITY ====================

function getConditionEmoji(id, isDay) {
  if (id >= 200 && id < 300) return '⛈️';
  if (id >= 300 && id < 400) return '🌦️';
  if (id >= 500 && id < 600) return id === 511 ? '🌨️' : '🌧️';
  if (id >= 600 && id < 700) return '❄️';
  if (id >= 700 && id < 800) return '🌫️';
  if (id === 800) return isDay ? '☀️' : '🌙';
  if (id === 801 || id === 802) return '⛅';
  if (id > 802) return '☁️';
  return '🌡️';
}

function formatTime(unix) {
  const d = new Date(unix * 1000);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatHour(dt_txt) {
  // "2024-01-01 15:00:00"
  const parts = dt_txt.split(' ');
  const timeParts = parts[1].split(':');
  let h = parseInt(timeParts[0], 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}${ampm}`;
}

// ==================== STATE ====================

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearErrors() {
  locationError.classList.add('hidden');
  searchError.classList.add('hidden');
}

function showLoading() {
  clearErrors();
  weatherContent.classList.remove('hidden');
  loadingState.classList.remove('hidden');
  mainCard.classList.add('hidden');
}

function hideLoading() {
  loadingState.classList.add('hidden');
  mainCard.classList.remove('hidden');
}

// ==================== FETCH ====================

async function fetchWeather(city) {
  showLoading();

  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=imperial`),
      fetch(`${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=imperial`)
    ]);

    if (!currentRes.ok) {
      const msg = currentRes.status === 404
        ? 'City not found. Please check the spelling and try again.'
        : 'Something went wrong. Please try again.';
      showError(searchError, msg);
      weatherContent.classList.add('hidden');
      return;
    }

    const current  = await currentRes.json();
    const forecast = forecastRes.ok ? await forecastRes.json() : null;

    // Try One Call 3.0 for alerts (may fail on free tier — silently skip)
    let alerts = [];
    try {
      const { lat, lon } = current.coord;
      const alertRes = await fetch(
        `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial&exclude=minutely,hourly,daily`
      );
      if (alertRes.ok) {
        const alertData = await alertRes.json();
        alerts = alertData.alerts || [];
      }
    } catch (_) { /* silently skip */ }

    renderWeather(current, forecast, alerts);

  } catch (err) {
    showError(searchError, 'Network error. Please check your connection.');
    weatherContent.classList.add('hidden');
  }
}

// ==================== RENDER ====================

function renderWeather(current, forecast, alerts) {
  hideLoading();

  const id  = current.weather[0].id;
  const now = Date.now() / 1000;
  const isDay = now >= current.sys.sunrise && now <= current.sys.sunset;
  const condType = getConditionType(id, isDay);

  startAnimation(condType);

  // Main card
  document.getElementById('city-name').textContent  = `${current.name}, ${current.sys.country}`;
  document.getElementById('temperature').textContent = `${Math.round(current.main.temp)}°`;
  document.getElementById('condition').textContent   = `${getConditionEmoji(id, isDay)} ${current.weather[0].description}`;
  document.getElementById('feels-like').textContent  = `Feels like ${Math.round(current.main.feels_like)}°F`;
  document.getElementById('high-low').textContent    = `H: ${Math.round(current.main.temp_max)}°  L: ${Math.round(current.main.temp_min)}°`;

  // Stats
  document.getElementById('humidity').textContent   = `${current.main.humidity}%`;
  document.getElementById('wind').textContent       = `${Math.round(current.wind.speed)} mph`;
  const visMi = current.visibility != null
    ? (current.visibility / 1609.34).toFixed(1) + ' mi'
    : '—';
  document.getElementById('visibility').textContent = visMi;
  document.getElementById('uv-index').textContent   = '—';

  // Alerts banner
  renderAlerts(alerts);

  // Suggestions
  renderSuggestions(current, isDay);

  // Hourly chart
  if (forecast && forecast.list && forecast.list.length >= 4) {
    renderHourlyChart(forecast.list.slice(0, 4));
  }

  // Sunrise/sunset
  renderSunrise(current.sys.sunrise, current.sys.sunset, now, isDay);

  // 5-day forecast
  if (forecast && forecast.list) {
    renderForecast(forecast.list);
  }

  weatherContent.classList.remove('hidden');
}

function renderAlerts(alerts) {
  if (!alerts || alerts.length === 0) {
    alertBanner.classList.add('hidden');
    alertBanner.innerHTML = '';
    return;
  }
  alertBanner.innerHTML = alerts.map(a => {
    const desc = a.description
      ? (a.description.length > 120 ? a.description.slice(0, 120) + '…' : a.description)
      : '';
    return `
      <div class="alert-item">
        <div class="alert-event">⚠️ ${a.event}</div>
        ${desc ? `<div class="alert-desc">${desc}</div>` : ''}
        ${a.sender_name ? `<div class="alert-source">via ${a.sender_name}</div>` : ''}
      </div>
    `;
  }).join('');
  alertBanner.classList.remove('hidden');
}

function renderSuggestions(current, isDay) {
  const feelsLike  = current.main.feels_like;
  const id         = current.weather[0].id;
  const windSpeed  = current.wind.speed;
  const humidity   = current.main.humidity;
  const temp       = current.main.temp;
  const isRain     = id >= 200 && id < 700;

  const items = [];

  // Clothing
  if (feelsLike > 85) {
    items.push("🧥 It's hot out. Go with shorts and a light tee. Sunscreen recommended.");
  } else if (feelsLike >= 70) {
    items.push("🧥 Nice and warm. A t-shirt and light pants should do it.");
  } else if (feelsLike >= 55) {
    items.push("🧥 Mild weather — bring a light jacket or hoodie just in case.");
  } else if (feelsLike >= 40) {
    items.push("🧥 It's chilly. Layer up with a jacket and consider pants over shorts.");
  } else {
    items.push("🧥 Bundle up — heavy coat, gloves, and a hat are a good call.");
  }

  // Umbrella
  if (isRain) {
    items.push("☂️ Yes, bring an umbrella. Rain is expected.");
  } else if (id > 800 && humidity > 80) {
    items.push("☂️ Maybe bring one — conditions could turn rainy.");
  } else {
    items.push("☂️ No umbrella needed today.");
  }

  // Sunglasses
  if (id === 800 && isDay) {
    items.push("🕶️ Sunglasses are a good idea — it'll be bright out.");
  }

  // Wind advisory
  if (windSpeed > 30) {
    items.push("💨 Strong winds expected. Be careful outdoors.");
  } else if (windSpeed > 20) {
    items.push("💨 It's quite windy — hold onto your hat and avoid umbrellas if possible.");
  }

  // Freeze warning
  if (temp < 32) {
    items.push("❄️ Freezing temps — roads may be icy. Drive carefully.");
  }

  document.getElementById('suggestions-list').innerHTML =
    items.map(s => `<div class="suggestion-item">${s}</div>`).join('');
}

function renderHourlyChart(entries) {
  const canvas = document.getElementById('hourly-chart');
  canvas.width  = canvas.offsetWidth || 500;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  const temps  = entries.map(e => e.main.temp);
  const labels = entries.map(e => formatHour(e.dt_txt));
  const minT = Math.min(...temps) - 10;
  const maxT = Math.max(...temps) + 10;
  const range = maxT - minT || 1;

  const PL = 22, PR = 22, PT = 32, PB = 28;
  const cw = w - PL - PR;
  const ch = h - PT - PB;

  const pts = temps.map((t, i) => ({
    x: PL + (i / (temps.length - 1)) * cw,
    y: PT + (1 - (t - minT) / range) * ch
  }));

  ctx.clearRect(0, 0, w, h);

  // Gradient fill below curve
  const fillGrad = ctx.createLinearGradient(0, PT, 0, h - PB);
  fillGrad.addColorStop(0, 'rgba(168,216,240,0.38)');
  fillGrad.addColorStop(1, 'rgba(168,216,240,0)');

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cpx, pts[i - 1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.lineTo(pts[pts.length - 1].x, h - PB);
  ctx.lineTo(pts[0].x, h - PB);
  ctx.closePath();
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Curve line
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cpx, pts[i - 1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = '#a8d8f0';
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // Dots + labels
  ctx.font      = '11px DM Mono, monospace';
  ctx.textAlign = 'center';

  pts.forEach((p, i) => {
    // dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#a8d8f0';
    ctx.fill();

    // temp above dot
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`${Math.round(temps[i])}°`, p.x, p.y - 10);

    // time below axis
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(labels[i], p.x, h - 8);
  });
}

function renderSunrise(sunrise, sunset, now, isDay) {
  const canvas = document.getElementById('sunrise-canvas');
  canvas.width  = canvas.offsetWidth  || 280;
  canvas.height = canvas.offsetHeight || 110;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h - 8;
  const r  = 78;

  // Track (full semicircle)
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth   = 3;
  ctx.stroke();

  // Progress arc
  let progress = (now - sunrise) / (sunset - sunrise);
  progress = Math.max(0, Math.min(1, progress));

  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI + progress * Math.PI);
  ctx.strokeStyle = '#f9d87a';
  ctx.lineWidth   = 3;
  ctx.stroke();

  // Sun / moon position
  const angle = Math.PI + progress * Math.PI;
  const sx = cx + Math.cos(angle) * r;
  const sy = cy + Math.sin(angle) * r;

  if (isDay) {
    // Glow
    ctx.beginPath();
    ctx.arc(sx, sy, 13, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(249,216,122,0.22)';
    ctx.fill();
    // Sun
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#f9d87a';
    ctx.fill();
  } else {
    // Moon parked at the edge
    ctx.font      = '18px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌙', sx, sy + 6);
  }

  // Labels
  document.getElementById('sunrise-time').textContent    = `🌅 ${formatTime(sunrise)}`;
  document.getElementById('sunset-time').textContent     = `🌇 ${formatTime(sunset)}`;
  document.getElementById('daylight-progress').textContent = `${Math.round(progress * 100)}% of daylight passed`;
}

function renderForecast(list) {
  // Collect per-day high/low and pick first entry per day
  const dayMap  = {};
  const highLow = {};

  for (const entry of list) {
    const date = entry.dt_txt.split(' ')[0];
    if (!dayMap[date])  dayMap[date]  = entry;
    if (!highLow[date]) highLow[date] = { high: -Infinity, low: Infinity };
    if (entry.main.temp_max > highLow[date].high) highLow[date].high = entry.main.temp_max;
    if (entry.main.temp_min < highLow[date].low)  highLow[date].low  = entry.main.temp_min;
  }

  const days = Object.keys(dayMap).slice(0, 5);

  document.getElementById('forecast-strip').innerHTML = days.map(date => {
    const entry   = dayMap[date];
    const d       = new Date(date + 'T12:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const emoji   = getConditionEmoji(entry.weather[0].id, true);
    const hl      = highLow[date];
    return `
      <div class="forecast-card">
        <div class="forecast-day">${dayName}</div>
        <span class="forecast-emoji">${emoji}</span>
        <div class="forecast-temps">
          <span class="forecast-high">${Math.round(hl.high)}°</span>
          / ${Math.round(hl.low)}°
        </div>
      </div>
    `;
  }).join('');
}

// ==================== EVENTS ====================

searchBtn.addEventListener('click', () => {
  const city = cityInput.value.trim();
  if (city) fetchWeather(city);
});

cityInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const city = cityInput.value.trim();
    if (city) fetchWeather(city);
  }
});

locationBtn.addEventListener('click', () => {
  clearErrors();
  if (!navigator.geolocation) {
    showError(locationError, 'Geolocation is not supported by your browser.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      try {
        const res  = await fetch(`${GEO_URL}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`);
        const data = await res.json();
        if (data && data.length > 0) {
          const city = data[0].name;
          cityInput.value = city;
          fetchWeather(city);
        } else {
          showError(locationError, 'Could not determine city from your location.');
        }
      } catch (_) {
        showError(locationError, 'Error resolving your location. Please search by city name.');
      }
    },
    () => {
      showError(locationError, 'Location access denied. Please search by city name.');
    }
  );
});
