/* =========================================
   RGB COLOR STUDIO — APP.JS
   Stellar Spectrometer Array
   ========================================= */

// =========================================
// 1. CONSTANTS & STATE
// =========================================

const state = {
    currentColor: { r: 128, g: 128, b: 128 },
    sourceColor: { r: 128, g: 128, b: 128 },
    scannerColor: { r: 255, g: 0, b: 0 },
    scannerHue: 0,
    scannerSaturation: 100,
    scannerLightness: 50,
    autoCycleActive: false,
    autoCycleHue: 0,
    activeScheme: 'complementary',
    schemeColors: [],
    catalog: [],
    schemeGroupId: 0,
    activeTab: 'spectrometer'
};

const REAL_STARS = [
    { designation: 'α ORI', name: 'Betelgeuse', hex: '#FF7F50', isReal: true },
    { designation: 'β ORI', name: 'Rigel', hex: '#C8D8FF', isReal: true },
    { designation: 'α CMa', name: 'Sirius', hex: '#E8EEFF', isReal: true },
    { designation: 'α CMi', name: 'Procyon', hex: '#FFF5E0', isReal: true },
    { designation: 'SOL', name: 'The Sun', hex: '#FFF4C2', isReal: true },
    { designation: 'α Lyr', name: 'Vega', hex: '#D8E8FF', isReal: true },
    { designation: 'α Aur', name: 'Capella', hex: '#FFE484', isReal: true },
    { designation: 'α Boo', name: 'Arcturus', hex: '#FFB347', isReal: true },
    { designation: 'α Leo', name: 'Regulus', hex: '#DDEEFF', isReal: true },
    { designation: 'α Sco', name: 'Antares', hex: '#FF4500', isReal: true }
];

const MAX_CATALOG = 20;

// =========================================
// 2. UTILITIES
// =========================================

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function getStellarClass(h, s, l) {
    if (l < 15) return 'CLASS BH — EVENT HORIZON';
    if (s < 15) return 'CLASS D — WHITE DWARF';
    if (h >= 0 && h <= 30 || h >= 330 && h <= 360) return 'CLASS M — RED GIANT';
    if (h > 30 && h <= 60) return 'CLASS K — ORANGE STAR';
    if (h > 60 && h <= 90) return 'CLASS G — YELLOW DWARF';
    if (h > 90 && h <= 150) return 'CLASS F — YELLOW-WHITE';
    if (h > 150 && h <= 210) return 'CLASS A — WHITE STAR';
    if (h > 210 && h <= 270) return 'CLASS B — BLUE-WHITE';
    if (h > 270 && h < 330) return 'CLASS O — BLUE SUPERGIANT';
    return 'CLASS D — WHITE DWARF';
}

function getLuminosity(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getStarPosition(hex) {
    const rgb = hexToRgb(hex);
    const x = (rgb.r / 255);
    const y = (rgb.g / 255);
    const offset = (rgb.b / 255) * 0.2 - 0.1;
    return { x: x + offset, y: y + offset };
}

function getStarRadius(hex) {
    const rgb = hexToRgb(hex);
    const luminosity = getLuminosity(rgb.r, rgb.g, rgb.b);
    return 3 + (luminosity / 255) * 8;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 3000);
}

// =========================================
// 3. STARFIELD BACKGROUND
// =========================================

const starfieldCanvas = document.getElementById('starfield-bg');
const starfieldCtx = starfieldCanvas.getContext('2d');
let stars = [];

function initStarfield() {
    resizeStarfield();
    createStars();
    animateStarfield();
    window.addEventListener('resize', () => {
        resizeStarfield();
        createStars();
    });
}

function resizeStarfield() {
    starfieldCanvas.width = window.innerWidth;
    starfieldCanvas.height = window.innerHeight;
}

function createStars() {
    stars = [];
    const count = Math.floor((starfieldCanvas.width * starfieldCanvas.height) / 8000);
    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * starfieldCanvas.width,
            y: Math.random() * starfieldCanvas.height,
            size: Math.random() * 1.5 + 0.5,
            opacity: Math.random() * 0.5 + 0.2,
            speed: Math.random() * 0.02 + 0.005
        });
    }
}

