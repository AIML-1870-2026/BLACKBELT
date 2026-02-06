// Core simulation engine for Turing Patterns
// Handles grid management, Laplacian computation, and model dispatching

import { grayScottModel } from './models/gray-scott.js';
import { fitzhughNagumoModel } from './models/fitzhugh-nagumo.js';
import { brusselatorModel } from './models/brusselator.js';

// Available models
const models = {
    'gray-scott': grayScottModel,
    'fitzhugh-nagumo': fitzhughNagumoModel,
    'brusselator': brusselatorModel
};

export class Simulation {
    constructor(width = 256, height = 256) {
        this.width = width;
        this.height = height;
        this.size = width * height;

        // Current model
        this.model = null;
        this.modelName = null;

        // Parameters (copied from model, can be modified by UI)
        this.params = {};

        // Grid buffers - two chemicals, double-buffered
        this.grids = [
            [new Float64Array(this.size), new Float64Array(this.size)], // Chemical 0: current, next
            [new Float64Array(this.size), new Float64Array(this.size)]  // Chemical 1: current, next
        ];

        // Which buffer is current (0 or 1)
        this.currentBuffer = 0;

        // Laplacian buffers
        this.laplacianBuffers = [
            new Float64Array(this.size),
            new Float64Array(this.size)
        ];

        // Pre-compute periodic boundary lookup tables
        this.wrapX = new Int32Array(width + 2);
        this.wrapY = new Int32Array(height + 2);
        this.buildWrapTables();

        // Simulation state
        this.stepCount = 0;
        this.stepsPerFrame = 4;
    }

    // Build periodic boundary lookup tables
    buildWrapTables() {
        for (let i = 0; i < this.width + 2; i++) {
            this.wrapX[i] = ((i - 1) + this.width) % this.width;
        }
        for (let i = 0; i < this.height + 2; i++) {
            this.wrapY[i] = ((i - 1) + this.height) % this.height;
        }
    }

    // Get list of available models
    static getModelNames() {
        return Object.keys(models);
    }

    // Get model display names
    static getModelDisplayNames() {
        const result = {};
        for (const [key, model] of Object.entries(models)) {
            result[key] = model.displayName;
        }
        return result;
    }

    // Get a model by name
    static getModel(name) {
        return models[name];
    }

    // Set the active model
    setModel(modelName) {
        const model = models[modelName];
        if (!model) {
            console.error(`Unknown model: ${modelName}`);
            return false;
        }

        this.model = model;
        this.modelName = modelName;

        // Copy default parameters
        this.params = { ...model.defaultParams };

        // Initialize the grids
        this.reset();

        return true;
    }

    // Set parameters (from UI or presets)
    setParams(params) {
        for (const [key, value] of Object.entries(params)) {
            if (key in this.params) {
                this.params[key] = value;
            }
        }
    }

    // Set a single parameter
    setParam(key, value) {
        if (key in this.params) {
            this.params[key] = value;
        }
    }

    // Get current parameters
    getParams() {
        return { ...this.params };
    }

    // Reset simulation to initial conditions
    reset() {
        if (!this.model) return;

        // Clear all buffers
        for (let c = 0; c < 2; c++) {
            this.grids[c][0].fill(0);
            this.grids[c][1].fill(0);
        }

        // Get current grids
        const currentGrids = this.getCurrentGrids();

        // Initialize with model's initial conditions
        this.model.initialize(this.width, this.height, currentGrids);

        // Reset step count
        this.stepCount = 0;
        this.currentBuffer = 0;
    }

    // Get current grid buffers (read-only view)
    getCurrentGrids() {
        return [
            this.grids[0][this.currentBuffer],
            this.grids[1][this.currentBuffer]
        ];
    }

    // Get next grid buffers (for writing)
    getNextGrids() {
        const next = 1 - this.currentBuffer;
        return [
            this.grids[0][next],
            this.grids[1][next]
        ];
    }

    // Swap buffers
    swapBuffers() {
        this.currentBuffer = 1 - this.currentBuffer;
    }

    // Compute Laplacian for a grid using 5-point stencil
    computeLaplacian(grid, laplacian) {
        const w = this.width;
        const h = this.height;
        const wrapX = this.wrapX;
        const wrapY = this.wrapY;

        for (let y = 0; y < h; y++) {
            const yIdx = y * w;
            const yUp = wrapY[y] * w;      // y - 1 wrapped
            const yDown = wrapY[y + 2] * w; // y + 1 wrapped

            for (let x = 0; x < w; x++) {
                const idx = yIdx + x;
                const xLeft = wrapX[x];      // x - 1 wrapped
                const xRight = wrapX[x + 2]; // x + 1 wrapped

                // 5-point stencil Laplacian
                laplacian[idx] = grid[yUp + x] +
                                 grid[yDown + x] +
                                 grid[yIdx + xLeft] +
                                 grid[yIdx + xRight] -
                                 4.0 * grid[idx];
            }
        }
    }

    // Perform one simulation step
    step() {
        if (!this.model) return;

        const currentGrids = this.getCurrentGrids();
        const nextGrids = this.getNextGrids();

        // Compute Laplacians for both chemicals
        this.computeLaplacian(currentGrids[0], this.laplacianBuffers[0]);
        this.computeLaplacian(currentGrids[1], this.laplacianBuffers[1]);

        // Run the model's step function
        this.model.step(
            this.width,
            this.height,
            currentGrids,
            nextGrids,
            this.params,
            this.laplacianBuffers[0],
            this.laplacianBuffers[1]
        );

        // Swap buffers
        this.swapBuffers();
        this.stepCount++;
    }

    // Run multiple steps (for one animation frame)
    runSteps(count = null) {
        const steps = count !== null ? count : this.stepsPerFrame;
        for (let i = 0; i < steps; i++) {
            this.step();
        }
    }

    // Paint chemical at a position (for brush tool)
    paint(x, y, radius, chemicalIndex = 1, value = null) {
        const grids = this.getCurrentGrids();
        const grid = grids[chemicalIndex];
        const otherGrid = grids[1 - chemicalIndex];

        // Determine paint value based on model
        let paintValue = value;
        let otherValue = null;

        if (paintValue === null) {
            if (this.modelName === 'gray-scott') {
                paintValue = 0.5;
                otherValue = 0.25; // Also modify U when painting V
            } else if (this.modelName === 'fitzhugh-nagumo') {
                paintValue = 1.0;
            } else if (this.modelName === 'brusselator') {
                paintValue = this.params.A + 1.0;
            }
        }

        const r2 = radius * radius;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= r2) {
                    const px = ((x + dx) % this.width + this.width) % this.width;
                    const py = ((y + dy) % this.height + this.height) % this.height;
                    const idx = py * this.width + px;

                    grid[idx] = paintValue;

                    if (otherValue !== null && this.modelName === 'gray-scott') {
                        // For Gray-Scott, when painting V, also lower U
                        otherGrid[idx] = 0.5;
                    }
                }
            }
        }
    }

    // Get value at a position
    getValue(x, y, chemicalIndex = 0) {
        const grids = this.getCurrentGrids();
        const idx = y * this.width + x;
        return grids[chemicalIndex][idx];
    }

    // Set steps per frame
    setStepsPerFrame(steps) {
        this.stepsPerFrame = Math.max(1, Math.min(16, steps));
    }
}
