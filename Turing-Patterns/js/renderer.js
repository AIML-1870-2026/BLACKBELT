// Canvas renderer for Turing Patterns
// Handles rendering simulation state to canvas with color maps

import { getLUT } from './colormaps.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Rendering state
        this.colorMapName = 'cosmic';
        this.displayChemical = 1; // Which chemical to display (0 or 1)

        // Image data for direct pixel manipulation
        this.imageData = null;

        // Simulation reference
        this.simulation = null;

        // Display range for normalization
        this.displayRange = { min: 0, max: 1 };
    }

    // Set the simulation to render
    setSimulation(simulation) {
        this.simulation = simulation;
        this.resize();
    }

    // Set which chemical to display
    setDisplayChemical(index) {
        this.displayChemical = index;
        this.updateDisplayRange();
    }

    // Set the color map
    setColorMap(name) {
        this.colorMapName = name;
    }

    // Update display range based on current model
    updateDisplayRange() {
        if (this.simulation && this.simulation.model) {
            this.displayRange = this.simulation.model.getDisplayRange(this.displayChemical);
        }
    }

    // Resize canvas to match simulation
    resize() {
        if (!this.simulation) return;

        this.canvas.width = this.simulation.width;
        this.canvas.height = this.simulation.height;

        // Create new image data
        this.imageData = this.ctx.createImageData(
            this.simulation.width,
            this.simulation.height
        );

        // Fill alpha channel
        const data = this.imageData.data;
        for (let i = 3; i < data.length; i += 4) {
            data[i] = 255;
        }

        this.updateDisplayRange();
    }

    // Render the current simulation state
    render() {
        if (!this.simulation || !this.imageData) return;

        const grids = this.simulation.getCurrentGrids();
        const grid = grids[this.displayChemical];
        const lut = getLUT(this.colorMapName);
        const data = this.imageData.data;

        const { min, max } = this.displayRange;
        const range = max - min;

        const size = this.simulation.size;

        for (let i = 0; i < size; i++) {
            // Normalize value to 0-1 range
            let value = (grid[i] - min) / range;
            value = Math.max(0, Math.min(1, value));

            // Map to LUT index
            const lutIndex = Math.floor(value * 255) * 3;

            // Set pixel color
            const pixelIndex = i * 4;
            data[pixelIndex] = lut[lutIndex];
            data[pixelIndex + 1] = lut[lutIndex + 1];
            data[pixelIndex + 2] = lut[lutIndex + 2];
            // Alpha already set to 255
        }

        // Draw to canvas
        this.ctx.putImageData(this.imageData, 0, 0);
    }

    // Draw brush cursor overlay
    drawBrushCursor(x, y, radius) {
        // Convert canvas coordinates to simulation coordinates
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // Draw the cursor circle
        this.ctx.save();

        // We need to draw in canvas space but the brush radius is in simulation space
        // So we scale the context temporarily
        this.ctx.scale(1 / scaleX, 1 / scaleY);

        const displayX = x / scaleX;
        const displayY = y / scaleY;
        const displayRadius = radius / scaleX;

        this.ctx.beginPath();
        this.ctx.arc(displayX, displayY, displayRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(displayX, displayY, displayRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        // Inner white stroke
        this.ctx.beginPath();
        this.ctx.arc(displayX, displayY, displayRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        this.ctx.restore();
    }
}
