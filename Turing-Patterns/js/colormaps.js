// Color map definitions and LUT generation for Turing Patterns

// Color map definitions - each is an array of [position, r, g, b] stops
const COLOR_MAP_DEFINITIONS = {
    viridis: [
        [0.00, 68, 1, 84],
        [0.25, 59, 82, 139],
        [0.50, 33, 145, 140],
        [0.75, 94, 201, 98],
        [1.00, 253, 231, 37]
    ],
    magma: [
        [0.00, 0, 0, 4],
        [0.25, 81, 18, 124],
        [0.50, 183, 55, 121],
        [0.75, 254, 136, 94],
        [1.00, 252, 253, 191]
    ],
    inferno: [
        [0.00, 0, 0, 4],
        [0.25, 87, 16, 110],
        [0.50, 188, 55, 84],
        [0.75, 249, 142, 9],
        [1.00, 252, 255, 164]
    ],
    plasma: [
        [0.00, 13, 8, 135],
        [0.25, 126, 3, 168],
        [0.50, 204, 71, 120],
        [0.75, 248, 149, 64],
        [1.00, 240, 249, 33]
    ],
    cividis: [
        [0.00, 0, 32, 77],
        [0.25, 66, 78, 108],
        [0.50, 125, 122, 116],
        [0.75, 186, 168, 106],
        [1.00, 253, 232, 37]
    ],
    cosmic: [
        [0.00, 10, 10, 40],
        [0.25, 30, 50, 120],
        [0.50, 50, 120, 180],
        [0.75, 100, 200, 220],
        [1.00, 240, 250, 255]
    ],
    ocean: [
        [0.00, 10, 20, 50],
        [0.25, 20, 60, 100],
        [0.50, 30, 110, 130],
        [0.75, 80, 170, 160],
        [1.00, 160, 220, 200]
    ],
    grayscale: [
        [0.00, 0, 0, 0],
        [1.00, 255, 255, 255]
    ]
};

// Interpolate between color stops
function interpolateColor(stops, t) {
    t = Math.max(0, Math.min(1, t));

    // Find the two stops to interpolate between
    let lower = stops[0];
    let upper = stops[stops.length - 1];

    for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i][0] && t <= stops[i + 1][0]) {
            lower = stops[i];
            upper = stops[i + 1];
            break;
        }
    }

    // Calculate interpolation factor
    const range = upper[0] - lower[0];
    const factor = range === 0 ? 0 : (t - lower[0]) / range;

    // Interpolate RGB values
    return [
        Math.round(lower[1] + factor * (upper[1] - lower[1])),
        Math.round(lower[2] + factor * (upper[2] - lower[2])),
        Math.round(lower[3] + factor * (upper[3] - lower[3]))
    ];
}

// Generate a 256-entry LUT for a color map
function generateLUT(colorMapName) {
    const stops = COLOR_MAP_DEFINITIONS[colorMapName];
    if (!stops) {
        console.warn(`Unknown color map: ${colorMapName}, using grayscale`);
        return generateLUT('grayscale');
    }

    const lut = new Uint8Array(256 * 3);

    for (let i = 0; i < 256; i++) {
        const t = i / 255;
        const [r, g, b] = interpolateColor(stops, t);
        lut[i * 3] = r;
        lut[i * 3 + 1] = g;
        lut[i * 3 + 2] = b;
    }

    return lut;
}

// Pre-generated LUTs for all color maps
const colorMapLUTs = {};

// Initialize all LUTs
function initializeColorMaps() {
    for (const name of Object.keys(COLOR_MAP_DEFINITIONS)) {
        colorMapLUTs[name] = generateLUT(name);
    }
}

// Get list of available color map names
function getColorMapNames() {
    return Object.keys(COLOR_MAP_DEFINITIONS);
}

// Get a color from the LUT
function getColor(colorMapName, value) {
    const lut = colorMapLUTs[colorMapName];
    if (!lut) return [128, 128, 128];

    const index = Math.max(0, Math.min(255, Math.floor(value * 255)));
    return [
        lut[index * 3],
        lut[index * 3 + 1],
        lut[index * 3 + 2]
    ];
}

// Get the raw LUT array for direct access in rendering
function getLUT(colorMapName) {
    return colorMapLUTs[colorMapName] || colorMapLUTs['grayscale'];
}

// Initialize on module load
initializeColorMaps();

export { getColorMapNames, getColor, getLUT, initializeColorMaps };
