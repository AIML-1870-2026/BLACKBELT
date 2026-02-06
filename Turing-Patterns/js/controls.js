// UI Controls for Turing Patterns
// Handles panel logic, slider bindings, and preset loading

import { Simulation } from './simulation.js';
import { getColorMapNames } from './colormaps.js';
import { getPresetNames, getPreset } from './presets.js';

export class Controls {
    constructor(simulation, renderer, painter, app) {
        this.simulation = simulation;
        this.renderer = renderer;
        this.painter = painter;
        this.app = app;

        // DOM element references
        this.elements = {};

        // Bind methods
        this.onModelChange = this.onModelChange.bind(this);
        this.onPresetChange = this.onPresetChange.bind(this);
        this.onColorMapChange = this.onColorMapChange.bind(this);
        this.onChannelChange = this.onChannelChange.bind(this);
        this.onPlayPause = this.onPlayPause.bind(this);
        this.onReset = this.onReset.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
    }

    // Initialize all controls
    init() {
        this.cacheElements();
        this.populateModelDropdown();
        this.populateColorMapDropdown();
        this.attachEventListeners();
        this.attachKeyboardListeners();

        // Set initial model
        this.selectModel('gray-scott');
    }

    // Cache DOM element references
    cacheElements() {
        this.elements = {
            modelSelect: document.getElementById('model-select'),
            presetSelect: document.getElementById('preset-select'),
            parametersContainer: document.getElementById('parameters-container'),
            colorMapSelect: document.getElementById('colormap-select'),
            channelButtons: document.querySelectorAll('.channel-btn'),
            brushSizeSlider: document.getElementById('brush-size'),
            brushSizeValue: document.getElementById('brush-size-value'),
            playPauseBtn: document.getElementById('play-pause-btn'),
            resetBtn: document.getElementById('reset-btn'),
            stepsPerFrameSlider: document.getElementById('steps-per-frame'),
            stepsPerFrameValue: document.getElementById('steps-per-frame-value'),
            stepCounter: document.getElementById('step-counter'),
            fpsDisplay: document.getElementById('fps-display')
        };
    }

    // Populate the model dropdown
    populateModelDropdown() {
        const select = this.elements.modelSelect;
        const displayNames = Simulation.getModelDisplayNames();

        for (const [key, name] of Object.entries(displayNames)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = name;
            select.appendChild(option);
        }
    }

    // Populate the color map dropdown
    populateColorMapDropdown() {
        const select = this.elements.colorMapSelect;
        const names = getColorMapNames();

        for (const name of names) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name.charAt(0).toUpperCase() + name.slice(1);
            select.appendChild(option);
        }