function animateStarfield() {
    starfieldCtx.fillStyle = '#080c10';
    starfieldCtx.fillRect(0, 0, starfieldCanvas.width, starfieldCanvas.height);

    stars.forEach(star => {
        star.opacity += Math.sin(Date.now() * star.speed) * 0.005;
        star.opacity = Math.max(0.1, Math.min(0.7, star.opacity));

        starfieldCtx.beginPath();
        starfieldCtx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        starfieldCtx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        starfieldCtx.fill();
    });

    requestAnimationFrame(animateStarfield);
}

// =========================================
// 4. SPECTROMETER
// =========================================

const sliderR = document.getElementById('slider-r');
const sliderG = document.getElementById('slider-g');
const sliderB = document.getElementById('slider-b');
const valueR = document.getElementById('value-r');
const valueG = document.getElementById('value-g');
const valueB = document.getElementById('value-b');
const starOrb = document.getElementById('star-orb');
const readoutHex = document.getElementById('readout-hex');
const readoutRgb = document.getElementById('readout-rgb');
const readoutHsl = document.getElementById('readout-hsl');
const readoutClass = document.getElementById('readout-class');
const btnRandomize = document.getElementById('btn-randomize');
const btnAutocycle = document.getElementById('btn-autocycle');
const btnTransmit = document.getElementById('btn-transmit');

function updateSpectrometer() {
    const { r, g, b } = state.currentColor;
    const hex = rgbToHex(r, g, b);
    const hsl = rgbToHsl(r, g, b);

    // Update sliders
    sliderR.value = r;
    sliderG.value = g;
    sliderB.value = b;
    valueR.textContent = r;
    valueG.textContent = g;
    valueB.textContent = b;

    // Update orb
    starOrb.style.backgroundColor = hex;
    starOrb.style.boxShadow = `0 0 60px ${hex}, 0 0 120px ${hex}80`;

    // Update readouts
    readoutHex.textContent = hex;
    readoutRgb.textContent = `rgb(${r}, ${g}, ${b})`;
    readoutHsl.textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    readoutClass.textContent = getStellarClass(hsl.h, hsl.s, hsl.l);
}

function handleSliderInput() {
    state.currentColor.r = parseInt(sliderR.value);
    state.currentColor.g = parseInt(sliderG.value);
    state.currentColor.b = parseInt(sliderB.value);
    updateSpectrometer();
}

function randomizeColor() {
    state.currentColor.r = Math.floor(Math.random() * 256);
    state.currentColor.g = Math.floor(Math.random() * 256);
    state.currentColor.b = Math.floor(Math.random() * 256);
    updateSpectrometer();
}

let autoCycleRAF = null;
function toggleAutoCycle() {
    state.autoCycleActive = !state.autoCycleActive;
    btnAutocycle.textContent = `AUTO-CYCLE [${state.autoCycleActive ? 'ON' : 'OFF'}]`;
    btnAutocycle.classList.toggle('active', state.autoCycleActive);

    if (state.autoCycleActive) {
        const hsl = rgbToHsl(state.currentColor.r, state.currentColor.g, state.currentColor.b);
        state.autoCycleHue = hsl.h;
        runAutoCycle();
    } else {
        cancelAnimationFrame(autoCycleRAF);
    }
}

function runAutoCycle() {
    if (!state.autoCycleActive) return;

    state.autoCycleHue = (state.autoCycleHue + 0.3) % 360;
    const rgb = hslToRgb(state.autoCycleHue, 80, 55);
    state.currentColor = rgb;
    updateSpectrometer();

    autoCycleRAF = requestAnimationFrame(runAutoCycle);
}

function transmitToAnalysis() {
    state.sourceColor = { ...state.currentColor };
    updateSourceDisplay();
    generateScheme();
    switchTab('analysis');
}

sliderR.addEventListener('input', handleSliderInput);
sliderG.addEventListener('input', handleSliderInput);
sliderB.addEventListener('input', handleSliderInput);
btnRandomize.addEventListener('click', randomizeColor);
btnAutocycle.addEventListener('click', toggleAutoCycle);
btnTransmit.addEventListener('click', transmitToAnalysis);

// =========================================
// 5. ANALYSIS — CANVAS PICKER
// =========================================

