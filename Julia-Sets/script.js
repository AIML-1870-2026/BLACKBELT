// Julia Set Explorer - Main Application

// ============================================================================
// Configuration & State
// ============================================================================

const CONFIG = {
    defaultC: { real: -0.7, imag: 0.27015 },
    defaultIterations: 200,
    defaultZoom: 1,
    defaultCenter: { x: 0, y: 0 },
    mandelbrotCenter: { x: -0.5, y: 0 },
    escapeRadius: 4,
    numWorkers: navigator.hardwareConcurrency || 4,
    progressiveSteps: [4, 2, 1],
    debounceDelay: 16
};

const PRESETS = [
    { name: 'Dendrite', real: -0.7, imag: 0.27015 },
    { name: 'Rabbit', real: -0.123, imag: 0.745 },
    { name: 'Seahorse Valley', real: -0.75, imag: 0.11 },
    { name: 'Lightning', real: -0.4, imag: 0.6 },
    { name: 'Spiral Galaxy', real: 0.285, imag: 0.01 },
    { name: 'Fatou Dust', real: 0.36, imag: 0.1 },
    { name: 'San Marco', real: -0.75, imag: 0.0 },
    { name: 'Starfish', real: -0.593, imag: 0.4 }
];

const PALETTES = ['classic', 'inferno', 'ocean', 'cosmic', 'grayscale'];

// Application state
const state = {
    c: { ...CONFIG.defaultC },
    julia: {
        zoom: CONFIG.defaultZoom,
        center: { ...CONFIG.defaultCenter }
    },
    mandelbrot: {
        zoom: 1,
        center: { ...CONFIG.mandelbrotCenter }
    },
    maxIterations: CONFIG.defaultIterations,
    palette: 'classic',
    isHeatmap: false,
    heatmapOpacity: 0.5,
    splitView: false,
    orbitMode: false,
    orbitPoint: null,
    orbitData: [],
    orbitPlaying: false,
    orbitStep: 0,
    animation: {
        playing: false,
        mode: 'circle',
        speed: 1,
        radius: 0.3,
        angle: 0,
        center: { real: 0, imag: 0 },
        customPath: [],
        pathIndex: 0
    },
    rendering: {
        julia: false,
        mandelbrot: false
    },
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragCanvas: null
};

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
    // Canvases
    juliaCanvas: document.getElementById('juliaCanvas'),
    mandelbrotCanvas: document.getElementById('mandelbrotCanvas'),
    orbitCanvas: document.getElementById('orbitCanvas'),
    minimapCanvas: document.getElementById('minimapCanvas'),

    // Containers
    juliaContainer: document.getElementById('juliaContainer'),
    mandelbrotContainer: document.getElementById('mandelbrotContainer'),
    mainContent: document.getElementById('mainContent'),
    minimap: document.getElementById('minimap'),
    minimapViewport: document.getElementById('minimapViewport'),

    // Info bar
    infoC: document.getElementById('infoC'),
    infoCursor: document.getElementById('infoCursor'),
    infoZoom: document.getElementById('infoZoom'),
    infoIterations: document.getElementById('infoIterations'),
    infoRenderTime: document.getElementById('infoRenderTime'),

    // Control panel
    controlPanel: document.getElementById('controlPanel'),
    panelToggle: document.getElementById('panelToggle'),
    panelClose: document.getElementById('panelClose'),

    // C controls
    cRealSlider: document.getElementById('cRealSlider'),
    cImagSlider: document.getElementById('cImagSlider'),
    cRealValue: document.getElementById('cRealValue'),
    cImagValue: document.getElementById('cImagValue'),
    displayCReal: document.getElementById('displayCReal'),
    displayCImag: document.getElementById('displayCImag'),

    // Iterations
    iterationsSlider: document.getElementById('iterationsSlider'),
    iterationsValue: document.getElementById('iterationsValue'),

    // View options
    splitViewBtn: document.getElementById('splitViewBtn'),
    heatmapBtn: document.getElementById('heatmapBtn'),
    heatmapOpacityRow: document.getElementById('heatmapOpacityRow'),
    heatmapOpacity: document.getElementById('heatmapOpacity'),
    heatmapOpacityValue: document.getElementById('heatmapOpacityValue'),

    // Educational
    orbitModeBtn: document.getElementById('orbitModeBtn'),
    orbitInfo: document.getElementById('orbitInfo'),
    orbitControls: document.getElementById('orbitControls'),
    orbitStep: document.getElementById('orbitStep'),
    orbitPlay: document.getElementById('orbitPlay'),
    orbitReset: document.getElementById('orbitReset'),
    orbitExit: document.getElementById('orbitExit'),
    iterationTableBody: document.getElementById('iterationTableBody'),

    // Animation
    animPlayBtn: document.getElementById('animPlayBtn'),
    animModeSelect: document.getElementById('animModeSelect'),
    animSpeed: document.getElementById('animSpeed'),
    animSpeedValue: document.getElementById('animSpeedValue'),
    animRadius: document.getElementById('animRadius'),
    animRadiusValue: document.getElementById('animRadiusValue'),

    // Actions
    resetViewBtn: document.getElementById('resetViewBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),

    // Presets
    presetsContainer: document.getElementById('presetsContainer'),
    presetsToggle: document.getElementById('presetsToggle'),
    presetsGallery: document.getElementById('presetsGallery'),

    // Help
    helpBtn: document.getElementById('helpBtn'),
    shortcutsModal: document.getElementById('shortcutsModal'),

    // Loading
    loadingIndicator: document.getElementById('loadingIndicator'),

    // Crosshair
    mandelbrotCrosshair: document.getElementById('mandelbrotCrosshair'),

    // App container
    app: document.getElementById('app')
};

