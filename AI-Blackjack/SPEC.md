# AI Blackjack Agent — Project Spec

## Overview

A browser-based blackjack game powered by an OpenAI AI agent that observes the game state and either **recommends** or **autonomously executes** actions on the player's behalf. The agent handles bet sizing, hand decisions (hit, stand, double down, split, surrender), and provides real-time reasoning for every choice.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Vanilla HTML/CSS/JS (single `index.html` or multi-file) |
| AI Agent | OpenAI Chat Completions API with tool/function calling |
| API Key | `.env` file upload **or** in-app paste input |
| Styling | Dark terminal/hacker aesthetic — see Visual Design section |

---

## Project Structure

```
blackjack-agent/
├── index.html
├── style.css
├── main.js              # Game loop, UI, event handling
├── agent.js             # OpenAI agent logic, tool definitions, decision loop
├── deck.js              # Deck, card, hand value utilities
├── strategy.js          # Basic strategy lookup table (offline fallback)
├── .env.example         # Template showing OPENAI_API_KEY=sk-...
└── SPEC.md
```

---

## API Key Handling

### Two entry methods (user chooses either)

**Method 1 — Upload `.env` file**
- A drag-and-drop zone or "Upload .env" button in the key panel
- User selects their local `.env` file via the browser file picker (`<input type="file">`)
- The file is read client-side with `FileReader`, parsed line by line for `OPENAI_API_KEY=...`
- The key is extracted and stored in `sessionStorage` only — the file itself is never sent anywhere
- This works with `file://`, `localhost`, or any hosted URL — no server required
- If the file is uploaded but no `OPENAI_API_KEY` line is found, show an inline error: "Could not find OPENAI_API_KEY in this file"

**Method 2 — Paste key directly**
- Password-type input field (masked by default, toggle-to-reveal eye icon)
- "Save for session" button stores in `sessionStorage` only, never `localStorage`

### Priority order on load
1. Check `sessionStorage` for a key from the current session
2. Otherwise show the key panel and prompt the user to upload or paste

### UI for key panel
- Collapsible panel accessible via a 🔑 button in the top-right corner
- Status indicator: 🔴 No key / 🟡 Key entered (unverified) / 🟢 Verified (after first successful API call)
- "Clear key" button wipes `sessionStorage` and resets status to 🔴
- `.env.example` included in repo with the expected format

---

## Agent Mode Toggle

A prominent toggle switch in the UI with two modes:

| Mode | Label | Behavior |
|---|---|---|
| Advisor | `ADVISOR MODE` | Agent analyzes the game state and displays a recommendation panel. Player clicks buttons to act. |
| Autopilot | `AUTOPILOT MODE` | Agent takes actions automatically with a configurable delay between steps (default 1.5s). Player just watches. |

- The toggle should be visually distinct — green glow when Autopilot is active
- In Autopilot mode a **Pause** button appears to let the player regain control at any time
- Switching modes mid-hand is allowed but only takes effect at the start of the next action (never interrupts mid-action)
- In Autopilot mode, a **bet confirmation threshold** can be set in Settings (e.g., "Confirm bets over $100") — if the agent recommends above this threshold, Autopilot pauses and waits for a manual click before placing the bet

---

## Game Features

### Core Blackjack Rules
- Standard 6-deck shoe (configurable), reshuffled when ~25% of cards remain
- Dealer hits on soft 17 (configurable)
- Blackjack pays 3:2
- **Pushes (ties)**: bet is returned to player, no win/loss recorded, commentary tool is skipped
- Player actions: **Hit**, **Stand**, **Double Down**, **Split** (matching rank), **Surrender** (early — first two cards only, before any hits)
- Insurance offered when dealer shows Ace

### Soft Hand Recognition
The game and agent must correctly distinguish soft hands from hard hands:
- A+6 = soft 17 (not hard 17) — entirely different decision from hard 17
- Hand value display shows both totals for soft hands: e.g. "7/17"
- The agent payload must explicitly include `isSoft: true/false` so the model reasons correctly
- The dealer's soft 17 rule is applied correctly per the configured setting