        // Set default to cosmic
        select.value = 'cosmic';
    }

    // Populate presets for current model
    populatePresetDropdown(modelName) {
        const select = this.elements.presetSelect;
        select.innerHTML = '';

        const presetNames = getPresetNames(modelName);
        for (const name of presetNames) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        }

        // Select first preset
        if (presetNames.length > 0) {
            select.value = presetNames[0];
        }
    }

    // Build parameter sliders for current model
    buildParameterSliders(modelName) {
        const container = this.elements.parametersContainer;
        container.innerHTML = '';

        const model = Simulation.getModel(modelName);
        if (!model) return;

        for (const paramDef of model.parameterDefs) {
            const div = document.createElement('div');
            div.className = 'param-row';

            const label = document.createElement('label');
            label.textContent = paramDef.label;
            label.htmlFor = `param-${paramDef.key}`;

            const sliderContainer = document.createElement('div');
            sliderContainer.className = 'slider-container';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = `param-${paramDef.key}`;
            slider.min = paramDef.min;
            slider.max = paramDef.max;
            slider.step = paramDef.step;
            slider.value = paramDef.default;

            const valueDisplay = document.createElement('span');
            valueDisplay.className = 'param-value';
            valueDisplay.id = `param-${paramDef.key}-value`;
            valueDisplay.textContent = this.formatValue(paramDef.default, paramDef.step);

            // Slider change handler
            slider.addEventListener('input', () => {
                const value = parseFloat(slider.value);
                valueDisplay.textContent = this.formatValue(value, paramDef.step);
                this.simulation.setParam(paramDef.key, value);
            });

            sliderContainer.appendChild(slider);
            sliderContainer.appendChild(valueDisplay);

            div.appendChild(label);
            div.appendChild(sliderContainer);
            container.appendChild(div);
        }
    }

    // Format value based on step size
    formatValue(value, step) {
        if (step >= 1) return value.toFixed(0);
        if (step >= 0.1) return value.toFixed(1);
        if (step >= 0.01) return value.toFixed(2);
        return value.toFixed(3);
    }

    // Update channel buttons for current model
    updateChannelButtons(modelName) {
        const model = Simulation.getModel(modelName);
        if (!model) return;

        const buttons = this.elements.channelButtons;
        buttons.forEach((btn, index) => {
            if (index < model.chemicals.length) {
                btn.textContent = model.chemicals[index];
                btn.style.display = 'inline-block';
            } else {
                btn.style.display = 'none';
            }
        });

        // Set active button based on model's default
        this.setActiveChannel(model.defaultDisplayChemical);
    }

    // Set active channel button
    setActiveChannel(index) {
        this.elements.channelButtons.forEach((btn, i) => {
            btn.classList.toggle('active', i === index);
        });
    }

    // Attach event listeners
    attachEventListeners() {
        // Model selection
        this.elements.modelSelect.addEventListener('change', this.onModelChange);

        // Preset selection
        this.elements.presetSelect.addEventListener('change', this.onPresetChange);

        // Color map selection
        this.elements.colorMapSelect.addEventListener('change', this.onColorMapChange);

        // Channel buttons
        this.elements.channelButtons.forEach((btn, index) => {
            btn.addEventListener('click', () => this.onChannelChange(index));
        });

        // Brush size slider
        this.elements.brushSizeSlider.addEventListener('input', () => {
            const value = parseInt(this.elements.brushSizeSlider.value);
            this.elements.brushSizeValue.textContent = value;
            this.painter.setBrushRadius(value);
        });

        // Play/Pause button
        this.elements.playPauseBtn.addEventListener('click', this.onPlayPause);

        // Reset button
        this.elements.resetBtn.addEventListener('click', this.onReset);

        // Steps per frame slider
        this.elements.stepsPerFrameSlider.addEventListener('input', () => {
            const value = parseInt(this.elements.stepsPerFrameSlider.value);
            this.elements.stepsPerFrameValue.textContent = value;
            this.simulation.setStepsPerFrame(value);
        });
    }

    // Attach keyboard listeners
    attachKeyboardListeners() {
        document.addEventListener('keydown', this.onKeyDown);
    }

    // Select a model
    selectModel(modelName) {
        this.simulation.setModel(modelName);
        this.elements.modelSelect.value = modelName;

        // Update UI
        this.populatePresetDropdown(modelName);
        this.buildParameterSliders(modelName);
        this.updateChannelButtons(modelName);

        // Apply first preset
        const presetNames = getPresetNames(modelName);
        if (presetNames.length > 0) {
            this.applyPreset(modelName, presetNames[0]);
        }

        // Update renderer
        const model = Simulation.getModel(modelName);
        this.renderer.setDisplayChemical(model.defaultDisplayChemical);
        this.painter.setPaintChemical(model.defaultDisplayChemical);
    }

    // Apply a preset
    applyPreset(modelName, presetName) {
        const preset = getPreset(modelName, presetName);
        if (!preset) return;

        // Set simulation parameters
        this.simulation.setParams(preset);

        // Update sliders
        for (const [key, value] of Object.entries(preset)) {
            if (key === 'description') continue;

            const slider = document.getElementById(`param-${key}`);
            const valueDisplay = document.getElementById(`param-${key}-value`);

            if (slider && valueDisplay) {
                slider.value = value;
                valueDisplay.textContent = this.formatValue(value, parseFloat(slider.step));
            }
        }

        // Reset simulation with new parameters
        this.simulation.reset();
    }

    // Event handlers
    onModelChange(e) {
        this.selectModel(e.target.value);
    }

    onPresetChange(e) {
        this.applyPreset(this.simulation.modelName, e.target.value);
    }

    onColorMapChange(e) {
        this.renderer.setColorMap(e.target.value);
    }

    onChannelChange(index) {
        this.setActiveChannel(index);
        this.renderer.setDisplayChemical(index);
        this.painter.setPaintChemical(index);
    }

    onPlayPause() {
        this.app.toggleRunning();
        this.updatePlayPauseButton();
    }

    onReset() {
        this.simulation.reset();
    }

    onKeyDown(e) {
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.onPlayPause();
                break;
            case 'KeyR':
                this.onReset();
                break;
            case 'Digit1':
            case 'Digit2':
            case 'Digit3':
            case 'Digit4':
            case 'Digit5':
            case 'Digit6':
            case 'Digit7':
            case 'Digit8':
            case 'Digit9':
                const presetIndex = parseInt(e.code.slice(-1)) - 1;
                const presetNames = getPresetNames(this.simulation.modelName);
                if (presetIndex < presetNames.length) {
                    this.elements.presetSelect.value = presetNames[presetIndex];
                    this.applyPreset(this.simulation.modelName, presetNames[presetIndex]);
                }
                break;
        }
    }

    // Update play/pause button state
    updatePlayPauseButton() {
        const btn = this.elements.playPauseBtn;
        if (this.app.isRunning) {
            btn.textContent = '⏸ Pause';
            btn.classList.add('running');
        } else {
            btn.textContent = '▶ Play';
            btn.classList.remove('running');
        }
    }

    // Update step counter display
    updateStepCounter(steps) {
        this.elements.stepCounter.textContent = steps.toLocaleString();
    }

    // Update FPS display
    updateFPS(fps) {
        this.elements.fpsDisplay.textContent = fps.toFixed(0);
    }
}
