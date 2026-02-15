/* ============================================
   TAEKWONDO SPARRING DECISION NEURON
   Main Application Logic
   ============================================ */

// Abbreviated attack labels for compact 5-column grid
const attackLabels = {
    jab: 'JAB',
    cross: 'CROSS',
    hook: 'HOOK',
    uppercut: 'UPPER',
    front_kick: 'FRONT',
    roundhouse: 'ROUND',
    side_kick: 'SIDE',
    spinning_back: 'SPIN',
    axe_kick: 'AXE',
    push_kick: 'PUSH'
};

// Application state
const state = {
    selectedAttack: null,
    selectedZone: 'body',
    stance: 'orthodox',
    distance: 1,
    speed: 1,
    energy: 75,
    experience: 1,
    viewMode: 'simple',
    lastResult: null,
    isProcessing: false
};

// DOM elements cache
let elements = {};

/**
 * Initialize the application
 */
function init() {
    // Cache DOM elements
    cacheElements();

    // Build attack grid
    buildAttackGrid();

    // Initialize body diagram
    initBodyDiagram(elements.bodyDiagram, handleZoneSelect);

    // Set up zone button handlers
    setupZoneButtons();

    // Set up stance toggle
    setupStanceToggle();

    // Set up sliders
    setupSliders();

    // Set up view toggle
    setupViewToggle();

    // Set up fire button
    setupFireButton();

    // Initialize neural canvas
    initCanvas(elements.canvas);

    // Initial state updates
    updateBodyDiagram(state.selectedZone);
    syncZoneButtons(state.selectedZone);
}

/**
 * Cache frequently used DOM elements
 */
function cacheElements() {
    elements = {
        attackGrid: document.getElementById('attackGrid'),
        bodyDiagram: document.getElementById('bodyDiagram'),
        zoneLabel: document.getElementById('zoneLabel'),
        zoneButtons: document.getElementById('zoneButtons'),
        stanceToggle: document.getElementById('stanceToggle'),
        distSlider: document.getElementById('distSlider'),
        distValue: document.getElementById('distValue'),
        speedSlider: document.getElementById('speedSlider'),
        speedValue: document.getElementById('speedValue'),
        energySlider: document.getElementById('energySlider'),
        energyValue: document.getElementById('energyValue'),
        expSlider: document.getElementById('expSlider'),
        expValue: document.getElementById('expValue'),
        fireBtn: document.getElementById('fireBtn'),
        canvas: document.getElementById('neuralCanvas'),
        timingDisplay: document.getElementById('timingDisplay'),
        outputEmpty: document.getElementById('outputEmpty'),
        outputResults: document.getElementById('outputResults'),
        blockValue: document.getElementById('blockValue'),
        blockDesc: document.getElementById('blockDesc'),
        counterValue: document.getElementById('counterValue'),
        counterDesc: document.getElementById('counterDesc'),
        confidenceValue: document.getElementById('confidenceValue'),
        confidenceFill: document.getElementById('confidenceFill'),
        alternativesList: document.getElementById('alternativesList'),
        detailedContent: document.getElementById('detailedContent'),
        reasoningText: document.getElementById('reasoningText'),
        blockWeightsTable: document.getElementById('blockWeightsTable'),
        counterWeightsTable: document.getElementById('counterWeightsTable'),
        processingOverlay: document.getElementById('processingOverlay'),
        processingFill: document.getElementById('processingFill'),
        viewToggle: document.querySelector('.view-toggle')
    };
}

/**
 * Build the attack selection grid with abbreviated labels
 */
function buildAttackGrid() {
    elements.attackGrid.innerHTML = attacks.map(attack => `
        <button class="attack-btn" data-attack="${attack.id}">
            <span class="emoji">${attack.emoji}</span>
            <span>${attackLabels[attack.id] || attack.name}</span>
        </button>
    `).join('');

    // Add click handlers
    elements.attackGrid.querySelectorAll('.attack-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectAttack(btn.dataset.attack);
        });
    });
}

/**
 * Select an attack
 * @param {string} attackId - The attack identifier
 */
function selectAttack(attackId) {
    state.selectedAttack = attackId;

    // Update UI
    elements.attackGrid.querySelectorAll('.attack-btn').forEach(btn => {
        if (btn.dataset.attack === attackId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update attack illustration
    setAttackIllustration(attackId);

    // Enable fire button
    elements.fireBtn.disabled = false;
}

/**
 * Handle zone selection from body diagram
 * @param {string} zone - The selected zone
 */
function handleZoneSelect(zone) {
    state.selectedZone = zone;
    syncZoneButtons(zone);
    updateBodyDiagram(zone);
}

/**
 * Set up zone button handlers
 */
function setupZoneButtons() {
    elements.zoneButtons.querySelectorAll('.zone-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const zone = btn.dataset.zone;
            state.selectedZone = zone;
            syncZoneButtons(zone);
            updateBodyDiagram(zone);
        });
    });
}

/**
 * Set up stance toggle handlers
 */
function setupStanceToggle() {
    elements.stanceToggle.querySelectorAll('.stance-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.stance = btn.dataset.stance;

            // Update UI
            elements.stanceToggle.querySelectorAll('.stance-btn').forEach(b => {
                if (b.dataset.stance === state.stance) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
        });
    });
}

/**
 * Set up slider handlers
 */
