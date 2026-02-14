/* ============================================
   TAEKWONDO SPARRING DECISION NEURON
   SVG Martial Arts Graphics
   ============================================ */

// Attack silhouette SVG paths
const attackSilhouettes = {
    jab: `<path d="M90,210 L88,170 L85,140 Q82,125 85,110 L88,95 Q90,82 88,70
         Q86,58 90,48 Q96,38 104,38 Q112,40 114,50 Q114,60 110,68
         L106,78 Q104,85 108,95 L140,92 Q155,88 168,85
         Q173,84 174,88 Q174,93 170,94 L150,98 Q130,102 115,108
         L110,115 Q112,130 110,148 L108,170 L110,210
         M85,110 L68,100 Q58,96 50,98 Q44,100 44,106 Q46,112 52,112
         L65,108 Q75,110 82,115" fill="currentColor"/>`,

    cross: `<path d="M85,210 L82,170 L78,140 Q75,125 80,108 L85,92
         Q88,78 86,65 Q84,52 88,42 Q94,32 104,32 Q114,35 116,46
         Q115,56 110,64 L105,74 Q102,82 106,92
         L145,82 Q162,75 175,70 Q180,68 182,73 Q182,78 178,80
         L160,88 Q140,96 120,102 L112,108
         Q115,125 112,145 L110,170 L115,210
         M80,108 L62,115 Q50,120 42,118 Q36,115 38,108
         Q40,102 48,104 L62,108 Q72,108 78,112" fill="currentColor"/>`,

    hook: `<path d="M88,210 L85,170 L82,140 Q80,125 84,108 L88,92
         Q90,78 88,65 Q86,52 90,42 Q96,33 106,34 Q114,38 115,48
         Q114,58 108,65 L104,75 Q100,85 105,95
         L115,90 Q128,82 138,80 Q148,78 155,82 Q162,88 158,96
         Q152,102 142,98 L128,94 Q118,98 112,108
         Q114,125 112,145 L110,170 L112,210
         M84,108 L65,118 Q52,125 44,122 Q38,118 40,112
         Q44,106 52,108 L68,112 Q78,110 82,115" fill="currentColor"/>`,

    uppercut: `<path d="M88,210 L86,175 L82,148 Q78,132 82,118 L86,105
         Q88,92 86,78 Q84,65 88,52 Q94,42 104,42 Q112,46 114,56
         Q112,66 108,74 L104,82 Q100,90 104,100
         L108,95 Q112,85 118,72 L125,58 Q130,50 136,52
         Q140,56 138,62 L130,78 Q122,92 116,105
         L112,112 Q114,128 112,148 L110,175 L112,210
         M82,118 L64,128 Q50,135 42,130 Q36,125 40,118
         Q44,112 52,116 L66,120 Q76,118 80,122" fill="currentColor"/>`,

    front_kick: `<path d="M70,210 L72,180 L75,155 Q78,140 76,125 L74,110
         Q72,95 76,82 Q80,70 78,58 Q76,46 80,36 Q86,28 96,28
         Q106,32 106,42 Q104,52 98,58 L94,66 Q90,75 94,88
         L98,100 Q100,110 98,125 L95,140
         Q98,148 108,150 L138,148 Q158,145 172,140
         Q178,138 178,144 Q176,150 170,150
         L145,155 Q122,160 105,162 L95,165 L92,180 L90,210
         M74,110 L56,100 Q45,95 38,98 Q32,102 34,108
         Q38,114 46,110 L60,106 Q68,108 72,112
         M76,82 L88,75 Q96,70 102,72 Q108,76 105,82
         Q100,86 92,82 L82,85" fill="currentColor"/>`,

    roundhouse: `<path d="M75,210 L78,175 L80,150 Q82,135 80,120 L78,105
         Q76,90 80,76 Q84,64 82,52 Q80,40 84,30 Q90,22 100,24
         Q110,28 110,40 Q108,50 102,56 L96,64 Q92,72 96,84
         L100,95 Q102,105 100,120
         Q108,125 120,122 L155,108 Q175,98 190,90
         Q196,88 196,94 Q194,100 188,100
         L168,112 Q145,125 125,135 L105,142
         Q102,155 100,175 L98,210
         M78,105 L60,95 Q48,90 40,94 Q34,98 36,104
         Q40,110 48,106 L62,102 Q72,102 76,108" fill="currentColor"/>`,

    side_kick: `<path d="M55,210 L58,178 L62,150 Q65,135 62,118 L60,102
         Q58,88 62,75 Q66,62 64,50 Q62,38 66,28 Q72,20 82,22
         Q92,26 92,38 Q90,48 84,54 L80,62 Q76,70 80,82
         L84,95 Q86,105 84,118
         Q92,120 105,118 L142,112 Q168,108 188,108
         Q195,108 195,114 Q193,120 188,118
         L162,120 Q135,124 110,128 L88,135
         Q86,148 85,170 L82,210
         M60,102 L42,112 Q30,118 24,114 Q18,108 22,102
         Q28,96 36,100 L50,104 Q56,104 58,108" fill="currentColor"/>`,

    spinning_back: `<path d="M95,210 L92,178 L88,150 Q85,135 88,118 L90,102
         Q92,88 88,75 Q84,62 86,50 Q88,38 94,30 Q102,24 110,28
         Q118,34 116,46 Q112,54 106,58 L100,65 Q96,72 100,84
         L104,95 Q106,105 104,118
         L108,125 Q112,128 108,135
         L88,140 L85,155 L82,180 L80,210
         M88,118 L72,122 Q58,128 45,138 L30,150
         Q24,155 20,150 Q18,144 24,140
         L42,128 Q58,115 72,110 L85,108
         M88,75 L72,68 Q62,62 56,66 Q50,72 54,78
         Q60,82 68,76 L82,72" fill="currentColor"/>`,

    axe_kick: `<path d="M80,210 L82,178 L85,150 Q88,135 85,118 L82,100
         Q80,85 84,72 Q88,60 86,48 Q84,36 88,26 Q94,18 104,20
         Q114,24 114,36 Q112,46 106,52 L100,60
         Q96,68 100,80 L104,92 Q106,100 104,110
         L108,105 Q112,92 115,78 L118,60 Q120,45 122,30
         L124,18 Q125,12 130,14 Q134,18 132,24
         L128,42 Q125,60 122,78 L118,98 Q115,112 112,125
         L108,140 Q105,155 102,178 L100,210
         M82,100 L64,108 Q52,115 44,110 Q38,105 42,98
         Q48,92 56,98 L68,102 Q76,102 80,106" fill="currentColor"/>`,

    push_kick: `<path d="M65,210 L68,180 L72,155 Q75,140 72,125 L70,108
         Q68,92 72,78 Q76,65 74,52 Q72,40 76,30 Q82,22 92,24
         Q102,28 102,40 Q100,50 94,56 L88,64 Q84,72 88,84
         L92,98 Q94,108 92,122
         Q98,125 110,122 L142,118 Q162,115 178,115
         Q185,115 185,120 Q183,126 178,124
         L155,122 Q132,126 112,130 L96,138
         Q94,152 92,175 L90,210
         M70,108 L52,98 Q42,92 36,96 Q30,102 34,108
         Q40,112 48,108 L60,104
         M72,78 L58,72 Q48,68 42,72 Q36,78 42,82
         Q48,86 56,80 L68,76" fill="currentColor"/>`
};

