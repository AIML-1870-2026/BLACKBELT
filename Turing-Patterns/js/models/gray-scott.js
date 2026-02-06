// Gray-Scott reaction-diffusion model
// Equations:
// ∂U/∂t = Du * ∇²U - U*V² + f*(1 - U)
// ∂V/∂t = Dv * ∇²V + U*V² - (f + k)*V

export const grayScottModel = {
    name: 'gray-scott',
    displayName: 'Gray-Scott',

    // Default parameters
    defaultParams: {
        f: 0.055,      // Feed rate
        k: 0.062,      // Kill rate
        Du: 0.21,      // Diffusion rate for U
        Dv: 0.105      // Diffusion rate for V
    },

    // Parameter definitions for UI
    parameterDefs: [
        { key: 'f', label: 'Feed rate', min: 0.000, max: 0.100, step: 0.001, default: 0.055 },
        { key: 'k', label: 'Kill rate', min: 0.000, max: 0.080, step: 0.001, default: 0.062 },
        { key: 'Du', label: 'Diffusion U', min: 0.05, max: 0.40, step: 0.01, default: 0.21 },
        { key: 'Dv', label: 'Diffusion V', min: 0.01, max: 0.20, step: 0.005, default: 0.105 }
    ],

    // Chemical names for this model
    chemicals: ['U', 'V'],
    defaultDisplayChemical: 1, // V (index 1)

    // Initialize the grid with initial conditions
    initialize(width, height, grids) {
        const U = grids[0];
        const V = grids[1];

        // U = 1.0 everywhere, V = 0.0 everywhere
        for (let i = 0; i < width * height; i++) {
            U[i] = 1.0;
            V[i] = 0.0;
        }

        // Seed some circular patches in the center region
        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);

        const seedPatches = [
            { x: cx, y: cy, r: 10 },
            { x: cx - 25, y: cy - 20, r: 8 },
            { x: cx + 30, y: cy + 15, r: 7 },
            { x: cx + 15, y: cy - 25, r: 9 },
            { x: cx - 20, y: cy + 30, r: 6 }
        ];

        for (const patch of seedPatches) {
            for (let dy = -patch.r; dy <= patch.r; dy++) {
                for (let dx = -patch.r; dx <= patch.r; dx++) {
                    if (dx * dx + dy * dy <= patch.r * patch.r) {
                        const x = (patch.x + dx + width) % width;
                        const y = (patch.y + dy + height) % height;
                        const idx = y * width + x;
                        U[idx] = 0.5;
                        V[idx] = 0.25;
                    }
                }
            }
        }
    },

    // Perform one simulation step
    step(width, height, currentGrids, nextGrids, params, laplacianU, laplacianV) {
        const U = currentGrids[0];
        const V = currentGrids[1];
        const nextU = nextGrids[0];
        const nextV = nextGrids[1];

        const { f, k, Du, Dv } = params;
        const dt = 1.0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;

                const u = U[idx];
                const v = V[idx];
                const lapU = laplacianU[idx];
                const lapV = laplacianV[idx];

                // Reaction terms
                const uvv = u * v * v;
                const reaction_u = -uvv + f * (1.0 - u);
                const reaction_v = uvv - (f + k) * v;

                // Update with diffusion and reaction
                nextU[idx] = u + dt * (Du * lapU + reaction_u);
                nextV[idx] = v + dt * (Dv * lapV + reaction_v);

                // Clamp values to prevent instability
                nextU[idx] = Math.max(0, Math.min(1, nextU[idx]));
                nextV[idx] = Math.max(0, Math.min(1, nextV[idx]));
            }
        }
    },

    // Get normalization range for visualization
    getDisplayRange(chemicalIndex) {
        return { min: 0, max: 1 };
    }
};