// Canvas contexts
const ctx = {
    julia: elements.juliaCanvas.getContext('2d'),
    mandelbrot: elements.mandelbrotCanvas.getContext('2d'),
    orbit: elements.orbitCanvas.getContext('2d'),
    minimap: elements.minimapCanvas.getContext('2d')
};

// ============================================================================
// Web Workers
// ============================================================================

const workers = [];
let workerIdCounter = 0;
const pendingRenders = new Map();

function initWorkers() {
    for (let i = 0; i < CONFIG.numWorkers; i++) {
        const worker = new Worker('worker.js');
        worker.onmessage = handleWorkerMessage;
        workers.push(worker);
    }
}

function handleWorkerMessage(e) {
    const { id, result, type } = e.data;
    const pending = pendingRenders.get(id);

    if (pending) {
        pending.strips.push(result);
        pending.completed++;

        if (pending.completed === pending.total) {
            // All strips complete - compose final image
            composeImage(pending);
            pendingRenders.delete(id);
        }
    }
}

function composeImage(pending) {
    const { canvas, context, strips, startTime, type } = pending;
    const imageData = context.createImageData(canvas.width, canvas.height);

    for (const strip of strips) {
        const stripHeight = strip.endY - strip.startY;
        for (let y = 0; y < stripHeight; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const srcIdx = (y * canvas.width + x) * 4;
                const dstIdx = ((strip.startY + y) * canvas.width + x) * 4;
                imageData.data[dstIdx] = strip.data[srcIdx];
                imageData.data[dstIdx + 1] = strip.data[srcIdx + 1];
                imageData.data[dstIdx + 2] = strip.data[srcIdx + 2];
                imageData.data[dstIdx + 3] = strip.data[srcIdx + 3];
            }
        }
    }

    context.putImageData(imageData, 0, 0);

    const renderTime = performance.now() - startTime;
    elements.infoRenderTime.textContent = `${Math.round(renderTime)}ms`;

    if (type === 'julia') {
        state.rendering.julia = false;
    } else {
        state.rendering.mandelbrot = false;
    }

    updateLoadingIndicator();
}

function renderFractal(type, canvas, context, params) {
    const id = workerIdCounter++;
    const height = canvas.height;
    const stripHeight = Math.ceil(height / CONFIG.numWorkers);

    pendingRenders.set(id, {
        canvas,
        context,
        strips: [],
        completed: 0,
        total: CONFIG.numWorkers,
        startTime: performance.now(),
        type
    });

    if (type === 'julia') {
        state.rendering.julia = true;
    } else {
        state.rendering.mandelbrot = true;
    }
    updateLoadingIndicator();

    for (let i = 0; i < CONFIG.numWorkers; i++) {
        const startY = i * stripHeight;
        const endY = Math.min((i + 1) * stripHeight, height);

        workers[i].postMessage({
            id,
            type,
            params: {
                ...params,
                startY,
                endY,
                width: canvas.width,
                height: canvas.height
            }
        });
    }
}

function updateLoadingIndicator() {
    const isRendering = state.rendering.julia || state.rendering.mandelbrot;
    elements.loadingIndicator.classList.toggle('visible', isRendering);
}

