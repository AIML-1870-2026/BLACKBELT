import { getBasicStrategyAction } from './strategy.js';
import { getHandValue, getCardDisplay } from './deck.js';

const SYSTEM_PROMPT = `You are an expert blackjack AI agent with deep knowledge of basic strategy and Hi-Lo card counting.

DECISION FRAMEWORK:
1. Start from the basic strategy play for the given hand vs dealer upcard
2. Apply Illustrious 18 deviations when the true count justifies it
3. Communicate your decision exclusively through the provided tools — never output raw text

SOFT HAND AWARENESS:
- Always check isSoft before evaluating a player hand total
- Soft 17 (A+6) and hard 17 require completely different decisions
- Soft hands have more flexibility — factor this into hit/stand/double decisions

BET SIZING (Kelly-lite, 1 unit = $5):
- True count <= 0:  1 unit (minimum bet)
- True count 1-2:   2-4 units
- True count 3-4:   6-8 units
- True count 5+:    max allowed (table or bankroll limit)
- Never recommend more than 20% of current bankroll on a single hand
- Always clamp recommendation to available bankroll

SPLIT RULES:
- Always split Aces and 8s
- Never split 10s or 5s
- Never recommend re-splitting Aces
- Only recommend split if "split" appears in availableActions

INSURANCE:
- Recommend yes only when true count >= +3
- Otherwise always decline

FALLBACK:
- If uncertain, default to basic strategy and note this in your reasoning
- Always populate the alternative field so the caller has a backup`;

const agentTools = [
  {
    type: 'function',
    function: {
      name: 'recommend_bet',
      description: 'Recommend a bet size for the upcoming hand based on count and bankroll.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Recommended bet in dollars' },
          reasoning: { type: 'string', description: 'Brief explanation (1-2 sentences)' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          count_assessment: { type: 'string', description: 'Current count situation' }
        },
        required: ['amount', 'reasoning', 'confidence']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'recommend_action',
      description: 'Recommend or execute a player action during their turn.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['hit', 'stand', 'double_down', 'split', 'surrender', 'insurance_yes', 'insurance_no'] },
          reasoning: { type: 'string', description: 'Brief explanation (1-2 sentences)' },
          alternative: { type: 'string', enum: ['hit', 'stand', 'double_down', 'split', 'surrender'] },
          basic_strategy_play: { type: 'string', description: 'What pure basic strategy says — only populate when deviating due to count' },
          is_count_deviation: { type: 'boolean', description: 'True if deviating from basic strategy due to the count' }
        },
        required: ['action', 'reasoning', 'alternative']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'commentary',
      description: 'Commentary on the hand outcome — called after result is determined. Skip on pushes.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: '1-3 sentences' },
          tone: { type: 'string', enum: ['neutral', 'celebratory', 'cautionary', 'analytical'] }
        },
        required: ['message', 'tone']
      }
    }
  }
];

function buildBetPayload(gameState, model) {
  return {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          phase: 'betting',
          runningCount: gameState.runningCount,
          trueCount: gameState.trueCount,
          decksRemaining: Math.round(gameState.decksRemaining * 10) / 10,
          bankroll: gameState.bankroll,
          minBet: 5,
          maxBet: Math.min(500, gameState.bankroll),
          handHistory: gameState.handHistory.slice(-10)
        })
      }
    ],
    tools: agentTools,
    tool_choice: { type: 'function', function: { name: 'recommend_bet' } }
  };
}

function buildActionPayload(gameState, hand, dealerUpcard, availableActions, isFirstTwoCards, isResplitHand, isSplitAce, model) {
  const { total, isSoft } = getHandValue(hand);
  return {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          phase: 'player_turn',
          playerHand: hand.map(getCardDisplay),
          handTotal: total,
          isSoft,
          dealerUpcard: getCardDisplay(dealerUpcard),
          availableActions,
          canSplit: availableActions.includes('split'),
          isFirstTwoCards,
          isResplitHand,
          isSplitAce,
          runningCount: gameState.runningCount,
          trueCount: gameState.trueCount,
          decksRemaining: Math.round(gameState.decksRemaining * 10) / 10,
          bankroll: gameState.bankroll,
          currentBet: gameState.playerHandBets[gameState.activeHandIndex],
          handHistory: gameState.handHistory.slice(-10)
        })
      }
    ],
    tools: agentTools,
    tool_choice: { type: 'function', function: { name: 'recommend_action' } }
  };
}