const gradientCanvas = document.getElementById('gradient-canvas');
const gradientCtx = gradientCanvas.getContext('2d');
const hueBar = document.getElementById('hue-bar');
const hueCtx = hueBar.getContext('2d');
const canvasCursor = document.getElementById('canvas-cursor');
const hueCursor = document.getElementById('hue-cursor');
const scannerSwatch = document.getElementById('scanner-swatch');
const scannerHex = document.getElementById('scanner-hex');
const scannerClass = document.getElementById('scanner-class');
const btnLoadSpectrometer = document.getElementById('btn-load-spectrometer');

function drawGradientCanvas() {
    const width = gradientCanvas.width;
    const height = gradientCanvas.height;

    // Draw saturation-lightness gradient
    for (let y = 0; y < height; y++) {
        const lightness = 100 - (y / height) * 100;
        for (let x = 0; x < width; x++) {
            const saturation = (x / width) * 100;
            const rgb = hslToRgb(state.scannerHue, saturation, lightness);
            gradientCtx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
            gradientCtx.fillRect(x, y, 1, 1);
        }
    }
}

function drawHueBar() {
    const width = hueBar.width;
    const height = hueBar.height;
    const gradient = hueCtx.createLinearGradient(0, 0, width, 0);

    for (let i = 0; i <= 360; i += 30) {
        gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }

    hueCtx.fillStyle = gradient;
    hueCtx.fillRect(0, 0, width, height);
}

function updateScannerPreview() {
    const rgb = hslToRgb(state.scannerHue, state.scannerSaturation, state.scannerLightness);
    state.scannerColor = rgb;
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    const stellarClass = getStellarClass(state.scannerHue, state.scannerSaturation, state.scannerLightness);

    scannerSwatch.style.backgroundColor = hex;
    scannerHex.textContent = hex;
    scannerClass.textContent = stellarClass;
}

function updateCursorPositions() {
    const x = (state.scannerSaturation / 100) * gradientCanvas.width;
    const y = (1 - state.scannerLightness / 100) * gradientCanvas.height;
    canvasCursor.style.left = `${x}px`;
    canvasCursor.style.top = `${y}px`;

    const hueX = (state.scannerHue / 360) * hueBar.width;
    hueCursor.style.left = `${hueX - 2}px`;
}

function handleGradientClick(e) {
    const rect = gradientCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    state.scannerSaturation = Math.round((x / gradientCanvas.width) * 100);
    state.scannerLightness = Math.round((1 - y / gradientCanvas.height) * 100);

    updateCursorPositions();
    updateScannerPreview();
}

function handleHueClick(e) {
    const rect = hueBar.getBoundingClientRect();
    const x = e.clientX - rect.left;

    state.scannerHue = Math.round((x / hueBar.width) * 360);

    drawGradientCanvas();
    updateCursorPositions();
    updateScannerPreview();
}

function loadScannerToSpectrometer() {
    state.currentColor = { ...state.scannerColor };
    updateSpectrometer();
    switchTab('spectrometer');
}

let isDraggingGradient = false;
let isDraggingHue = false;

gradientCanvas.addEventListener('mousedown', (e) => {
    isDraggingGradient = true;
    handleGradientClick(e);
});

gradientCanvas.addEventListener('mousemove', (e) => {
    if (isDraggingGradient) handleGradientClick(e);
});

hueBar.addEventListener('mousedown', (e) => {
    isDraggingHue = true;
    handleHueClick(e);
});

hueBar.addEventListener('mousemove', (e) => {
    if (isDraggingHue) handleHueClick(e);
});

document.addEventListener('mouseup', () => {
    isDraggingGradient = false;
    isDraggingHue = false;
});

btnLoadSpectrometer.addEventListener('click', loadScannerToSpectrometer);

// =========================================
// 6. ANALYSIS — SCHEME GENERATOR
// =========================================

const sourceSwatch = document.getElementById('source-swatch');
const sourceHex = document.getElementById('source-hex');
const sourceClass = document.getElementById('source-class');
const schemeSwatches = document.getElementById('scheme-swatches');
const bandButtons = document.querySelectorAll('.btn-band');
const btnCatalogAll = document.getElementById('btn-catalog-all');