### Split Rules
- Split allowed on any two cards of matching rank (10-value cards may be split together, e.g., K-Q)
- **Re-splitting**: allowed up to 3 times (max 4 hands total), except Aces
- **Split Aces**: each Ace receives exactly one additional card — no further hitting, doubling, or re-splitting
- **Double after split**: configurable (default on)
- **Surrender after split**: not allowed
- A blackjack resulting from a split pays even money (1:1), not 3:2
- `availableActions` in the agent payload must always reflect what is actually legal for the current hand and state — the agent should never be offered an action it cannot take

### Bankroll & End State
- Starting bankroll: configurable (default $1,000)
- Minimum bet: $5 / Maximum bet: $500
- Chip denominations: $5, $10, $25, $50, $100
- Agent bet recommendations are always clamped to `Math.min(recommendedBet, bankroll)` client-side
- **Bankroll floor**: if bankroll drops below $5 (minimum bet), trigger Game Over
  - Show a "Game Over" overlay with session summary stats (hands played, win rate, peak bankroll)
  - Offer a "Rebuy" button that resets bankroll to the configured starting amount
  - A dialog asks: "Reset hand history and count?" — player chooses yes or no

### Game State Tracked
```js
gameState = {
  shoe: [...],                  // remaining cards
  playerHands: [[...]],         // array of hands (supports splits)
  playerHandBets: [...],        // parallel array — bet on each hand
  activeHandIndex: 0,
  dealerHand: [...],
  dealerHoleCardHidden: true,
  bankroll: 1000,
  currentBet: 0,
  phase: 'betting' | 'player_turn' | 'dealer_turn' | 'result',
  runningCount: 0,              // Hi-Lo running count
  trueCount: 0,                 // runningCount / decksRemaining
  decksRemaining: 6,
  shoeSize: 6,                  // configured deck count
  cardsSeen: 0,                 // for penetration %
  handHistory: [...],           // last 10 hands (see format below)
  sessionStats: {
    handsPlayed: 0,
    handsWon: 0,
    handsLost: 0,
    handsPushed: 0,
    blackjacks: 0,
    peakBankroll: 1000,
    agentDeviations: 0,         // times agent deviated from basic strategy
    fallbacks: 0                // times basic strategy fallback was used
  }
}
```

### Hand History Format
Keep the last 10 hands — enough context for the agent without bloating the API payload:
```js
{
  playerHand: ["A♠", "6♥"],
  handTotal: 17,
  isSoft: true,
  dealerUpcard: "10♦",
  dealerFinalHand: ["10♦", "7♣"],
  actions: ["hit", "stand"],
  outcome: "loss",              // win | loss | push | blackjack | surrender | bust
  bet: 50,
  netResult: -50,               // dollars won (positive) or lost (negative); surrender = -half bet
  trueCountAtStart: 1.8
}
```

---

## AI Agent — OpenAI Function Calling

The agent is called at three points per hand:
1. **Before betting** — recommend bet size
2. **Insurance decision** — if dealer shows Ace
3. **Each player decision point** — once per action in the player turn loop

### Model Selection
- Default: `gpt-4o`
- Option: `gpt-4o-mini` — available in settings dropdown, but display a ⚠️ label: *"gpt-4o-mini may produce less accurate card counting math and strategy deviations. Recommended for testing only."*

### System Prompt (full — use in `agent.js`)

```
You are an expert blackjack AI agent with deep knowledge of basic strategy and Hi-Lo card counting.

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
- True count 1–2:   2–4 units
- True count 3–4:   6–8 units
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
- Always populate the alternative field so the caller has a backup
```

### Tool / Function Definitions

