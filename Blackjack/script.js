/* ============================================
   COSMIC BLACKJACK - GAME ENGINE
   ============================================ */

// ============================================
// CONSTANTS & CONFIG
// ============================================
const CONFIG = {
    DECK_COUNT: 6,
    RESHUFFLE_THRESHOLD: 0.75, // Reshuffle when 75% of shoe is used
    STARTING_BANKROLL: 500,
    MIN_BET: 5,
    CHIP_VALUES: [5, 10, 25, 50, 100],
    BLACKJACK_PAYOUT: 1.5, // 3:2
    DEALER_STAND_VALUE: 17,
    DEAL_DELAY: 300,        // ms between dealing cards
    DEALER_PLAY_DELAY: 800, // ms between dealer actions
    RESULT_DISPLAY_MS: 2000, // ms to show result before resetting
};

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUIT_SYMBOLS = {
    hearts:   '♥',
    diamonds: '♦',
    clubs:    '♣',
    spades:   '♠'
};

// ============================================
// GAME STATE
// ============================================
const gameState = {
    shoe: [],
    playerHands: [[]], // Array of hands for split support
    activeHandIndex: 0,
    dealerHand: [],
    currentBet: 0,
    splitBets: [], // Per-hand bets when split occurs
    bankroll: CONFIG.STARTING_BANKROLL,
    phase: 'betting', // 'betting' | 'dealing' | 'player' | 'dealer' | 'result'
    cardsDealt: 0,
    totalCardsInShoe: CONFIG.DECK_COUNT * 52,
    stats: {
        wins: 0,
        losses: 0,
        pushes: 0,
        blackjacks: 0,
        biggestWin: 0,
        biggestLoss: 0,
    },
};

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {
    // Shoe status
    shoeCount: document.querySelector('.shoe-count'),

    // Card containers
    dealerCards:          document.querySelector('.dealer-cards'),
    playerCards:          document.querySelector('.player-cards'),
    splitHandsContainer:  document.querySelector('.split-hands-container'),

    // Totals
    dealerTotal: document.querySelector('.dealer-total .total-value'),
    playerTotal: document.querySelector('.player-total .total-value'),

    // Status
    statusMessage:  document.querySelector('.status-message'),
    dealerThinking: document.querySelector('.dealer-thinking'),

    // Action buttons
    btnHit:    document.querySelector('.btn-hit'),
    btnStand:  document.querySelector('.btn-stand'),
    btnDouble: document.querySelector('.btn-double'),
    btnSplit:  document.querySelector('.btn-split'),

    // Bet controls
    chips:          document.querySelectorAll('.chip'),
    betAmount:      document.querySelector('.bet-amount'),
    bankrollAmount: document.querySelector('.bankroll-amount'),
    btnClear:       document.querySelector('.btn-clear'),
    btnDeal:        document.querySelector('.btn-deal'),

    // Overlays
    statsPanel:      document.querySelector('.stats-panel'),
    gameOverOverlay: document.querySelector('.game-over-overlay'),
    btnRestart:      document.querySelector('.btn-restart'),
};

// ============================================
// DECK MANAGEMENT
// ============================================
function buildShoe() {
    const shoe = [];
    for (let d = 0; d < CONFIG.DECK_COUNT; d++) {
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                shoe.push({ suit, rank, value: getCardValue(rank) });
            }
        }
    }
    return shoe;
}