function setupSliders() {
    // Distance slider
    elements.distSlider.addEventListener('input', (e) => {
        state.distance = parseInt(e.target.value);
        elements.distValue.textContent = distanceLabels[state.distance];
    });

    // Speed slider
    elements.speedSlider.addEventListener('input', (e) => {
        state.speed = parseInt(e.target.value);
        elements.speedValue.textContent = speedLabels[state.speed];
    });

    // Energy slider
    elements.energySlider.addEventListener('input', (e) => {
        state.energy = parseInt(e.target.value);
        elements.energyValue.textContent = `${state.energy}%`;
    });

    // Experience slider
    elements.expSlider.addEventListener('input', (e) => {
        state.experience = parseInt(e.target.value);
        elements.expValue.textContent = experienceLabels[state.experience];
    });
}

/**
 * Set up view toggle handlers
 */
function setupViewToggle() {
    elements.viewToggle.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.viewMode = btn.dataset.view;

            // Update UI
            elements.viewToggle.querySelectorAll('.view-btn').forEach(b => {
                if (b.dataset.view === state.viewMode) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });

            // Show/hide detailed content
            if (state.lastResult) {
                if (state.viewMode === 'detailed') {
                    elements.detailedContent.classList.remove('hidden');
                } else {
                    elements.detailedContent.classList.add('hidden');
                }
            }
        });
    });
}

/**
 * Set up fire button handler
 */
function setupFireButton() {
    elements.fireBtn.addEventListener('click', () => {
        if (!state.selectedAttack || state.isProcessing) return;
        fireNeuron();
    });
}

/**
 * Fire the decision neuron
 */
async function fireNeuron() {
    state.isProcessing = true;
    elements.fireBtn.disabled = true;

    // Show processing overlay
    elements.processingOverlay.classList.remove('hidden');
    elements.processingFill.style.width = '0%';

    // Start progress animation
    setTimeout(() => {
        elements.processingFill.style.width = '100%';
    }, 50);

    // Trigger canvas animation
    const animationPromise = triggerSignalAnimation();

    // Wait for animation to complete
    await animationPromise;

    // Compute decision
    const result = computeDecision(
        state.selectedAttack,
        state.selectedZone,
        state.distance,
        state.speed,
        state.energy,
        state.experience,
        state.stance
    );

    state.lastResult = result;

    // Hide processing overlay
    setTimeout(() => {
        elements.processingOverlay.classList.add('hidden');

        // Render output
        renderOutput(result);

        state.isProcessing = false;
        elements.fireBtn.disabled = false;
    }, 200);
}

/**
 * Render the output panel with results
 * @param {object} result - The decision result object
 */
function renderOutput(result) {
    // Hide empty state, show results
    elements.outputEmpty.classList.add('hidden');
    elements.outputResults.classList.remove('hidden');

    // Update block card
    elements.blockValue.textContent = result.bestBlock.name;
    elements.blockDesc.textContent = result.bestBlock.description;

    // Update counter card
    elements.counterValue.textContent = result.bestCounter.name;
    elements.counterDesc.textContent = result.bestCounter.description;

    // Update confidence
    elements.confidenceValue.textContent = `${result.confidencePercent}%`;
    elements.confidenceFill.style.width = '0%';
    setTimeout(() => {
        elements.confidenceFill.style.width = `${result.confidencePercent}%`;
    }, 100);

    // Update alternatives
    const alternatives = getAlternatives(result);
    elements.alternativesList.innerHTML = alternatives.map(alt => `
        <div class="alt-row">
            <span class="alt-name">${alt.emoji} ${alt.name}</span>
            <span class="alt-score">${alt.score}%</span>
        </div>
    `).join('');

    // Update timing display
    const processingMs = Math.floor(Math.random() * 81) + 120; // 120-200ms
    elements.timingDisplay.innerHTML = `
        Neural processing: <span class="timing-value">${processingMs}</span>ms ·
        Decision confidence: <span class="timing-value">${result.confidencePercent}</span>%
    `;

    // Update detailed content
    elements.reasoningText.textContent = result.reasoning;

    // Update block weights table
    const blockTbody = elements.blockWeightsTable.querySelector('tbody');
    blockTbody.innerHTML = result.blocks.map(block => {
        const scoreClass = block.score >= 0.7 ? 'score-high' : (block.score < 0.4 ? 'score-low' : '');
        return `
            <tr>
                <td>${block.name}</td>
                <td>${block.baseWeight.toFixed(2)}</td>
                <td class="${scoreClass}">${Math.round(block.score * 100)}%</td>
            </tr>
        `;
    }).join('');

    // Update counter weights table
    const counterTbody = elements.counterWeightsTable.querySelector('tbody');
    counterTbody.innerHTML = result.counters.map(counter => {
        const scoreClass = counter.score >= 0.7 ? 'score-high' : (counter.score < 0.4 ? 'score-low' : '');
        return `
            <tr>
                <td>${counter.name}</td>
                <td>${counter.baseWeight.toFixed(2)}</td>
                <td>${Math.round(counter.energy * 100)}%</td>
                <td class="${scoreClass}">${Math.round(counter.score * 100)}%</td>
            </tr>
        `;
    }).join('');

    // Show/hide detailed content based on view mode
    if (state.viewMode === 'detailed') {
        elements.detailedContent.classList.remove('hidden');
    } else {
        elements.detailedContent.classList.add('hidden');
    }

    // Reset animation by re-adding result cards
    const cards = elements.outputResults.querySelectorAll('.result-card');
    cards.forEach(card => {
        card.style.animation = 'none';
        card.offsetHeight; // Trigger reflow
        card.style.animation = '';
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