```js
const agentTools = [
  {
    name: "recommend_bet",
    description: "Recommend a bet size for the upcoming hand based on count and bankroll.",
    parameters: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Recommended bet in dollars — already clamped to bankroll by caller"
        },
        reasoning: { type: "string", description: "Brief explanation (1-2 sentences)" },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        count_assessment: {
          type: "string",
          description: "Current count situation, e.g. 'Shoe is hot, +4 true count'"
        }
      },
      required: ["amount", "reasoning", "confidence"]
    }
  },
  {
    name: "recommend_action",
    description: "Recommend or execute a player action during their turn.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["hit", "stand", "double_down", "split", "surrender", "insurance_yes", "insurance_no"]
        },
        reasoning: { type: "string", description: "Brief explanation (1-2 sentences)" },
        alternative: {
          type: "string",
          enum: ["hit", "stand", "double_down", "split", "surrender"],
          description: "Second-best action if primary is unavailable"
        },
        basic_strategy_play: {
          type: "string",
          description: "What pure basic strategy says — only populate when deviating due to count"
        },
        is_count_deviation: {
          type: "boolean",
          description: "True if this decision deviates from basic strategy due to the count"
        }
      },
      required: ["action", "reasoning", "alternative"]
    }
  },
  {
    name: "commentary",
    description: "Commentary on the hand outcome — called after result is determined. Skip on pushes.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "1-3 sentences" },
        tone: { type: "string", enum: ["neutral", "celebratory", "cautionary", "analytical"] }
      },
      required: ["message", "tone"]
    }
  }
]
```

### Agent Call Payload (example — player turn)

```js
{
  model: "gpt-4o",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        phase: "player_turn",
        playerHand: ["A♠", "6♥"],
        handTotal: 17,
        isSoft: true,
        dealerUpcard: "10♦",
        availableActions: ["hit", "stand", "double_down"],
        canSplit: false,
        isFirstTwoCards: true,
        isResplitHand: false,
        isSplitAce: false,        // if true, no further actions allowed anyway
        runningCount: 3,
        trueCount: 1.8,
        decksRemaining: 1.7,
        bankroll: 845,
        currentBet: 50,
        handHistory: [...last10hands]
      })
    }
  ],
  tools: agentTools,
  tool_choice: "required"
}
```

### Fallback Action Resolution
Validate every agent response before executing:
```
1. Is action in availableActions? → execute it
2. No → is alternative in availableActions? → execute alternative, log to console
3. No → look up basic strategy table (strategy.js) → execute that, increment sessionStats.fallbacks
```

---

## Basic Strategy Lookup Table (`strategy.js`)

Used as the offline fallback and optionally surfaced as a "hint" label in the UI alongside agent recommendations.

```js
// Three separate tables
const hardTotals = { ... }   // player hard 5–21 vs dealer 2–A
const softTotals = { ... }   // A+2 through A+9 vs dealer 2–A
const pairSplits = { ... }   // 2-2 through A-A vs dealer 2–A

function getBasicStrategyAction(hand, dealerUpcard, availableActions, rules) {
  // rules = { allowSurrender, allowDoubleAfterSplit, dealerHitsSoft17, numDecks }
  // Returns: 'hit' | 'stand' | 'double_down' | 'split' | 'surrender'
  // If optimal action not in availableActions, return next-best action
}
```

Implement per the standard Wizard of Odds basic strategy charts for the active rule configuration. The table must handle soft hands, pairs, and hard totals separately, and must adjust for whether surrender and double-after-split are permitted.

---

## Visual Design

### Aesthetic — Dark Terminal / Hacker
Consistent with the review generator and science experiment generator projects. Key characteristics:

- **Background**: near-black (`#0a0a0a` or similar), not dark green felt — this is a terminal, not a casino floor
- **Typography**: monospace font throughout (e.g. `JetBrains Mono`, `Fira Code`, or `IBM Plex Mono`) — ranks, suits, counts, labels, agent text, everything
- **Accent color**: a single muted neon — dim cyan (`#00d4aa` range) or amber (`#f0a500` range) for highlights, recommended actions, and key UI elements. Not bright, not gaudy — like a terminal cursor
- **Borders**: thin `1px` lines in a low-opacity version of the accent color — give structure without heaviness
- **Texture**: subtle scanline overlay or noise grain on the background (CSS only, low opacity) — adds depth without clutter
- **No gradients**: flat surfaces only. Depth comes from borders and opacity, not shadows or glows
- **Card backs**: dark surface with a geometric pattern (e.g. thin grid or dot matrix) in the accent color at low opacity