function getCardValue(rank) {
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    if (rank === 'A') return 11;
    return parseInt(rank);
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealCard() {
    const usedPct = gameState.cardsDealt / gameState.totalCardsInShoe;
    if (usedPct >= CONFIG.RESHUFFLE_THRESHOLD || gameState.shoe.length === 0) {
        gameState.shoe = shuffle(buildShoe());
        gameState.cardsDealt = 0;
        showMessage('Shuffling new shoe...');
    }
    gameState.cardsDealt++;
    updateShoeCount();
    return gameState.shoe.pop();
}

function updateShoeCount() {
    const remaining = gameState.totalCardsInShoe - gameState.cardsDealt;
    elements.shoeCount.textContent = remaining;
}

// ============================================
// HAND LOGIC
// ============================================
function handValue(hand) {
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
    return total;
}

function isBust(hand) {
    return handValue(hand) > 21;
}

function isBlackjack(hand) {
    return hand.length === 2 && handValue(hand) === 21;
}

function canSplit(hand) {
    if (hand.length !== 2) return false;
    return hand[0].value === hand[1].value || hand[0].rank === hand[1].rank;
}

function canDouble(hand) {
    return hand.length === 2;
}

// ============================================
// UI RENDERING
// ============================================
function createCardElement(card, faceDown = false) {
    const el = document.createElement('div');
    el.className = `card ${faceDown ? 'face-down' : 'face-up'} ${card.suit} dealing`;

    if (!faceDown) {
        el.innerHTML = `
            <div class="card-corner top">
                <span class="card-rank">${card.rank}</span>
                <span class="card-suit">${SUIT_SYMBOLS[card.suit]}</span>
            </div>
            <div class="card-center">${SUIT_SYMBOLS[card.suit]}</div>
            <div class="card-corner bottom">
                <span class="card-rank">${card.rank}</span>
                <span class="card-suit">${SUIT_SYMBOLS[card.suit]}</span>
            </div>
        `;
    }

    el.dataset.suit  = card.suit;
    el.dataset.rank  = card.rank;
    el.dataset.value = card.value;
    return el;
}

function renderDealerHand(hideHole = true) {
    elements.dealerCards.innerHTML = '';
    gameState.dealerHand.forEach((card, i) => {
        const faceDown = hideHole && i === 1 &&
            gameState.phase !== 'dealer' && gameState.phase !== 'result';
        const el = createCardElement(card, faceDown);
        el.style.animationDelay = `${i * 0.1}s`;
        elements.dealerCards.appendChild(el);
    });
    updateDealerTotal(hideHole);
}

function renderPlayerHand(handIndex = 0) {
    const hand = gameState.playerHands[handIndex];
    const container = handIndex === 0
        ? elements.playerCards
        : document.querySelector(`.split-hand-${handIndex + 1} .cards-container`);

    if (!container) return;
    container.innerHTML = '';
    hand.forEach((card, i) => {
        const el = createCardElement(card);
        el.style.animationDelay = `${i * 0.1}s`;
        container.appendChild(el);
    });
    updatePlayerTotal(handIndex);
}

function renderAllPlayerHands() {
    if (gameState.playerHands.length === 1) {
        elements.playerCards.hidden = false;
        elements.splitHandsContainer.hidden = true;
        renderPlayerHand(0);
    } else {
        elements.playerCards.hidden = true;
        elements.splitHandsContainer.hidden = false;

        gameState.playerHands.forEach((_, i) => {
            renderPlayerHand(i);
            const splitHand = document.querySelector(`.split-hand-${i + 1}`);
            if (splitHand) {
                splitHand.classList.toggle('active', i === gameState.activeHandIndex);
            }
        });
    }
}

function clearTable() {
    elements.dealerCards.innerHTML = '';
    elements.playerCards.innerHTML = '';
    // Clear split hand card containers
    document.querySelectorAll('.split-hand .cards-container').forEach(c => {
        c.innerHTML = '';
    });
    // Clear split result labels
    document.querySelectorAll('.split-result').forEach(r => {
        r.textContent = '';
        r.className = 'split-result';
    });
    // Clear split hand totals
    document.querySelectorAll('.split-hand .total-value').forEach(el => {
        el.textContent = '—';
    });
    // Remove active highlight from split hands
    document.querySelectorAll('.split-hand').forEach(el => {
        el.classList.remove('active');
    });
}

function updateDealerTotal(hideHole = true) {
    if (gameState.dealerHand.length === 0) {
        elements.dealerTotal.textContent = '—';
        return;
    }
    if (hideHole && gameState.phase !== 'dealer' && gameState.phase !== 'result') {
        elements.dealerTotal.textContent = gameState.dealerHand[0].value;
    } else {
        elements.dealerTotal.textContent = handValue(gameState.dealerHand);
    }
}

function updatePlayerTotal(handIndex = 0) {
    const hand = gameState.playerHands[handIndex];
    const value = hand.length > 0 ? handValue(hand) : '—';
    if (handIndex === 0 && gameState.playerHands.length === 1) {
        elements.playerTotal.textContent = value;
    } else {
        const el = document.querySelector(`.split-hand-${handIndex + 1} .total-value`);
        if (el) el.textContent = value;
    }
}

function showMessage(text, type = '') {
    elements.statusMessage.textContent = text;
    elements.statusMessage.className = 'status-message';
    if (type) elements.statusMessage.classList.add(type);
}

function showDealerThinking(show) {
    elements.dealerThinking.hidden = !show;
}

function showSplitResults(resultMessages) {
    resultMessages.forEach(({ result, index, bet, winnings }) => {
        const el = document.querySelector(`.split-hand-${index + 1} .split-result`);
        if (!el) return;
        const net = winnings - bet;
        const sign = net >= 0 ? '+' : '';
        const labels = { win: 'Win', lose: 'Bust/Loss', push: 'Push' };
        el.textContent = `${labels[result] || result} ${sign}$${net}`;
        el.className = `split-result ${result}`;
    });
}

function updateBetUI() {
    elements.betAmount.textContent      = `$${gameState.currentBet}`;
    elements.bankrollAmount.textContent = `$${gameState.bankroll}`;
    elements.bankrollAmount.classList.toggle('low', gameState.bankroll <= 50);

    const inBetting = gameState.phase === 'betting';
    elements.chips.forEach(chip => {
        const val = parseInt(chip.dataset.value);
        chip.disabled = val > gameState.bankroll || !inBetting;
    });
    elements.btnClear.disabled = gameState.currentBet === 0 || !inBetting;
    elements.btnDeal.disabled  = gameState.currentBet < CONFIG.MIN_BET || !inBetting;
}

function setActionButtons() {
    const activeHand  = gameState.playerHands[gameState.activeHandIndex];
    const isPlayerTurn = gameState.phase === 'player';

    elements.btnHit.disabled    = !isPlayerTurn;
    elements.btnStand.disabled  = !isPlayerTurn;
    elements.btnDouble.disabled = !isPlayerTurn || !canDouble(activeHand) ||
        gameState.bankroll < (gameState.splitBets[gameState.activeHandIndex] || gameState.currentBet);
    elements.btnSplit.disabled  = !isPlayerTurn || !canSplit(activeHand) ||
        gameState.playerHands.length > 1 ||
        gameState.bankroll < gameState.currentBet;
}

// ============================================
// STATISTICS
// ============================================
function updateStats(wins, losses, pushes, netGain, hasBlackjack = false) {
    gameState.stats.wins    += wins;
    gameState.stats.losses  += losses;
    gameState.stats.pushes  += pushes;
    if (hasBlackjack) gameState.stats.blackjacks++;
    if (netGain > 0) {
        gameState.stats.biggestWin = Math.max(gameState.stats.biggestWin, netGain);
    }
    if (netGain < 0) {
        gameState.stats.biggestLoss = Math.max(gameState.stats.biggestLoss, Math.abs(netGain));
    }
}

function renderStats() {
    const { wins, losses, pushes, blackjacks, biggestWin, biggestLoss } = gameState.stats;
    const total   = wins + losses + pushes;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) + '%' : '—';

    document.getElementById('stat-wins').textContent        = wins;
    document.getElementById('stat-losses').textContent      = losses;
    document.getElementById('stat-pushes').textContent      = pushes;
    document.getElementById('stat-winrate').textContent     = winRate;
    document.getElementById('stat-blackjacks').textContent  = blackjacks;
    document.getElementById('stat-biggest-win').textContent  = `$${biggestWin}`;
    document.getElementById('stat-biggest-loss').textContent = `$${biggestLoss}`;

    elements.statsPanel.hidden = false;
}

