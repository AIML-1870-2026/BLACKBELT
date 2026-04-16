import { createShoe, getHandValue, getCardDisplay, updateCount, isRedSuit } from './deck.js';
import { getBasicStrategyAction } from './strategy.js';
import {
  callAgentBet, callAgentAction, callAgentInsurance, callAgentCommentary, resolveAgentAction
} from './agent.js';

// ─── State ────────────────────────────────────────────────────────────────────

const settings = {
  numDecks: 6,
  dealerHitsSoft17: true,
  allowSurrender: true,
  allowDoubleAfterSplit: true,
  allowReSplit: true,
  startingBankroll: 1000,
  autopilotDelay: 1.5,
  autopilotBetThreshold: 100,
  showCountPanel: true,
  model: 'gpt-4o',
  showBSHint: false,
  keyboardShortcuts: true
};

let gameState = createInitialState();

function createInitialState() {
  return {
    shoe: [],
    totalCards: 0,
    playerHands: [[]],
    playerHandBets: [0],
    playerHandStatus: ['active'],    // active | stood | bust | doubled | surrendered | blackjack
    playerHandIsSplitAce: [false],
    playerHandIsResplit: [false],
    activeHandIndex: 0,
    dealerHand: [],
    dealerHoleCardHidden: true,
    bankroll: settings.startingBankroll,
    currentBet: 0,
    phase: 'betting',
    runningCount: 0,
    trueCount: 0,
    decksRemaining: settings.numDecks,
    shoeSize: settings.numDecks,
    cardsSeen: 0,
    handHistory: [],
    sessionStats: {
      handsPlayed: 0,
      handsWon: 0,
      handsLost: 0,
      handsPushed: 0,
      blackjacks: 0,
      peakBankroll: settings.startingBankroll,
      agentDeviations: 0,
      fallbacks: 0
    }
  };
}

// ─── UI State ─────────────────────────────────────────────────────────────────

let isAutopilot = false;
let isPaused = false;
let currentAbortController = null;
let autopilotTimer = null;
let decisionResolve = null;
let decisionAvailableActions = [];
let apiKey = sessionStorage.getItem('bja_key') || null;
let apiKeyStatus = apiKey ? 'entered' : 'none';
let offlineMode = false;
let countdownInterval = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  newShoe();
  setupEventListeners();
  updateKeyStatus();
  renderUI();
  setupBettingPhase();
}

function newShoe() {
  gameState.shoe = createShoe(settings.numDecks);
  gameState.totalCards = gameState.shoe.length;
  gameState.cardsSeen = 0;
  gameState.runningCount = 0;
  gameState.trueCount = 0;
  gameState.decksRemaining = settings.numDecks;
  flashShoeBar();
}

function needsReshuffle() {
  return gameState.shoe.length < gameState.totalCards * 0.25;
}

// ─── Shoe / Card Utils ────────────────────────────────────────────────────────

function dealCard(hidden = false) {
  if (gameState.shoe.length === 0) newShoe();
  const card = gameState.shoe.pop();
  if (!hidden) updateCount(card, gameState);
  return card;
}

function createCardElement(card, revealed = true, isHole = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card-wrapper';

  const inner = document.createElement('div');
  inner.className = 'card' + (revealed ? ' revealed' : '');
  if (isHole) inner.classList.add('hole-card');

  const back = document.createElement('div');
  back.className = 'card-face card-back';

  const front = document.createElement('div');
  front.className = 'card-face card-front' + (isRedSuit(card.suit) ? ' red-suit' : '');
  front.innerHTML = `<span class="card-rank">${card.rank}</span><span class="card-suit">${card.suit}</span>`;

  inner.appendChild(back);
  inner.appendChild(front);
  wrapper.appendChild(inner);

  wrapper.dataset.rank = card.rank;
  wrapper.dataset.suit = card.suit;

  return wrapper;
}

async function animatedDeal(container, card, hidden = false, delayBefore = 0) {
  if (delayBefore > 0) await sleep(delayBefore);
  const el = createCardElement(card, !hidden, hidden);
  container.appendChild(el);
  return el;
}

// ─── Phase: Betting ───────────────────────────────────────────────────────────

function setupBettingPhase() {
  gameState.phase = 'betting';
  gameState.currentBet = 0;
  gameState.playerHands = [[]];
  gameState.playerHandBets = [0];
  gameState.playerHandStatus = ['active'];
  gameState.playerHandIsSplitAce = [false];
  gameState.playerHandIsResplit = [false];
  gameState.activeHandIndex = 0;
  gameState.dealerHand = [];
  gameState.dealerHoleCardHidden = true;

  setBettingAreaVisible(true);
  document.getElementById('action-buttons').classList.add('hidden');
  renderUI();
  updateBetDisplay();

  if (isAutopilot && !isPaused) {
    if (apiKey) {
      startAutopilotBetting();
    } else {
      // No key — use basic strategy bet sizing (minimum at neutral count)
      gameState.currentBet = 5;
      updateBetDisplay();
      showAgentIdle('No API key — betting minimum ($5). Add a key for count-based sizing.');
      setTimeout(() => startHand(), 700);
    }
  } else {
    showAgentIdle('Ready — place your bet.');
  }
}

