// Brusselator reaction-diffusion model
// A chemical reaction model that produces oscillations and Turing instabilities
// Equations:
// ∂u/∂t = Du * ∇²u + A - (B + 1)*u + u²*v
// ∂v/∂t = Dv * ∇²v + B*u - u²*v

export const brusselatorModel = {
    name: 'brusselator',
    displayName: 'Brusselator',

    // Default parameters
    defaultParams: {
        A: 1.00,       // Feed A
        B: 3.00,       // Feed B
        Du: 1.00,      // Diffusion rate for u
        Dv: 0.10       // Diffusion rate for v
    },

    // Parameter definitions for UI
    parameterDefs: [
        { key: 'A', label: 'Feed A', min: 0.50, max: 5.00, step: 0.10, default: 1.00 },
        { key: 'B', label: 'Feed B', min: 0.50, max: 5.00, step: 0.10, default: 3.00 },
        { key: 'Du', label: 'Diffusion u', min: 0.10, max: 5.00, step: 0.10, default: 1.00 },
        { key: 'Dv', label: 'Diffusion v', min: 0.10, max: 5.00, step: 0.10, default: 0.10 }
    ],

    // Chemical names for this model
    chemicals: ['u', 'v'],
    defaultDisplayChemical: 0, // u (index 0)

    // Initialize the grid with initial conditions
    initialize(width, height, grids) {
        const u = grids[0];
        const v = grids[1];

        // Get A and B from default params for steady state calculation
        const A = this.defaultParams.A;
        const B = this.defaultParams.B;

        // Steady state: u = A, v = B/A
        const u_ss = A;
        const v_ss = B / A;

        // Initialize with steady state plus small random perturbations
        for (let i = 0; i < width * height; i++) {
            u[i] = u_ss + (Math.random() - 0.5) * 0.1;
            v[i] = v_ss + (Math.random() - 0.5) * 0.1;
        }

        // Add some localized perturbations to seed pattern formation
        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);

        const seedPatches = [
            { x: cx, y: cy, r: 8 },
            { x: cx - 30, y: cy - 25, r: 6 },
            { x: cx + 35, y: cy + 20, r: 7 }
        ];

        for (const patch of seedPatches) {
            for (let dy = -patch.r; dy <= patch.r; dy++) {
                for (let dx = -patch.r; dx <= patch.r; dx++) {
                    if (dx * dx + dy * dy <= patch.r * patch.r) {
                        const x = (patch.x + dx + width) % width;
                        const y = (patch.y + dy + height) % height;
                        const idx = y * width + x;
                        u[idx] = u_ss + 0.5;
                        v[idx] = v_ss + 0.5;
                    }
                }
            }
        }
    },

    // Perform one simulation step
    step(width, height, currentGrids, nextGrids, params, laplacianU, laplacianV) {
        const u = currentGrids[0];
        const v = currentGrids[1];
        const nextU = nextGrids[0];
        const nextV = nextGrids[1];

        const { A, B, Du, Dv } = params;
        const dt = 0.01; // Small timestep for stability

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;

                const uVal = u[idx];
                const vVal = v[idx];
                const lapU = laplacianU[idx];
                const lapV = laplacianV[idx];

                // Reaction terms
                // du/dt = A - (B + 1)*u + u²*v
                // dv/dt = B*u - u²*v
                const u2v = uVal * uVal * vVal;
                const reaction_u = A - (B + 1) * uVal + u2v;
                const reaction_v = B * uVal - u2v;

                // Update with diffusion and reaction
                nextU[idx] = uVal + dt * (Du * lapU + reaction_u);
                nextV[idx] = vVal + dt * (Dv * lapV + reaction_v);

                // Clamp to prevent negative values and extreme values
                nextU[idx] = Math.max(0, Math.min(10, nextU[idx]));
                nextV[idx] = Math.max(0, Math.min(10, nextV[idx]));
            }
        }
    },

    // Get normalization range for visualization
    getDisplayRange(chemicalIndex) {
        // Brusselator can have wider ranges
        return { min: 0, max: 5 };
    }
};
