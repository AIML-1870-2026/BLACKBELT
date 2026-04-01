// globe.js — Three.js 3D Earth renderer
// Requires Three.js loaded via CDN before this file

let canvas, renderer, scene, camera;
let earthMesh, atmoMesh;
let asteroidObjects = []; // [{id,name,ld,…, mesh,glow,hit,labelEl,pos3D}]
let moonMesh;
let labelOverlay;

let autoRotate = true;
let showLabels  = true;
let hoveredId   = null;
let selectedId  = null;

// Camera orbit
let camTheta    = 0.35;   // vertical tilt (radians from equator)
let camPhi      = 0;      // horizontal angle
let cameraRadius = 3.5;   // distance from origin
let earthSpin   = 0;      // earth's own spin angle

// Drag
let isDragging = false;
let lastMx = 0, lastMy = 0;

let onHover   = () => {};
let onSelect  = () => {};
let onDeselect = () => {};

const ER = 1.0; // Earth radius in scene units

// ── Init ─────────────────────────────────────────────────────────────────────

function initGlobe(canvasEl) {
  canvas = canvasEl;
  onHover   = ast => { setHoveredAsteroid(ast);  updateBottomBar(ast); };
  onSelect  = ast => { setSelectedAsteroid(ast);  updateBottomBar(ast); };
  onDeselect = () => { clearSelectedAsteroid(); clearBottomBar(); };

  // HTML overlay for asteroid labels (positioned via 3D→2D projection)
  labelOverlay = document.createElement('div');
  labelOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  canvas.parentElement.appendChild(labelOverlay);

  // Three.js
  scene    = new THREE.Scene();
  const w  = canvas.parentElement.clientWidth  || 800;
  const h  = canvas.parentElement.clientHeight || 600;
  camera   = new THREE.PerspectiveCamera(40, w / h, 0.01, 200);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  buildScene();
  bindEvents();
  window.addEventListener('resize', debounce(resize, 80));
  requestAnimationFrame(loop);
}

// ── Scene ────────────────────────────────────────────────────────────────────

function buildScene() {
  // Lights — dim ambient + single "sun" directional
  scene.add(new THREE.AmbientLight(0x223344, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(5, 2, 4);
  scene.add(sun);

  // Star field
  const sPos = new Float32Array(2500 * 3);
  for (let i = 0; i < 2500; i++) {
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(2 * Math.random() - 1);
    const r = 50;
    sPos[i*3]   = r * Math.sin(b) * Math.cos(a);
    sPos[i*3+1] = r * Math.sin(b) * Math.sin(a);
    sPos[i*3+2] = r * Math.cos(b);
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  scene.add(new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0x8899bb, size: 0.055 })));

  // Earth sphere — night-lights texture wrapped on a sphere
  const loader  = new THREE.TextureLoader();
  const earthTex = loader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg');
  earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(ER, 72, 72),
    new THREE.MeshPhongMaterial({ map: earthTex, specular: 0x111122, shininess: 15 })
  );
  scene.add(earthMesh);

  // Atmosphere: thin blue haze on front face
  atmoMesh = new THREE.Mesh(
    new THREE.SphereGeometry(ER * 1.04, 32, 32),
    new THREE.MeshPhongMaterial({
      color: 0x0055cc, transparent: true, opacity: 0.10,
      side: THREE.FrontSide, depthWrite: false
    })
  );
  scene.add(atmoMesh);

  // Atmosphere: back-face rim glow (limb brightening)
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(ER * 1.14, 32, 32),
    new THREE.MeshPhongMaterial({
      color: 0x1155ee, transparent: true, opacity: 0.08,
      side: THREE.BackSide, depthWrite: false
    })
  ));

  // Orbit reference rings
  addRing(ldTo3D(0.11), 0x4499ff, 0.45); // GEO
  addRing(ldTo3D(1.0),  0x445566, 0.28); // Lunar orbit

  // Moon
  moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 16),
    new THREE.MeshPhongMaterial({ color: 0xbbbbc8, emissive: 0x222230 })
  );
  scene.add(moonMesh);
}

function addRing(r, color, opacity) {
  const N   = 192;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  ));
}

// ── Coordinate helpers ───────────────────────────────────────────────────────