// ============================================================================
// Rendering Functions
// ============================================================================

let renderDebounceTimer = null;

function requestRender(immediate = false) {
    if (renderDebounceTimer) {
        clearTimeout(renderDebounceTimer);
    }

    if (immediate) {
        performRender();
    } else {
        renderDebounceTimer = setTimeout(performRender, CONFIG.debounceDelay);
    }
}

function performRender() {
    renderJulia();
    if (state.splitView) {
        renderMandelbrot();
    }
    updateMinimap();
}

function renderJulia() {
    renderFractal('julia', elements.juliaCanvas, ctx.julia, {
        cReal: state.c.real,
        cImag: state.c.imag,
        maxIterations: state.maxIterations,
        viewCenterX: state.julia.center.x,
        viewCenterY: state.julia.center.y,
        zoom: state.julia.zoom,
        palette: state.palette,
        isHeatmap: state.isHeatmap
    });
}

function renderMandelbrot() {
    renderFractal('mandelbrot', elements.mandelbrotCanvas, ctx.mandelbrot, {
        maxIterations: state.maxIterations,
        viewCenterX: state.mandelbrot.center.x,
        viewCenterY: state.mandelbrot.center.y,
        zoom: state.mandelbrot.zoom,
        palette: state.palette,
        isHeatmap: false
    });
    updateCrosshair();
}

function updateMinimap() {
    if (state.julia.zoom <= 2) {
        elements.minimap.classList.add('hidden');
        return;
    }

    elements.minimap.classList.remove('hidden');

    // Render minimap at low resolution
    const miniCanvas = elements.minimapCanvas;
    const miniCtx = ctx.minimap;

    // Simple direct render for minimap (no workers for simplicity)
    const width = miniCanvas.width;
    const height = miniCanvas.height;
    const imageData = miniCtx.createImageData(width, height);

    const viewWidth = 4;
    const viewHeight = viewWidth * (height / width);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const zReal0 = (x / width - 0.5) * viewWidth;
            const zImag0 = (y / height - 0.5) * viewHeight;

            let zReal = zReal0;
            let zImag = zImag0;
            let iteration = 0;
            const maxIter = 50;

            while (zReal * zReal + zImag * zImag <= 4 && iteration < maxIter) {
                const temp = zReal * zReal - zImag * zImag + state.c.real;
                zImag = 2 * zReal * zImag + state.c.imag;
                zReal = temp;
                iteration++;
            }

            const idx = (y * width + x) * 4;
            if (iteration === maxIter) {
                imageData.data[idx] = 0;
                imageData.data[idx + 1] = 0;
                imageData.data[idx + 2] = 0;
            } else {
                const t = iteration / maxIter;
                imageData.data[idx] = Math.floor(t * 100);
                imageData.data[idx + 1] = Math.floor(t * 150);
                imageData.data[idx + 2] = Math.floor(200 + t * 55);
            }
            imageData.data[idx + 3] = 255;
        }
    }

    miniCtx.putImageData(imageData, 0, 0);

    // Update viewport rectangle
    const viewportWidth = (1 / state.julia.zoom) * miniCanvas.width;
    const viewportHeight = (1 / state.julia.zoom) * miniCanvas.height;
    const viewportX = (0.5 + state.julia.center.x / 4) * miniCanvas.width - viewportWidth / 2;
    const viewportY = (0.5 + state.julia.center.y / (4 * miniCanvas.height / miniCanvas.width)) * miniCanvas.height - viewportHeight / 2;

    elements.minimapViewport.style.left = `${viewportX}px`;
    elements.minimapViewport.style.top = `${viewportY}px`;
    elements.minimapViewport.style.width = `${viewportWidth}px`;
    elements.minimapViewport.style.height = `${viewportHeight}px`;
}

// ============================================================================
// Canvas Setup
// ============================================================================

function resizeCanvases() {
    const juliaRect = elements.juliaContainer.getBoundingClientRect();
    elements.juliaCanvas.width = juliaRect.width;
    elements.juliaCanvas.height = juliaRect.height;
    elements.orbitCanvas.width = juliaRect.width;
    elements.orbitCanvas.height = juliaRect.height;

    if (state.splitView) {
        const mandelbrotRect = elements.mandelbrotContainer.getBoundingClientRect();
        elements.mandelbrotCanvas.width = mandelbrotRect.width;
        elements.mandelbrotCanvas.height = mandelbrotRect.height;
    }

    elements.minimapCanvas.width = 150;
    elements.minimapCanvas.height = 100;

    requestRender(true);
}