function hideStats() {
    elements.statsPanel.hidden = true;
}

// ============================================
// GAME FLOW
// ============================================
function initGame() {
    gameState.shoe           = shuffle(buildShoe());
    gameState.cardsDealt     = 0;
    gameState.bankroll       = CONFIG.STARTING_BANKROLL;
    gameState.currentBet     = 0;
    gameState.stats          = { wins: 0, losses: 0, pushes: 0, blackjacks: 0, biggestWin: 0, biggestLoss: 0 };

    resetRound();
    updateBetUI();
    updateShoeCount();
    showMessage('Place your bet to begin');
    hideStats();
    elements.gameOverOverlay.hidden = true;
}

function resetRound() {
    gameState.playerHands    = [[]];
    gameState.activeHandIndex = 0;
    gameState.dealerHand     = [];
    gameState.splitBets      = [];
    gameState.phase          = 'betting';

    clearTable();
    elements.playerCards.hidden          = false;
    elements.splitHandsContainer.hidden  = true;
    elements.dealerTotal.textContent     = '—';
    elements.playerTotal.textContent     = '—';

    setActionButtons();
}

async function startRound() {
    if (gameState.currentBet < CONFIG.MIN_BET) return;

    hideStats();
    gameState.phase = 'dealing';
    showMessage('Dealing...');
    updateBetUI();

    await dealInitialCards();

    const playerBJ = isBlackjack(gameState.playerHands[0]);
    const dealerBJ = isBlackjack(gameState.dealerHand);

    if (playerBJ || dealerBJ) {
        renderDealerHand(false);

        if (playerBJ && dealerBJ) {
            showMessage('Both Blackjack — Push!', 'push');
            gameState.bankroll += gameState.currentBet;
            updateStats(0, 0, 1, 0);
            endRound();
        } else if (playerBJ) {
            const winAmt = Math.floor(gameState.currentBet * CONFIG.BLACKJACK_PAYOUT);
            showMessage('BLACKJACK! ★', 'blackjack');
            gameState.bankroll += gameState.currentBet + winAmt;
            updateStats(1, 0, 0, winAmt, true);
            endRound();
        } else {
            showMessage('Dealer has Blackjack!', 'lose');
            updateStats(0, 1, 0, -gameState.currentBet);
            endRound();
        }
        return;
    }

    gameState.phase = 'player';
    showMessage('Your turn — Hit or Stand?');
    setActionButtons();
}

