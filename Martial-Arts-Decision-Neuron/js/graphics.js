/* ============================================
   TAEKWONDO SPARRING DECISION NEURON
   SVG Martial Arts Graphics
   ============================================ */

// Attack silhouette SVG paths (viewBox 0 0 200 300)
const attackSilhouettes = {
    jab: `<path d="M100,290 L98,235 L94,195 Q90,175 94,155 L98,135 Q100,118 98,100
         Q95,82 100,68 Q108,55 120,55 Q132,58 135,72 Q135,85 130,95
         L125,108 Q122,118 128,132 L170,128 Q188,123 205,118
         Q212,116 214,122 Q214,128 208,130 L185,135 Q160,142 140,150
         L132,158 Q135,178 132,200 L130,235 L133,290
         M94,155 L72,142 Q60,136 50,138 Q42,142 42,150 Q45,158 52,158
         L70,153 Q82,155 90,162" fill="currentColor"/>`,

    cross: `<path d="M95,290 L92,235 L87,195 Q82,175 88,152 L94,132
         Q98,115 95,98 Q92,78 98,62 Q106,48 120,48 Q134,52 137,68
         Q135,82 128,92 L122,105 Q118,115 124,132
         L175,118 Q198,108 215,102 Q222,98 225,105 Q225,112 218,115
         L195,125 Q170,135 145,145 L135,152
         Q138,175 135,200 L132,235 L138,290
         M88,152 L65,162 Q50,168 40,165 Q32,160 35,152
         Q38,145 48,148 L65,152 Q78,152 87,158" fill="currentColor"/>`,

    hook: `<path d="M98,290 L94,235 L90,195 Q88,175 92,152 L98,132
         Q100,115 98,98 Q95,78 100,62 Q108,50 122,52 Q132,58 134,72
         Q132,85 125,95 L120,108 Q115,120 122,135
         L135,128 Q152,118 165,115 Q178,112 188,118 Q198,125 192,138
         Q185,145 172,140 L155,135 Q142,140 135,152
         Q138,175 135,200 L132,235 L135,290
         M92,152 L68,165 Q52,175 42,172 Q34,168 38,158
         Q42,150 52,152 L72,158 Q85,155 90,162" fill="currentColor"/>`,

    uppercut: `<path d="M98,290 L95,242 L90,208 Q85,188 90,168 L95,152
         Q98,135 95,118 Q92,102 98,85 Q106,72 120,72 Q130,78 132,92
         Q130,105 125,115 L120,125 Q115,135 120,148
         L125,142 Q130,128 138,112 L148,95 Q155,85 162,88
         Q168,92 165,100 L155,118 Q145,138 138,152
         L132,162 Q135,182 132,208 L130,242 L132,290
         M90,168 L68,182 Q50,192 40,185 Q32,178 38,168
         Q42,160 52,165 L70,172 Q82,168 88,175" fill="currentColor"/>`,

    front_kick: `<path d="M78,290 L80,250 L84,218 Q88,198 85,178 L82,158
         Q80,140 84,122 Q88,108 86,92 Q84,78 88,65 Q95,55 108,55
         Q120,60 120,72 Q118,85 110,92 L105,102 Q100,112 105,128
         L110,142 Q112,155 110,178 L106,195
         Q110,205 122,208 L158,205 Q182,202 200,195
         Q208,192 208,200 Q205,208 198,208
         L170,215 Q142,222 122,225 L108,230 L104,250 L100,290
         M82,158 L60,145 Q48,138 38,142 Q30,148 32,155
         Q38,162 48,158 L65,152 Q75,155 80,162
         M84,122 L98,112 Q108,105 115,108 Q122,115 118,122
         Q112,128 102,122 L90,125" fill="currentColor"/>`,

    roundhouse: `<path d="M82,290 L86,242 L88,210 Q90,192 88,172 L86,152
         Q84,132 88,115 Q92,100 90,85 Q88,70 92,58 Q100,48 112,50
         Q124,55 124,70 Q122,82 115,90 L108,100 Q102,110 108,125
         L112,138 Q115,150 112,172
         Q122,178 138,175 L180,158 Q205,145 225,135
         Q232,132 232,140 Q230,148 222,148
         L198,162 Q170,178 145,192 L120,202
         Q118,218 115,242 L112,290
         M86,152 L65,140 Q50,132 40,138 Q32,142 35,150
         Q40,158 50,152 L68,148 Q80,148 84,155" fill="currentColor"/>`,

    side_kick: `<path d="M60,290 L64,248 L68,212 Q72,192 68,172 L65,152
         Q62,135 68,118 Q72,102 70,85 Q68,70 72,58 Q80,48 92,50
         Q104,55 104,70 Q102,82 95,90 L90,100 Q85,110 90,125
         L95,140 Q98,152 95,172
         Q105,175 122,172 L168,165 Q200,160 225,160
         Q234,160 234,168 Q232,176 225,175
         L192,178 Q160,182 130,188 L105,198
         Q102,215 100,242 L95,290
         M65,152 L45,165 Q30,172 22,168 Q14,162 20,152
         Q28,145 38,150 L55,155 Q62,155 65,160" fill="currentColor"/>`,

    spinning_back: `<path d="M108,290 L104,248 L98,212 Q94,192 98,172 L100,152
         Q102,135 98,118 Q92,102 95,85 Q98,70 106,60 Q118,52 128,58
         Q138,65 135,80 Q130,92 122,98 L115,108 Q110,118 115,132
         L120,145 Q122,155 120,172
         L125,180 Q130,185 125,195
         L100,202 L96,220 L92,250 L90,290
         M98,172 L78,178 Q62,185 48,198 L30,212
         Q22,218 18,212 Q15,205 22,200
         L45,185 Q65,168 82,162 L95,158
         M98,118 L78,110 Q66,102 58,108 Q50,115 55,122
         Q62,128 72,120 L88,115" fill="currentColor"/>`,

    axe_kick: `<path d="M88,290 L90,248 L94,212 Q98,192 94,172 L90,150
         Q88,132 92,118 Q98,102 95,85 Q92,70 98,58 Q106,48 120,50
         Q132,55 132,70 Q130,82 122,90 L115,100
         Q110,110 115,125 L120,140 Q122,150 120,165
         L125,158 Q130,142 135,125 L140,102 Q142,82 145,62
         L148,48 Q150,40 156,42 Q162,48 160,55
         L155,78 Q150,102 145,125 L140,148 Q135,165 132,185
         L125,205 Q120,222 118,248 L115,290
         M90,150 L68,160 Q52,168 42,162 Q35,155 40,145
         Q48,138 58,145 L72,150 Q82,150 88,155" fill="currentColor"/>`,

    push_kick: `<path d="M72,290 L75,250 L80,218 Q84,198 80,178 L78,158
         Q75,140 80,122 Q85,105 82,88 Q80,72 85,60 Q92,50 105,52
         Q118,58 118,72 Q115,85 108,92 L100,102 Q94,112 100,128
         L105,145 Q108,158 105,178
         Q112,182 128,178 L168,175 Q192,170 215,170
         Q224,170 224,178 Q222,186 215,184
         L185,180 Q158,185 132,192 L112,202
         Q110,218 108,245 L105,290
         M78,158 L55,145 Q42,138 35,142 Q28,150 34,158
         Q42,162 52,158 L68,152
         M80,122 L62,115 Q50,110 42,115 Q35,122 42,128
         Q50,132 60,125 L75,120" fill="currentColor"/>`
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