async function startAutopilotBetting() {
  showAgentLoading('QUERYING AGENT...');
  let betResult = null;
  try {
    currentAbortController = new AbortController();
    betResult = await callAgentBet(gameState, apiKey, settings.model, currentAbortController.signal);
    if (betResult && apiKeyStatus !== 'verified') {
      apiKeyStatus = 'verified';
      updateKeyStatus();
    }
  } catch (err) {
    handleApiError(err);
    return;
  }

  const recommendedAmount = betResult
    ? Math.max(5, Math.min(betResult.args.amount, gameState.bankroll, 500))
    : 5;

  showAgentBetRecommendation(betResult, recommendedAmount);

  const agentBetEl = document.getElementById('agent-bet-suggestion');
  if (agentBetEl) agentBetEl.textContent = `> AGENT SUGGESTS $${recommendedAmount}`;

  if (recommendedAmount > settings.autopilotBetThreshold) {
    isPaused = true;
    setAutopilotPauseUI(true);
    showAgentCard({
      title: `BET: $${recommendedAmount}`,
      subtitle: 'Above threshold — confirm to continue',
      reasoning: betResult?.args?.reasoning || '',
      confidence: betResult?.args?.confidence || '',
      extra: betResult?.args?.count_assessment || ''
    });
    gameState.currentBet = recommendedAmount;
    updateBetDisplay();
    // Wait for manual deal click
  } else {
    gameState.currentBet = recommendedAmount;
    updateBetDisplay();
    await sleep(600);
    startHand();
  }
}

function addChip(value) {
  if (gameState.phase !== 'betting') return;
  const newBet = Math.min(gameState.currentBet + value, gameState.bankroll, 500);
  gameState.currentBet = newBet;
  updateBetDisplay();
  showAgentIdle(`BET: $${gameState.currentBet}`);
}

function clearBet() {
  if (gameState.phase !== 'betting') return;
  gameState.currentBet = 0;
  updateBetDisplay();
}

function startHand() {
  if (gameState.currentBet < 5) {
    flashElement('bet-display', 'flash-error');
    return;
  }
  if (gameState.currentBet > gameState.bankroll) {
    gameState.currentBet = gameState.bankroll;
  }
  gameState.bankroll -= gameState.currentBet;
  gameState.playerHandBets = [gameState.currentBet];
  updateHeader();
  runHand();
}

// ─── Main Hand Flow ───────────────────────────────────────────────────────────

async function runHand() {
  gameState.phase = 'dealing';
  setBettingAreaVisible(false);
  setActionButtonsEnabled(false);
  renderUI();

  const dealerContainer = document.getElementById('dealer-hand');
  const playerContainer = getPlayerHandContainer(0);

  dealerContainer.innerHTML = '';
  document.getElementById('player-hands-container').innerHTML = '';
  document.getElementById('dealer-total').textContent = '';
  setupPlayerHandContainers(1);

  // Deal: P1, D1, P2, D-hole
  const p1 = dealCard();
  await animatedDeal(getPlayerHandContainer(0), p1, false, 0);
  gameState.playerHands[0].push(p1);
  updateHandTotal(0);
  await sleep(250);

  const d1 = dealCard();
  await animatedDeal(document.getElementById('dealer-hand'), d1, false, 0);
  gameState.dealerHand.push(d1);
  updateDealerTotal();
  await sleep(250);

  const p2 = dealCard();
  await animatedDeal(getPlayerHandContainer(0), p2, false, 0);
  gameState.playerHands[0].push(p2);
  updateHandTotal(0);
  await sleep(250);

  const dHole = dealCard(true); // hidden, don't count
  const holeEl = await animatedDeal(document.getElementById('dealer-hand'), dHole, true, 0);
  gameState.dealerHand.push(dHole);
  gameState.dealerHoleCardHidden = true;
  updateDealerTotal();
  updateShoeBar();
  updateHeader();

  // Check player blackjack
  const playerBJ = isBlackjack(gameState.playerHands[0]);
  const dealerShowsAce = gameState.dealerHand[0].rank === 'A';
  let holeRevealed = false;

  // Insurance check — reveals hole card only if dealer has BJ
  if (dealerShowsAce) {
    const dealerBJ = await handleInsurance(holeEl, dHole);
    if (dealerBJ) {
      holeRevealed = true;
      const outcomes = playerBJ ? ['push'] : ['loss'];
      gameState.playerHandStatus[0] = playerBJ ? 'blackjack' : 'stood';
      await endHand(outcomes);
      return;
    }
  }

  // Player blackjack check
  if (playerBJ) {
    gameState.playerHandStatus[0] = 'blackjack';
    if (!holeRevealed) await revealHoleCard(holeEl, dHole);
    const dealerBJ = isBlackjack(gameState.dealerHand);
    const outcomes = dealerBJ ? ['push'] : ['blackjack'];
    await endHand(outcomes);
    return;
  }

  // Player turn
  gameState.phase = 'player_turn';
  await playPlayerTurn(holeEl, dHole, holeRevealed);
}

// ─── Insurance ────────────────────────────────────────────────────────────────

async function handleInsurance(holeEl, dHole) {
  gameState.phase = 'insurance';
  const cost = Math.floor(gameState.playerHandBets[0] / 2);

  let agentResult = null;
  if (apiKey && !offlineMode) {
    showAgentLoading('QUERYING AGENT...');
    try {
      currentAbortController = new AbortController();
      agentResult = await callAgentInsurance(gameState, apiKey, settings.model, currentAbortController.signal);
    } catch (err) { handleApiError(err); }
  }

  const agentSaysYes = agentResult?.args?.action === 'insurance_yes';

  let took = false;
  if (isAutopilot && !isPaused) {
    showAgentCard({
      title: agentSaysYes ? 'INSURANCE: YES' : 'INSURANCE: NO',
      reasoning: agentResult?.args?.reasoning || (agentSaysYes ? 'True count >= +3' : 'True count below threshold'),
      confidence: agentResult?.args?.confidence || 'medium'
    });
    await sleep(settings.autopilotDelay * 1000);
    took = agentSaysYes && gameState.bankroll >= cost;
  } else {
    document.getElementById('insurance-cost').textContent = cost;
    document.getElementById('insurance-prompt').classList.remove('hidden');
    showAgentCard({
      title: agentSaysYes ? 'INSURANCE: YES' : 'INSURANCE: NO',
      reasoning: agentResult?.args?.reasoning || (agentSaysYes ? 'Count favors insurance' : 'Decline insurance'),
      confidence: agentResult?.args?.confidence || 'medium'
    });
    took = await new Promise(resolve => {
      document.getElementById('insurance-yes-btn').onclick = () => resolve(true);
      document.getElementById('insurance-no-btn').onclick = () => resolve(false);
    });
    document.getElementById('insurance-prompt').classList.add('hidden');
  }

  return resolveInsurance(took, cost, holeEl, dHole);
}

