/* ============================================================
   Shadow Runner — game.js
   Full game logic, rendering, input, entity management
   ============================================================ */

'use strict';

// ── Canvas setup ─────────────────────────────────────────────
const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); });

// ── Constants ─────────────────────────────────────────────────
const SCROLL_SPEED   = 400;   // px/sec — constant forever
const GRAVITY        = 1800;  // px/sec²
const JUMP_VELOCITY  = -680;  // px/sec (upward)
const GROUND_FRAC    = 0.82;  // ground y as fraction of canvas height
const PLAYER_X_FRAC  = 0.15;

// Colour palette (matches CSS variables)
const C = {
  bg:        '#0a0a0f',
  midground: '#1a1025',
  ground:    '#1c1008',
  accent:    '#c0392b',
  gold:      '#f0c040',
  silver:    '#e8e8f0',
  teal:      '#2a4a5a',
  moon:      '#d4cfa8',
  blossom:   '#e8a0b0',
};

// ── State machine ─────────────────────────────────────────────
// States: 'title' | 'running' | 'combat' | 'paused' | 'dead' | 'gameover'
let STATE = 'title';

// ── Score & persistence ───────────────────────────────────────
let score     = 0;
let highScore = parseInt(localStorage.getItem('shadowRunnerHS') || '0', 10);
let lastSecondScore = 0; // for +1/sec ticking

// ── Input ─────────────────────────────────────────────────────
const keys = {};
const keysJustPressed = {};

