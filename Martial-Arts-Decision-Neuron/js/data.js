/* ============================================
   TAEKWONDO SPARRING DECISION NEURON
   Data Constants
   ============================================ */

// Attack definitions
const attacks = [
    { id: 'jab', name: 'Jab', emoji: '🥊', type: 'punch' },
    { id: 'cross', name: 'Cross', emoji: '💥', type: 'punch' },
    { id: 'hook', name: 'Hook', emoji: '🪝', type: 'punch' },
    { id: 'uppercut', name: 'Uppercut', emoji: '⬆️', type: 'punch' },
    { id: 'front_kick', name: 'Front Kick', emoji: '🦵', type: 'kick' },
    { id: 'roundhouse', name: 'Roundhouse', emoji: '🌀', type: 'kick' },
    { id: 'side_kick', name: 'Side Kick', emoji: '➡️', type: 'kick' },
    { id: 'spinning_back', name: 'Spinning Back', emoji: '🔄', type: 'kick' },
    { id: 'axe_kick', name: 'Axe Kick', emoji: '⚡', type: 'kick' },
    { id: 'push_kick', name: 'Push Kick', emoji: '🫸', type: 'kick' }
];

// Zone definitions
const zones = ['head', 'body', 'legs'];

// Block definitions
const blocks = {
    high_block: {
        name: 'High Block',
        description: 'Rising forearm block to deflect overhead/head attacks'
    },
    mid_block: {
        name: 'Middle Block',
        description: 'Inward forearm block for body-level strikes'
    },
    low_block: {
        name: 'Low Block',
        description: 'Downward sweeping block for low kicks'
    },
    outer_block: {
        name: 'Outer Forearm Block',
        description: 'Outward deflection to redirect linear attacks'
    },
    inner_block: {
        name: 'Inner Forearm Block',
        description: 'Inward sweeping block to deflect hooks and roundhouses'
    },
    palm_block: {
        name: 'Palm Block',
        description: 'Open hand parry for fast, precise deflection'
    },
    shin_check: {
        name: 'Shin Check',
        description: 'Lifting leg to absorb low kicks on the shin'
    },
    lean_back: {
        name: 'Lean Back',
        description: 'Evasive pull-back to create distance from head strikes'
    },
    side_step: {
        name: 'Side Step',
        description: 'Lateral movement to evade and create angle'
    },
    cross_block: {
        name: 'Cross Block',
        description: 'Double arm X-block for powerful descending strikes'
    }
};

// Counter definitions
const counters = {
    jab: {
        name: 'Counter Jab',
        description: 'Quick straight punch exploiting the opening',
        energy: 0.15
    },
    cross_counter: {
        name: 'Cross Counter',
        description: 'Powerful rear-hand straight after block',
        energy: 0.30
    },
    hook_counter: {
        name: 'Counter Hook',
        description: 'Short hook targeting exposed side',
        energy: 0.35
    },
    roundhouse_counter: {
        name: 'Counter Roundhouse',
        description: 'Fast turning kick to the now-open side',
        energy: 0.50
    },
    front_kick_counter: {
        name: 'Counter Front Kick',
        description: 'Push kick to create distance and punish',
        energy: 0.25
    },
    side_kick_counter: {
        name: 'Counter Side Kick',
        description: 'Thrusting kick to exploit lateral opening',
        energy: 0.40
    },
    spinning_hook: {
        name: 'Spinning Hook Kick',
        description: 'High-risk, high-reward counter for experienced fighters',
        energy: 0.70
    },
    axe_kick_counter: {
        name: 'Counter Axe Kick',
        description: 'Descending heel strike on opponent off-balance',
        energy: 0.55
    },
    back_kick: {
        name: 'Back Kick',
        description: 'Rear thrusting kick with maximum power',
        energy: 0.55
    },
    cut_kick: {
        name: 'Cut Kick',
        description: 'Low roundhouse to disrupt opponent\'s stance',
        energy: 0.30
    },
    sweep: {
        name: 'Sweep',
        description: 'Foot sweep to unbalance the opponent',
        energy: 0.40
    },
    clinch: {
        name: 'Clinch & Knee',
        description: 'Close distance, control, and deliver knee strikes',
        energy: 0.45
    }
};