function updateSourceDisplay() {
    const { r, g, b } = state.sourceColor;
    const hex = rgbToHex(r, g, b);
    const hsl = rgbToHsl(r, g, b);

    sourceSwatch.style.backgroundColor = hex;
    sourceHex.textContent = hex;
    sourceClass.textContent = getStellarClass(hsl.h, hsl.s, hsl.l);
}

function generateScheme() {
    const { r, g, b } = state.sourceColor;
    const hsl = rgbToHsl(r, g, b);
    let hueShifts = [];

    switch (state.activeScheme) {
        case 'complementary':
            hueShifts = [180];
            break;
        case 'analogous':
            hueShifts = [-60, -30, 30, 60];
            break;
        case 'triadic':
            hueShifts = [120, 240];
            break;
        case 'tetradic':
            hueShifts = [90, 180, 270];
            break;
    }

    state.schemeColors = hueShifts.map(shift => {
        const newHue = (hsl.h + shift + 360) % 360;
        const rgb = hslToRgb(newHue, hsl.s, hsl.l);
        return {
            ...rgb,
            hex: rgbToHex(rgb.r, rgb.g, rgb.b),
            hsl: { h: newHue, s: hsl.s, l: hsl.l }
        };
    });

    renderSchemeSwatches();
}

function renderSchemeSwatches() {
    schemeSwatches.innerHTML = '';

    state.schemeColors.forEach(color => {
        const stellarClass = getStellarClass(color.hsl.h, color.hsl.s, color.hsl.l);

        const swatch = document.createElement('div');
        swatch.className = 'scheme-swatch';
        swatch.innerHTML = `
            <div class="swatch-color" style="background-color: ${color.hex}"></div>
            <span class="swatch-hex">${color.hex}</span>
            <span class="swatch-class">${stellarClass}</span>
        `;

        swatch.addEventListener('click', () => {
            state.currentColor = { r: color.r, g: color.g, b: color.b };
            updateSpectrometer();
            switchTab('spectrometer');
        });

        schemeSwatches.appendChild(swatch);
    });
}

function handleBandSelect(e) {
    const scheme = e.target.dataset.scheme;
    if (!scheme) return;

    bandButtons.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');

    state.activeScheme = scheme;
    generateScheme();
}

bandButtons.forEach(btn => btn.addEventListener('click', handleBandSelect));

// =========================================
// 7. ANALYSIS — STAR CATALOG
// =========================================

const catalogGrid = document.getElementById('catalog-grid');
const catalogEmpty = document.getElementById('catalog-empty');
const catalogCount = document.getElementById('catalog-count');
const btnCopyAll = document.getElementById('btn-copy-all');
const btnClearCatalog = document.getElementById('btn-clear-catalog');
const clearModal = document.getElementById('clear-modal');
const btnConfirmClear = document.getElementById('btn-confirm-clear');
const btnCancelClear = document.getElementById('btn-cancel-clear');

function addToCatalog(color, groupId = null) {
    if (state.catalog.length >= MAX_CATALOG) {
        showToast('CATALOG FULL — REMOVE A SPECIMEN FIRST');
        return false;
    }

    const hex = rgbToHex(color.r, color.g, color.b);
    const existing = state.catalog.find(c => c.hex === hex);
    if (existing) return false;

    state.catalog.push({
        ...color,
        hex,
        groupId: groupId,
        designation: `NGC-${hex.slice(1)}`
    });

    renderCatalog();
    addStarToChart(hex, groupId);
    return true;
}

function removeFromCatalog(hex) {
    state.catalog = state.catalog.filter(c => c.hex !== hex);
    renderCatalog();
    renderStarChart();
}

function renderCatalog() {
    // Clear existing chips (keep empty message)
    const chips = catalogGrid.querySelectorAll('.catalog-chip');
    chips.forEach(chip => chip.remove());

    // Show/hide empty message
    catalogEmpty.style.display = state.catalog.length === 0 ? 'block' : 'none';
    catalogCount.textContent = state.catalog.length;

    // Render chips
    state.catalog.forEach(color => {
        const chip = document.createElement('div');
        chip.className = 'catalog-chip';
        chip.innerHTML = `
            <div class="chip-color" style="background-color: ${color.hex}"></div>
            <span class="chip-hex">${color.hex}</span>
            <span class="chip-designation">${color.designation}</span>
            <button class="chip-remove">×</button>
        `;

        chip.querySelector('.chip-color').addEventListener('click', () => {
            state.currentColor = { r: color.r, g: color.g, b: color.b };
            updateSpectrometer();
            switchTab('spectrometer');
        });

        chip.querySelector('.chip-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromCatalog(color.hex);
        });

        catalogGrid.appendChild(chip);
    });

    // Update vision simulator display
    renderVisionSwatches();
}

