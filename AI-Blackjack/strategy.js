import { getHandValue } from './deck.js';

// Dealer upcard index: 2=0, 3=1, 4=2, 5=3, 6=4, 7=5, 8=6, 9=7, 10/J/Q/K=8, A=9
// Action codes:
//   H   = hit
//   S   = stand
//   D   = double if available, else hit
//   Ds  = double if available, else stand
//   Rh  = surrender if available, else hit
//   Rs  = surrender if available, else stand
//   SP  = split if available (fallback to hard total logic if not)

const HARD_TABLE = {
  5:  ['H','H','H','H','H','H','H','H','H','H'],
  6:  ['H','H','H','H','H','H','H','H','H','H'],
  7:  ['H','H','H','H','H','H','H','H','H','H'],
  8:  ['H','H','H','H','H','H','H','H','H','H'],
  9:  ['H','D','D','D','D','H','H','H','H','H'],
  10: ['D','D','D','D','D','D','D','D','H','H'],
  11: ['D','D','D','D','D','D','D','D','D','H'],
  12: ['H','H','S','S','S','H','H','H','H','H'],
  13: ['S','S','S','S','S','H','H','H','H','H'],
  14: ['S','S','S','S','S','H','H','H','H','H'],
  15: ['S','S','S','S','S','H','H','H','Rh','Rh'],
  16: ['S','S','S','S','S','H','H','Rh','Rh','Rh'],
  17: ['S','S','S','S','S','S','S','S','S','Rs'],
};

// Key = non-ace card value (2-9), represents A+2 through A+9
const SOFT_TABLE = {
  2: ['H','H','H','D','D','H','H','H','H','H'],   // soft 13
  3: ['H','H','H','D','D','H','H','H','H','H'],   // soft 14
  4: ['H','H','D','D','D','H','H','H','H','H'],   // soft 15
  5: ['H','H','D','D','D','H','H','H','H','H'],   // soft 16
  6: ['H','D','D','D','D','H','H','H','H','H'],   // soft 17
  7: ['Ds','D','D','D','D','S','S','H','H','H'],  // soft 18
  8: ['S','S','S','S','Ds','S','S','S','S','S'],  // soft 19
  9: ['S','S','S','S','S','S','S','S','S','S'],   // soft 20
};

// Key = card rank value (2-11 for A), for pair splitting
const PAIR_TABLE = {
  2:  ['SP','SP','SP','SP','SP','SP','H','H','H','H'],
  3:  ['SP','SP','SP','SP','SP','SP','H','H','H','H'],
  4:  ['H','H','H','SP','SP','H','H','H','H','H'],
  // 5-5 is treated as hard 10 — omitted from pair table
  6:  ['SP','SP','SP','SP','SP','H','H','H','H','H'],
  7:  ['SP','SP','SP','SP','SP','SP','H','H','H','H'],
  8:  ['SP','SP','SP','SP','SP','SP','SP','SP','SP','SP'],
  9:  ['SP','SP','SP','SP','SP','S','SP','SP','S','S'],
  10: ['S','S','S','S','S','S','S','S','S','S'],
  11: ['SP','SP','SP','SP','SP','SP','SP','SP','SP','SP'], // Aces
};

function getDealerIndex(dealerUpcard) {
  if (dealerUpcard === 'A') return 9;
  if (['10','J','Q','K'].includes(dealerUpcard)) return 8;
  return parseInt(dealerUpcard) - 2;
}

function getRankValue(rank) {
  if (rank === 'A') return 11;
  if (['J','Q','K'].includes(rank)) return 10;
  return parseInt(rank);
}

function resolveCode(code, availableActions, rules) {
  switch (code) {
    case 'H':  return 'hit';
    case 'S':  return 'stand';
    case 'SP': return availableActions.includes('split') ? 'split' : 'hit';
    case 'D':  return availableActions.includes('double_down') ? 'double_down' : 'hit';
    case 'Ds': return availableActions.includes('double_down') ? 'double_down' : 'stand';
    case 'Rh': return (rules.allowSurrender && availableActions.includes('surrender')) ? 'surrender' : 'hit';
    case 'Rs': return (rules.allowSurrender && availableActions.includes('surrender')) ? 'surrender' : 'stand';
    default:   return 'hit';
  }
}

export function getBasicStrategyAction(hand, dealerUpcard, availableActions, rules) {
  const { total, isSoft } = getHandValue(hand);
  const dealerIdx = getDealerIndex(dealerUpcard);

  // Check for pair split opportunity (only 2 cards, split must be available)
  if (hand.length === 2 && availableActions.includes('split')) {
    const v1 = getRankValue(hand[0].rank);
    const v2 = getRankValue(hand[1].rank);
    if (v1 === v2 && v1 !== 5 && PAIR_TABLE[v1]) {
      const code = PAIR_TABLE[v1][dealerIdx];
      const action = resolveCode(code, availableActions, rules);
      if (action === 'split') return 'split';
      // If not splitting, fall through to soft/hard tables
    }
  }

  // Soft hand
  if (isSoft) {
    const otherVal = total - 11;
    if (otherVal >= 2 && otherVal <= 9 && SOFT_TABLE[otherVal]) {
      return resolveCode(SOFT_TABLE[otherVal][dealerIdx], availableActions, rules);
    }
    return 'stand'; // soft 20+ always stand
  }

  // Hard total
  const t = Math.max(5, Math.min(total, 17));
  if (HARD_TABLE[t]) {
    return resolveCode(HARD_TABLE[t][dealerIdx], availableActions, rules);
  }

  return total >= 17 ? 'stand' : 'hit';
}