window.addEventListener('keydown', e => {
  if (!keys[e.code]) keysJustPressed[e.code] = true;
  keys[e.code] = true;
  handleInput(e.code);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ── Player ────────────────────────────────────────────────────
const player = {
  x: 0, y: 0,
  w: 28, h: 54,
  vy: 0,
  grounded: false,
  state: 'running', // running|jumping|ducking|attacking|dead
  animFrame: 0,
  animTimer: 0,
  trail: [],        // [{x,y,alpha}] motion blur
  deadTimer: 0,
};

function groundY() {
  return canvas.height * GROUND_FRAC;
}

function resetPlayer() {
  player.x       = canvas.width * PLAYER_X_FRAC;
  player.y       = groundY() - player.h;
  player.vy      = 0;
  player.grounded = true;
  player.state   = 'running';
  player.animFrame = 0;
  player.animTimer = 0;
  player.trail   = [];
  player.deadTimer = 0;
}

// ── Entities ──────────────────────────────────────────────────
let spikes      = [];
let projectiles = [];
let platforms   = [];
let stars       = [];
let blossoms    = [];

// ── Parallax layers ───────────────────────────────────────────
const parallax = {
  starfield: [],
  mountains: [],
  pagodas:   [],
  rooftiles: [],
  scrollX:   [0, 0, 0, 0, 0], // per-layer scroll offsets
};

// ── Combat state ──────────────────────────────────────────────
const combat = {
  active:   false,
  enemy:    null,   // {type, hp, x, y, timer, maxTimer, combo, input}
  comboKeys: [],
  inputIdx:  0,
  timerFrac: 1.0,
  hitFlash:  0,     // brief green screen flash on correct key press
};

// ── Chunk scheduler ───────────────────────────────────────────
const scheduler = {
  nextSpawnX: 0,       // world-x at which next chunk spawns
  worldX: 0,           // how far world has scrolled (px)
  gapMin: 1.5,         // seconds of safe gap (shrinks at higher tiers)
  pending: [],         // queued entity placements [{type,x,y,...}]
  safeTimer: 0,        // seconds remaining in obstacle-free start window
  easyTimer: 0,        // seconds of single-small-spike-only after safe window
};

// Enemy encounter scheduler
const enemyScheduler = {
  nextAt: 500 + Math.random() * 50, // first enemy at score ~500–550
  bossScores: [800, 1600, 2500],
  nextBossIdx: 0,
};

// ── Tier helpers ──────────────────────────────────────────────
function currentTier() {
  if (score >= 1000) return 5;
  if (score >= 600)  return 4;
  if (score >= 300)  return 3;
  if (score >= 100)  return 2;
  return 1;
}

function tierLabel() {
  const t = currentTier();
  return ['','BEGINNER','INTERMEDIATE','ADVANCED','EXPERT','MASTER'][t];
}

// ── Pattern Chunk Library ─────────────────────────────────────
// Each chunk: array of entity descriptors with relative x offsets (in pixels)
// relX is offset from chunk spawn point; heights relative to groundY()

function makeChunks() {
  // Helper abbreviations
  const spike   = (rx, variant) => ({ kind:'spike',   rx, variant });        // variant: 1|2|3 (small/med/wide)
  const proj    = (rx, height)  => ({ kind:'proj',    rx, height });          // height: 'mid'|'low'
  const plat    = (rx, spiked)  => ({ kind:'platform',rx, spiked: !!spiked });
  const star    = (rx, ry)      => ({ kind:'star',    rx, ry });               // ry offset above ground
  const GAP     = sec => sec * SCROLL_SPEED;                                   // convert sec to px gap

  return {
    T1: [
      { id:'T1-A', entities:[ spike(0,1) ],                                         after: GAP(2.2) },
      { id:'T1-B', entities:[ proj(0,'mid') ],                                      after: GAP(2.2) },
      { id:'T1-C', entities:[ spike(0,1), spike(GAP(1.6),1) ],                      after: GAP(2.2) },
      { id:'T1-D', entities:[ spike(0,2) ],                                         after: GAP(2.2) },
      { id:'T1-E', entities:[ star(0,120), star(80,150), star(160,120) ],           after: GAP(2.0) },
    ],
    T2: [
      { id:'T2-A', entities:[ spike(0,2), proj(GAP(1.0),'mid') ],                   after: GAP(1.8) },
      { id:'T2-B', entities:[ spike(0,2), spike(GAP(1.0),2) ],                      after: GAP(1.8) },
      { id:'T2-C', entities:[ proj(0,'mid'), spike(GAP(1.0),1) ],                   after: GAP(1.8) },
      { id:'T2-D', entities:[ spike(0,3) ],                                         after: GAP(1.8) },
      { id:'T2-E', entities:[ proj(0,'mid'), proj(GAP(0.9),'mid') ],                after: GAP(1.8) },
      { id:'T2-F', entities:[ spike(0,1), star(GAP(0.8),130) ],                     after: GAP(1.8) },
    ],
    T3: [
      { id:'T3-A', entities:[ plat(0,false), spike(GAP(0.55),1) ],                  after: GAP(1.3) },
      { id:'T3-B', entities:[ spike(0,1), proj(GAP(0.6),'mid'), spike(GAP(1.25),1)], after: GAP(1.3) },
      { id:'T3-C', entities:[ plat(0,true), spike(GAP(0.8),2) ],                    after: GAP(1.3) },
      { id:'T3-D', entities:[ spike(0,2), proj(GAP(0.52),'mid') ],                  after: GAP(1.3) },
      { id:'T3-E', entities:[ proj(0,'mid'), proj(GAP(0.5),'low'), proj(GAP(1.0),'mid') ], after: GAP(1.3) },
      { id:'T3-F', entities:[ spike(0,3), proj(GAP(0.55),'mid') ],                  after: GAP(1.3) },
    ],
    T4: [
      { id:'T4-A', entities:[ spike(0,1), spike(GAP(0.5),2), spike(GAP(1.05),1) ], after: GAP(1.2) },
      { id:'T4-B', entities:[ plat(0,false), plat(GAP(0.8),false) ],                after: GAP(1.2) },
      { id:'T4-C', entities:[ proj(0,'mid'), proj(GAP(0.4),'mid'), proj(GAP(0.8),'mid'), spike(GAP(1.4),2) ], after: GAP(1.2) },
      { id:'T4-D', entities:[ plat(0,true), spike(GAP(0.55),1) ],                   after: GAP(1.2) },
      { id:'T4-E', entities:[ spike(0,1), proj(GAP(0.6),'low') ],                   after: GAP(1.2) },
      { id:'T4-F', entities:[ spike(0,2), plat(GAP(0.65),false), proj(GAP(1.3),'mid') ], after: GAP(1.2) },
    ],
    T5: [
      { id:'T5-A', entities:[ spike(0,1), proj(GAP(0.55),'mid'), plat(GAP(1.1),false), spike(GAP(1.75),2) ], after: GAP(1.0) },
      { id:'T5-B', entities:[ proj(0,'mid'), proj(GAP(0.45),'low'), proj(GAP(0.9),'mid') ],                  after: GAP(1.0) },
      { id:'T5-C', entities:[ plat(0,false), plat(GAP(0.7),false), plat(GAP(1.4),false), spike(GAP(2.0),1) ], after: GAP(1.0) },
      { id:'T5-D', entities:[ spike(0,1), spike(GAP(0.42),2), spike(GAP(0.90),1) ], after: GAP(1.0) },
      { id:'T5-E', entities:[ spike(0,3), proj(GAP(0.55),'mid'), proj(GAP(0.95),'mid'), plat(GAP(1.45),true) ], after: GAP(1.0) },
    ],
  };
}

let CHUNKS;

// ── Weighted chunk picker ─────────────────────────────────────
function pickChunk() {
  // Phase 1: pure safe window — stars only
  if (scheduler.safeTimer > 0) {
    return CHUNKS.T1.find(c => c.id === 'T1-E') || CHUNKS.T1[0];
  }
  // Phase 2: easy window — single small spike only
  if (scheduler.easyTimer > 0) {
    return CHUNKS.T1.find(c => c.id === 'T1-A') || CHUNKS.T1[0];
  }
  const tier = currentTier();
  // Build weighted pool: higher tiers weighted more heavily
  const pool = [];
  for (let t = 1; t <= tier; t++) {
    const key = `T${t}`;
    const weight = t === tier ? 5 : Math.max(1, tier - t);
    for (let i = 0; i < weight; i++) {
      CHUNKS[key].forEach(c => pool.push(c));
    }
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Spawn a chunk ─────────────────────────────────────────────
function spawnChunk(chunkStartX) {
  const chunk = pickChunk();
  const gY = groundY();
  const tileH = 30; // platform thickness

  chunk.entities.forEach(e => {
    const worldX = chunkStartX + e.rx;

    if (e.kind === 'spike') {
      spikes.push(createSpike(worldX, e.variant, gY));
    } else if (e.kind === 'proj') {
      const projH = e.height === 'mid'
        ? gY - player.h * 1.1            // mid height — duck required
        : gY - player.h * 0.55;          // low height — can jump or duck
      projectiles.push({
        x: worldX, y: projH,
        w: 18, h: 8,
        speed: SCROLL_SPEED,
      });
    } else if (e.kind === 'platform') {
      // Platform at jump height — about 60% of jump arc peak
      const platY = gY - player.h - 130;
      platforms.push({
        x: worldX, y: platY,
        w: 110, h: tileH,
        spiked: e.spiked,
      });
    } else if (e.kind === 'star') {
      stars.push({
        x: worldX,
        y: gY - e.ry,
        r: 10,
        angle: 0,
        collected: false,
      });
    }
  });

  // Return the world-x for next chunk start (including after-gap)
  return chunkStartX + chunk.entities.reduce((max, e) => Math.max(max, e.rx), 0)
         + spikeWidth(3) + chunk.after;
}

function createSpike(wx, variant, gY) {
  // variant 1=small(1 spike), 2=medium(2-3), 3=wide(4-5)
  const counts = [0, 1, 2, 4];
  const n      = counts[variant] + Math.floor(Math.random() * (variant === 1 ? 1 : variant));
  const sw     = 20; // width per spike
  return {
    x: wx, y: gY - n * 14 - 10,
    w: n * sw, h: n * 14 + 10,
    count: n,
    variant,
  };
}

function spikeWidth(variant) {
  return variant * 2 * 20;
}

// ── Blossom particles ─────────────────────────────────────────
function initBlossoms() {
  blossoms = [];
  for (let i = 0; i < 40; i++) {
    blossoms.push(makeBlossom(true));
  }
}

function makeBlossom(initial) {
  return {
    x: initial ? Math.random() * canvas.width : canvas.width + 10,
    y: initial ? Math.random() * canvas.height : -10,
    vx: -(1.5 + Math.random() * 1.5),
    vy: 0.6 + Math.random() * 0.8,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.04,
    r: 3 + Math.random() * 3,
    alpha: 0.4 + Math.random() * 0.5,
  };
}

// ── Parallax init ─────────────────────────────────────────────
function initParallax() {
  parallax.starfield = [];
  for (let i = 0; i < 120; i++) {
    parallax.starfield.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.65,
      r: Math.random() * 1.5,
      alpha: 0.3 + Math.random() * 0.7,
    });
  }
  parallax.mountains = buildMountainPath();
  parallax.pagodas   = buildPagodaPath();
  parallax.rooftiles = buildRooftilePath();
  parallax.scrollX   = [0, 0, 0, 0, 0];
}

function buildMountainPath() {
  // Returns two canvas-width-wide strips that tile horizontally
  const strips = [];
  for (let s = 0; s < 2; s++) {
    const pts = [];
    const W = canvas.width;
    pts.push([s * W, canvas.height]);
    let cx = 0;
    while (cx < W) {
      const pw = 80 + Math.random() * 160;
      const ph = canvas.height * (0.18 + Math.random() * 0.22);
      pts.push([s * W + cx, canvas.height * GROUND_FRAC + 10]);
      pts.push([s * W + cx + pw * 0.35, canvas.height * GROUND_FRAC - ph]);
      pts.push([s * W + cx + pw * 0.65, canvas.height * GROUND_FRAC - ph * 0.85]);
      pts.push([s * W + cx + pw, canvas.height * GROUND_FRAC + 10]);
      cx += pw;
    }
    pts.push([(s + 1) * W, canvas.height]);
    strips.push(pts);
  }
  return strips;
}

function buildPagodaPath() {
  const strips = [];
  for (let s = 0; s < 2; s++) {
    const shapes = [];
    const W = canvas.width;
    let cx = 40;
    while (cx < W) {
      shapes.push({ x: s * W + cx, type: Math.random() > 0.4 ? 'pagoda' : 'tree' });
      cx += 120 + Math.random() * 180;
    }
    strips.push(shapes);
  }
  return strips;
}

function buildRooftilePath() {
  const strips = [];
  for (let s = 0; s < 2; s++) {
    const tiles = [];
    const gY = canvas.height * GROUND_FRAC;
    const W  = canvas.width;
    let cx = 0;
    while (cx < W) {
      tiles.push({ x: s * W + cx, y: gY - 18, w: 60 + Math.random() * 80, h: 20 });
      cx += 60 + Math.random() * 80 + 5;
    }
    strips.push(tiles);
  }
  return strips;
}

// ── Rendering helpers ─────────────────────────────────────────

function drawBackground() {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * GROUND_FRAC);
  skyGrad.addColorStop(0, '#04040a');
  skyGrad.addColorStop(1, '#0f0820');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height * GROUND_FRAC);

  // Moon
  const moonX = canvas.width * 0.82;
  const moonY = canvas.height * 0.14;
  const moonR = canvas.height * 0.05;
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 3.5);
  moonGlow.addColorStop(0, 'rgba(212,207,168,0.25)');
  moonGlow.addColorStop(1, 'rgba(212,207,168,0)');
  ctx.fillStyle = moonGlow;
  ctx.beginPath(); ctx.arc(moonX, moonY, moonR * 3.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = C.moon;
  ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI*2); ctx.fill();

  // Starfield (static, no scroll needed for distant stars)
  parallax.starfield.forEach(s => {
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawMountains() {
  const speed = SCROLL_SPEED * 0.06;
  const offset = (parallax.scrollX[1] * speed) % canvas.width;
  ctx.fillStyle = C.midground;
  for (let s = 0; s < 2; s++) {
    const pts = parallax.mountains[s];
    if (!pts) return;
    ctx.save();
    ctx.translate(-offset + s * canvas.width, 0);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawPagodas() {
  const speed = SCROLL_SPEED * 0.18;
  const offset = (parallax.scrollX[2] * speed) % canvas.width;
  const gY = groundY();
  ctx.fillStyle = '#100a18';
  for (let s = 0; s < 2; s++) {
    const shapes = parallax.pagodas[s];
    if (!shapes) return;
    shapes.forEach(sh => {
      const sx = sh.x - offset + (s === 0 ? 0 : canvas.width);
      const screenX = ((sx % (canvas.width * 2)) + canvas.width * 2) % (canvas.width * 2);
      if (screenX > -200 && screenX < canvas.width + 200) {
        if (sh.type === 'pagoda') drawPagoda(screenX, gY - 10);
        else                      drawTree(screenX, gY - 10);
      }
    });
  }
}

function drawPagoda(x, baseY) {
  const h = 90 + Math.random() * 20;
  // trunk
  ctx.fillRect(x - 6, baseY - h, 12, h);
  // roof tiers
  for (let t = 0; t < 3; t++) {
    const ty = baseY - h * 0.35 - t * h * 0.22;
    const tw = 30 - t * 7;
    ctx.beginPath();
    ctx.moveTo(x - tw, ty);
    ctx.lineTo(x + tw, ty);
    ctx.lineTo(x, ty - 18);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTree(x, baseY) {
  ctx.fillRect(x - 3, baseY - 55, 6, 55);
  ctx.beginPath();
  ctx.arc(x, baseY - 60, 22, 0, Math.PI*2);
  ctx.fill();
}

function drawRooftiles() {
  const speed  = SCROLL_SPEED * 0.55;
  const offset = (parallax.scrollX[3] * speed) % canvas.width;
  const gY     = groundY();
  ctx.fillStyle = '#0e0c14';
  ctx.strokeStyle = '#1a1825';
  ctx.lineWidth = 1;
  for (let s = 0; s < 2; s++) {
    const tiles = parallax.rooftiles[s];
    if (!tiles) return;
    tiles.forEach(t => {
      const sx = t.x - offset + (s === 0 ? 0 : canvas.width);
      const screenX = ((sx % (canvas.width * 2)) + canvas.width * 2) % (canvas.width * 2);
      if (screenX > -200 && screenX < canvas.width + 200) {
        ctx.fillRect(screenX, gY - 25, t.w, 20);
        ctx.strokeRect(screenX, gY - 25, t.w, 20);
        // tile curve hint
        ctx.beginPath();
        ctx.moveTo(screenX, gY - 25);
        ctx.quadraticCurveTo(screenX + t.w * 0.5, gY - 32, screenX + t.w, gY - 25);
        ctx.stroke();
      }
    });
  }
}

function drawGround() {
  const gY = groundY();
  // ground fill
  const grad = ctx.createLinearGradient(0, gY, 0, canvas.height);
  grad.addColorStop(0, '#241508');
  grad.addColorStop(1, '#0a0602');
  ctx.fillStyle = grad;
  ctx.fillRect(0, gY, canvas.width, canvas.height - gY);
  // ground edge line
  ctx.strokeStyle = '#3a2810';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, gY); ctx.lineTo(canvas.width, gY);
  ctx.stroke();
}

function drawFog() {
  const gY = groundY();
  const fogGrad = ctx.createLinearGradient(0, gY - 80, 0, gY - 200);
  fogGrad.addColorStop(0, 'rgba(20,15,35,0.35)');
  fogGrad.addColorStop(1, 'rgba(20,15,35,0)');
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, gY - 200, canvas.width, 200);
}

function drawBlossoms() {
  blossoms.forEach(b => {
    ctx.save();
    ctx.globalAlpha = b.alpha;
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = C.blossom;
    // Simple 5-petal blossom
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(b.r * 0.8, 0, b.r, b.r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(Math.PI * 2 / 5);
    }
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

// ── Combat overlay ────────────────────────────────────────────
function drawCombatOverlay() {
  // Darken the scene so the enemy and player pop
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Red arena glow centred on the combat zone
  const gY  = groundY();
  const grd = ctx.createRadialGradient(
    canvas.width * 0.65, gY, 0,
    canvas.width * 0.65, gY, canvas.width * 0.42
  );
  grd.addColorStop(0, 'rgba(192,57,43,0.22)');
  grd.addColorStop(1, 'rgba(192,57,43,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ── Player drawing ────────────────────────────────────────────
function drawPlayer() {
  if (player.state === 'dead') {
    const t = Math.min(1, player.deadTimer / 0.8);
    ctx.globalAlpha = 1 - t;
  }

  // Motion trail
  player.trail.forEach(t => {
    ctx.save();
    ctx.globalAlpha = t.alpha * 0.18;
    drawNinja(t.x, t.y, player.state, player.animFrame, 0.6);
    ctx.restore();
  });

  ctx.globalAlpha = player.state === 'dead' ? ctx.globalAlpha : 1;
  drawNinja(player.x, player.y, player.state, player.animFrame, 1);
  ctx.globalAlpha = 1;
}

function drawNinja(x, y, state, frame, scale) {
  ctx.save();
  ctx.translate(x + player.w * 0.5, y + player.h);
  ctx.scale(scale, scale);

  const W = player.w;
  const H = player.h;
  const duck = state === 'ducking';
  const bH   = duck ? H * 0.4 : H;

  // Scarf (behind body)
  ctx.strokeStyle = C.accent;
  ctx.lineWidth   = 4;
  ctx.lineCap     = 'round';
  const scarfY = duck ? -bH * 0.7 : -bH * 0.8;
  const waveOff = state === 'running' ? Math.sin(frame * 0.8) * 8 : 0;
  ctx.beginPath();
  ctx.moveTo(-W * 0.05, scarfY);
  ctx.bezierCurveTo(-W * 0.5, scarfY - 5 + waveOff, -W, scarfY + 10, -W * 1.4, scarfY + 5 + waveOff);
  ctx.stroke();

  // Body silhouette
  ctx.fillStyle = '#1a1a2a';
  ctx.beginPath();
  if (duck) {
    ctx.ellipse(0, -bH * 0.55, W * 0.55, bH * 0.55, 0, 0, Math.PI * 2);
  } else {
    // Torso
    ctx.roundRect(-W * 0.45, -bH, W * 0.9, bH * 0.6, 3);
  }
  ctx.fill();

  // Gi highlight (silver)
  ctx.fillStyle = C.silver;
  ctx.globalAlpha = 0.85;
  if (!duck) {
    ctx.beginPath();
    ctx.roundRect(-W * 0.3, -bH * 0.95, W * 0.6, bH * 0.45, 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Legs (running animation)
  if (!duck && state !== 'dead') {
    const legSwing = Math.sin(frame * 0.9) * 18;
    ctx.fillStyle = '#1a1a2a';
    // leg 1
    ctx.save();
    ctx.translate(-W * 0.18, -bH * 0.42);
    ctx.rotate((legSwing) * Math.PI / 180);
    ctx.fillRect(-5, 0, 10, bH * 0.42);
    ctx.restore();
    // leg 2
    ctx.save();
    ctx.translate(W * 0.18, -bH * 0.42);
    ctx.rotate((-legSwing) * Math.PI / 180);
    ctx.fillRect(-5, 0, 10, bH * 0.42);
    ctx.restore();
  }

  // Head
  ctx.fillStyle = '#1a1a2a';
  ctx.beginPath();
  if (duck) ctx.arc(W * 0.15, -bH * 1.0, W * 0.28, 0, Math.PI * 2);
  else      ctx.arc(0, -bH * 1.05, W * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Eye(s) — white slit
  ctx.fillStyle = C.silver;
  ctx.fillRect(duck ? W * 0.28 : W * 0.08, duck ? -bH * 1.02 : -bH * 1.06, W * 0.15, 3);

  // Attack arm
  if (state === 'attacking') {
    ctx.strokeStyle = C.silver;
    ctx.lineWidth   = 5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(W * 0.4, -bH * 0.7);
    ctx.lineTo(W * 1.0, -bH * 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Spike drawing ─────────────────────────────────────────────
function drawSpikes() {
  spikes.forEach(s => {
    const n  = s.count;
    const sw = s.w / n;
    for (let i = 0; i < n; i++) {
      const sx = s.x + i * sw + sw * 0.1;
      const tw = sw * 0.8;
      ctx.fillStyle = C.accent;
      ctx.beginPath();
      ctx.moveTo(sx, groundY());
      ctx.lineTo(sx + tw * 0.5, s.y);
      ctx.lineTo(sx + tw, groundY());
      ctx.closePath();
      ctx.fill();
      // highlight edge
      ctx.strokeStyle = '#e05040';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
}

// ── Projectile drawing ────────────────────────────────────────
function drawProjectiles() {
  projectiles.forEach(p => {
    ctx.save();
    ctx.translate(p.x + p.w * 0.5, p.y + p.h * 0.5);

    // Streak trail to the right (direction it came from)
    const trailGrd = ctx.createLinearGradient(0, 0, 44, 0);
    trailGrd.addColorStop(0, 'rgba(0,212,255,0.45)');
    trailGrd.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.fillStyle = trailGrd;
    ctx.fillRect(0, -3, 44, 6);

    // Bright cyan shuriken with strong glow
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur  = 22;
    ctx.fillStyle   = '#00d4ff';
    ctx.strokeStyle = '#80eeff';
    ctx.lineWidth   = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI * 0.5 + (Date.now() * 0.006));
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(5, -3); ctx.lineTo(0, 0); ctx.lineTo(-5, -3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

// ── Platform drawing ──────────────────────────────────────────
function drawPlatforms() {
  platforms.forEach(p => {
    // Platform body
    const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    grad.addColorStop(0, '#2a2040');
    grad.addColorStop(1, '#1a1030');
    ctx.fillStyle = grad;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#3a3060';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x, p.y, p.w, p.h);

    if (p.spiked) {
      // Spike tops
      const n = Math.floor(p.w / 18);
      const sw = p.w / n;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = C.accent;
        ctx.beginPath();
        ctx.moveTo(p.x + i * sw + 2, p.y);
        ctx.lineTo(p.x + i * sw + sw * 0.5, p.y - 12);
        ctx.lineTo(p.x + i * sw + sw - 2, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  });
}

// ── Star drawing ──────────────────────────────────────────────
function drawStars() {
  stars.forEach(s => {
    if (s.collected) return;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = C.gold;
    ctx.shadowColor = C.gold;
    ctx.shadowBlur  = 8;
    // 5-pointed star path
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r   = i % 2 === 0 ? s.r : s.r * 0.45;
      const ang = (i * Math.PI * 2 / 10) - Math.PI * 0.5;
      if (i === 0) ctx.moveTo(r * Math.cos(ang), r * Math.sin(ang));
      else         ctx.lineTo(r * Math.cos(ang), r * Math.sin(ang));
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

// ── Enemy drawing ─────────────────────────────────────────────
function drawEnemy() {
  if (!combat.active || !combat.enemy) return;
  const e  = combat.enemy;
  const gY = groundY();
  const scale = e.type === 'boss' ? 1.5 : 1.0;
  const W  = 28 * scale;
  const H  = 54 * scale;

  ctx.save();
  ctx.translate(e.x + W * 0.5, gY);
  ctx.scale(scale, scale);

  // Enemy glow (all types, stronger for boss)
  ctx.shadowColor = C.accent;
  ctx.shadowBlur  = e.type === 'boss' ? 40 : 18;

  // Body
  ctx.fillStyle = '#5a1010';
  ctx.beginPath();
  ctx.roundRect(-W * 0.45, -H, W * 0.9, H * 0.6, 3);
  ctx.fill();

  // Gi (red variant)
  ctx.fillStyle = '#c02020';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.roundRect(-W * 0.3, -H * 0.95, W * 0.6, H * 0.45, 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Head
  ctx.fillStyle = '#5a1010';
  ctx.beginPath();
  ctx.arc(0, -H * 1.05, W * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Glowing eyes
  ctx.fillStyle = e.type === 'boss' ? C.accent : '#e04040';
  ctx.shadowColor = C.accent;
  ctx.shadowBlur = 8;
  ctx.fillRect(-W * 0.18, -H * 1.07, W * 0.12, 4);
  ctx.fillRect(W * 0.06, -H * 1.07, W * 0.12, 4);
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ── Combat UI ─────────────────────────────────────────────────
function updateCombatUI() {
  const hc  = document.getElementById('hud-combat');
  const ck  = document.getElementById('combat-keys');
  const ctc = document.getElementById('combat-timer-container');
  const tr  = document.getElementById('timer-ring');

  if (!combat.active) {
    hc.classList.add('hidden');
    ctc.classList.add('hidden');
    return;
  }

  hc.classList.remove('hidden');
  ctc.classList.remove('hidden');

  // Render combo keys
  ck.innerHTML = '';
  combat.comboKeys.forEach((k, i) => {
    const div = document.createElement('div');
    div.className = 'combat-key';
    if (i < combat.inputIdx) div.classList.add('hit');
    else if (i === combat.inputIdx) div.classList.add('active');
    div.textContent = k;
    ck.appendChild(div);
  });

  // Timer ring — circumference = 2π×34 ≈ 213.6
  const circ    = 213.6;
  const elapsed = combat.timerFrac;
  tr.style.strokeDashoffset = circ * (1 - elapsed);
  tr.classList.toggle('timer-low', elapsed < 0.3);
}

// ── HUD text ──────────────────────────────────────────────────
function updateHUD() {
  document.getElementById('tier-label').textContent    = tierLabel();
  document.getElementById('score-value').textContent   = Math.floor(score);
  document.getElementById('highscore-value').textContent = Math.floor(highScore);
}

// ── Screen helpers ────────────────────────────────────────────
function showScreen(id) {
  ['screen-title','screen-pause','screen-gameover'].forEach(s => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}
function hideAllScreens() {
  ['screen-title','screen-pause','screen-gameover'].forEach(s =>
    document.getElementById(s).classList.add('hidden')
  );
}

// ── Input handler ─────────────────────────────────────────────
function handleInput(code) {
  // Title → start
  if (code === 'Enter' && (STATE === 'title' || STATE === 'gameover')) {
    startGame();
    return;
  }

  // Pause toggle (running only, not combat)
  if (code === 'Escape' && STATE === 'running') {
    STATE = 'paused';
    showScreen('screen-pause');
    return;
  }
  if (code === 'Escape' && STATE === 'paused') {
    STATE = 'running';
    hideAllScreens();
    return;
  }

  // Jump
  if ((code === 'Space' || code === 'ArrowUp') && STATE === 'running') {
    if (player.grounded && player.state !== 'ducking') {
      player.vy      = JUMP_VELOCITY;
      player.grounded = false;
      player.state   = 'jumping';
    }
    return;
  }

  // Combat input
  if (STATE === 'combat' && combat.active) {
    const keyMap = { KeyA:'A', KeyS:'S', KeyD:'D', KeyF:'F' };
    const k = keyMap[code];
    if (k) processCombatInput(k);
  }
}

// ── Combat logic ──────────────────────────────────────────────
const ENEMY_TYPES = {
  grunt:   { w:28, h:54, seq:2, timer:3.0, reward:25, label:'GRUNT'   },
  warrior: { w:28, h:54, seq:2, timer:2.5, reward:50, label:'WARRIOR' },
  elite:   { w:28, h:54, seq:3, timer:2.5, reward:75, label:'ELITE'   },
  boss:    { w:42, h:80, seq:3, timer:2.5, reward:150,label:'BOSS'    },
};

function triggerCombat(type) {
  const def   = ENEMY_TYPES[type] || ENEMY_TYPES.grunt;
  const keys  = ['A','S','D','F'];
  const timer = def.timer;

  combat.active    = true;
  combat.comboKeys = Array.from({length: def.seq}, () =>
    keys[Math.floor(Math.random() * keys.length)]
  );
  combat.inputIdx  = 0;
  combat.timerFrac = 1.0;
  combat.enemy     = {
    type, def, timer, maxTimer: timer,
    x: canvas.width * 0.65,
    y: groundY(),
    reward: def.reward,
  };
  STATE = 'combat';
}

function processCombatInput(key) {
  if (!combat.active) return;
  const expected = combat.comboKeys[combat.inputIdx];
  if (key !== expected) {
    killPlayer('Combat failed');
    return;
  }
  combat.inputIdx++;
  combat.hitFlash = 1;
  if (combat.inputIdx >= combat.comboKeys.length) {
    // Success
    score += combat.enemy.reward;
    endCombat(true);
  }
}

function endCombat(success) {
  combat.active = false;
  combat.enemy  = null;
  updateCombatUI();
  if (success) {
    STATE = 'running';
  }
}

// ── Player death ──────────────────────────────────────────────
function killPlayer(cause) {
  if (player.state === 'dead') return;
  player.state    = 'dead';
  player.deadTimer = 0;
  STATE = 'dead';
  endCombat(false);

  // Show game over after brief delay
  setTimeout(() => {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('shadowRunnerHS', Math.floor(highScore));
    }
    document.getElementById('gameover-score').textContent     = Math.floor(score);
    document.getElementById('gameover-highscore').textContent = Math.floor(highScore);
    document.getElementById('gameover-cause').textContent     = cause || 'Unknown';
    document.getElementById('new-best-banner').classList.toggle('hidden', score <= highScore);
    showScreen('screen-gameover');
    STATE = 'gameover';
  }, 900);
}

// ── Collision detection ───────────────────────────────────────
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function checkCollisions() {
  const gY      = groundY();
  const px      = player.x;
  const py      = player.y;
  const pw      = player.w;
  const ph      = player.state === 'ducking' ? player.h * 0.4 : player.h;
  const pTop    = py + (player.state === 'ducking' ? player.h * 0.6 : 0);

  // Spikes
  spikes.forEach(s => {
    if (rectOverlap(px + 4, pTop, pw - 8, ph - 4, s.x, s.y, s.w, s.h)) {
      killPlayer('Struck by spike');
    }
  });

  // Projectiles
  projectiles.forEach(p => {
    if (rectOverlap(px + 4, pTop, pw - 8, ph - 4, p.x, p.y, p.w, p.h)) {
      killPlayer('Hit by projectile');
    }
  });

  // Stars
  stars.forEach(s => {
    if (!s.collected && rectOverlap(px, pTop, pw, ph, s.x - s.r, s.y - s.r, s.r*2, s.r*2)) {
      s.collected = true;
      score += 10;
    }
  });

  // Platform landing (from above)
  if (!player.grounded && player.vy >= 0) {
    platforms.forEach(p => {
      if (player.x + pw > p.x && player.x < p.x + p.w) {
        const prevBottom = py + ph - player.vy * (1/60); // approximate previous frame
        const currBottom = py + ph;
        if (prevBottom <= p.y && currBottom >= p.y - 2) {
          if (p.spiked) {
            killPlayer('Struck by spike');
          } else {
            player.y       = p.y - ph;
            player.vy      = 0;
            player.grounded = true;
            if (player.state === 'jumping') player.state = 'running';
          }
        }
      }
    });
  }
}

// ── Enemy schedule ────────────────────────────────────────────
function checkEnemySchedule() {
  // Boss milestones
  if (enemyScheduler.nextBossIdx < enemyScheduler.bossScores.length) {
    const bs = enemyScheduler.bossScores[enemyScheduler.nextBossIdx];
    if (score >= bs) {
      enemyScheduler.nextBossIdx++;
      triggerCombat('boss');
      return;
    }
  }

  // Regular enemies
  if (score >= enemyScheduler.nextAt) {
    enemyScheduler.nextAt = score + 100 + Math.random() * 50;
    // Pick enemy type by score
    const pool = score >= 2000 ? ['grunt','warrior','elite','boss']
               : score >= 1200 ? ['grunt','warrior','elite']
               : score >= 800  ? ['grunt','warrior']
               : ['grunt'];
    const type = pool[Math.floor(Math.random() * pool.length)];
    triggerCombat(type);
  }
}

// ── Game init & start ─────────────────────────────────────────
function initGame() {
  CHUNKS = makeChunks();
  initParallax();
  initBlossoms();
}

function startGame() {
  score            = 0;
  lastSecondScore  = 0;
  player.deadTimer = 0;
  spikes           = [];
  projectiles      = [];
  platforms        = [];
  stars            = [];
  scheduler.worldX      = 0;
  scheduler.nextSpawnX  = canvas.width * 1.1; // first chunk just off screen right
  scheduler.safeTimer   = 5;                   // 5 s of pure star chunks
  scheduler.easyTimer   = 30;                  // then 30 s of single small spikes
  enemyScheduler.nextAt     = 500 + Math.random() * 50;
  enemyScheduler.nextBossIdx = 0;
  combat.active    = false;
  combat.enemy     = null;

  resetPlayer();
  hideAllScreens();
  updateHUD();

  // Update title HS
  const ths = document.getElementById('title-hs-value');
  if (ths) ths.textContent = Math.floor(highScore);
  const thsWrap = document.getElementById('title-highscore');
  if (thsWrap) {
    if (highScore > 0) thsWrap.classList.remove('hidden');
    else               thsWrap.classList.add('hidden');
  }

  STATE = 'running';
}

// ── Main update ───────────────────────────────────────────────
let lastTime = 0;
const PARALLAX_TICK = { t: 0 };

function update(dt) {
  // Parallax scroll accumulator (independent of game speed)
  PARALLAX_TICK.t += dt;
  // Freeze background during combat so it isn't distracting
  if (STATE !== 'combat') {
    parallax.scrollX[1] += dt;
    parallax.scrollX[2] += dt;
    parallax.scrollX[3] += dt;
  }

  if (STATE === 'running') {
    updateRunning(dt);
    checkEnemySchedule();
  } else if (STATE === 'combat') {
    updateCombat(dt);
  } else if (STATE === 'dead') {
    player.deadTimer += dt;
    player.vy += GRAVITY * dt;
    player.y  += player.vy * dt;
  }

  // Blossoms always animate
  updateBlossoms(dt);
}

function updateRunning(dt) {
  const gY = groundY();

  // Phase countdowns
  if (scheduler.safeTimer > 0) {
    scheduler.safeTimer -= dt;
  } else if (scheduler.easyTimer > 0) {
    scheduler.easyTimer -= dt;
  }

  // Score: +1/sec survival
  score += dt;

  // Player physics
  if (!player.grounded) {
    player.vy += GRAVITY * dt;
    player.y  += player.vy * dt;
  }

  // Ducking
  const isDucking = keys['ShiftLeft'] || keys['ShiftRight'];
  if (player.grounded) {
    if (isDucking) {
      player.state = 'ducking';
    } else if (player.state === 'ducking' || player.state === 'running') {
      player.state = 'running';
    }
  }

  // Ground snap
  const ph = player.state === 'ducking' ? player.h * 0.4 : player.h;
  const pBottom = player.y + ph;
  if (pBottom >= gY) {
    player.y        = gY - ph;
    player.vy       = 0;
    player.grounded = true;
    if (player.state === 'jumping') player.state = 'running';
  }

  // Animate
  player.animTimer += dt;
  if (player.animTimer > 0.1) {
    player.animTimer = 0;
    player.animFrame = (player.animFrame + 1) % 4;
  }

  // Trail
  player.trail.push({ x: player.x - 12, y: player.y, alpha: 0.6 });
  if (player.trail.length > 6) player.trail.shift();
  player.trail.forEach(t => t.alpha -= 0.08);

  // Scroll world
  const dx = SCROLL_SPEED * dt;
  scheduler.worldX += dx;

  // Move entities left
  spikes.forEach(s => s.x -= dx);
  projectiles.forEach(p => p.x -= dx);
  platforms.forEach(p => p.x -= dx);
  stars.forEach(s => s.x -= dx);

  // Cull off-screen entities
  spikes      = spikes.filter(s => s.x + s.w > -50);
  projectiles = projectiles.filter(p => p.x + p.w > -50);
  platforms   = platforms.filter(p => p.x + p.w > -50);
  stars        = stars.filter(s => s.x > -50);

  // Spawn next chunk
  if (scheduler.worldX >= scheduler.nextSpawnX - canvas.width) {
    const spawnScreenX = canvas.width + 100;
    const worldAbs     = scheduler.worldX + spawnScreenX;
    // Translate: entity screen x = worldAbs - scheduler.worldX + dx
    // Simpler: just use screen x directly since we'll subtract worldX scroll each frame
    // Entities start at canvas.width+100 and scroll left from there
    spawnChunkAtScreen(spawnScreenX);
    // Schedule next chunk
    scheduler.nextSpawnX = scheduler.worldX + canvas.width * 1.5 + Math.random() * canvas.width * 0.5;
  }

  // Rotate stars
  stars.forEach(s => s.angle += dt * 1.8);

  checkCollisions();
}

function spawnChunkAtScreen(startX) {
  const chunk = pickChunk();
  const gY    = groundY();

  chunk.entities.forEach(e => {
    const ex = startX + e.rx;

    if (e.kind === 'spike') {
      spikes.push(createSpike(ex, e.variant, gY));
    } else if (e.kind === 'proj') {
      const projH = e.height === 'mid'
        ? gY - player.h * 1.15
        : gY - player.h * 0.55;
      projectiles.push({ x: ex, y: projH, w: 18, h: 8 });
    } else if (e.kind === 'platform') {
      platforms.push({
        x: ex, y: gY - player.h - 135,
        w: 110, h: 28, spiked: e.spiked,
      });
    } else if (e.kind === 'star') {
      stars.push({ x: ex, y: gY - e.ry, r: 10, angle: 0, collected: false });
    }
  });
}

function updateCombat(dt) {
  if (!combat.active || !combat.enemy) return;
  const e = combat.enemy;
  e.timer -= dt;
  combat.timerFrac = Math.max(0, e.timer / e.maxTimer);
  if (combat.hitFlash > 0) combat.hitFlash = Math.max(0, combat.hitFlash - dt * 5);
  if (e.timer <= 0) {
    killPlayer('Combat failed');
  }
}

function updateBlossoms(dt) {
  blossoms.forEach(b => {
    b.x     += b.vx;
    b.y     += b.vy;
    b.angle += b.spin;
    if (b.x < -20 || b.y > canvas.height + 20) {
      Object.assign(b, makeBlossom(false));
    }
  });
}

// ── Render ────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawMountains();
  drawPagodas();
  drawRooftiles();
  drawGround();
  drawFog();
  if (STATE === 'combat') drawCombatOverlay();

  drawPlatforms();
  drawSpikes();
  drawProjectiles();
  drawStars();

  drawEnemy();
  drawPlayer();
  drawBlossoms();

  // Green screen flash on a correct combat key press
  if (combat.hitFlash > 0) {
    ctx.fillStyle = `rgba(74,222,128,${combat.hitFlash * 0.2})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  updateCombatUI();
  updateHUD();
}

// ── Game loop ─────────────────────────────────────────────────
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = timestamp;

  if (STATE !== 'paused') {
    update(dt);
  }
  render();
  requestAnimationFrame(loop);
}

// ── Bootstrap ─────────────────────────────────────────────────
(function bootstrap() {
  initGame();

  // Show title screen
  STATE = 'title';
  showScreen('screen-title');

  // Set title high score
  const ths = document.getElementById('title-hs-value');
  if (ths) ths.textContent = Math.floor(highScore);
  if (highScore > 0) {
    document.getElementById('title-highscore').classList.remove('hidden');
  }

  requestAnimationFrame(ts => { lastTime = ts; loop(ts); });
})();