async function resolveInsurance(took, cost, holeEl, dHole) {
  if (took) {
    gameState.bankroll -= cost;
    updateHeader();
  }

  // Peek at hole card — reveal visually only if dealer has BJ
  const dealerBJ = isBlackjack(gameState.dealerHand);
  if (dealerBJ) {
    await revealHoleCard(holeEl, dHole);
    if (took) {
      gameState.bankroll += cost * 3; // 2:1 payout + insurance stake returned
      updateHeader();
    }
    return true;
  }
  // No dealer BJ — insurance bet lost, game continues, hole card stays hidden
  return false;
}

// ─── Player Turn ──────────────────────────────────────────────────────────────

async function playPlayerTurn(holeEl, dHole, holeRevealed = false) {
  for (let handIdx = 0; handIdx < gameState.playerHands.length; handIdx++) {
    gameState.activeHandIndex = handIdx;
    highlightActiveHand(handIdx);

    if (gameState.playerHandIsSplitAce[handIdx]) {
      // Split aces get one card only, already dealt
      gameState.playerHandStatus[handIdx] = 'stood';
      continue;
    }

    // Play this hand to completion
    while (true) {
      const hand = gameState.playerHands[handIdx];
      const { total } = getHandValue(hand);

      if (total >= 21) {
        if (total > 21) gameState.playerHandStatus[handIdx] = 'bust';
        else gameState.playerHandStatus[handIdx] = 'stood';
        break;
      }

      const available = computeAvailableActions(handIdx);
      if (available.length === 0) break;

      // Get agent recommendation
      let agentResult = null;
      if (apiKey && !offlineMode) {
        showAgentLoading('QUERYING AGENT...');
        try {
          currentAbortController = new AbortController();
          const isFirstTwo = hand.length === 2;
          const isResplit = gameState.playerHandIsResplit[handIdx];
          const isSplitAce = gameState.playerHandIsSplitAce[handIdx];
          agentResult = await callAgentAction(
            gameState, hand, gameState.dealerHand[0],
            available, isFirstTwo, isResplit, isSplitAce,
            apiKey, settings.model, currentAbortController.signal
          );
          if (agentResult && apiKeyStatus !== 'verified') {
            apiKeyStatus = 'verified';
            updateKeyStatus();
          }
        } catch (err) {
          if (!handleApiError(err)) agentResult = null;
        }
      }

      const bsAction = getBasicStrategyAction(
        hand, gameState.dealerHand[0].rank, available,
        { allowSurrender: settings.allowSurrender, allowDoubleAfterSplit: settings.allowDoubleAfterSplit }
      );

      if (agentResult?.args?.is_count_deviation) {
        gameState.sessionStats.agentDeviations++;
      }

      const action = await waitForDecision(agentResult, available, bsAction);
      if (!action) return; // Paused/aborted

      const done = await executePlayerAction(action, handIdx);
      if (done) break;
    }
    updateHandTotal(handIdx);
  }

  // All hands done — dealer turn
  highlightActiveHand(-1);
  await playDealerTurn(holeEl, dHole, holeRevealed);
}

async function waitForDecision(agentResult, availableActions, bsAction) {
  decisionAvailableActions = availableActions;

  const recommended = agentResult ? resolveAgentAction(agentResult, availableActions, gameState, settings) : bsAction;

  showAgentCard({
    title: `ACTION: ${(recommended || '').replace('_', ' ').toUpperCase()}`,
    reasoning: agentResult?.args?.reasoning || '(basic strategy fallback)',
    confidence: agentResult?.args?.confidence || '',
    bsPlay: agentResult?.args?.basic_strategy_play || (agentResult?.args?.is_count_deviation ? bsAction : ''),
    isDeviation: agentResult?.args?.is_count_deviation || false,
    alternative: agentResult?.args?.alternative || ''
  });

  if (settings.showBSHint && bsAction) {
    const bsEl = document.getElementById('bs-hint');
    if (bsEl) bsEl.textContent = `BS: ${bsAction.replace('_',' ').toUpperCase()}`;
  }

  updateActionButtons(availableActions, recommended);

  if (isAutopilot && !isPaused) {
    const delayMs = settings.autopilotDelay * 1000;
    startCountdownBar(delayMs);
    return new Promise(resolve => {
      decisionResolve = resolve;
      autopilotTimer = setTimeout(() => {
        if (decisionResolve === resolve) {
          decisionResolve = null;
          resolve(recommended);
        }
      }, delayMs);
    });
  }

  // Advisor mode — wait for click
  return new Promise(resolve => {
    decisionResolve = resolve;
  });
}

function handleActionClick(action) {
  if (!decisionResolve) return;
  if (!decisionAvailableActions.includes(action)) return;
  clearTimeout(autopilotTimer);
  stopCountdownBar();
  const fn = decisionResolve;
  decisionResolve = null;
  fn(action);
}

