/* ============================================
   TAEKWONDO SPARRING DECISION NEURON
   Decision Engine - Perceptron Computation
   ============================================ */

/**
 * Sigmoid activation function
 * @param {number} x - Input value
 * @returns {number} - Output between 0 and 1
 */
function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

/**
 * Compute the optimal defensive response
 * @param {string} attackId - The incoming attack identifier
 * @param {string} zoneId - Target zone (head, body, legs)
 * @param {number} distance - Distance index (0=close, 1=mid, 2=far)
 * @param {number} speed - Opponent speed (0=slow, 1=medium, 2=fast)
 * @param {number} energy - Fighter energy (10-100)
 * @param {number} experience - Experience level (0=beginner, 1=intermediate, 2=advanced)
 * @param {string} stance - Fighter stance (orthodox, southpaw)
 * @returns {object} - Decision result with blocks, counters, confidence, reasoning
 */
function computeDecision(attackId, zoneId, distance, speed, energy, experience, stance) {
    // Get the decision matrix entry for this attack/zone combination
    const matrixEntry = decisionMatrix[attackId]?.[zoneId];

    if (!matrixEntry) {
        return {
            error: 'Invalid attack or zone combination',
            blocks: [],
            counters: [],
            confidence: 0,
            reasoning: 'Unable to compute decision.'
        };
    }

    // Normalize energy to 0-1 scale
    const energyNorm = energy / 100;

    // Score all candidate blocks
    const scoredBlocks = matrixEntry.blocks.map(block => {
        let score = block.w[distance];

        // Speed modifier
        if (speed === 2) { // Fast
            // Evasive blocks get bonus, others penalized
            if (block.id === 'lean_back' || block.id === 'side_step') {
                score *= 1.1;
            } else {
                score *= 0.9;
            }
        } else if (speed === 0) { // Slow
            score *= 1.05;
        }

        // Stance modifier (southpaw slightly less natural)
        if (stance === 'southpaw') {
            score *= 0.95;
        }

        // Experience gates
        if (block.id === 'side_step' && experience < 1) {
            score *= 0.7;
        }
        if (block.id === 'lean_back' && experience < 1) {
            score *= 0.75;
        }

        // Cap at 1.0
        score = Math.min(score, 1.0);

        return {
            id: block.id,
            name: blocks[block.id]?.name || block.id,
            description: blocks[block.id]?.description || '',
            baseWeight: block.w[distance],
            score: score
        };
    });

    // Score all candidate counters
    const scoredCounters = matrixEntry.counters.map(counter => {
        let score = counter.w[distance];
        const energyCost = counter.energy;

        // Energy cost check
        if (energyNorm < (energyCost + 0.1)) {
            score *= 0.5;
        } else if (energyNorm < 0.4) {
            score *= 0.75;
        }

        // Speed modifier for counters
        if (speed === 2 && energyCost > 0.4) { // Fast attack + high-energy counter
            score *= 0.7;
        } else if (speed === 0 && energyCost > 0.4) { // Slow attack + high-energy counter
            score *= 1.15;
        }

        // Experience gates for advanced counters
        if ((counter.id === 'spinning_hook' || counter.id === 'back_kick' || counter.id === 'axe_kick_counter') && experience < 2) {
            score *= 0.5;
        }
        if ((counter.id === 'sweep' || counter.id === 'clinch') && experience < 1) {
            score *= 0.6;
        }

        // Stance bonus for certain counters
        if (stance === 'southpaw' && (counter.id === 'cross_counter' || counter.id === 'hook_counter')) {
            score *= 1.05;
        }

        // Cap at 1.0
        score = Math.min(score, 1.0);

        return {
            id: counter.id,
            name: counters[counter.id]?.name || counter.id,
            description: counters[counter.id]?.description || '',
            baseWeight: counter.w[distance],
            energy: energyCost,
            score: score
        };
    });

    // Sort by score descending
    scoredBlocks.sort((a, b) => b.score - a.score);
    scoredCounters.sort((a, b) => b.score - a.score);

    // Calculate confidence
    const bestBlock = scoredBlocks[0];
    const secondBlock = scoredBlocks[1];
    const bestCounter = scoredCounters[0];
    const secondCounter = scoredCounters[1];

    const blockConf = bestBlock.score - (secondBlock?.score || 0) + bestBlock.score;
    const counterConf = bestCounter.score - (secondCounter?.score || 0) + bestCounter.score;
    const confidence = Math.min(sigmoid((blockConf + counterConf) / 2 * 3 - 1), 0.99);

    // Generate reasoning text
    const attackName = attacks.find(a => a.id === attackId)?.name || attackId;
    const distanceName = distanceLabels[distance];
    const speedName = speedLabels[speed];
    const expName = experienceLabels[experience];
    const stanceName = stance === 'orthodox' ? 'Orthodox' : 'Southpaw';

    let reasoning = `Incoming ${attackName} to the ${zoneId} at ${distanceName} range.\n`;
    reasoning += `Opponent speed: ${speedName}. Your energy: ${energy}%.\n`;
    reasoning += `Stance: ${stanceName}. Experience: ${expName}.\n\n`;
    reasoning += `Primary block: ${bestBlock.name} — ${bestBlock.description}.\n`;
    reasoning += `Optimal counter: ${bestCounter.name} — ${bestCounter.description}.`;

    // Add contextual warnings
    if (energy < 30) {
        reasoning += `\n\n⚠️ Low energy — conserve with efficient counters.`;
    }
    if (speed === 2 && bestCounter.energy > 0.4) {
        reasoning += `\n\n⚡ Fast attack detected — simplified counter recommended.`;
    }

    return {
        blocks: scoredBlocks,
        counters: scoredCounters,
        bestBlock: bestBlock,
        bestCounter: bestCounter,
        confidence: confidence,
        confidencePercent: Math.round(confidence * 100),
        reasoning: reasoning,
        input: {
            attack: attackName,
            zone: zoneId,
            distance: distanceName,
            speed: speedName,
            energy: energy,
            experience: expName,
            stance: stanceName
        }
    };
}

/**
 * Get alternative options (2-4 next best techniques)
 * @param {object} result - The decision result object
 * @returns {array} - Array of alternative techniques
 */
function getAlternatives(result) {
    const alternatives = [];

    // Add second and third best blocks
    if (result.blocks[1]) {
        alternatives.push({
            type: 'block',
            emoji: '🛡',
            name: result.blocks[1].name,
            score: Math.round(result.blocks[1].score * 100)
        });
    }

    // Add second and third best counters
    if (result.counters[1]) {
        alternatives.push({
            type: 'counter',
            emoji: '⚔️',
            name: result.counters[1].name,
            score: Math.round(result.counters[1].score * 100)
        });
    }

    if (result.blocks[2]) {
        alternatives.push({
            type: 'block',
            emoji: '🛡',
            name: result.blocks[2].name,
            score: Math.round(result.blocks[2].score * 100)
        });
    }

    if (result.counters[2]) {
        alternatives.push({
            type: 'counter',
            emoji: '⚔️',
            name: result.counters[2].name,
            score: Math.round(result.counters[2].score * 100)
        });
    }

    // Sort by score and take top 4
    alternatives.sort((a, b) => b.score - a.score);
    return alternatives.slice(0, 4);
}