### Cards
- Styled `<div>` elements, not images
- Dark card face (`#111` or `#141414`), thin accent-colored border
- Rank in top-left, suit symbol centered or bottom-right
- Suit colors: red suits (♥ ♦) in a muted terminal red (`#c0392b` range), black suits (♠ ♣) in off-white or light gray (`#ccc`)
- Soft hand totals shown as "7/17" — both values, monospace, no decoration
- Hole card: same dark back, geometric pattern. CSS 3D flip animation on reveal (rotateY 180°, ~300ms)
- Split hands: displayed side by side with a thin accent border on the active hand; inactive hands dimmed slightly

### Layout — Top to Bottom

```
┌──────────────────────────────────────────────────────┐
│  BLACKJACK_AGENT.exe    [ADVISOR ○──● AUTOPILOT]     │
│  $1,000.00              RC: +3   TC: +1.8   [⚙] [🔑] │
│  SHOE ████████░░ 72%                                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│   DEALER    [▓▓▓][10♦]   ?                          │
│                                                      │
│   PLAYER    [A♠][6♥]    7/17  soft                  │
│                                                      │
│   [$5][$10][$25][$50][$100]  BET: $50  [DEAL]       │
│                                                      │
├──────────────────────────────────────────────────────┤
│  > AGENT                                             │
│  ┌────────────────────────────────────────────────┐  │
│  │ ACTION: HIT          CONFIDENCE: HIGH          │  │
│  │ "Soft 17 vs 10 — always hit. Can't bust and   │  │
│  │  standing here concedes too much edge."        │  │
│  │ BS: HIT   DEVIATION: NO   ████████░░ 1.5s     │  │
│  └────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│  [HIT]  [STAND]  [DOUBLE]  [SPLIT──]  [SURR──]      │
│   ^recommended   ──= unavailable (dimmed)            │
└──────────────────────────────────────────────────────┘
```

---

## UI Components

### Header Bar
- App title in monospace, styled like a terminal process name: `BLACKJACK_AGENT.exe` or `> blackjack`
- Bankroll displayed as a fixed-width number that ticks up/down with a brief CSS transition on change
- Mode toggle: pill-style, accent color on active side, muted on inactive
- RC / TC values inline in the header — always visible, update in real time
- ⚙ and 🔑 as small icon buttons in top-right corner

### Shoe / Penetration Bar
- Thin full-width progress bar below the header
- Filled portion in accent color, empty portion in dark gray
- Percentage label inline: `SHOE 72%`
- When shoe drops below 25% and reshuffles, brief flash animation on the bar

### Table Area (middle zone)
- No felt texture — just the dark background with subtle scanlines
- Dealer row and player row clearly labeled in small monospace caps (`DEALER`, `PLAYER`)
- Cards laid out horizontally left to right as they're dealt, each with a brief slide-in animation
- Hand total displayed to the right of the cards, updates live as cards are added
- Result badge appears centered over the player hand on hand end: `WIN`, `LOSS`, `BUST`, `PUSH`, `BLACKJACK`, `SURRENDER` — styled as a terminal status tag (bordered, accent or red colored). Stays for ~1.5s then fades out and cards clear

### Chip Tray & Betting
- Compact single row of five chip buttons: `$5` `$10` `$25` `$50` `$100`
- Chips styled as small bordered squares/circles in monospace, not realistic chip graphics
- Agent's recommended bet amount shown as a dim label above the tray: `> AGENT SUGGESTS $50`
- Current bet shown as `BET: $50` inline
- `[DEAL]` button to the right — becomes `[NEXT]` between hands
- `[CLEAR]` appears only when bet > 0
- Tray is hidden during the player turn and dealer turn phases — only shown during betting phase