async function executePlayerAction(action, handIdx) {
  const hand = gameState.playerHands[handIdx];
  const bet = gameState.playerHandBets[handIdx];

  if (action === 'hit') {
    const card = dealCard();
    hand.push(card);
    const container = getPlayerHandContainer(handIdx);
    await animatedDeal(container, card, false, 0);
    updateHandTotal(handIdx);
    updateShoeBar();
    updateHeader();

    const { total } = getHandValue(hand);
    if (total > 21) { gameState.playerHandStatus[handIdx] = 'bust'; return true; }
    if (total === 21) { gameState.playerHandStatus[handIdx] = 'stood'; return true; }
    return false;
  }

  if (action === 'stand') {
    gameState.playerHandStatus[handIdx] = 'stood';
    return true;
  }

  if (action === 'double_down') {
    const extraBet = Math.min(bet, gameState.bankroll);
    gameState.bankroll -= extraBet;
    gameState.playerHandBets[handIdx] += extraBet;
    updateHeader();
    const card = dealCard();
    hand.push(card);
    const container = getPlayerHandContainer(handIdx);
    await animatedDeal(container, card, false, 0);
    updateHandTotal(handIdx);
    updateShoeBar();
    const { total } = getHandValue(hand);
    gameState.playerHandStatus[handIdx] = total > 21 ? 'bust' : 'doubled';
    return true;
  }

  if (action === 'split') {
    const splitCard1 = hand.splice(1, 1)[0]; // remove second card
    const isAceSplit = hand[0].rank === 'A';

    // Create second hand
    const newHandIdx = gameState.playerHands.length;
    gameState.playerHands.push([splitCard1]);
    gameState.playerHandBets.push(bet);
    gameState.playerHandStatus.push('active');
    gameState.playerHandIsSplitAce.push(isAceSplit);
    gameState.playerHandIsResplit.push(true);
    gameState.bankroll -= bet;
    updateHeader();

    // Add container for new hand
    setupPlayerHandContainers(gameState.playerHands.length);

    // Re-render all hands
    rerenderPlayerHands();

    // Deal one card to first hand
    const card1 = dealCard();
    gameState.playerHands[handIdx].push(card1);
    await animatedDeal(getPlayerHandContainer(handIdx), card1, false, 0);
    updateHandTotal(handIdx);

    // Deal one card to second hand
    const card2 = dealCard();
    gameState.playerHands[newHandIdx].push(card2);
    await animatedDeal(getPlayerHandContainer(newHandIdx), card2, false, 0);
    updateHandTotal(newHandIdx);

    updateShoeBar();
    updateHeader();

    if (isAceSplit) {
      gameState.playerHandStatus[handIdx] = 'stood';
      return true;
    }
    return false;
  }

  if (action === 'surrender') {
    gameState.playerHandStatus[handIdx] = 'surrendered';
    gameState.bankroll += Math.floor(bet / 2);
    gameState.playerHandBets[handIdx] = Math.ceil(bet / 2); // net loss
    updateHeader();
    return true;
  }

  return false;
}

function computeAvailableActions(handIdx) {
  const hand = gameState.playerHands[handIdx];
  const bet = gameState.playerHandBets[handIdx];
  const isFirstTwo = hand.length === 2;
  const isSplitAce = gameState.playerHandIsSplitAce[handIdx];
  const numHands = gameState.playerHands.length;
  const { total } = getHandValue(hand);

  if (isSplitAce) return []; // No actions after split ace
  if (total >= 21) return [];

  const actions = ['hit', 'stand'];
  const isResplit = gameState.playerHandIsResplit[handIdx];

  // Double down — allowed on first two cards; after split only if DAS enabled
  if (isFirstTwo && gameState.bankroll >= bet && (!isResplit || settings.allowDoubleAfterSplit)) {
    actions.push('double_down');
  }

  // Split — matching rank pair, under 4 hands total, bankroll covers extra bet
  if (isFirstTwo && gameState.bankroll >= bet) {
    const v1 = getPairValue(hand[0].rank);
    const v2 = getPairValue(hand[1].rank);
    if (v1 === v2 && numHands < 4) {
      const isAcePair = hand[0].rank === 'A' && hand[1].rank === 'A';
      // No re-splitting Aces
      if (!isAcePair) {
        if (settings.allowReSplit || !isResplit) actions.push('split');
      } else if (!isResplit) {
        actions.push('split');
      }
    }
  }

  // Surrender — only on original hand's first two cards, never after split
  if (isFirstTwo && settings.allowSurrender && !isResplit && numHands === 1) {
    actions.push('surrender');
  }

  return actions;
}

function getPairValue(rank) {
  if (rank === 'A') return 11;
  if (['J','Q','K'].includes(rank)) return 10;
  return parseInt(rank);
}

// ─── Dealer Turn ──────────────────────────────────────────────────────────────

async function playDealerTurn(holeEl, dHole, holeAlreadyRevealed = false) {
  gameState.phase = 'dealer_turn';

  const needsDealer = gameState.playerHandStatus.some(s => s === 'stood' || s === 'doubled' || s === 'blackjack');

  if (!holeAlreadyRevealed) await revealHoleCard(holeEl, dHole);
  updateDealerTotal();
  updateHeader();

  if (!needsDealer) {
    await endHand(computeOutcomes());
    return;
  }

  // Dealer draws
  while (shouldDealerHit()) {
    await sleep(400);
    const card = dealCard();
    gameState.dealerHand.push(card);
    await animatedDeal(document.getElementById('dealer-hand'), card, false, 0);
    updateDealerTotal();
    updateShoeBar();
    updateHeader();
  }

  await endHand(computeOutcomes());
}

function shouldDealerHit() {
  const { total, isSoft } = getHandValue(gameState.dealerHand);
  if (total < 17) return true;
  if (total === 17 && isSoft && settings.dealerHitsSoft17) return true;
  return false;
}

async function revealHoleCard(holeEl, dHole) {
  const inner = holeEl.querySelector('.card');
  if (inner) {
    inner.classList.add('revealed');
    await sleep(350);
    updateCount(dHole, gameState);
    updateHeader();
  }
  gameState.dealerHoleCardHidden = false;
}

// ─── Results ──────────────────────────────────────────────────────────────────

function computeOutcomes() {
  const { total: dealerTotal } = getHandValue(gameState.dealerHand);
  const dealerBust = dealerTotal > 21;
  const dealerBJ = isBlackjack(gameState.dealerHand);

  return gameState.playerHands.map((hand, i) => {
    const status = gameState.playerHandStatus[i];
    if (status === 'surrendered') return 'surrender';
    if (status === 'bust') return 'bust';

    const { total: playerTotal } = getHandValue(hand);
    const playerBJ = status === 'blackjack' && !gameState.playerHandIsResplit[i];

    if (playerBJ && dealerBJ) return 'push';
    if (playerBJ) return 'blackjack';
    if (dealerBJ) return 'loss';
    if (dealerBust) return 'win';
    if (playerTotal > dealerTotal) return 'win';
    if (playerTotal < dealerTotal) return 'loss';
    return 'push';
  });
}