function buildInsurancePayload(gameState, model) {
  return {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          phase: 'insurance',
          dealerUpcard: 'A',
          runningCount: gameState.runningCount,
          trueCount: gameState.trueCount,
          decksRemaining: Math.round(gameState.decksRemaining * 10) / 10,
          bankroll: gameState.bankroll,
          currentBet: gameState.playerHandBets[0]
        })
      }
    ],
    tools: agentTools,
    tool_choice: { type: 'function', function: { name: 'recommend_action' } }
  };
}

function buildCommentaryPayload(gameState, outcome, netResult, model) {
  const activeHand = gameState.playerHands[0];
  const { total, isSoft } = getHandValue(activeHand);
  return {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          phase: 'commentary',
          outcome,
          netResult,
          playerHand: activeHand.map(getCardDisplay),
          handTotal: total,
          isSoft,
          dealerHand: gameState.dealerHand.map(getCardDisplay),
          bankroll: gameState.bankroll,
          trueCount: gameState.trueCount
        })
      }
    ],
    tools: agentTools,
    tool_choice: { type: 'function', function: { name: 'commentary' } }
  };
}

async function fetchAgent(payload, apiKey, signal) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const status = response.status;
    const error = new Error(err.error?.message || `HTTP ${status}`);
    error.status = status;
    throw error;
  }

  return response.json();
}

function parseToolCall(response) {
  const msg = response.choices?.[0]?.message;
  if (!msg?.tool_calls?.length) return null;
  const tc = msg.tool_calls[0];
  return {
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments)
  };
}

export function resolveAgentAction(agentResult, availableActions, gameState, settings) {
  if (!agentResult) {
    return fallbackToBS(gameState, availableActions, settings);
  }

  const action = agentResult.args?.action;
  if (action && availableActions.includes(action)) {
    return action;
  }

  const alt = agentResult.args?.alternative;
  if (alt && availableActions.includes(alt)) {
    console.warn(`Agent primary action "${action}" unavailable — using alternative "${alt}"`);
    return alt;
  }

  console.warn('Agent action and alternative both unavailable — falling back to basic strategy');
  gameState.sessionStats.fallbacks++;
  return fallbackToBS(gameState, availableActions, settings);
}

function fallbackToBS(gameState, availableActions, settings) {
  const hand = gameState.playerHands[gameState.activeHandIndex];
  const dealerUpcard = gameState.dealerHand[0];
  const rules = {
    allowSurrender: settings.allowSurrender,
    allowDoubleAfterSplit: settings.allowDoubleAfterSplit,
    dealerHitsSoft17: settings.dealerHitsSoft17,
    numDecks: settings.numDecks
  };
  return getBasicStrategyAction(hand, dealerUpcard.rank, availableActions, rules);
}

export async function callAgentBet(gameState, apiKey, model, signal) {
  const payload = buildBetPayload(gameState, model);
  try {
    const response = await fetchAgent(payload, apiKey, signal);
    return parseToolCall(response);
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export async function callAgentAction(gameState, hand, dealerUpcard, availableActions, isFirstTwoCards, isResplitHand, isSplitAce, apiKey, model, signal) {
  const payload = buildActionPayload(gameState, hand, dealerUpcard, availableActions, isFirstTwoCards, isResplitHand, isSplitAce, model);
  try {
    const response = await fetchAgent(payload, apiKey, signal);
    return parseToolCall(response);
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export async function callAgentInsurance(gameState, apiKey, model, signal) {
  const payload = buildInsurancePayload(gameState, model);
  try {
    const response = await fetchAgent(payload, apiKey, signal);
    return parseToolCall(response);
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export async function callAgentCommentary(gameState, outcome, netResult, apiKey, model, signal) {
  const payload = buildCommentaryPayload(gameState, outcome, netResult, model);
  try {
    const response = await fetchAgent(payload, apiKey, signal);
    return parseToolCall(response);
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}