function catalogAllBands() {
    state.schemeGroupId++;
    const groupId = state.schemeGroupId;

    // Add source color first
    addToCatalog(state.sourceColor, groupId);

    // Add scheme colors
    state.schemeColors.forEach(color => {
        addToCatalog({ r: color.r, g: color.g, b: color.b }, groupId);
    });

    showToast('SPECIMENS CATALOGUED');
}

function copyAllSignatures() {
    if (state.catalog.length === 0) {
        showToast('NO SPECIMENS TO COPY');
        return;
    }

    const signatures = state.catalog.map(c => c.hex).join(', ');
    navigator.clipboard.writeText(signatures).then(() => {
        showToast('SIGNATURES COPIED TO CLIPBOARD');
    });
}

function clearCatalog() {
    state.catalog = [];
    renderCatalog();
    renderStarChart();
    clearModal.classList.remove('active');
    showToast('CATALOG PURGED');
}

btnCatalogAll.addEventListener('click', catalogAllBands);
btnCopyAll.addEventListener('click', copyAllSignatures);
btnClearCatalog.addEventListener('click', () => clearModal.classList.add('active'));
btnConfirmClear.addEventListener('click', clearCatalog);
btnCancelClear.addEventListener('click', () => clearModal.classList.remove('active'));

// =========================================
// 8. STAR CHART
// =========================================

const starchartCanvas = document.getElementById('starchart-canvas');
const starchartCtx = starchartCanvas.getContext('2d');
const starTooltip = document.getElementById('star-tooltip');
const tooltipDesignation = document.getElementById('tooltip-designation');
const tooltipHex = document.getElementById('tooltip-hex');
const tooltipRgb = document.getElementById('tooltip-rgb');
const tooltipClass = document.getElementById('tooltip-class');

let chartStars = [];
let chartOffset = { x: 0, y: 0 };
let chartZoom = 1;
let isDraggingChart = false;
let lastMousePos = { x: 0, y: 0 };
let autoPanOffset = { x: 0, y: 0 };
let discoveryAnimations = [];

function initStarChart() {
    resizeStarChart();
    initRealStars();
    renderStarChart();
    window.addEventListener('resize', () => {
        resizeStarChart();
        renderStarChart();
    });
}

function resizeStarChart() {
    const container = starchartCanvas.parentElement;
    starchartCanvas.width = container.clientWidth;
    starchartCanvas.height = container.clientHeight;
}

function initRealStars() {
    chartStars = REAL_STARS.map(star => {
        const rgb = hexToRgb(star.hex);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const pos = getStarPosition(star.hex);
        const radius = getStarRadius(star.hex);

        return {
            ...star,
            rgb,
            hsl,
            x: pos.x,
            y: pos.y,
            radius,
            stellarClass: getStellarClass(hsl.h, hsl.s, hsl.l)
        };
    });
}

function addStarToChart(hex, groupId = null) {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const pos = getStarPosition(hex);
    const radius = getStarRadius(hex);

    const star = {
        designation: `NGC-${hex.slice(1)}`,
        hex,
        rgb,
        hsl,
        x: pos.x,
        y: pos.y,
        radius,
        stellarClass: getStellarClass(hsl.h, hsl.s, hsl.l),
        groupId,
        isReal: false
    };

    chartStars.push(star);

    // Add discovery animation
    discoveryAnimations.push({
        x: pos.x,
        y: pos.y,
        hex,
        startTime: Date.now(),
        duration: 1000
    });

    renderStarChart();
}

