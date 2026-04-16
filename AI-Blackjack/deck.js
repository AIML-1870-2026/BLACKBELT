export const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
export const SUITS = ['♠','♥','♦','♣'];

export function createShoe(numDecks = 6) {
  const cards = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const value = rank === 'A' ? 11
          : ['10','J','Q','K'].includes(rank) ? 10
          : parseInt(rank);
        const countValue = ['2','3','4','5','6'].includes(rank) ? 1
          : ['10','J','Q','K','A'].includes(rank) ? -1
          : 0;
        cards.push({ rank, suit, value, countValue });
      }
    }
  }
  shuffle(cards);
  return cards;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function getHandValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += card.value;
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, isSoft: aces > 0 && total <= 21 };
}

export function getCardDisplay(card) {
  return `${card.rank}${card.suit}`;
}

export function updateCount(card, state) {
  state.runningCount += card.countValue;
  state.cardsSeen++;
  const decksRemaining = state.shoe.length / 52;
  state.decksRemaining = Math.max(decksRemaining, 0.1);
  state.trueCount = state.decksRemaining > 0.1
    ? Math.round((state.runningCount / state.decksRemaining) * 10) / 10
    : state.runningCount;
}

export function isRedSuit(suit) {
  return suit === '♥' || suit === '♦';
}
