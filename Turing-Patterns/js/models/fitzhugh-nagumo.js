// FitzHugh-Nagumo reaction-diffusion model
// A simplified model of excitable media
// Equations:
// ∂u/∂t = Du * ∇²u + u - u³ - v + a
// ∂v/∂t = Dv * ∇²v + ε * (u - b*v)

export const fitzhughNagumoModel = {
    name: 'fitzhugh-nagumo',
    displayName: 'FitzHugh-Nagumo',

    // Default parameters
    defaultParams: {
        a: 0.00,       // Stimulus
        b: 0.50,       // Recovery
        epsilon: 0.010, // Epsilon (time scale separation)
        Du: 0.20,      // Diffusion rate for u
        Dv: 0.05       // Diffusion rate for v
    },

    // Parameter definitions for UI
    parameterDefs: [
        { key: 'a', label: 'Stimulus', min: -0.50, max: 0.50, step: 0.01, default: 0.00 },
        { key: 'b', label: 'Recovery', min: 0.00, max: 2.00, step: 0.01, default: 0.50 },
        { key: 'epsilon', label: 'Epsilon', min: 0.001, max: 0.100, step: 0.001, default: 0.010 },
        { key: 'Du', label: 'Diffusion u', min: 0.05, max: 1.00, step: 0.01, default: 0.20 },
        { key: 'Dv', label: 'Diffusion v', min: 0.00, max: 1.00, step: 0.01, default: 0.05 }
    ],

    // Chemical names for this model
    chemicals: ['u', 'v'],
    defaultDisplayChemical: 0, // u (index 0)

    // Initialize the grid with initial conditions
    initialize(width, height, grids) {
        const u = grids[0];
        const v = grids[1];

        // u = 0.0 everywhere with small random perturbations
        for (let i = 0; i < width * height; i++) {
            u[i] = (Math.random() - 0.5) * 0.1;
            v[i] = (Math.random() - 0.5) * 0.1;
        }

        // Add some seed perturbations in the center
        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);

        // Create an asymmetric initial condition to encourage spiral formation
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 20 && dx > 0) {
                    const idx = y * width + x;
                    u[idx] = 1.0;
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

        const { a, b, epsilon, Du, Dv } = params;
        const dt = 0.1; // Smaller timestep for stability

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;

                const uVal = u[idx];
                const vVal = v[idx];
                const lapU = laplacianU[idx];
                const lapV = laplacianV[idx];

                // Reaction terms
                // du/dt = u - u³ - v + a
                // dv/dt = ε * (u - b*v)
                const reaction_u = uVal - uVal * uVal * uVal - vVal + a;
                const reaction_v = epsilon * (uVal - b * vVal);

                // Update with diffusion and reaction
                nextU[idx] = uVal + dt * (Du * lapU + reaction_u);
                nextV[idx] = vVal + dt * (Dv * lapV + reaction_v);

                // Clamp to prevent extreme values
                nextU[idx] = Math.max(-2, Math.min(2, nextU[idx]));
                nextV[idx] = Math.max(-2, Math.min(2, nextV[idx]));
            }
        }
    },

    // Get normalization range for visualization
    getDisplayRange(chemicalIndex) {
        return { min: -1, max: 1 };
    }
};