function renderStarChart() {
    const width = starchartCanvas.width;
    const height = starchartCanvas.height;

    // Clear canvas
    starchartCtx.fillStyle = '#000';
    starchartCtx.fillRect(0, 0, width, height);

    // Draw background stars
    drawChartBackground();

    // Auto-pan
    autoPanOffset.x += 0.02;
    autoPanOffset.y += 0.01;

    // Transform for pan/zoom
    starchartCtx.save();
    starchartCtx.translate(width / 2, height / 2);
    starchartCtx.scale(chartZoom, chartZoom);
    starchartCtx.translate(-width / 2 + chartOffset.x + autoPanOffset.x, -height / 2 + chartOffset.y + autoPanOffset.y);

    // Draw constellation lines
    drawConstellationLines();

    // Draw stars
    const allStars = [...chartStars];
    state.catalog.forEach(cat => {
        if (!allStars.find(s => s.hex === cat.hex)) {
            const rgb = hexToRgb(cat.hex);
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            const pos = getStarPosition(cat.hex);
            const radius = getStarRadius(cat.hex);

            allStars.push({
                designation: cat.designation,
                hex: cat.hex,
                rgb,
                hsl,
                x: pos.x,
                y: pos.y,
                radius,
                stellarClass: getStellarClass(hsl.h, hsl.s, hsl.l),
                groupId: cat.groupId,
                isReal: false
            });
        }
    });

    allStars.forEach(star => {
        drawStar(star, width, height);
    });

    // Draw discovery animations
    drawDiscoveryAnimations(width, height);

    starchartCtx.restore();

    requestAnimationFrame(renderStarChart);
}

function drawChartBackground() {
    const width = starchartCanvas.width;
    const height = starchartCanvas.height;
    const count = 200;

    for (let i = 0; i < count; i++) {
        const x = (Math.sin(i * 12345.67) * 0.5 + 0.5) * width;
        const y = (Math.cos(i * 67890.12) * 0.5 + 0.5) * height;
        const opacity = 0.1 + Math.random() * 0.2;

        starchartCtx.beginPath();
        starchartCtx.arc(x, y, 0.5, 0, Math.PI * 2);
        starchartCtx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        starchartCtx.fill();
    }
}

function drawConstellationLines() {
    const width = starchartCanvas.width;
    const height = starchartCanvas.height;

    // Group stars by groupId
    const groups = {};
    [...chartStars, ...state.catalog.map(c => {
        const pos = getStarPosition(c.hex);
        return { ...c, x: pos.x, y: pos.y };
    })].forEach(star => {
        if (star.groupId !== null && star.groupId !== undefined) {
            if (!groups[star.groupId]) groups[star.groupId] = [];
            groups[star.groupId].push(star);
        }
    });

    // Draw lines between stars in same group
    starchartCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    starchartCtx.lineWidth = 1;

    Object.values(groups).forEach(group => {
        if (group.length < 2) return;

        starchartCtx.beginPath();
        const first = group[0];
        starchartCtx.moveTo(first.x * width, first.y * height);

        for (let i = 1; i < group.length; i++) {
            starchartCtx.lineTo(group[i].x * width, group[i].y * height);
        }

        starchartCtx.stroke();
    });
}

function drawStar(star, width, height) {
    const x = star.x * width;
    const y = star.y * height;
    const radius = star.radius;

    // Glow
    const gradient = starchartCtx.createRadialGradient(x, y, 0, x, y, radius * 3);
    gradient.addColorStop(0, star.hex);
    gradient.addColorStop(0.5, `${star.hex}80`);
    gradient.addColorStop(1, 'transparent');

    starchartCtx.beginPath();
    starchartCtx.arc(x, y, radius * 3, 0, Math.PI * 2);
    starchartCtx.fillStyle = gradient;
    starchartCtx.fill();

    // Core
    starchartCtx.beginPath();
    starchartCtx.arc(x, y, radius, 0, Math.PI * 2);
    starchartCtx.fillStyle = star.hex;
    starchartCtx.fill();

    // Highlight
    starchartCtx.beginPath();
    starchartCtx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
    starchartCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    starchartCtx.fill();
}