// Current selected zone
let currentSelectedZone = 'body';

/**
 * Initialize the body diagram interaction
 * @param {SVGElement} svgElement - The body diagram SVG element
 * @param {function} onZoneSelect - Callback when zone is selected
 */
function initBodyDiagram(svgElement, onZoneSelect) {
    // Get all zone hit areas
    const hitAreas = svgElement.querySelectorAll('.zone-hitarea');
    const zoneGroups = svgElement.querySelectorAll('.zone-group');

    // Add click handlers to hit areas
    hitAreas.forEach(hitArea => {
        hitArea.addEventListener('click', () => {
            const zone = hitArea.dataset.zone;
            updateBodyDiagram(zone);
            if (onZoneSelect) {
                onZoneSelect(zone);
            }
        });

        // Add hover effects
        hitArea.addEventListener('mouseenter', () => {
            const zone = hitArea.dataset.zone;
            const group = svgElement.querySelector(`.zone-${zone}`);
            if (group && !group.classList.contains('active')) {
                group.style.stroke = 'var(--text)';
            }
        });

        hitArea.addEventListener('mouseleave', () => {
            const zone = hitArea.dataset.zone;
            const group = svgElement.querySelector(`.zone-${zone}`);
            if (group && !group.classList.contains('active')) {
                group.style.stroke = '';
            }
        });
    });

    // Also make zone groups clickable directly
    zoneGroups.forEach(group => {
        group.addEventListener('click', () => {
            const zone = group.dataset.zone;
            updateBodyDiagram(zone);
            if (onZoneSelect) {
                onZoneSelect(zone);
            }
        });
    });

    // Set initial selection
    updateBodyDiagram('body');
}

/**
 * Update the body diagram to show selected zone
 * @param {string} zone - The zone to select (head, body, legs)
 */
function updateBodyDiagram(zone) {
    const diagram = document.getElementById('bodyDiagram');
    const zoneLabel = document.getElementById('zoneLabel');

    if (!diagram) return;

    currentSelectedZone = zone;

    // Remove active class from all zones
    const groups = diagram.querySelectorAll('.zone-group');
    groups.forEach(group => {
        group.classList.remove('active');
        group.style.stroke = '';
    });

    // Add active class to selected zone
    const activeGroup = diagram.querySelector(`.zone-${zone}`);
    if (activeGroup) {
        activeGroup.classList.add('active');
    }

    // Update zone label
    if (zoneLabel) {
        zoneLabel.textContent = zone.toUpperCase();
    }
}

/**
 * Set the attack illustration SVG
 * @param {string} attackId - The attack identifier
 */
function setAttackIllustration(attackId) {
    const container = document.getElementById('attackIllustration');
    const svg = document.getElementById('attackSvg');
    const label = document.getElementById('attackLabel');

    if (!container || !svg) return;

    // Get attack data
    const attack = attacks.find(a => a.id === attackId);
    const silhouette = attackSilhouettes[attackId];

    if (!attack || !silhouette) {
        // Hide illustration if no valid attack
        container.classList.remove('visible');
        return;
    }

    // Fade out current
    container.classList.remove('visible');

    // After fade out, update content and fade in
    setTimeout(() => {
        svg.innerHTML = silhouette;
        label.textContent = attack.name;
        container.classList.add('visible');
    }, 200);
}

/**
 * Clear the attack illustration
 */
function clearAttackIllustration() {
    const container = document.getElementById('attackIllustration');
    if (container) {
        container.classList.remove('visible');
    }
}

/**
 * Sync zone buttons with diagram selection
 * @param {string} zone - The selected zone
 */
function syncZoneButtons(zone) {
    const buttons = document.querySelectorAll('.zone-btn');
    buttons.forEach(btn => {
        if (btn.dataset.zone === zone) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

/**
 * Get current selected zone
 * @returns {string} - Current zone
 */
function getCurrentZone() {
    return currentSelectedZone;
}