### Agent Panel
- Located directly below the table, above the action buttons
- Prefixed with `> AGENT` in the terminal style
- Single card view — each new decision replaces the previous one entirely (no scrolling log)
- Card contains: action badge (e.g. `ACTION: HIT`), confidence tag, agent's reasoning text in quotes, basic strategy comparison, count deviation flag, and Autopilot countdown bar
- Countdown bar is a thin progress bar that depletes over the action delay duration — when it hits zero the action fires
- While waiting for API response: the card shows `> QUERYING AGENT...` with a blinking cursor animation
- On API error: card shows error message in muted red with a retry or fallback notice

### Action Buttons
- Five buttons always rendered: `HIT`, `STAND`, `DOUBLE`, `SPLIT`, `SURR`
- Unavailable actions: same size and position, but dimmed opacity (~30%) and `──` appended to label — they do not disappear, do not reorder
- Agent's recommended action: accent-colored border, slightly brighter text
- In Autopilot mode: buttons are all dimmed and non-interactive (they show what the agent picked but cannot be clicked)
- Keyboard shortcuts always active in Advisor mode: `H` `S` `D` `P` `X` for each action, `Space` to deal

---

## Card Counting Display

Shown by default — visible inline in the header bar (RC and TC) plus an optional expanded panel toggled via Settings.

| Field | Description |
|---|---|
| Running Count | Raw Hi-Lo: +1 for 2–6, 0 for 7–9, −1 for 10–A |
| Decks Remaining | `(totalCards − cardsSeen) / 52`, 1 decimal |
| True Count | `runningCount / decksRemaining`, 1 decimal |
| Shoe Penetration | Progress bar in header — `cardsSeen / totalCards` |
| Count Indicator | RC value colored: muted red (≤ −2), gray (−1 to +1), accent green (≥ +2) |

Count updates in real time as each card is revealed, including the dealer hole card on flip. The RC value in the header briefly pulses on each update.

---

## Hand End Sequence

1. Dealer hole card flips (CSS 3D rotation, ~300ms), count updates
2. Dealer draws cards one at a time if needed, each with a ~400ms delay
3. Result determined for each player hand
4. Result badge renders over each hand: `WIN` / `LOSS` / `BUST` / `PUSH` / `BLACKJACK` / `SURRENDER`
5. Bankroll number ticks up or down with a CSS transition (~500ms)
6. Agent commentary appears in the agent panel (replaces the last action card)
7. After ~1.5s: result badges fade out, cards slide off or fade, table resets to betting phase
8. Chip tray reappears, `> AGENT SUGGESTS $XX` label updates for the next hand

---

## Autopilot Mode — Execution Flow

```
1.  Hand starts
2.  Agent called → recommend_bet
    └─ If bet > confirmation threshold → pause, wait for player click
    └─ Otherwise → place bet, start deal animation
3.  Cards dealt one at a time (animated), count updates per card
4.  If dealer upcard is Ace → agent called → insurance_yes / insurance_no
5.  Check for player blackjack → if blackjack, skip to step 8
6.  Player turn loop (repeated per split hand):
    a.  Build availableActions from current hand state and rules
    b.  Call agent → recommend_action (show spinner)
    c.  Display recommendation with countdown timer
    d.  Validate action → resolve fallback if needed
    e.  Execute action with animation, update count
    f.  If "hit" → check bust → if no bust, loop to (a)
    g.  If "stand" / "double" / "surrender" / bust → next hand or end player turn
7.  Dealer turn — rule-based, animated (no AI), hole card flips and count updates
8.  Determine result per hand, update bankroll
9.  If outcome is not a push → agent called → commentary
10. Check bankroll floor → if < $5 → show Game Over overlay
11. Otherwise → return to step 1
```

**API call management in Autopilot:**
- Every agent fetch uses `AbortController`
- If Pause is pressed mid-call: abort request, hold current game state — do not execute any action
- If API response takes longer than the countdown delay: extend the timer — never execute before response arrives
- Show spinner in agent panel while awaiting response

---

## Error Handling