// ============================================================================
// Coordinate Conversion
// ============================================================================

function pixelToComplex(x, y, canvas, view) {
    const aspectRatio = canvas.width / canvas.height;
    const viewWidth = 4 / view.zoom;
    const viewHeight = viewWidth / aspectRatio;

    const real = view.center.x + (x / canvas.width - 0.5) * viewWidth;
    const imag = view.center.y + (y / canvas.height - 0.5) * viewHeight;

    return { real, imag };
}

function complexToPixel(real, imag, canvas, view) {
    const aspectRatio = canvas.width / canvas.height;
    const viewWidth = 4 / view.zoom;
    const viewHeight = viewWidth / aspectRatio;

    const x = ((real - view.center.x) / viewWidth + 0.5) * canvas.width;
    const y = ((imag - view.center.y) / viewHeight + 0.5) * canvas.height;

    return { x, y };
}

// ============================================================================
// UI Updates
// ============================================================================

function updateUI() {
    // Update info bar
    elements.infoC.textContent = formatComplex(state.c.real, state.c.imag);
    elements.infoZoom.textContent = `${state.julia.zoom.toFixed(1)}x`;
    elements.infoIterations.textContent = state.maxIterations;

    // Update control panel
    elements.cRealSlider.value = state.c.real;
    elements.cImagSlider.value = state.c.imag;
    elements.cRealValue.textContent = state.c.real.toFixed(3);
    elements.cImagValue.textContent = state.c.imag.toFixed(3);
    elements.displayCReal.textContent = state.c.real.toFixed(3);
    elements.displayCImag.textContent = state.c.imag.toFixed(3);

    elements.iterationsSlider.value = state.maxIterations;
    elements.iterationsValue.textContent = state.maxIterations;

    // Update button states
    elements.splitViewBtn.classList.toggle('active', state.splitView);
    elements.heatmapBtn.classList.toggle('active', state.isHeatmap);
    elements.orbitModeBtn.classList.toggle('active', state.orbitMode);
    elements.animPlayBtn.classList.toggle('active', state.animation.playing);

    // Update animation controls
    elements.animSpeedValue.textContent = `${state.animation.speed.toFixed(1)}x`;
    elements.animRadiusValue.textContent = state.animation.radius.toFixed(2);

    // Update heatmap opacity
    elements.heatmapOpacity.value = state.heatmapOpacity * 100;
    elements.heatmapOpacityValue.textContent = `${Math.round(state.heatmapOpacity * 100)}%`;
}

function formatComplex(real, imag) {
    const sign = imag >= 0 ? '+' : '-';
    return `${real.toFixed(3)} ${sign} ${Math.abs(imag).toFixed(3)}i`;
}

function updateCrosshair() {
    if (!state.splitView) return;

    const pos = complexToPixel(
        state.c.real,
        state.c.imag,
        elements.mandelbrotCanvas,
        state.mandelbrot
    );

    elements.mandelbrotCrosshair.style.left = `${pos.x}px`;
    elements.mandelbrotCrosshair.style.top = `${pos.y}px`;
}

// ============================================================================
// Presets Gallery
// ============================================================================

function initPresets() {
    const gallery = elements.presetsGallery;
    gallery.innerHTML = '';

    PRESETS.forEach((preset, index) => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        item.dataset.index = index;

        const thumb = document.createElement('div');
        thumb.className = 'preset-thumb';

        const canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 60;
        thumb.appendChild(canvas);

        const name = document.createElement('span');
        name.className = 'preset-name';
        name.textContent = preset.name;

        item.appendChild(thumb);
        item.appendChild(name);
        gallery.appendChild(item);

        // Render thumbnail
        renderPresetThumb(canvas, preset);

        item.addEventListener('click', () => selectPreset(index));
    });

    updatePresetSelection();
}