async function dealInitialCards() {
    gameState.playerHands[0].push(dealCard());
    renderPlayerHand(0);
    await delay(CONFIG.DEAL_DELAY);

    gameState.dealerHand.push(dealCard());
    renderDealerHand(true);
    await delay(CONFIG.DEAL_DELAY);

    gameState.playerHands[0].push(dealCard());
    renderPlayerHand(0);
    await delay(CONFIG.DEAL_DELAY);

    gameState.dealerHand.push(dealCard()); // hole card
    renderDealerHand(true);
    await delay(CONFIG.DEAL_DELAY);
}

function playerHit() {
    if (gameState.phase !== 'player') return;

    const hand = gameState.playerHands[gameState.activeHandIndex];
    hand.push(dealCard());
    renderAllPlayerHands();

    if (isBust(hand)) {
        showMessage('Bust!', 'lose');
        advanceToNextHand();
    } else if (handValue(hand) === 21) {
        playerStand(); // auto-stand on 21
    } else {
        setActionButtons();
    }
}

function playerStand() {
    if (gameState.phase !== 'player') return;
    advanceToNextHand();
}

function playerDouble() {
    if (gameState.phase !== 'player') return;

    const hand    = gameState.playerHands[gameState.activeHandIndex];
    const betNow  = gameState.splitBets[gameState.activeHandIndex] ?? gameState.currentBet;
    if (!canDouble(hand) || gameState.bankroll < betNow) return;

    gameState.bankroll -= betNow;
    if (gameState.splitBets[gameState.activeHandIndex] !== undefined) {
        gameState.splitBets[gameState.activeHandIndex] *= 2;
    } else {
        gameState.currentBet *= 2;
    }
    updateBetUI();

    hand.push(dealCard());
    renderAllPlayerHands();

    if (isBust(hand)) showMessage('Bust!', 'lose');
    advanceToNextHand();
}

function playerSplit() {
    if (gameState.phase !== 'player') return;

    const hand = gameState.playerHands[gameState.activeHandIndex];
    if (!canSplit(hand) || gameState.playerHands.length > 1) return;
    if (gameState.bankroll < gameState.currentBet) return;

    gameState.bankroll -= gameState.currentBet;

    const secondCard = hand.pop();
    gameState.playerHands.push([secondCard]);
    gameState.splitBets = [gameState.currentBet, gameState.currentBet];

    hand.push(dealCard());
    gameState.playerHands[1].push(dealCard());

    updateBetUI();
    renderAllPlayerHands();
    setActionButtons();
    showMessage('Split! Playing Hand 1');
}

function advanceToNextHand() {
    if (gameState.activeHandIndex < gameState.playerHands.length - 1) {
        gameState.activeHandIndex++;
        renderAllPlayerHands();
        setActionButtons();
        showMessage(`Playing Hand ${gameState.activeHandIndex + 1}`);
    } else {
        dealerPlay();
    }
}

async function dealerPlay() {
    gameState.phase = 'dealer';

    const allBusted = gameState.playerHands.every(h => isBust(h));
    if (allBusted) {
        renderDealerHand(false);
        resolveRound();
        return;
    }

    showMessage("Dealer's turn");
    showDealerThinking(true);
    await delay(CONFIG.DEALER_PLAY_DELAY);

    renderDealerHand(false);

    while (shouldDealerHit()) {
        await delay(CONFIG.DEALER_PLAY_DELAY);
        gameState.dealerHand.push(dealCard());
        renderDealerHand(false);
    }

    showDealerThinking(false);
    await delay(CONFIG.DEAL_DELAY);

    resolveRound();
}

function shouldDealerHit() {
    // Dealer hits on soft 16 or less, stands on soft 17 or higher
    return handValue(gameState.dealerHand) < CONFIG.DEALER_STAND_VALUE;
}