// Map a lunar-distance value to a 3-D radius in scene units
// Mirrors the 2-D ldToRadius() logic so the two views look consistent
function ldTo3D(ld) {
  const edge  = ER * 1.35; // just outside earth surface
  const moonR = ER * 2.8;  // 1 LD → moon
  const maxR  = ER * 5.2;  // 12 LD → scene edge
  if (ld <= 0) return edge;
  if (ld <= 1) return edge + (moonR - edge) * ld;
  return moonR + (maxR - moonR) * Math.min((ld - 1) / 11, 1);
}

// ── Asteroids ────────────────────────────────────────────────────────────────

function setAsteroids(neoData) {
  // Tear down previous objects
  for (const o of asteroidObjects) {
    scene.remove(o.mesh);
    scene.remove(o.glow);
    scene.remove(o.hit);
    o.labelEl?.remove();
  }
  asteroidObjects = [];

  const total = neoData.length;
  neoData.forEach((neo, i) => {
    const ca       = neo.close_approach_data?.[0];
    const ld       = ca ? parseFloat(ca.miss_distance.lunar) : 999;
    const dMin     = neo.estimated_diameter?.meters?.estimated_diameter_min || 0;
    const dMax     = neo.estimated_diameter?.meters?.estimated_diameter_max || 0;
    const diameterM = (dMin + dMax) / 2;
    const speed    = parseFloat(ca?.relative_velocity?.kilometers_per_second || 0);
    const date     = ca?.close_approach_date || '';
    const color    = getHazardColor(ld);

    // Angular position — evenly distributed + hash jitter + slight vertical scatter
    const angle  = (i / total) * Math.PI * 2 + hashAngle(neo.name || neo.id);
    // Map hash to 0..1 then apply arcsin for uniform sphere distribution (−π/2 → +π/2)
    const h01  = (hashAngle((neo.id || neo.name) + '_v') / 0.7 + 0.5);
    const elev = Math.asin(2 * h01 - 1);

    const r3D = ldTo3D(ld);
    const pos = new THREE.Vector3(
      r3D * Math.cos(angle) * Math.cos(elev),
      r3D * Math.sin(elev),
      r3D * Math.sin(angle) * Math.cos(elev)
    );

    const c3  = new THREE.Color(color);
    const dr  = dotRadius(diameterM) * 0.007;

    // Glow halo
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(dr * 3.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: c3, transparent: true, opacity: 0.22, depthWrite: false })
    );
    glow.position.copy(pos);
    scene.add(glow);

    // Core dot
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(dr, 8, 8),
      new THREE.MeshBasicMaterial({ color: c3 })
    );
    mesh.position.copy(pos);
    scene.add(mesh);

    // Invisible larger hit-sphere for easy clicking
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(dr * 9, 6, 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.copy(pos);
    scene.add(hit);

    // HTML label
    const labelEl = document.createElement('span');
    labelEl.textContent = neo.name;
    labelEl.style.cssText =
      'position:absolute;font:8.5px "JetBrains Mono",monospace;' +
      'color:rgba(120,155,200,0.5);pointer-events:none;white-space:nowrap;';
    labelOverlay.appendChild(labelEl);

    asteroidObjects.push({
      id: neo.id, name: neo.name, ld, diameterM, speed, date,
      hazardColor: color, dotR: dr,
      mesh, glow, hit, pos3D: pos, labelEl
    });
  });
}

// ── Render loop ──────────────────────────────────────────────────────────────

function loop() {
  requestAnimationFrame(loop);

  // Earth auto-spin
  if (autoRotate) earthSpin += 0.001;
  earthMesh.rotation.y = earthSpin;
  atmoMesh.rotation.y  = earthSpin;

  // Moon slowly orbits
  const t  = Date.now() * 0.00008;
  const mR = ldTo3D(1.0);
  moonMesh.position.set(Math.cos(t) * mR, 0, Math.sin(t) * mR);

  // Camera orbits origin based on (camPhi, camTheta, cameraRadius)
  camera.position.set(
    cameraRadius * Math.sin(camPhi) * Math.cos(camTheta),
    cameraRadius * Math.sin(camTheta),
    cameraRadius * Math.cos(camPhi) * Math.cos(camTheta)
  );
  camera.lookAt(0, 0, 0);

  // Asteroid highlight pulse
  for (const o of asteroidObjects) {
    const active = (hoveredId === o.id) || (selectedId === o.id);
    o.glow.material.opacity = active ? 0.65 : 0.22;
    o.glow.scale.setScalar(active ? 2.0 : 1.0);
  }

  // Project asteroid positions to 2-D for HTML labels
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  for (const o of asteroidObjects) {
    if (!showLabels) { o.labelEl.style.display = 'none'; continue; }
    const p = o.pos3D.clone().project(camera);
    if (p.z >= 1) { o.labelEl.style.display = 'none'; continue; } // behind camera
    o.labelEl.style.display = 'block';
    o.labelEl.style.left = `${((p.x + 1) / 2) * w + 5}px`;
    o.labelEl.style.top  = `${((-p.y + 1) / 2) * h - 4}px`;
  }

  renderer.render(scene, camera);
}