function renderPresetThumb(canvas, preset) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.createImageData(width, height);

    const viewWidth = 4;
    const viewHeight = viewWidth * (height / width);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let zReal = (x / width - 0.5) * viewWidth;
            let zImag = (y / height - 0.5) * viewHeight;
            let iteration = 0;
            const maxIter = 50;

            while (zReal * zReal + zImag * zImag <= 4 && iteration < maxIter) {
                const temp = zReal * zReal - zImag * zImag + preset.real;
                zImag = 2 * zReal * zImag + preset.imag;
                zReal = temp;
                iteration++;
            }

            const idx = (y * width + x) * 4;
            if (iteration === maxIter) {
                imageData.data[idx] = 0;
                imageData.data[idx + 1] = 0;
                imageData.data[idx + 2] = 0;
            } else {
                const t = iteration / maxIter;
                imageData.data[idx] = Math.floor(t * 100);
                imageData.data[idx + 1] = Math.floor(t * 150);
                imageData.data[idx + 2] = Math.floor(200 + t * 55);
            }
            imageData.data[idx + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function selectPreset(index) {
    const preset = PRESETS[index];
    state.c.real = preset.real;
    state.c.imag = preset.imag;
    updateUI();
    updatePresetSelection();
    requestRender(true);
}

function updatePresetSelection() {
    const items = elements.presetsGallery.querySelectorAll('.preset-item');
    items.forEach((item, index) => {
        const preset = PRESETS[index];
        const isActive = Math.abs(state.c.real - preset.real) < 0.001 &&
                        Math.abs(state.c.imag - preset.imag) < 0.001;
        item.classList.toggle('active', isActive);
    });
}

// ============================================================================
// Orbit Visualization
// ============================================================================

function toggleOrbitMode() {
    state.orbitMode = !state.orbitMode;
    elements.orbitModeBtn.classList.toggle('active', state.orbitMode);
    elements.orbitInfo.style.display = state.orbitMode ? 'block' : 'none';
    elements.orbitControls.classList.toggle('hidden', !state.orbitMode);

    if (!state.orbitMode) {
        clearOrbit();
    }

    elements.juliaCanvas.style.cursor = state.orbitMode ? 'crosshair' : 'grab';
}

function startOrbit(x, y) {
    const complex = pixelToComplex(x, y, elements.juliaCanvas, state.julia);
    state.orbitPoint = complex;
    state.orbitData = [];
    state.orbitStep = 0;
    state.orbitPlaying = false;

    computeOrbit();
    drawOrbit();
    updateOrbitTable();
}

function computeOrbit() {
    if (!state.orbitPoint) return;

    let z = { real: state.orbitPoint.real, imag: state.orbitPoint.imag };
    state.orbitData = [{ ...z }];

    for (let i = 0; i < state.maxIterations; i++) {
        const real2 = z.real * z.real;
        const imag2 = z.imag * z.imag;

        if (real2 + imag2 > 4) break;

        const newReal = real2 - imag2 + state.c.real;
        const newImag = 2 * z.real * z.imag + state.c.imag;
        z = { real: newReal, imag: newImag };
        state.orbitData.push({ ...z });
    }
}

function drawOrbit() {
    const canvas = elements.orbitCanvas;
    const context = ctx.orbit;
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!state.orbitPoint || state.orbitData.length === 0) return;

    const visibleSteps = state.orbitStep > 0 ? state.orbitStep : state.orbitData.length;
    const escaped = state.orbitData.length < state.maxIterations;

    // Draw path
    context.beginPath();
    context.strokeStyle = escaped ? 'rgba(239, 68, 68, 0.7)' : 'rgba(34, 197, 94, 0.7)';
    context.lineWidth = 1.5;

    for (let i = 0; i < Math.min(visibleSteps, state.orbitData.length); i++) {
        const point = state.orbitData[i];
        const pos = complexToPixel(point.real, point.imag, canvas, state.julia);

        if (i === 0) {
            context.moveTo(pos.x, pos.y);
        } else {
            context.lineTo(pos.x, pos.y);
        }
    }
    context.stroke();

    // Draw points
    for (let i = 0; i < Math.min(visibleSteps, state.orbitData.length); i++) {
        const point = state.orbitData[i];
        const pos = complexToPixel(point.real, point.imag, canvas, state.julia);
        const size = Math.max(2, 6 - i * 0.1);

        context.beginPath();
        context.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        context.fillStyle = escaped ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)';
        context.fill();

        // Highlight current step
        if (state.orbitStep > 0 && i === state.orbitStep - 1) {
            context.beginPath();
            context.arc(pos.x, pos.y, size + 4, 0, Math.PI * 2);
            context.strokeStyle = '#fff';
            context.lineWidth = 2;
            context.stroke();
        }
    }
}