function drawDiscoveryAnimations(width, height) {
    const now = Date.now();

    discoveryAnimations = discoveryAnimations.filter(anim => {
        const elapsed = now - anim.startTime;
        if (elapsed > anim.duration) return false;

        const progress = elapsed / anim.duration;
        const x = anim.x * width;
        const y = anim.y * height;
        const radius = 10 + progress * 50;
        const opacity = 1 - progress;

        starchartCtx.beginPath();
        starchartCtx.arc(x, y, radius, 0, Math.PI * 2);
        starchartCtx.strokeStyle = `${anim.hex}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`;
        starchartCtx.lineWidth = 2;
        starchartCtx.stroke();

        return true;
    });
}

function getStarAtPosition(mouseX, mouseY) {
    const width = starchartCanvas.width;
    const height = starchartCanvas.height;

    // Transform mouse position
    const transformedX = (mouseX - width / 2) / chartZoom + width / 2 - chartOffset.x - autoPanOffset.x;
    const transformedY = (mouseY - height / 2) / chartZoom + height / 2 - chartOffset.y - autoPanOffset.y;

    const allStars = [...chartStars];
    state.catalog.forEach(cat => {
        if (!allStars.find(s => s.hex === cat.hex)) {
            const rgb = hexToRgb(cat.hex);
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            const pos = getStarPosition(cat.hex);
            const radius = getStarRadius(cat.hex);

            allStars.push({
                designation: cat.designation,
                hex: cat.hex,
                rgb,
                hsl,
                x: pos.x,
                y: pos.y,
                radius,
                stellarClass: getStellarClass(hsl.h, hsl.s, hsl.l),
                isReal: false
            });
        }
    });

    for (const star of allStars) {
        const starX = star.x * width;
        const starY = star.y * height;
        const dist = Math.sqrt((transformedX - starX) ** 2 + (transformedY - starY) ** 2);

        if (dist < star.radius * 2) {
            return star;
        }
    }

    return null;
}

starchartCanvas.addEventListener('mousedown', (e) => {
    isDraggingChart = true;
    lastMousePos = { x: e.clientX, y: e.clientY };
});

starchartCanvas.addEventListener('mousemove', (e) => {
    const rect = starchartCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDraggingChart) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        chartOffset.x += dx / chartZoom;
        chartOffset.y += dy / chartZoom;
        lastMousePos = { x: e.clientX, y: e.clientY };
    }

    // Tooltip
    const star = getStarAtPosition(mouseX, mouseY);
    if (star) {
        starTooltip.classList.add('active');
        starTooltip.style.left = `${mouseX + 15}px`;
        starTooltip.style.top = `${mouseY + 15}px`;

        tooltipDesignation.textContent = star.designation || star.name;
        tooltipHex.textContent = star.hex;
        tooltipRgb.textContent = `rgb(${star.rgb.r}, ${star.rgb.g}, ${star.rgb.b})`;
        tooltipClass.textContent = star.stellarClass;
    } else {
        starTooltip.classList.remove('active');
    }
});

starchartCanvas.addEventListener('mouseup', () => {
    isDraggingChart = false;
});

starchartCanvas.addEventListener('mouseleave', () => {
    isDraggingChart = false;
    starTooltip.classList.remove('active');
});

starchartCanvas.addEventListener('click', (e) => {
    if (isDraggingChart) return;

    const rect = starchartCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const star = getStarAtPosition(mouseX, mouseY);
    if (star) {
        state.currentColor = { ...star.rgb };
        updateSpectrometer();
        switchTab('spectrometer');
    }
});

starchartCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    chartZoom = Math.max(0.5, Math.min(3, chartZoom * delta));
});

// =========================================
// 9. CROSS-TAB COMMUNICATION
// =========================================

const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

function switchTab(tabName) {
    state.activeTab = tabName;

    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    tabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === tabName);
    });

    // Resize star chart when tab becomes visible
    if (tabName === 'starchart') {
        setTimeout(() => {
            resizeStarChart();
        }, 10);
    }
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// =========================================
// 10. VISION DEFICIENCY SIMULATOR
// =========================================

let visionButtons, visionNormalSwatches, visionSimulatedSwatches, visionSimulatedRow, visionSimLabel, visionEmptyNormal;
let activeVisionMode = null;