// ── Resize ───────────────────────────────────────────────────────────────────

function resize() {
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ── Input ────────────────────────────────────────────────────────────────────

function bindEvents() {
  canvas.addEventListener('mousedown',  onMouseDown);
  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('mouseup',    onMouseUp);
  canvas.addEventListener('mouseleave', () => { isDragging = false; canvas.style.cursor = 'grab'; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    cameraRadius = Math.max(1.6, Math.min(8, cameraRadius + e.deltaY * 0.004));
  }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.style.cursor = 'grab';
}

function onMouseDown(e) {
  isDragging = true;
  lastMx = e.clientX;
  lastMy = e.clientY;
  canvas.style.cursor = 'grabbing';
  autoRotate = false;
}

function onMouseMove(e) {
  if (isDragging) {
    camPhi   -= (e.clientX - lastMx) * 0.005;
    camTheta  = Math.max(-1.4, Math.min(1.4, camTheta - (e.clientY - lastMy) * 0.005));
    lastMx = e.clientX;
    lastMy = e.clientY;
    return;
  }
  // Hover hit-test
  const rect = canvas.getBoundingClientRect();
  const hit  = raycastAsteroids(e.clientX - rect.left, e.clientY - rect.top);
  if (hit) {
    hoveredId = hit.id;
    canvas.style.cursor = 'pointer';
    onHover(hit);
  } else if (hoveredId !== null) {
    hoveredId = null;
    canvas.style.cursor = 'grab';
    if (selectedId === null) onDeselect();
  }
}

function onMouseUp(e) {
  isDragging = false;
  canvas.style.cursor = hoveredId ? 'pointer' : 'grab';
  const dx = Math.abs(e.clientX - lastMx);
  const dy = Math.abs(e.clientY - lastMy);
  if (dx < 3 && dy < 3) {
    const rect = canvas.getBoundingClientRect();
    const hit  = raycastAsteroids(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) { selectedId = hit.id; onSelect(hit); }
    else     { selectedId = null;   onDeselect();  }
  }
  setTimeout(() => { autoRotate = true; }, 1500);
}

function raycastAsteroids(mx, my) {
  const ndc = new THREE.Vector2(
    (mx / canvas.clientWidth)  * 2 - 1,
    -(my / canvas.clientHeight) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(asteroidObjects.map(o => o.hit));
  if (!hits.length) return null;
  return asteroidObjects.find(o => o.hit === hits[0].object) || null;
}

// ── Public API (called from index.html and views) ────────────────────────────

function zoomIn()    { cameraRadius = Math.max(1.6, cameraRadius - 0.3); }
function zoomOut()   { cameraRadius = Math.min(8,   cameraRadius + 0.3); }
function resetView() { cameraRadius = 3.5; camTheta = 0.35; camPhi = 0; }
function toggleLabels() { showLabels = !showLabels; return showLabels; }

function selectAsteroidById(id) {
  selectedId = id;
  const ast = asteroidObjects.find(a => a.id === id);
  if (ast) onSelect(ast);
}

function showGlobeError() {
  if (document.getElementById('globe-error')) return;
  const ov = document.createElement('div');
  ov.id = 'globe-error';
  ov.className = 'globe-error-overlay';
  ov.innerHTML = `<p>Could not load asteroid data</p><button onclick="retryNeo()">Click to retry</button>`;
  canvas.parentElement.appendChild(ov);
}

function clearGlobeError() {
  document.getElementById('globe-error')?.remove();
}