async function endHand(outcomes) {
  gameState.phase = 'result';
  gameState.sessionStats.handsPlayed++;

  let totalNet = 0;
  const handContainers = document.getElementById('player-hands-container').querySelectorAll('.player-hand-slot');

  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    const bet = gameState.playerHandBets[i];
    let net = 0;

    switch (outcome) {
      case 'blackjack': net = Math.floor(bet * 1.5); gameState.bankroll += bet + net; gameState.sessionStats.handsWon++; gameState.sessionStats.blackjacks++; break;
      case 'win':       net = bet; gameState.bankroll += bet * 2; gameState.sessionStats.handsWon++; break;
      case 'push':      net = 0; gameState.bankroll += bet; gameState.sessionStats.handsPushed++; break;
      case 'loss':      net = -bet; gameState.sessionStats.handsLost++; break;
      case 'bust':      net = -bet; gameState.sessionStats.handsLost++; break;
      case 'surrender': net = -Math.ceil(bet / 2); gameState.sessionStats.handsLost++; break;
    }
    totalNet += net;

    if (handContainers[i]) {
      showResultBadge(handContainers[i], outcome);
    }
  }

  if (gameState.bankroll > gameState.sessionStats.peakBankroll) {
    gameState.sessionStats.peakBankroll = gameState.bankroll;
  }

  updateHeader();
  animateBankrollFlash(totalNet > 0);

  // Record hand history
  const primaryHand = gameState.playerHands[0];
  const { total: handTotal, isSoft } = getHandValue(primaryHand);
  gameState.handHistory.push({
    playerHand: primaryHand.map(getCardDisplay),
    handTotal,
    isSoft,
    dealerUpcard: getCardDisplay(gameState.dealerHand[0]),
    dealerFinalHand: gameState.dealerHand.map(getCardDisplay),
    actions: [],
    outcome: outcomes[0],
    bet: gameState.playerHandBets[0],
    netResult: totalNet,
    trueCountAtStart: gameState.trueCount
  });
  if (gameState.handHistory.length > 10) gameState.handHistory.shift();

  // Agent commentary (skip on all-push)
  const allPush = outcomes.every(o => o === 'push');
  if (!allPush && apiKey && !offlineMode) {
    showAgentLoading('ANALYZING...');
    try {
      currentAbortController = new AbortController();
      const commentary = await callAgentCommentary(
        gameState, outcomes[0], totalNet,
        apiKey, settings.model, currentAbortController.signal
      );
      if (commentary) {
        showAgentCommentary(commentary.args);
      }
    } catch (_) {}
  }

  await sleep(1800);

  // Clear result badges and cards
  clearTable();

  if (needsReshuffle()) {
    newShoe();
    showShoeReshuffle();
    await sleep(800);
  }

  if (checkGameOver()) return;

  setupBettingPhase();
}

function isBlackjack(hand) {
  return hand.length === 2 &&
    getHandValue(hand).total === 21;
}

// ─── Game Over ────────────────────────────────────────────────────────────────

function checkGameOver() {
  if (gameState.bankroll < 5) {
    showGameOver();
    return true;
  }
  return false;
}

function showGameOver() {
  const stats = gameState.sessionStats;
  const winRate = stats.handsPlayed > 0
    ? Math.round((stats.handsWon / stats.handsPlayed) * 100)
    : 0;

  document.getElementById('game-over-stats').innerHTML = `
    <div class="stat-row"><span>Hands Played</span><span>${stats.handsPlayed}</span></div>
    <div class="stat-row"><span>Win Rate</span><span>${winRate}%</span></div>
    <div class="stat-row"><span>W / L / P</span><span>${stats.handsWon} / ${stats.handsLost} / ${stats.handsPushed}</span></div>
    <div class="stat-row"><span>Blackjacks</span><span>${stats.blackjacks}</span></div>
    <div class="stat-row"><span>Peak Bankroll</span><span>$${stats.peakBankroll.toFixed(0)}</span></div>
    <div class="stat-row"><span>Final Bankroll</span><span>$${gameState.bankroll.toFixed(0)}</span></div>
  `;
  document.getElementById('game-over-overlay').classList.remove('hidden');
}

function rebuy(resetHistory) {
  document.getElementById('game-over-overlay').classList.add('hidden');
  gameState.bankroll = settings.startingBankroll;
  if (resetHistory) {
    gameState.handHistory = [];
    gameState.runningCount = 0;
    gameState.trueCount = 0;
    gameState.cardsSeen = 0;
    newShoe();
  }
  gameState.sessionStats = {
    handsPlayed: 0, handsWon: 0, handsLost: 0, handsPushed: 0,
    blackjacks: 0, peakBankroll: settings.startingBankroll,
    agentDeviations: 0, fallbacks: 0
  };
  updateHeader();
  setupBettingPhase();
}

// ─── UI Rendering ─────────────────────────────────────────────────────────────

function renderUI() {
  updateHeader();
  updateShoeBar();
  updateBetDisplay();
}

function updateHeader() {
  document.getElementById('bankroll-display').textContent = `$${gameState.bankroll.toFixed(2)}`;
  const rcEl = document.getElementById('rc-value');
  const rc = gameState.runningCount;
  rcEl.textContent = rc >= 0 ? `+${rc}` : `${rc}`;
  rcEl.className = rc >= 2 ? 'count-hot' : rc <= -2 ? 'count-cold' : 'count-neutral';
  document.getElementById('tc-value').textContent = gameState.trueCount >= 0
    ? `+${gameState.trueCount.toFixed(1)}`
    : gameState.trueCount.toFixed(1);
}