| Error | Behavior |
|---|---|
| Invalid / expired API key | Error in agent panel, status → 🔴, prompt re-entry, pause Autopilot |
| Rate limit (HTTP 429) | Pause Autopilot, show "Rate limited — retrying in 5s" with countdown, retry once |
| Network error / timeout | Switch to offline mode: use basic strategy fallback, show "Offline mode" banner |
| Agent returns no tool call | Log to console, use basic strategy fallback, increment `sessionStats.fallbacks` |
| Agent recommends unavailable action | Use `alternative`; if also unavailable, use basic strategy fallback |
| Bankroll below minimum | Trigger Game Over overlay — do not deal another hand |
| `.env` upload parse failure | Inline error in key panel: "Could not find OPENAI_API_KEY in this file" |
| Split Aces receive illegal action | Ignore — Split Aces only ever receive one card each, no actions are offered |

---

## Settings Panel (collapsible via ⚙️)

| Setting | Default | Description |
|---|---|---|
| Number of decks | 6 | 1, 2, 4, 6, or 8 |
| Dealer hits soft 17 | On | Toggle |
| Allow surrender | On | Toggle |
| Allow double after split | On | Toggle |
| Allow re-splits | On | Up to 3 times (4 hands max), Aces excluded |
| Starting bankroll | $1,000 | Number input |
| Autopilot action delay | 1.5s | Slider 0.5s – 3s |
| Autopilot bet confirm threshold | $100 | Pause Autopilot above this bet size |
| Show card count panel | On | Toggle |
| AI model | gpt-4o | Dropdown (gpt-4o / gpt-4o-mini ⚠️) |
| Show basic strategy hint | Off | Display BS chart action alongside agent recommendation |
| Keyboard shortcuts | On | H/S/D/P/X + Space in Advisor mode |

---

## Stretch Goals

- **Session statistics panel**: hands played, win/loss/push breakdown, bankroll chart over time, agent vs basic strategy deviation frequency
- **Replay mode**: step through a completed hand move by move with agent annotations
- **Side bets**: Perfect Pairs and 21+3 — agent evaluates EV and advises
- **Multi-hand mode**: 2–3 hands simultaneously, agent manages all sequentially per hand
- **Voice readout**: Web Speech API reads agent decisions aloud
- **Export session log**: download JSON of all hands with agent reasoning, actions, outcomes, and counts
- **Basic strategy trainer mode**: hide agent recommendations, let player act, then grade each decision against basic strategy and reveal what the agent would have done

---

## Implementation Guide for Claude Code

### Hard constraints — do not deviate from these
- **No frameworks** — vanilla HTML, CSS, and JS only. No React, Vue, Svelte, or any component library
- **No `localStorage`** — API key goes in `sessionStorage` only, never persisted across browser sessions
- **No inline game logic in HTML** — `index.html` is markup only. All logic lives in the JS modules
- **No single-file dump** — do not consolidate everything into `main.js`. Respect the module boundaries below
- **No external libraries** — no jQuery, no lodash, no animation libraries. CSS animations and vanilla JS only
- **Serve via a local dev server** — recommend `npx serve .` or VS Code Live Server in the README. Do not instruct the user to open `index.html` directly as a `file://` URL

---

### Module boundaries — what each file owns

| File | Owns | Never touches |
|---|---|---|
| `deck.js` | Card creation, shoe generation, shuffling, hand value calculation (hard/soft), Hi-Lo count update | DOM, API, game state |
| `strategy.js` | Basic strategy lookup tables (hard, soft, pairs), `getBasicStrategyAction()` function | DOM, API, game state |
| `agent.js` | OpenAI API calls, tool definitions, system prompt, response parsing, fallback resolution | DOM, CSS, card rendering |
| `main.js` | Game state object, game loop, phase transitions, wiring deck/agent/strategy together, event listeners | Direct API calls (delegate to agent.js) |
| `style.css` | All visual styling, animations, card designs, terminal aesthetic | None |
| `index.html` | DOM structure, static markup, script/style imports | Logic of any kind |

`main.js` is the only file that imports from all others. `agent.js` and `strategy.js` are pure logic modules — they receive data as arguments and return results. They do not read from or write to `gameState` directly; `main.js` passes state in and applies results back.

---

### Build order — complete each milestone before moving to the next