function updateOrbitTable() {
    const tbody = elements.iterationTableBody;
    tbody.innerHTML = '';

    const visibleSteps = state.orbitStep > 0 ? state.orbitStep : state.orbitData.length;

    for (let i = 0; i < Math.min(visibleSteps, state.orbitData.length); i++) {
        const point = state.orbitData[i];
        const mag = Math.sqrt(point.real * point.real + point.imag * point.imag);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${i}</td>
            <td>${point.real.toFixed(4)}</td>
            <td>${point.imag.toFixed(4)}</td>
            <td>${mag.toFixed(4)}</td>
        `;
        tbody.appendChild(row);
    }
}

function stepOrbit() {
    if (!state.orbitPoint) return;
    if (state.orbitStep < state.orbitData.length) {
        state.orbitStep++;
        drawOrbit();
        updateOrbitTable();
    }
}

function playOrbit() {
    state.orbitPlaying = !state.orbitPlaying;
    if (state.orbitPlaying) {
        animateOrbit();
    }
}

function animateOrbit() {
    if (!state.orbitPlaying) return;
    if (state.orbitStep < state.orbitData.length) {
        state.orbitStep++;
        drawOrbit();
        updateOrbitTable();
        setTimeout(animateOrbit, 100);
    } else {
        state.orbitPlaying = false;
    }
}

function resetOrbit() {
    state.orbitStep = 0;
    state.orbitPlaying = false;
    drawOrbit();
    updateOrbitTable();
}

function clearOrbit() {
    state.orbitPoint = null;
    state.orbitData = [];
    state.orbitStep = 0;
    state.orbitPlaying = false;
    ctx.orbit.clearRect(0, 0, elements.orbitCanvas.width, elements.orbitCanvas.height);
    elements.iterationTableBody.innerHTML = '';
}

// ============================================================================
// Animation
// ============================================================================

let animationFrame = null;

function toggleAnimation() {
    state.animation.playing = !state.animation.playing;
    elements.animPlayBtn.classList.toggle('active', state.animation.playing);

    if (state.animation.playing) {
        state.animation.center = { ...state.c };
        state.animation.angle = 0;
        animationFrame = requestAnimationFrame(animate);
    } else {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
    }
}

function animate(timestamp) {
    if (!state.animation.playing) return;

    const { mode, speed, radius, center } = state.animation;
    const delta = speed * 0.02;
    state.animation.angle += delta;

    switch (mode) {
        case 'circle':
            state.c.real = center.real + radius * Math.cos(state.animation.angle);
            state.c.imag = center.imag + radius * Math.sin(state.animation.angle);
            break;

        case 'lissajous':
            state.c.real = center.real + radius * Math.sin(state.animation.angle * 3);
            state.c.imag = center.imag + radius * Math.sin(state.animation.angle * 2);
            break;

        case 'custom':
            // For custom path, interpolate between waypoints
            if (state.animation.customPath.length >= 2) {
                const pathLen = state.animation.customPath.length;
                const t = (state.animation.angle / (Math.PI * 2)) % 1;
                const idx = Math.floor(t * pathLen);
                const frac = (t * pathLen) % 1;
                const p1 = state.animation.customPath[idx];
                const p2 = state.animation.customPath[(idx + 1) % pathLen];
                state.c.real = p1.real + frac * (p2.real - p1.real);
                state.c.imag = p1.imag + frac * (p2.imag - p1.imag);
            }
            break;
    }

    updateUI();
    requestRender();
    animationFrame = requestAnimationFrame(animate);
}

// ============================================================================
// Event Handlers
// ============================================================================

function initEventListeners() {
    // Window resize
    window.addEventListener('resize', debounce(resizeCanvases, 100));

    // Panel toggle
    elements.panelToggle.addEventListener('click', togglePanel);
    elements.panelClose.addEventListener('click', togglePanel);

    // C sliders
    elements.cRealSlider.addEventListener('input', handleCSlider);
    elements.cImagSlider.addEventListener('input', handleCSlider);

    // Iterations slider
    elements.iterationsSlider.addEventListener('input', (e) => {
        state.maxIterations = parseInt(e.target.value);
        updateUI();
        requestRender();
    });

    // Palette buttons
    document.querySelectorAll('.palette-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.palette = btn.dataset.palette;
            document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            requestRender(true);
        });
    });

    // View options
    elements.splitViewBtn.addEventListener('click', toggleSplitView);
    elements.heatmapBtn.addEventListener('click', toggleHeatmap);
    elements.heatmapOpacity.addEventListener('input', (e) => {
        state.heatmapOpacity = parseInt(e.target.value) / 100;
        updateUI();
        requestRender();
    });

    // Orbit mode
    elements.orbitModeBtn.addEventListener('click', toggleOrbitMode);
    elements.orbitStep.addEventListener('click', stepOrbit);
    elements.orbitPlay.addEventListener('click', playOrbit);
    elements.orbitReset.addEventListener('click', resetOrbit);
    elements.orbitExit.addEventListener('click', toggleOrbitMode);

    // Animation
    elements.animPlayBtn.addEventListener('click', toggleAnimation);
    elements.animModeSelect.addEventListener('change', (e) => {
        state.animation.mode = e.target.value;
    });
    elements.animSpeed.addEventListener('input', (e) => {
        state.animation.speed = parseFloat(e.target.value);
        updateUI();
    });
    elements.animRadius.addEventListener('input', (e) => {
        state.animation.radius = parseFloat(e.target.value);
        updateUI();
    });

    // Reset
    elements.resetViewBtn.addEventListener('click', resetView);

    // Fullscreen
    elements.fullscreenBtn.addEventListener('click', toggleFullscreen);

    // Presets
    elements.presetsToggle.addEventListener('click', () => {
        elements.presetsContainer.classList.toggle('collapsed');
    });

    // Help
    elements.helpBtn.addEventListener('click', toggleShortcutsModal);
    elements.shortcutsModal.addEventListener('click', (e) => {
        if (e.target === elements.shortcutsModal) {
            toggleShortcutsModal();
        }
    });

    // Canvas interactions
    setupCanvasInteractions(elements.juliaCanvas, 'julia');
    setupCanvasInteractions(elements.mandelbrotCanvas, 'mandelbrot');

    // Minimap click
    elements.minimap.addEventListener('click', handleMinimapClick);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeydown);
}

function setupCanvasInteractions(canvas, type) {
    // Mouse move for cursor position
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const view = type === 'julia' ? state.julia : state.mandelbrot;
        const complex = pixelToComplex(x, y, canvas, view);
        elements.infoCursor.textContent = formatComplex(complex.real, complex.imag);

        if (state.isDragging && state.dragCanvas === type) {
            handleDrag(e, canvas, view, type);
        }
    });

    // Mouse down for drag or orbit
    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (state.orbitMode && type === 'julia') {
            startOrbit(x, y);
            return;
        }

        if (type === 'mandelbrot' && state.splitView) {
            // Click on Mandelbrot sets c
            const complex = pixelToComplex(x, y, canvas, state.mandelbrot);
            state.c.real = complex.real;
            state.c.imag = complex.imag;
            updateUI();
            updatePresetSelection();
            requestRender(true);
            return;
        }

        state.isDragging = true;
        state.dragStart = { x: e.clientX, y: e.clientY };
        state.dragCanvas = type;
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mouseup', () => {
        state.isDragging = false;
        canvas.style.cursor = state.orbitMode && type === 'julia' ? 'crosshair' : 'grab';
    });

    canvas.addEventListener('mouseleave', () => {
        if (state.isDragging) {
            state.isDragging = false;
            canvas.style.cursor = state.orbitMode && type === 'julia' ? 'crosshair' : 'grab';
        }
    });

    // Wheel zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const view = type === 'julia' ? state.julia : state.mandelbrot;

        handleZoom(e.deltaY, x, y, canvas, view);
    }, { passive: false });

    // Double-click zoom
    canvas.addEventListener('dblclick', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const view = type === 'julia' ? state.julia : state.mandelbrot;

        handleZoom(-100, x, y, canvas, view);
    });
}

function handleDrag(e, canvas, view, type) {
    const dx = e.clientX - state.dragStart.x;
    const dy = e.clientY - state.dragStart.y;

    const aspectRatio = canvas.width / canvas.height;
    const viewWidth = 4 / view.zoom;
    const viewHeight = viewWidth / aspectRatio;

    view.center.x -= (dx / canvas.width) * viewWidth;
    view.center.y -= (dy / canvas.height) * viewHeight;

    state.dragStart = { x: e.clientX, y: e.clientY };
    updateUI();
    requestRender();
}

function handleZoom(delta, x, y, canvas, view) {
    const zoomFactor = delta > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(100000, view.zoom * zoomFactor));

    // Zoom toward cursor position
    const complex = pixelToComplex(x, y, canvas, view);
    const factor = 1 - view.zoom / newZoom;

    view.center.x += (complex.real - view.center.x) * factor;
    view.center.y += (complex.imag - view.center.y) * factor;
    view.zoom = newZoom;

    updateUI();
    requestRender();
}

function handleCSlider(e) {
    if (e.target === elements.cRealSlider) {
        state.c.real = parseFloat(e.target.value);
    } else {
        state.c.imag = parseFloat(e.target.value);
    }
    updateUI();
    updatePresetSelection();
    requestRender();
}

function handleMinimapClick(e) {
    const rect = elements.minimapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const viewWidth = 4;
    const viewHeight = viewWidth * (elements.minimapCanvas.height / elements.minimapCanvas.width);

    state.julia.center.x = (x / elements.minimapCanvas.width - 0.5) * viewWidth;
    state.julia.center.y = (y / elements.minimapCanvas.height - 0.5) * viewHeight;

    updateUI();
    requestRender(true);
}

function handleKeydown(e) {
    // Ignore if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    switch (e.key) {
        case 'ArrowUp':
            e.preventDefault();
            state.c.imag += 0.01;
            break;
        case 'ArrowDown':
            e.preventDefault();
            state.c.imag -= 0.01;
            break;
        case 'ArrowLeft':
            e.preventDefault();
            state.c.real -= 0.01;
            break;
        case 'ArrowRight':
            e.preventDefault();
            state.c.real += 0.01;
            break;
        case '+':
        case '=':
            e.preventDefault();
            state.julia.zoom *= 1.2;
            break;
        case '-':
            e.preventDefault();
            state.julia.zoom /= 1.2;
            break;
        case ' ':
            e.preventDefault();
            toggleAnimation();
            return;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
            const paletteIndex = parseInt(e.key) - 1;
            if (PALETTES[paletteIndex]) {
                state.palette = PALETTES[paletteIndex];
                document.querySelectorAll('.palette-btn').forEach((b, i) => {
                    b.classList.toggle('active', i === paletteIndex);
                });
                requestRender(true);
            }
            return;
        case 'f':
        case 'F':
            toggleFullscreen();
            return;
        case 'm':
        case 'M':
            toggleSplitView();
            return;
        case 'e':
        case 'E':
            toggleOrbitMode();
            return;
        case 'r':
        case 'R':
            resetView();
            return;
        case '?':
            toggleShortcutsModal();
            return;
        case 'Escape':
            if (elements.shortcutsModal.classList.contains('visible')) {
                toggleShortcutsModal();
            } else if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            return;
        default:
            return;
    }

    updateUI();
    updatePresetSelection();
    requestRender();
}

// ============================================================================
// Toggle Functions
// ============================================================================

function togglePanel() {
    elements.controlPanel.classList.toggle('collapsed');
}

function toggleSplitView() {
    state.splitView = !state.splitView;
    elements.splitViewBtn.classList.toggle('active', state.splitView);
    elements.mainContent.classList.toggle('split-view', state.splitView);
    elements.mandelbrotContainer.classList.toggle('hidden', !state.splitView);

    setTimeout(() => {
        resizeCanvases();
        if (state.splitView) {
            renderMandelbrot();
        }
    }, 50);
}

function toggleHeatmap() {
    state.isHeatmap = !state.isHeatmap;
    elements.heatmapBtn.classList.toggle('active', state.isHeatmap);
    elements.heatmapOpacityRow.style.display = state.isHeatmap ? 'flex' : 'none';
    requestRender(true);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        elements.app.requestFullscreen();
        elements.app.classList.add('fullscreen-mode');
    } else {
        document.exitFullscreen();
        elements.app.classList.remove('fullscreen-mode');
    }
}

function toggleShortcutsModal() {
    elements.shortcutsModal.classList.toggle('visible');
}

function resetView() {
    state.c = { ...CONFIG.defaultC };
    state.julia = {
        zoom: CONFIG.defaultZoom,
        center: { ...CONFIG.defaultCenter }
    };
    state.mandelbrot = {
        zoom: 1,
        center: { ...CONFIG.mandelbrotCenter }
    };
    state.maxIterations = CONFIG.defaultIterations;

    if (state.animation.playing) {
        toggleAnimation();
    }
    if (state.orbitMode) {
        toggleOrbitMode();
    }

    updateUI();
    updatePresetSelection();
    requestRender(true);
}

// ============================================================================
// Utilities
// ============================================================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================================================
// Initialization
// ============================================================================

function init() {
    initWorkers();
    initPresets();
    initEventListeners();
    resizeCanvases();
    updateUI();

    // Initial render
    setTimeout(() => requestRender(true), 100);
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
