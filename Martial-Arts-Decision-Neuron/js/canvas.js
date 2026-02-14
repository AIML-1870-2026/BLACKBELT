/* ============================================
   TAEKWONDO SPARRING DECISION NEURON
   Neural Network Canvas Visualization
   ============================================ */

// Canvas state
let canvas, ctx;
let canvasWidth, canvasHeight;
let dpr = 1;

// Network layout
const nodes = {
    input: [],
    hidden: [],
    output: []
};

// Animation state
let isAnimating = false;
let animationStartTime = 0;
const ANIMATION_DURATION = 1400;
let animationProgress = 0;

// Colors
const colors = {
    bgCard: '#2c2520',
    border: 'rgba(61, 51, 42, 0.3)',
    borderActive: 'rgba(61, 51, 42, 0.5)',
    accentRed: '#c4372e',
    accentGold: '#d4a544',
    success: '#5a8a4a',
    text: '#b8a898',
    textDim: '#7a6b5d'
};

// Node labels
const inputLabels = ['Attack', 'Zone', 'Distance', 'Speed', 'Energy', 'Stance', 'Experience'];
const hiddenLabels = ['Block\nProcessor', 'Counter\nProcessor', 'Risk\nEvaluator', 'Timing\nAnalyzer'];
const outputLabels = ['Block', 'Counter'];

/**
 * Initialize the canvas
 * @param {HTMLCanvasElement} canvasElement - The canvas element
 */
function initCanvas(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');

    // Handle device pixel ratio for sharp rendering
    dpr = window.devicePixelRatio || 1;

    // Set up resize handler
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Start draw loop
    requestAnimationFrame(drawLoop);
}

/**
 * Resize canvas to fit container
 */
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvasWidth = rect.width;
    canvasHeight = rect.height;

    // Set canvas size with DPR for sharp rendering
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;

    // Scale context
    ctx.scale(dpr, dpr);

    // Recalculate node positions
    calculateNodePositions();
}

/**
 * Calculate node positions based on canvas size
 */
function calculateNodePositions() {
    const padding = 70;
    const inputX = padding;
    const hiddenX = canvasWidth / 2;
    const outputX = canvasWidth - padding;

    // Input layer nodes (7 nodes)
    nodes.input = inputLabels.map((label, i) => ({
        x: inputX,
        y: 60 + (i * ((canvasHeight - 100) / (inputLabels.length - 1))),
        radius: 24,
        label: label,
        color: colors.accentRed
    }));

    // Hidden layer nodes (4 nodes)
    nodes.hidden = hiddenLabels.map((label, i) => ({
        x: hiddenX,
        y: 90 + (i * ((canvasHeight - 140) / (hiddenLabels.length - 1))),
        radius: 28,
        label: label,
        color: colors.accentGold
    }));

    // Output layer nodes (2 nodes)
    nodes.output = outputLabels.map((label, i) => ({
        x: outputX,
        y: (canvasHeight / 2) - 60 + (i * 120),
        radius: 24,
        label: label,
        color: colors.success
    }));
}

/**
 * Draw loop using requestAnimationFrame
 */
function drawLoop() {
    draw();
    requestAnimationFrame(drawLoop);
}

/**
 * Main draw function
 */
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Update animation progress
    if (isAnimating) {
        const elapsed = Date.now() - animationStartTime;
        animationProgress = Math.min(elapsed / ANIMATION_DURATION, 1);
        if (animationProgress >= 1) {
            isAnimating = false;
            animationProgress = 0;
        }
    }

    // Draw layer labels
    drawLayerLabels();

    // Draw connections
    drawConnections(nodes.input, nodes.hidden, 0);
    drawConnections(nodes.hidden, nodes.output, 1);

    // Draw nodes
    drawNodes(nodes.input);
    drawNodes(nodes.hidden);
    drawNodes(nodes.output);
}

/**
 * Draw layer labels above each column
 */
function drawLayerLabels() {
    ctx.font = '600 11px "Barlow Condensed", sans-serif';
    ctx.fillStyle = colors.textDim;
    ctx.textAlign = 'center';

    const labels = ['INPUT LAYER', 'HIDDEN LAYER', 'OUTPUT LAYER'];
    const xPositions = [70, canvasWidth / 2, canvasWidth - 70];

    labels.forEach((label, i) => {
        ctx.fillText(label, xPositions[i], 28);
    });
}

/**
 * Draw connections between two layers
 * @param {array} fromNodes - Source layer nodes
 * @param {array} toNodes - Target layer nodes
 * @param {number} layerIndex - Which connection layer (0 or 1)
 */
