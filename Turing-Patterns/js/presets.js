// Preset definitions for all reaction-diffusion models

export const presets = {
    'gray-scott': {
        'Coral': {
            f: 0.055,
            k: 0.062,
            Du: 0.21,
            Dv: 0.105,
            description: 'Branching coral-like growth'
        },
        'Mitosis': {
            f: 0.028,
            k: 0.062,
            Du: 0.21,
            Dv: 0.105,
            description: 'Cell-division-like splitting dots'
        },
        'Spirals': {
            f: 0.014,
            k: 0.045,
            Du: 0.21,
            Dv: 0.105,
            description: 'Rotating spiral waves'
        },
        'Spots': {
            f: 0.030,
            k: 0.060,
            Du: 0.21,
            Dv: 0.105,
            description: 'Stable circular spots'
        },
        'Worms': {
            f: 0.078,
            k: 0.061,
            Du: 0.21,
            Dv: 0.105,
            description: 'Wriggling worm-like stripes'
        },
        'Fingerprints': {
            f: 0.040,
            k: 0.060,
            Du: 0.21,
            Dv: 0.105,
            description: 'Labyrinthine fingerprint patterns'
        },
        'Maze': {
            f: 0.029,
            k: 0.057,
            Du: 0.21,
            Dv: 0.105,
            description: 'Dense maze-like structures'
        },
        'Holes': {
            f: 0.039,
            k: 0.058,
            Du: 0.21,
            Dv: 0.105,
            description: 'Expanding holes in a filled field'
        },
        'Pulse Soliton': {
            f: 0.025,
            k: 0.060,
            Du: 0.21,
            Dv: 0.105,
            description: 'Pulsating soliton-like structures'
        }
    },
    'fitzhugh-nagumo': {
        'Traveling Waves': {
            a: 0.00,
            b: 0.50,
            epsilon: 0.010,
            Du: 0.20,
            Dv: 0.05,
            description: 'Classic propagating wavefronts'
        },
        'Spiral Waves': {
            a: 0.10,
            b: 0.50,
            epsilon: 0.010,
            Du: 0.20,
            Dv: 0.05,
            description: 'Self-sustaining spiral waves'
        },
        'Turing Spots': {
            a: 0.00,
            b: 1.20,
            epsilon: 0.050,
            Du: 0.20,
            Dv: 0.05,
            description: 'Static spot patterns'
        },
        'Turing Stripes': {
            a: 0.00,
            b: 1.50,
            epsilon: 0.050,
            Du: 0.20,
            Dv: 0.05,
            description: 'Static stripe patterns'
        },
        'Oscillations': {
            a: 0.30,
            b: 0.30,
            epsilon: 0.020,
            Du: 0.20,
            Dv: 0.05,
            description: 'Bulk oscillatory behavior'
        }
    },
    'brusselator': {
        'Turing Spots': {
            A: 1.00,
            B: 3.00,
            Du: 1.00,
            Dv: 0.10,
            description: 'Classic Turing spot pattern'
        },
        'Turing Stripes': {
            A: 1.00,
            B: 3.50,
            Du: 1.00,
            Dv: 0.10,
            description: 'Stripe/labyrinth patterns'
        },
        'Oscillations': {
            A: 1.00,
            B: 2.50,
            Du: 1.00,
            Dv: 0.50,
            description: 'Temporal oscillations'
        },
        'Hexagons': {
            A: 2.00,
            B: 4.50,
            Du: 1.50,
            Dv: 0.10,
            description: 'Hexagonal spot arrangement'
        }
    }
};

// Get presets for a specific model
export function getPresetsForModel(modelName) {
    return presets[modelName] || {};
}

// Get preset names for a model
export function getPresetNames(modelName) {
    return Object.keys(presets[modelName] || {});
}

// Get a specific preset
export function getPreset(modelName, presetName) {
    const modelPresets = presets[modelName];
    if (!modelPresets) return null;
    return modelPresets[presetName] || null;
}