function resolveRound() {
    gameState.phase = 'result';

    const dealerValue  = handValue(gameState.dealerHand);
    const dealerBusted = isBust(gameState.dealerHand);

    let totalWinnings = 0;
    let totalBets     = 0;
    let roundWins     = 0;
    let roundLosses   = 0;
    let roundPushes   = 0;
    const resultMessages = [];

    gameState.playerHands.forEach((hand, i) => {
        const playerValue  = handValue(hand);
        const playerBusted = isBust(hand);
        const bet          = gameState.splitBets[i] ?? gameState.currentBet;
        totalBets += bet;

        let result   = '';
        let winnings = 0;

        if (playerBusted) {
            result = 'lose';
            roundLosses++;
        } else if (dealerBusted) {
            result   = 'win';
            winnings = bet * 2;
            roundWins++;
        } else if (playerValue > dealerValue) {
            result   = 'win';
            winnings = bet * 2;
            roundWins++;
        } else if (dealerValue > playerValue) {
            result = 'lose';
            roundLosses++;
        } else {
            result   = 'push';
            winnings = bet;
            roundPushes++;
        }

        totalWinnings += winnings;
        resultMessages.push({ result, playerValue, index: i, bet, winnings });
    });

    gameState.bankroll += totalWinnings;
    const netGain = totalWinnings - totalBets;
    updateStats(roundWins, roundLosses, roundPushes, netGain);

    // Per-hand labels for split
    if (gameState.playerHands.length > 1) {
        showSplitResults(resultMessages);
    }

    // Overall status message
    if (gameState.playerHands.length === 1) {
        const { result, playerValue } = resultMessages[0];
        if (result === 'win') {
            showMessage(dealerBusted
                ? 'Dealer busts! You win!'
                : `${playerValue} beats ${dealerValue}! You win!`, 'win');
        } else if (result === 'lose') {
            showMessage(isBust(gameState.playerHands[0])
                ? 'Bust! You lose.'
                : `${dealerValue} beats ${playerValue}. Dealer wins.`, 'lose');
        } else {
            showMessage('Push — bet returned.', 'push');
        }
    } else {
        const wins   = resultMessages.filter(r => r.result === 'win').length;
        const losses = resultMessages.filter(r => r.result === 'lose').length;
        const pushes = resultMessages.filter(r => r.result === 'push').length;
        if (wins > 0 && losses === 0) {
            showMessage(`You win ${wins} hand${wins > 1 ? 's' : ''}!`, 'win');
        } else if (losses > 0 && wins === 0) {
            showMessage(`You lose ${losses} hand${losses > 1 ? 's' : ''}.`, 'lose');
        } else {
            showMessage(`Won ${wins} · Lost ${losses} · Push ${pushes}`, wins >= losses ? 'win' : 'lose');
        }
    }

    endRound();
}

function endRound() {
    gameState.phase = 'result';
    updateBetUI();
    setActionButtons();

    if (gameState.bankroll <= 0) {
        setTimeout(() => {
            elements.gameOverOverlay.hidden = false;
        }, 1500);
        return;
    }

    setTimeout(() => {
        gameState.currentBet = 0;
        resetRound();
        updateBetUI();
        showMessage('Place your bet for the next hand');
        renderStats(); // Show stats panel between rounds
    }, CONFIG.RESULT_DISPLAY_MS);
}

// ============================================
// EVENT HANDLERS
// ============================================
function handleChipClick(e) {
    if (gameState.phase !== 'betting') return;
    const value = parseInt(e.target.dataset.value);
    if (isNaN(value) || value > gameState.bankroll) return;

    hideStats();
    gameState.bankroll  -= value;
    gameState.currentBet += value;
    updateBetUI();
}

function handleClearBet() {
    if (gameState.phase !== 'betting') return;
    gameState.bankroll  += gameState.currentBet;
    gameState.currentBet = 0;
    updateBetUI();
}

function handleDeal() {
    if (gameState.phase !== 'betting' || gameState.currentBet < CONFIG.MIN_BET) return;
    hideStats();
    startRound();
}

function handleRestart() {
    initGame();
}

// ============================================
// UTILITY
// ============================================
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// INITIALIZATION
// ============================================
function init() {
    elements.chips.forEach(chip => chip.addEventListener('click', handleChipClick));
    elements.btnClear.addEventListener('click', handleClearBet);
    elements.btnDeal.addEventListener('click', handleDeal);
    elements.btnHit.addEventListener('click', playerHit);
    elements.btnStand.addEventListener('click', playerStand);
    elements.btnDouble.addEventListener('click', playerDouble);
    elements.btnSplit.addEventListener('click', playerSplit);
    elements.btnRestart.addEventListener('click', handleRestart);

    initGame();
}

document.addEventListener('DOMContentLoaded', init);