function drawConnections(fromNodes, toNodes, layerIndex) {
    fromNodes.forEach((fromNode) => {
        toNodes.forEach((toNode) => {
            // Calculate bezier control points
            const midX = (fromNode.x + toNode.x) / 2;
            const cp1x = midX;
            const cp1y = fromNode.y;
            const cp2x = midX;
            const cp2y = toNode.y;

            // Determine if this connection should be highlighted
            let lineAlpha = 0.3;
            let signalProgress = 0;

            if (isAnimating) {
                // Calculate layer-specific progress
                const totalLayers = 2;
                const layerProgress = animationProgress * totalLayers - layerIndex;

                if (layerProgress > 0 && layerProgress <= 1) {
                    lineAlpha = 0.3 + (layerProgress * 0.4);
                    signalProgress = layerProgress;
                } else if (layerProgress > 1) {
                    lineAlpha = 0.5;
                }
            }

            // Draw connection line
            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, toNode.x, toNode.y);
            ctx.strokeStyle = `rgba(61, 51, 42, ${lineAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw signal particle if animating this layer
            if (isAnimating && signalProgress > 0 && signalProgress <= 1) {
                const point = getBezierPoint(
                    fromNode.x, fromNode.y,
                    cp1x, cp1y,
                    cp2x, cp2y,
                    toNode.x, toNode.y,
                    signalProgress
                );

                // Calculate alpha using sine for fade in/out
                const alpha = Math.sin(signalProgress * Math.PI) * 0.8;

                // Draw glowing particle
                ctx.beginPath();
                ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(212, 165, 68, ${alpha})`;
                ctx.fill();

                // Add glow effect
                ctx.beginPath();
                ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
                const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 6);
                gradient.addColorStop(0, `rgba(212, 165, 68, ${alpha * 0.5})`);
                gradient.addColorStop(1, 'rgba(212, 165, 68, 0)');
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        });
    });
}

/**
 * Get point on bezier curve at time t
 */
function getBezierPoint(x0, y0, cp1x, cp1y, cp2x, cp2y, x3, y3, t) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    let x = uuu * x0;
    x += 3 * uu * t * cp1x;
    x += 3 * u * tt * cp2x;
    x += ttt * x3;

    let y = uuu * y0;
    y += 3 * uu * t * cp1y;
    y += 3 * u * tt * cp2y;
    y += ttt * y3;

    return { x, y };
}

/**
 * Draw nodes for a layer
 * @param {array} nodeList - Array of node objects
 */
function drawNodes(nodeList) {
    nodeList.forEach((node, index) => {
        // Determine if node should glow during animation
        let glowIntensity = 0;
        if (isAnimating) {
            // Calculate node activation based on layer and progress
            let layerIndex;
            if (nodeList === nodes.input) layerIndex = 0;
            else if (nodeList === nodes.hidden) layerIndex = 1;
            else layerIndex = 2;

            const activationPoint = layerIndex / 3;
            const activationWindow = 0.3;

            if (animationProgress >= activationPoint && animationProgress <= activationPoint + activationWindow) {
                glowIntensity = Math.sin(((animationProgress - activationPoint) / activationWindow) * Math.PI);
            }
        }

        // Draw glow if active
        if (glowIntensity > 0) {
            const glowRadius = node.radius * 2;
            const gradient = ctx.createRadialGradient(
                node.x, node.y, node.radius * 0.5,
                node.x, node.y, glowRadius
            );
            gradient.addColorStop(0, hexToRgba(node.color, 0.2 * glowIntensity));
            gradient.addColorStop(1, hexToRgba(node.color, 0));

            ctx.beginPath();
            ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Draw node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = colors.bgCard;
        ctx.fill();
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw label
        ctx.font = '500 10px "Barlow Condensed", sans-serif';
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Handle multi-line labels
        const lines = node.label.split('\n');
        const lineHeight = 11;
        const startY = node.y - ((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, i) => {
            ctx.fillText(line, node.x, startY + (i * lineHeight));
        });
    });
}

/**
 * Convert hex color to rgba
 * @param {string} hex - Hex color code
 * @param {number} alpha - Alpha value
 * @returns {string} - RGBA color string
 */
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Trigger the signal flow animation
 * @returns {Promise} - Resolves when animation completes
 */
function triggerSignalAnimation() {
    return new Promise((resolve) => {
        isAnimating = true;
        animationStartTime = Date.now();
        animationProgress = 0;

        // Resolve after animation duration
        setTimeout(() => {
            resolve();
        }, ANIMATION_DURATION);
    });
}