function updateShoeBar() {
  const pct = gameState.totalCards > 0
    ? Math.round((gameState.shoe.length / gameState.totalCards) * 100)
    : 100;
  document.getElementById('shoe-bar-fill').style.width = pct + '%';
  document.getElementById('shoe-label').textContent = `SHOE ${pct}%`;
}

function updateBetDisplay() {
  const el = document.getElementById('bet-display');
  if (el) el.textContent = `BET: $${gameState.currentBet}`;
  const clearBtn = document.getElementById('clear-bet-btn');
  if (clearBtn) clearBtn.classList.toggle('hidden', gameState.currentBet === 0);
}

function updateHandTotal(handIdx) {
  const container = getPlayerHandContainer(handIdx);
  if (!container) return;
  const hand = gameState.playerHands[handIdx];
  const { total, isSoft } = getHandValue(hand);
  let totalEl = container.querySelector('.hand-total');
  if (!totalEl) {
    totalEl = document.createElement('div');
    totalEl.className = 'hand-total';
    container.appendChild(totalEl);
  }
  if (isSoft) {
    totalEl.textContent = `${total - 10}/${total}`;
    totalEl.dataset.soft = 'true';
  } else {
    totalEl.textContent = total > 21 ? 'BUST' : total;
    totalEl.dataset.soft = '';
    if (total > 21) totalEl.classList.add('bust');
    else totalEl.classList.remove('bust');
  }
}

function updateDealerTotal() {
  const el = document.getElementById('dealer-total');
  if (!el) return;
  const visibleHand = gameState.dealerHoleCardHidden
    ? [gameState.dealerHand[0]]
    : gameState.dealerHand;
  const { total, isSoft } = getHandValue(visibleHand);
  if (gameState.dealerHoleCardHidden) {
    el.textContent = `${total} + ?`;
  } else {
    el.textContent = isSoft ? `${total - 10}/${total}` : (total > 21 ? 'BUST' : total);
    if (total > 21) el.classList.add('bust');
    else el.classList.remove('bust');
  }
}

function setupPlayerHandContainers(count) {
  const container = document.getElementById('player-hands-container');
  const existing = container.querySelectorAll('.player-hand-slot').length;
  for (let i = existing; i < count; i++) {
    const slot = document.createElement('div');
    slot.className = 'player-hand-slot';
    slot.dataset.handIdx = i;
    const cardsRow = document.createElement('div');
    cardsRow.className = 'hand-row';
    slot.appendChild(cardsRow);
    container.appendChild(slot);
  }
}

function getPlayerHandContainer(handIdx) {
  const slots = document.getElementById('player-hands-container').querySelectorAll('.player-hand-slot');
  if (slots[handIdx]) return slots[handIdx].querySelector('.hand-row');
  return null;
}

function rerenderPlayerHands() {
  const container = document.getElementById('player-hands-container');
  container.innerHTML = '';
  setupPlayerHandContainers(gameState.playerHands.length);
  gameState.playerHands.forEach((hand, i) => {
    const row = getPlayerHandContainer(i);
    hand.forEach(card => {
      const el = createCardElement(card, true);
      row.appendChild(el);
    });
    updateHandTotal(i);
  });
}

function highlightActiveHand(handIdx) {
  document.querySelectorAll('.player-hand-slot').forEach((slot, i) => {
    slot.classList.toggle('active-hand', i === handIdx);
    slot.classList.toggle('inactive-hand', handIdx >= 0 && i !== handIdx);
  });
}

function setBettingAreaVisible(visible) {
  document.getElementById('betting-area').classList.toggle('hidden', !visible);
  document.getElementById('betting-area').classList.toggle('visible', visible);
}

function setActionButtonsEnabled(enabled) {
  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.classList.toggle('btn-disabled', !enabled);
  });
}

function updateActionButtons(available, recommended) {
  const map = { hit: 'btn-hit', stand: 'btn-stand', double_down: 'btn-double', split: 'btn-split', surrender: 'btn-surrender' };
  Object.entries(map).forEach(([action, id]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const isAvailable = available.includes(action);
    btn.classList.toggle('unavailable', !isAvailable);
    btn.classList.toggle('recommended', action === recommended);
    btn.disabled = !isAvailable || (isAutopilot && !isPaused);
  });
  setActionButtonsEnabled(true);
  document.getElementById('action-buttons').classList.remove('hidden');
}

function showResultBadge(container, outcome) {
  const badge = document.createElement('div');
  badge.className = `result-badge result-${outcome}`;
  badge.textContent = outcome.toUpperCase();
  container.appendChild(badge);
  setTimeout(() => badge.classList.add('fade-out'), 1400);
}

function clearTable() {
  document.getElementById('dealer-hand').innerHTML = '';
  document.getElementById('player-hands-container').innerHTML = '';
  document.getElementById('dealer-total').textContent = '';
  document.getElementById('action-buttons').classList.add('hidden');
  setBettingAreaVisible(true);
}

function animateBankrollFlash(win) {
  const el = document.getElementById('bankroll-display');
  el.classList.remove('flash-win', 'flash-loss');
  void el.offsetWidth; // reflow
  el.classList.add(win ? 'flash-win' : 'flash-loss');
}