**Milestone 1 — Core card logic (no UI)**
Build `deck.js` first and verify it independently in the browser console:
- `createShoe(numDecks)` returns a shuffled array of card objects `{ rank, suit, value, countValue }`
- `getHandValue(hand)` returns `{ total, isSoft }` correctly for all edge cases (soft aces, multiple aces, bust)
- `updateCount(card, state)` correctly increments/decrements running count and recalculates true count
- Test: deal 10 random hands and `console.log` the totals — verify soft hands, pairs, and bust detection are correct before proceeding

**Milestone 2 — Basic strategy table**
Build `strategy.js` and verify independently:
- Implement all three lookup tables: hard totals, soft totals, pairs
- `getBasicStrategyAction(hand, dealerUpcard, availableActions, rules)` returns a valid action for every combination
- Test: run the 10 most common hand/upcard combos through the function and verify against a known basic strategy chart

**Milestone 3 — Agent wrapper**
Build `agent.js`:
- `callAgent(phase, gameState)` constructs the correct payload and returns a parsed tool call result
- Handle all three tool types: `recommend_bet`, `recommend_action`, `commentary`
- Implement fallback resolution: agent action → alternative → basic strategy
- Test with a hardcoded game state before any UI exists — log the raw API response and parsed result to confirm tool calling works

**Milestone 4 — Game loop (no styling)**
Build `main.js` with a minimal functional game loop:
- All phases working: betting → deal → player turn → dealer turn → result → repeat
- Correct handling of splits, soft hands, blackjack, bust, and push
- Agent called at the right moments, results applied correctly
- Keyboard shortcuts wired up
- At this point the game should be fully playable in an unstyled state — ugly but correct

**Milestone 5 — UI and styling**
Only after Milestone 4 is verified working:
- Build `style.css` with the full terminal aesthetic
- Add card animations (deal slide-in, hole card flip)
- Add agent panel with countdown timer
- Add result badges and bankroll tick animation
- Add chip tray, mode toggle, settings panel, key panel
- Add shoe penetration bar and count display

---

### Key implementation notes

**Hand value calculation** — the trickiest part of `deck.js`. Aces must be handled iteratively:
```js
function getHandValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += card.value; // Ace starts as 11
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10; // flip Ace from 11 to 1
    aces--;
  }
  return { total, isSoft: aces > 0 && total <= 21 };
}
```

**`availableActions` must be computed fresh before every agent call** — never cache it. It depends on: current phase, number of cards in hand, whether it's the first two cards, bankroll vs bet (for double), matching ranks (for split), number of existing split hands, whether the hand is a split Ace.

**Agent panel replace behavior** — do not use a scrolling list. The panel has one slot. Each new agent response overwrites the previous content entirely. Use `innerHTML` replacement or a single bound DOM element updated in place.

**CSS flip animation for hole card** — use `transform: rotateY(180deg)` on a card with two faces (front and back as child elements with `backface-visibility: hidden`). Trigger by toggling a `.revealed` class. Do not use JS animation libraries.

**Autopilot countdown bar** — implement as a CSS `transition` on `width` from 100% to 0% over the configured delay duration. Start the transition after the agent response arrives, not before. Use `setTimeout` to fire the action when the transition ends.

**`AbortController` pattern for Autopilot pause**:
```js
let currentAbortController = null;

async function callAgentWithAbort(phase, gameState) {
  currentAbortController = new AbortController();
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      signal: currentAbortController.signal,
      // ...
    });
    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError') return null; // paused — do nothing
    throw err;
  }
}

function pauseAutopilot() {
  if (currentAbortController) currentAbortController.abort();
  // hold game state as-is — do not advance phase
}
```

**True count calculation** — always recalculate on the fly, never cache:
```js
const decksRemaining = (gameState.shoe.length) / 52;
const trueCount = decksRemaining > 0
  ? Math.round((gameState.runningCount / decksRemaining) * 10) / 10
  : 0;
```

**Game Over check** — run after every bankroll update, before starting a new hand. Never attempt to deal if `bankroll < 5`.
