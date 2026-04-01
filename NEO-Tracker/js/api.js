// api.js — all fetch functions, caching, error handling

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms

function cacheGet(url) {
  try {
    const raw = sessionStorage.getItem(url);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return { data, age: Date.now() - ts };
    return null;
  } catch {
    return null;
  }
}

function cacheSet(url, data) {
  try {
    sessionStorage.setItem(url, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

function cacheAge(url) {
  try {
    const raw = sessionStorage.getItem(url);
    if (!raw) return null;
    const { ts } = JSON.parse(raw);
    return Date.now() - ts;
  } catch {
    return null;
  }
}

async function apiFetch(url, label) {
  const cached = cacheGet(url);
  if (cached) {
    const mins = Math.floor(cached.age / 60000);
    showCacheChip(label, mins);
    return cached.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    cacheSet(url, json);
    hideCacheChip();
    return json;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function showCacheChip(label, mins) {
  const chip = document.getElementById('cache-chip');
  if (chip) {
    chip.textContent = `cached · ${mins}m ago`;
    chip.style.display = 'inline-block';
  }
}

function hideCacheChip() {
  const chip = document.getElementById('cache-chip');
  if (chip) chip.style.display = 'none';
}

// Build date range string YYYY-MM-DD for today ± days
function dateRange(days = 3) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  const fmt = d => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

// NeoWs weekly feed
async function fetchNeoFeed() {
  const { start, end } = dateRange(3);
  const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${NASA_KEY}`;
  const json = await apiFetch(url, 'neows');

  // Flatten the date-keyed object into a single array
  const neos = [];
  for (const date of Object.keys(json.near_earth_objects)) {
    for (const neo of json.near_earth_objects[date]) {
      neos.push(neo);
    }
  }
  return neos;
}

// JPL SBDB Small Body Database — fetch orbital + physical data for a single object
// Cached by designation so repeat clicks skip the network
async function fetchSBDB(designation) {
  const enc = encodeURIComponent(designation);
  const url = `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${enc}&phys-par=true&orbit=true`;
  return apiFetch(url, 'sbdb');
}

// NASA Sentry impact monitoring
// Falls back to a CORS proxy when running from file:// (direct fetch is blocked by browsers)
async function fetchSentryData() {
  const url = 'https://ssd-api.jpl.nasa.gov/sentry.api';
  try {
    return await apiFetch(url, 'sentry');
  } catch {
    const proxy = 'https://corsproxy.io/?' + encodeURIComponent(url);
    return await apiFetch(proxy, 'sentry');
  }
}

// Individual NEO detail
async function fetchNeoDetail(id) {
  const url = `https://api.nasa.gov/neo/rest/v1/neo/${id}?api_key=${NASA_KEY}`;
  return apiFetch(url, 'neo-detail');
}

// Shared state — cached once per page load (refreshable)
let _neoData = null;
let _neoError = null;
let _neoCallbacks = [];
let _neoFetching = false;

function getNeoData(callback) {
  if (_neoData) { callback(null, _neoData); return; }
  if (_neoError) { callback(_neoError, null); return; }
  _neoCallbacks.push(callback);
  if (_neoFetching) return;
  _neoFetching = true;
  fetchNeoFeed().then(data => {
    _neoData = data;
    _neoFetching = false;
    _neoCallbacks.forEach(cb => cb(null, data));
    _neoCallbacks = [];
  }).catch(err => {
    _neoError = err;
    _neoFetching = false;
    _neoCallbacks.forEach(cb => cb(err, null));
    _neoCallbacks = [];
  });
}

function refreshNeoData(callback) {
  _neoData = null;
  _neoError = null;
  _neoFetching = false;
  // Clear cache for NeoWs URLs
  try {
    const keys = Object.keys(sessionStorage);
    keys.filter(k => k.includes('api.nasa.gov/neo/rest/v1/feed')).forEach(k => sessionStorage.removeItem(k));
  } catch {}
  getNeoData(callback);
}