// Decision Matrix: attackId -> zoneId -> { blocks, counters }
// Weights: [closeWeight, midWeight, farWeight]
const decisionMatrix = {
    jab: {
        head: {
            blocks: [
                { id: 'palm_block', w: [0.9, 0.85, 0.7] },
                { id: 'lean_back', w: [0.5, 0.8, 0.75] },
                { id: 'inner_block', w: [0.7, 0.6, 0.4] }
            ],
            counters: [
                { id: 'cross_counter', w: [0.9, 0.85, 0.6], energy: 0.30 },
                { id: 'jab', w: [0.7, 0.8, 0.7], energy: 0.15 },
                { id: 'roundhouse_counter', w: [0.3, 0.7, 0.5], energy: 0.50 }
            ]
        },
        body: {
            blocks: [
                { id: 'mid_block', w: [0.85, 0.8, 0.6] },
                { id: 'side_step', w: [0.6, 0.75, 0.7] },
                { id: 'outer_block', w: [0.7, 0.65, 0.5] }
            ],
            counters: [
                { id: 'hook_counter', w: [0.85, 0.7, 0.4], energy: 0.35 },
                { id: 'cross_counter', w: [0.8, 0.85, 0.65], energy: 0.30 },
                { id: 'front_kick_counter', w: [0.5, 0.75, 0.8], energy: 0.25 }
            ]
        },
        legs: {
            blocks: [
                { id: 'low_block', w: [0.8, 0.75, 0.5] },
                { id: 'shin_check', w: [0.7, 0.6, 0.3] },
                { id: 'side_step', w: [0.65, 0.8, 0.75] }
            ],
            counters: [
                { id: 'cut_kick', w: [0.8, 0.7, 0.5], energy: 0.30 },
                { id: 'jab', w: [0.75, 0.8, 0.7], energy: 0.15 },
                { id: 'front_kick_counter', w: [0.6, 0.75, 0.8], energy: 0.25 }
            ]
        }
    },
    cross: {
        head: {
            blocks: [
                { id: 'high_block', w: [0.85, 0.8, 0.6] },
                { id: 'lean_back', w: [0.6, 0.85, 0.8] },
                { id: 'side_step', w: [0.7, 0.8, 0.75] }
            ],
            counters: [
                { id: 'hook_counter', w: [0.9, 0.75, 0.4], energy: 0.35 },
                { id: 'jab', w: [0.65, 0.75, 0.65], energy: 0.15 },
                { id: 'roundhouse_counter', w: [0.4, 0.75, 0.6], energy: 0.50 }
            ]
        },
        body: {
            blocks: [
                { id: 'mid_block', w: [0.9, 0.85, 0.65] },
                { id: 'outer_block', w: [0.75, 0.7, 0.55] },
                { id: 'side_step', w: [0.65, 0.8, 0.75] }
            ],
            counters: [
                { id: 'cross_counter', w: [0.85, 0.8, 0.55], energy: 0.30 },
                { id: 'hook_counter', w: [0.9, 0.7, 0.4], energy: 0.35 },
                { id: 'clinch', w: [0.8, 0.5, 0.2], energy: 0.45 }
            ]
        },
        legs: {
            blocks: [
                { id: 'low_block', w: [0.75, 0.7, 0.5] },
                { id: 'shin_check', w: [0.65, 0.55, 0.3] },
                { id: 'side_step', w: [0.7, 0.8, 0.75] }
            ],
            counters: [
                { id: 'cut_kick', w: [0.85, 0.75, 0.55], energy: 0.30 },
                { id: 'sweep', w: [0.7, 0.5, 0.25], energy: 0.40 },
                { id: 'jab', w: [0.7, 0.8, 0.7], energy: 0.15 }
            ]
        }
    },
    hook: {
        head: {
            blocks: [
                { id: 'high_block', w: [0.8, 0.75, 0.5] },
                { id: 'lean_back', w: [0.55, 0.8, 0.7] },
                { id: 'inner_block', w: [0.85, 0.75, 0.55] }
            ],
            counters: [
                { id: 'cross_counter', w: [0.85, 0.8, 0.5], energy: 0.30 },
                { id: 'jab', w: [0.6, 0.7, 0.6], energy: 0.15 },
                { id: 'clinch', w: [0.9, 0.6, 0.25], energy: 0.45 }
            ]
        },
        body: {
            blocks: [
                { id: 'inner_block', w: [0.9, 0.8, 0.6] },
                { id: 'mid_block', w: [0.8, 0.75, 0.55] },
                { id: 'side_step', w: [0.65, 0.8, 0.75] }
            ],
            counters: [
                { id: 'hook_counter', w: [0.85, 0.7, 0.4], energy: 0.35 },
                { id: 'cross_counter', w: [0.8, 0.8, 0.55], energy: 0.30 },
                { id: 'front_kick_counter', w: [0.55, 0.75, 0.8], energy: 0.25 }
            ]
        },
        legs: {
            blocks: [
                { id: 'low_block', w: [0.7, 0.65, 0.45] },
                { id: 'shin_check', w: [0.75, 0.6, 0.35] },
                { id: 'side_step', w: [0.7, 0.8, 0.75] }
            ],
            counters: [
                { id: 'cut_kick', w: [0.8, 0.7, 0.5], energy: 0.30 },
                { id: 'sweep', w: [0.75, 0.55, 0.3], energy: 0.40 },
                { id: 'jab', w: [0.65, 0.75, 0.65], energy: 0.15 }
            ]
        }
    },
    uppercut: {
        head: {
            blocks: [
                { id: 'lean_back', w: [0.85, 0.8, 0.65] },
                { id: 'palm_block', w: [0.75, 0.65, 0.4] },
                { id: 'side_step', w: [0.7, 0.8, 0.75] }
            ],
            counters: [
                { id: 'cross_counter', w: [0.9, 0.8, 0.5], energy: 0.30 },
                { id: 'hook_counter', w: [0.85, 0.7, 0.4], energy: 0.35 },
                { id: 'clinch', w: [0.9, 0.55, 0.2], energy: 0.45 }
            ]
        },
        body: {
            blocks: [
                { id: 'mid_block', w: [0.8, 0.75, 0.55] },
                { id: 'side_step', w: [0.7, 0.8, 0.75] },
                { id: 'outer_block', w: [0.7, 0.65, 0.5] }
            ],
            counters: [
                { id: 'hook_counter', w: [0.9, 0.75, 0.45], energy: 0.35 },
                { id: 'cross_counter', w: [0.85, 0.8, 0.55], energy: 0.30 },
                { id: 'front_kick_counter', w: [0.6, 0.8, 0.85], energy: 0.25 }
            ]
        },
        legs: {
            blocks: [
                { id: 'low_block', w: [0.65, 0.6, 0.4] },
                { id: 'side_step', w: [0.75, 0.8, 0.75] },
                { id: 'shin_check', w: [0.6, 0.5, 0.3] }
            ],
            counters: [
                { id: 'cut_kick', w: [0.75, 0.7, 0.5], energy: 0.30 },
                { id: 'jab', w: [0.7, 0.8, 0.7], energy: 0.15 },
                { id: 'sweep', w: [0.7, 0.5, 0.25], energy: 0.40 }
            ]
        }
    },
    front_kick: {
        head: {
            blocks: [
                { id: 'high_block', w: [0.75, 0.8, 0.65] },
                { id: 'lean_back', w: [0.65, 0.85, 0.8] },
                { id: 'palm_block', w: [0.7, 0.7, 0.55] }
            ],
            counters: [
                { id: 'side_kick_counter', w: [0.7, 0.85, 0.75], energy: 0.40 },
                { id: 'roundhouse_counter', w: [0.5, 0.8, 0.7], energy: 0.50 },
                { id: 'jab', w: [0.55, 0.7, 0.65], energy: 0.15 }
            ]
        },
        body: {
            blocks: [
                { id: 'outer_block', w: [0.85, 0.8, 0.6] },
                { id: 'side_step', w: [0.7, 0.85, 0.8] },
                { id: 'mid_block', w: [0.8, 0.75, 0.55] }
            ],
            counters: [
                { id: 'roundhouse_counter', w: [0.55, 0.85, 0.75], energy: 0.50 },
                { id: 'cut_kick', w: [0.8, 0.7, 0.5], energy: 0.30 },
                { id: 'cross_counter', w: [0.75, 0.7, 0.45], energy: 0.30 }
            ]
        },
        legs: {
            blocks: [
                { id: 'shin_check', w: [0.85, 0.75, 0.5] },
                { id: 'low_block', w: [0.8, 0.7, 0.5] },
                { id: 'side_step', w: [0.65, 0.8, 0.8] }
            ],
            counters: [
                { id: 'cut_kick', w: [0.85, 0.75, 0.55], energy: 0.30 },
                { id: 'sweep', w: [0.75, 0.55, 0.3], energy: 0.40 },
                { id: 'front_kick_counter', w: [0.65, 0.8, 0.8], energy: 0.25 }
            ]
        }
    },
    roundhouse: {
        head: {
            blocks: [
                { id: 'high_block', w: [0.8, 0.85, 0.7] },
                { id: 'lean_back', w: [0.55, 0.8, 0.85] },
                { id: 'inner_block', w: [0.75, 0.7, 0.5] }
            ],
            counters: [
                { id: 'spinning_hook', w: [0.4, 0.7, 0.65], energy: 0.70 },
                { id: 'back_kick', w: [0.5, 0.8, 0.75], energy: 0.55 },
                { id: 'jab', w: [0.6, 0.7, 0.6], energy: 0.15 }
            ]
        },
        body: {
            blocks: [
                { id: 'inner_block', w: [0.9, 0.85, 0.65] },
                { id: 'mid_block', w: [0.8, 0.75, 0.55] },
                { id: 'side_step', w: [0.6, 0.8, 0.8] }
            ],
            counters: [
                { id: 'roundhouse_counter', w: [0.6, 0.85, 0.75], energy: 0.50 },
                { id: 'cut_kick', w: [0.85, 0.7, 0.5], energy: 0.30 },
                { id: 'clinch', w: [0.85, 0.5, 0.2], energy: 0.45 }
            ]
        },
        legs: {
            blocks: [
                { id: 'shin_check', w: [0.9, 0.8, 0.55] },
                { id: 'low_block', w: [0.75, 0.7, 0.5] },
                { id: 'side_step', w: [0.6, 0.8, 0.8] }
            ],
            counters: [
                { id: 'cut_kick', w: [0.9, 0.8, 0.6], energy: 0.30 },
                { id: 'sweep', w: [0.8, 0.6, 0.3], energy: 0.40 },
                { id: 'front_kick_counter', w: [0.6, 0.8, 0.8], energy: 0.25 }
            ]
        }
    },
    side_kick: {
        head: {
            blocks: [
                { id: 'lean_back', w: [0.5, 0.8, 0.85] },
                { id: 'high_block', w: [0.7, 0.75, 0.6] },
                { id: 'side_step', w: [0.75, 0.85, 0.8] }
            ],
            counters: [
                { id: 'roundhouse_counter', w: [0.45, 0.8, 0.75], energy: 0.50 },
                { id: 'back_kick', w: [0.55, 0.85, 0.8], energy: 0.55 },
                { id: 'jab', w: [0.5, 0.65, 0.55], energy: 0.15 }
            ]
        },
        body: {
            blocks: [
                { id: 'side_step', w: [0.8, 0.9, 0.85] },
                { id: 'outer_block', w: [0.75, 0.7, 0.5] },
                { id: 'mid_block', w: [0.7, 0.65, 0.45] }
            ],
            counters: [
                { id: 'roundhouse_counter', w: [0.5, 0.85, 0.8], energy: 0.50 },
                { id: 'side_kick_counter', w: [0.6, 0.8, 0.8], energy: 0.40 },
                { id: 'cut_kick', w: [0.8, 0.65, 0.45], energy: 0.30 }
            ]
        },
        legs: {
            blocks: [
                { id: 'shin_check', w: [0.85, 0.75, 0.5] },
                { id: 'side_step', w: [0.75, 0.85, 0.85] },
                { id: 'low_block', w: [0.7, 0.65, 0.45] }
            ],
            counters: [
                { id: 'cut_kick', w: [0.9, 0.8, 0.6], energy: 0.30 },
                { id: 'sweep', w: [0.75, 0.55, 0.3], energy: 0.40 },
                { id: 'front_kick_counter', w: [0.6, 0.8, 0.8], energy: 0.25 }
            ]
        }
    },
    spinning_back: {
        head: {
            blocks: [
                { id: 'lean_back', w: [0.6, 0.85, 0.9] },
                { id: 'high_block', w: [0.65, 0.7, 0.55] },
                { id: 'side_step', w: [0.8, 0.85, 0.8] }
            ],
            counters: [
                { id: 'jab', w: [0.7, 0.8, 0.7], energy: 0.15 },
                { id: 'cross_counter', w: [0.75, 0.7, 0.5], energy: 0.30 },
                { id: 'spinning_hook', w: [0.45, 0.75, 0.7], energy: 0.70 }
            ]
        },
        body: {
            blocks: [
                { id: 'side_step', w: [0.85, 0.9, 0.85] },
                { id: 'mid_block', w: [0.7, 0.65, 0.45] },
                { id: 'outer_block', w: [0.65, 0.6, 0.4] }
            ],
            counters: [
                { id: 'jab', w: [0.75, 0.85, 0.75], energy: 0.15 },
                { id: 'cross_counter', w: [0.8, 0.75, 0.55], energy: 0.30 },
                { id: 'roundhouse_counter', w: [0.5, 0.8, 0.75], energy: 0.50 }
            ]
        },
        legs: {
            blocks: [
                { id: 'side_step', w: [0.8, 0.9, 0.85] },
                { id: 'shin_check', w: [0.75, 0.65, 0.45] },
                { id: 'low_block', w: [0.65, 0.6, 0.4] }
            ],
            counters: [
                { id: 'cut_kick', w: [0.85, 0.75, 0.55], energy: 0.30 },
                { id: 'jab', w: [0.7, 0.8, 0.7], energy: 0.15 },
                { id: 'sweep', w: [0.75, 0.55, 0.3], energy: 0.40 }
            ]
        }
    },
    axe_kick: {
        head: {
            blocks: [
                { id: 'cross_block', w: [0.85, 0.9, 0.75] },
                { id: 'lean_back', w: [0.5, 0.75, 0.8] },
                { id: 'side_step', w: [0.8, 0.85, 0.8] }
            ],
            counters: [
                { id: 'jab', w: [0.6, 0.7, 0.6], energy: 0.15 },
                { id: 'front_kick_counter', w: [0.7, 0.85, 0.8], energy: 0.25 },
                { id: 'axe_kick_counter', w: [0.4, 0.65, 0.6], energy: 0.55 }
            ]
        },
        body: {
            blocks: [
                { id: 'side_step', w: [0.85, 0.9, 0.85] },
                { id: 'cross_block', w: [0.75, 0.8, 0.65] },
                { id: 'outer_block', w: [0.65, 0.6, 0.45] }
            ],
            counters: [
                { id: 'roundhouse_counter', w: [0.55, 0.85, 0.8], energy: 0.50 },
                { id: 'front_kick_counter', w: [0.7, 0.85, 0.85], energy: 0.25 },
                { id: 'cut_kick', w: [0.8, 0.7, 0.5], energy: 0.30 }
            ]
        },
        legs: {
            blocks: [
                { id: 'side_step', w: [0.85, 0.9, 0.85] },
                { id: 'low_block', w: [0.7, 0.65, 0.45] },
                { id: 'shin_check', w: [0.6, 0.55, 0.35] }
            ],
            counters: [
                { id: 'cut_kick', w: [0.85, 0.75, 0.55], energy: 0.30 },
                { id: 'sweep', w: [0.8, 0.6, 0.35], energy: 0.40 },
                { id: 'front_kick_counter', w: [0.65, 0.8, 0.85], energy: 0.25 }
            ]
        }
    },
    push_kick: {
        head: {
            blocks: [
                { id: 'palm_block', w: [0.8, 0.75, 0.6] },
                { id: 'lean_back', w: [0.6, 0.8, 0.8] },
                { id: 'side_step', w: [0.75, 0.85, 0.8] }
            ],
            counters: [
                { id: 'roundhouse_counter', w: [0.5, 0.8, 0.75], energy: 0.50 },
                { id: 'jab', w: [0.55, 0.7, 0.6], energy: 0.15 },
                { id: 'side_kick_counter', w: [0.6, 0.8, 0.75], energy: 0.40 }
            ]
        },
        body: {
            blocks: [
                { id: 'outer_block', w: [0.85, 0.8, 0.6] },
                { id: 'side_step', w: [0.7, 0.85, 0.8] },
                { id: 'mid_block', w: [0.75, 0.7, 0.5] }
            ],
            counters: [
                { id: 'roundhouse_counter', w: [0.55, 0.85, 0.8], energy: 0.50 },
                { id: 'cut_kick', w: [0.85, 0.7, 0.5], energy: 0.30 },
                { id: 'front_kick_counter', w: [0.7, 0.85, 0.85], energy: 0.25 }
            ]
        },
        legs: {
            blocks: [
                { id: 'shin_check', w: [0.8, 0.7, 0.5] },
                { id: 'low_block', w: [0.75, 0.7, 0.5] },
                { id: 'side_step', w: [0.65, 0.8, 0.8] }
            ],
            counters: [
                { id: 'cut_kick', w: [0.9, 0.8, 0.6], energy: 0.30 },
                { id: 'sweep', w: [0.75, 0.55, 0.3], energy: 0.40 },
                { id: 'front_kick_counter', w: [0.6, 0.8, 0.8], energy: 0.25 }
            ]
        }
    }
};

// Distance labels
const distanceLabels = ['Close', 'Mid', 'Far'];

// Speed labels
const speedLabels = ['Slow', 'Medium', 'Fast'];

// Experience labels
const experienceLabels = ['Beginner', 'Intermediate', 'Advanced'];