function flashElement(id, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function flashShoeBar() {
  const bar = document.getElementById('shoe-bar-fill');
  if (!bar) return;
  bar.classList.add('shoe-flash');
  setTimeout(() => bar.classList.remove('shoe-flash'), 800);
}

function showShoeReshuffle() {
  const el = document.getElementById('shoe-label');
  const orig = el.textContent;
  el.textContent = 'RESHUFFLING...';
  el.classList.add('shoe-flash');
  setTimeout(() => { el.textContent = orig; el.classList.remove('shoe-flash'); }, 700);
  flashShoeBar();
}

// ─── Agent Panel UI ───────────────────────────────────────────────────────────

function showAgentLoading(msg = 'QUERYING AGENT...') {
  document.getElementById('agent-card-content').innerHTML =
    `<div class="agent-loading"><span class="blink-cursor">${msg}</span></div>`;
  stopCountdownBar();
}

function showAgentIdle(msg = 'Waiting...') {
  document.getElementById('agent-card-content').innerHTML =
    `<div class="agent-idle">${msg}</div>`;
  stopCountdownBar();
}

function showAgentCard({ title, subtitle, reasoning, confidence, bsPlay, isDeviation, alternative, extra }) {
  const lines = [];
  if (title) lines.push(`<div class="agent-action-title">${title}</div>`);
  if (subtitle) lines.push(`<div class="agent-subtitle">${subtitle}</div>`);
  if (confidence) lines.push(`<div class="agent-confidence">CONFIDENCE: ${confidence.toUpperCase()}</div>`);
  if (reasoning) lines.push(`<div class="agent-reasoning">"${reasoning}"</div>`);
  if (extra) lines.push(`<div class="agent-extra">${extra}</div>`);
  if (bsPlay) lines.push(`<div class="agent-bs-line">BS: ${bsPlay.replace('_',' ').toUpperCase()} ${isDeviation ? '⚡ DEVIATION' : ''}</div>`);
  lines.push(`<div class="countdown-bar-container"><div id="countdown-bar" class="countdown-bar"></div></div>`);
  document.getElementById('agent-card-content').innerHTML = lines.join('');
}

function showAgentBetRecommendation(agentResult, amount) {
  showAgentCard({
    title: `BET: $${amount}`,
    reasoning: agentResult?.args?.reasoning || '',
    confidence: agentResult?.args?.confidence || '',
    extra: agentResult?.args?.count_assessment || ''
  });
}

function showAgentCommentary({ message, tone }) {
  document.getElementById('agent-card-content').innerHTML =
    `<div class="agent-commentary tone-${tone}">"${message}"</div>`;
}

function showAgentError(msg) {
  document.getElementById('agent-card-content').innerHTML =
    `<div class="agent-error">⚠ ${msg}</div>`;
}

function startCountdownBar(durationMs) {
  const bar = document.getElementById('countdown-bar');
  if (!bar) return;
  bar.style.transition = 'none';
  bar.style.width = '100%';
  void bar.offsetWidth;
  bar.style.transition = `width ${durationMs}ms linear`;
  bar.style.width = '0%';
}

function stopCountdownBar() {
  clearTimeout(autopilotTimer);
  const bar = document.getElementById('countdown-bar');
  if (!bar) return;
  const computed = window.getComputedStyle(bar).width;
  bar.style.transition = 'none';
  bar.style.width = computed;
}

// ─── Error Handling ───────────────────────────────────────────────────────────

function handleApiError(err) {
  if (err.name === 'AbortError') return false;

  if (err.status === 401) {
    apiKeyStatus = 'none';
    updateKeyStatus();
    showAgentError('Invalid API key — please re-enter your key.');
    if (isAutopilot) { isPaused = true; setAutopilotPauseUI(true); }
    return false;
  }

  if (err.status === 429) {
    showAgentError('Rate limited — retrying in 5s...');
    if (isAutopilot) { isPaused = true; setAutopilotPauseUI(true); }
    return false;
  }

  // Network error — switch to offline mode
  offlineMode = true;
  showOfflineBanner(true);
  return false;
}

function showOfflineBanner(show) {
  let banner = document.getElementById('offline-banner');
  if (show && !banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.textContent = 'OFFLINE MODE — Using basic strategy fallback';
    document.body.prepend(banner);
  } else if (!show && banner) {
    banner.remove();
  }
}

// ─── Autopilot ────────────────────────────────────────────────────────────────

function setAutopilot(on) {
  isAutopilot = on;
  document.getElementById('mode-toggle').classList.toggle('autopilot-active', on);
  document.getElementById('pause-container').classList.toggle('hidden', !on);
  document.getElementById('autopilot-label').classList.toggle('active-label', on);
  document.getElementById('advisor-label').classList.toggle('active-label', !on);

  if (!on && isPaused) {
    isPaused = false;
    setAutopilotPauseUI(false);
  }

  // If switching to autopilot during a betting phase, trigger auto-bet
  if (on && !isPaused && gameState.phase === 'betting' && apiKey) {
    startAutopilotBetting();
  }

  // If switching to advisor mode with a pending decision, enable buttons
  if (!on && decisionResolve) {
    clearTimeout(autopilotTimer);
    stopCountdownBar();
    updateActionButtons(decisionAvailableActions, null);
  }
}

function pauseAutopilot() {
  isPaused = !isPaused;
  setAutopilotPauseUI(isPaused);
  if (isPaused) {
    if (currentAbortController) currentAbortController.abort();
    clearTimeout(autopilotTimer);
    stopCountdownBar();
    // Enable action buttons for manual play
    if (decisionResolve && decisionAvailableActions.length > 0) {
      updateActionButtons(decisionAvailableActions, null);
    }
  } else {
    // Resume autopilot
    if (gameState.phase === 'betting') {
      startAutopilotBetting();
    }
    // If in player_turn with pending decision, auto-fire with a delay
    if (decisionResolve && decisionAvailableActions.length > 0) {
      const hand = gameState.playerHands[gameState.activeHandIndex];
      const bsAction = getBasicStrategyAction(
        hand, gameState.dealerHand[0].rank, decisionAvailableActions,
        { allowSurrender: settings.allowSurrender, allowDoubleAfterSplit: settings.allowDoubleAfterSplit }
      );
      startCountdownBar(settings.autopilotDelay * 1000);
      autopilotTimer = setTimeout(() => {
        if (decisionResolve) {
          const fn = decisionResolve;
          decisionResolve = null;
          fn(bsAction);
        }
      }, settings.autopilotDelay * 1000);
    }
  }
}

function setAutopilotPauseUI(paused) {
  const btn = document.getElementById('pause-btn');
  if (btn) btn.textContent = paused ? '▶ RESUME' : '⏸ PAUSE';
}

// ─── Key Management ───────────────────────────────────────────────────────────

function updateKeyStatus() {
  const icons = { none: '🔴', entered: '🟡', verified: '🟢' };
  document.getElementById('key-status').textContent = icons[apiKeyStatus];
  document.getElementById('key-panel-status').textContent = icons[apiKeyStatus];
}

function saveApiKey(key) {
  key = key.trim();
  if (!key.startsWith('sk-')) {
    showAgentError('Key must start with sk-');
    return;
  }
  apiKey = key;
  apiKeyStatus = 'entered';
  sessionStorage.setItem('bja_key', key);
  updateKeyStatus();
  document.getElementById('key-panel').classList.add('hidden');
  offlineMode = false;
  showOfflineBanner(false);
}

function clearApiKey() {
  apiKey = null;
  apiKeyStatus = 'none';
  sessionStorage.removeItem('bja_key');
  updateKeyStatus();
  document.getElementById('key-input').value = '';
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function applySettings() {
  settings.numDecks = parseInt(document.getElementById('setting-decks').value);
  settings.dealerHitsSoft17 = document.getElementById('setting-h17').checked;
  settings.allowSurrender = document.getElementById('setting-surrender').checked;
  settings.allowDoubleAfterSplit = document.getElementById('setting-das').checked;
  settings.allowReSplit = document.getElementById('setting-resplit').checked;
  settings.startingBankroll = parseInt(document.getElementById('setting-bankroll').value) || 1000;
  settings.autopilotDelay = parseFloat(document.getElementById('setting-delay').value);
  settings.autopilotBetThreshold = parseInt(document.getElementById('setting-threshold').value) || 100;
  settings.showCountPanel = document.getElementById('setting-count').checked;
  settings.model = document.getElementById('setting-model').value;
  settings.showBSHint = document.getElementById('setting-bs-hint').checked;
  settings.keyboardShortcuts = document.getElementById('setting-keys').checked;

  document.getElementById('model-warning').classList.toggle('hidden', settings.model !== 'gpt-4o-mini');
  document.getElementById('settings-panel').classList.add('hidden');
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

function setupEventListeners() {
  // Mode toggle
  document.getElementById('mode-toggle').addEventListener('click', () => {
    setAutopilot(!isAutopilot);
  });

  // Pause
  document.getElementById('pause-btn').addEventListener('click', pauseAutopilot);

  // Chips
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => addChip(parseInt(btn.dataset.value)));
  });

  // Bet controls
  document.getElementById('clear-bet-btn').addEventListener('click', clearBet);
  document.getElementById('deal-btn').addEventListener('click', () => {
    if (gameState.phase === 'betting') startHand();
  });

  // Action buttons
  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => handleActionClick(btn.dataset.action));
  });

  // Settings
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.toggle('hidden');
    document.getElementById('key-panel').classList.add('hidden');
  });
  document.getElementById('settings-apply-btn').addEventListener('click', applySettings);
  document.getElementById('setting-delay').addEventListener('input', e => {
    document.getElementById('setting-delay-val').textContent = parseFloat(e.target.value).toFixed(1) + 's';
  });
  document.getElementById('setting-model').addEventListener('change', e => {
    document.getElementById('model-warning').classList.toggle('hidden', e.target.value !== 'gpt-4o-mini');
  });

  // Key panel
  document.getElementById('key-btn').addEventListener('click', () => {
    document.getElementById('key-panel').classList.toggle('hidden');
    document.getElementById('settings-panel').classList.add('hidden');
  });
  document.getElementById('key-save-btn').addEventListener('click', () => {
    saveApiKey(document.getElementById('key-input').value);
  });
  document.getElementById('key-clear-btn').addEventListener('click', clearApiKey);
  document.getElementById('key-reveal-btn').addEventListener('click', () => {
    const input = document.getElementById('key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('key-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveApiKey(e.target.value);
  });

  // .env file upload
  document.getElementById('env-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result;
      const match = text.match(/^OPENAI_API_KEY=(.+)$/m);
      if (match) {
        saveApiKey(match[1].trim());
      } else {
        const errEl = document.getElementById('env-upload-error');
        errEl.textContent = 'Could not find OPENAI_API_KEY in this file';
        errEl.classList.remove('hidden');
      }
    };
    reader.readAsText(file);
  });

  // Insurance
  // These are set inline during the insurance phase

  // Game over
  document.getElementById('rebuy-btn').addEventListener('click', () => {
    document.getElementById('reset-dialog').classList.remove('hidden');
  });
  document.getElementById('reset-yes-btn').addEventListener('click', () => {
    document.getElementById('reset-dialog').classList.add('hidden');
    rebuy(true);
  });
  document.getElementById('reset-no-btn').addEventListener('click', () => {
    document.getElementById('reset-dialog').classList.add('hidden');
    rebuy(false);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (!settings.keyboardShortcuts) return;
    if (e.target.tagName === 'INPUT') return;

    if (e.code === 'Space' && gameState.phase === 'betting') {
      e.preventDefault();
      startHand();
      return;
    }
    if (gameState.phase !== 'player_turn') return;
    if (isAutopilot && !isPaused) return;

    const keyMap = { KeyH: 'hit', KeyS: 'stand', KeyD: 'double_down', KeyP: 'split', KeyX: 'surrender' };
    const action = keyMap[e.code];
    if (action) handleActionClick(action);
  });

  // Click outside panels to close
  document.addEventListener('click', e => {
    const settingsPanel = document.getElementById('settings-panel');
    const keyPanel = document.getElementById('key-panel');
    if (!settingsPanel.contains(e.target) && !document.getElementById('settings-btn').contains(e.target)) {
      settingsPanel.classList.add('hidden');
    }
    if (!keyPanel.contains(e.target) && !document.getElementById('key-btn').contains(e.target) && !document.getElementById('key-status').contains(e.target)) {
      keyPanel.classList.add('hidden');
    }
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

init();