// Color Vision Deficiency Transformation Matrices (Brettel/Viénot)
const CVD_MATRICES = {
    protanopia: {
        label: 'PROTANOPIA — RED ABSENT',
        matrix: [
            [0.567, 0.433, 0.000],
            [0.558, 0.442, 0.000],
            [0.000, 0.242, 0.758]
        ]
    },
    deuteranopia: {
        label: 'DEUTERANOPIA — GREEN ABSENT',
        matrix: [
            [0.625, 0.375, 0.000],
            [0.700, 0.300, 0.000],
            [0.000, 0.300, 0.700]
        ]
    },
    tritanopia: {
        label: 'TRITANOPIA — BLUE ABSENT',
        matrix: [
            [0.950, 0.050, 0.000],
            [0.000, 0.433, 0.567],
            [0.000, 0.475, 0.525]
        ]
    }
};

function initVisionSimulator() {
    visionButtons = document.querySelectorAll('.btn-vision');
    visionNormalSwatches = document.getElementById('vision-normal');
    visionSimulatedSwatches = document.getElementById('vision-simulated');
    visionSimulatedRow = document.getElementById('vision-simulated-row');
    visionSimLabel = document.getElementById('vision-sim-label');
    visionEmptyNormal = document.getElementById('vision-empty-normal');

    visionButtons.forEach(btn => btn.addEventListener('click', handleVisionModeToggle));
}

function transformColorForCVD(r, g, b, matrix) {
    const newR = Math.min(255, Math.max(0, Math.round(matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b)));
    const newG = Math.min(255, Math.max(0, Math.round(matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b)));
    const newB = Math.min(255, Math.max(0, Math.round(matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b)));
    return { r: newR, g: newG, b: newB };
}

function renderVisionSwatches() {
    if (!visionNormalSwatches || !visionSimulatedSwatches) return;

    // Clear existing swatches (keep empty message)
    const normalSwatches = visionNormalSwatches.querySelectorAll('.vision-swatch');
    normalSwatches.forEach(s => s.remove());
    const simSwatches = visionSimulatedSwatches.querySelectorAll('.vision-swatch');
    simSwatches.forEach(s => s.remove());

    // Show/hide empty message
    if (state.catalog.length === 0) {
        visionEmptyNormal.style.display = 'block';
        visionSimulatedRow.classList.remove('active');
        return;
    } else {
        visionEmptyNormal.style.display = 'none';
    }

    // Render normal vision swatches
    state.catalog.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'vision-swatch';
        swatch.style.backgroundColor = color.hex;
        visionNormalSwatches.appendChild(swatch);
    });

    // Render simulated swatches if a mode is active
    if (activeVisionMode && CVD_MATRICES[activeVisionMode]) {
        visionSimulatedRow.classList.add('active');
        visionSimLabel.textContent = CVD_MATRICES[activeVisionMode].label;

        state.catalog.forEach(color => {
            const transformed = transformColorForCVD(
                color.r,
                color.g,
                color.b,
                CVD_MATRICES[activeVisionMode].matrix
            );
            const hex = rgbToHex(transformed.r, transformed.g, transformed.b);

            const swatch = document.createElement('div');
            swatch.className = 'vision-swatch';
            swatch.style.backgroundColor = hex;
            visionSimulatedSwatches.appendChild(swatch);
        });
    } else {
        visionSimulatedRow.classList.remove('active');
    }
}

function handleVisionModeToggle(e) {
    const mode = e.target.dataset.vision;
    if (!mode) return;

    // Toggle mode - clicking active button deactivates it
    if (activeVisionMode === mode) {
        activeVisionMode = null;
        e.target.classList.remove('active');
    } else {
        // Deactivate all buttons first
        visionButtons.forEach(btn => btn.classList.remove('active'));
        // Activate clicked button
        e.target.classList.add('active');
        activeVisionMode = mode;
    }

    renderVisionSwatches();
}

// =========================================
// INITIALIZATION
// =========================================

function init() {
    initStarfield();
    updateSpectrometer();

    // Initialize Analysis
    drawHueBar();
    drawGradientCanvas();
    updateCursorPositions();
    updateScannerPreview();
    updateSourceDisplay();
    generateScheme();

    // Initialize Star Chart
    initStarChart();

    // Initialize Vision Simulator
    initVisionSimulator();

    // Initialize Catalog and Vision Simulator
    renderCatalog();
    renderVisionSwatches();
}

document.addEventListener('DOMContentLoaded', init);
