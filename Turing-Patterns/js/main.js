// Main entry point for Turing Patterns Explorer
// Initializes all components and runs the animation loop

import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { Painter } from './painter.js';
import { Controls } from './controls.js';
import { initializeColorMaps } from './colormaps.js';

class TuringPatternsApp {
    constructor() {
        // Core components
        this.simulation = null;
        this.renderer = null;
        this.painter = null;
        this.controls = null;

        // Animation state
        this.isRunning = false;
        this.animationId = null;

        // FPS tracking
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        this.fpsUpdateInterval = 500; // ms
        this.lastFpsUpdate = 0;

        // Bind methods
        this.animate = this.animate.bind(this);
    }

    // Initialize the application
    init() {
        console.log('Initializing Turing Patterns Explorer...');

        // Initialize color maps
        initializeColorMaps();

        // Get canvas element
        const canvas = document.getElementById('simulation-canvas');
        if (!canvas) {
            console.error('Canvas element not found!');
            return;
        }

        // Create simulation
        this.simulation = new Simulation(256, 256);

        // Create renderer
        this.renderer = new Renderer(canvas);
        this.renderer.setSimulation(this.simulation);

        // Create painter
        this.painter = new Painter(canvas, this.simulation, this.renderer);

        // Create controls
        this.controls = new Controls(this.simulation, this.renderer, this.painter, this);
        this.controls.init();

        // Initial render
        this.renderer.render();

        // Start paused (as per spec)
        this.isRunning = false;
        this.controls.updatePlayPauseButton();

        console.log('Initialization complete. Press Space or click Play to start.');
    }

    // Toggle running state
    toggleRunning() {
        this.isRunning = !this.isRunning;

        if (this.isRunning) {
            this.lastFrameTime = performance.now();
            this.lastFpsUpdate = this.lastFrameTime;
            this.frameCount = 0;
            this.animate();
        } else {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        }
    }

    // Start the simulation
    start() {
        if (!this.isRunning) {
            this.toggleRunning();
            this.controls.updatePlayPauseButton();
        }
    }

    // Stop the simulation
    stop() {
        if (this.isRunning) {
            this.toggleRunning();
            this.controls.updatePlayPauseButton();
        }
    }

    // Animation loop
    animate(timestamp = performance.now()) {
        if (!this.isRunning) return;

        // Run simulation steps
        this.simulation.runSteps();

        // Render
        this.renderer.render();

        // Draw brush cursor if hovering
        const cursorInfo = this.painter.getCursorInfo();
        if (cursorInfo) {
            this.renderer.drawBrushCursor(cursorInfo.x, cursorInfo.y, cursorInfo.radius);
        }

        // Update step counter
        this.controls.updateStepCounter(this.simulation.stepCount);

        // Update FPS
        this.frameCount++;
        const elapsed = timestamp - this.lastFpsUpdate;
        if (elapsed >= this.fpsUpdateInterval) {
            this.fps = (this.frameCount * 1000) / elapsed;
            this.controls.updateFPS(this.fps);
            this.frameCount = 0;
            this.lastFpsUpdate = timestamp;
        }

        // Schedule next frame
        this.animationId = requestAnimationFrame(this.animate);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new TuringPatternsApp();
    app.init();

    // Expose app globally for debugging
    window.turingApp = app;
});
