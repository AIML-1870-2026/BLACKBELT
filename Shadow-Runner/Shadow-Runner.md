# 🥷 Shadow Runner — Game Specification

## Overview
A side-scrolling endless runner with a dark feudal Japan aesthetic. The player controls a ninja sprinting across rooftops, jumping over ground spikes, ducking under projectiles, collecting stars, and engaging enemies in quick combo-based combat. Difficulty comes entirely from increasingly complex obstacle patterns — not speed. World scroll speed stays constant throughout, giving the player room to focus on pattern recognition and execution. One life — instant death on failure.

---

## File Structure
```
index.html       — Game canvas, HUD layout, screen overlays
style.css        — Visual theme, animations, UI styling
game.js          — All game logic, input handling, entity management
```

---

## Visual Theme

**Aesthetic**: Dark feudal Japan — ink-wash silhouettes, layered parallax mountains, paper lanterns, moonlit sky, cherry blossom particles.

**Color Palette**:
- Background: `#0a0a0f` (near-black night sky)
- Midground: `#1a1025` (dark purple-grey mountains)
- Ground: `#1c1008` (dark earth)
- Accent: `#c0392b` (blood red — danger, enemy highlights)
- Gold: `#f0c040` (collectibles, score)
- White/silver: `#e8e8f0` (ninja character, UI text)
- Muted teal: `#2a4a5a` (subtle environment details)

**Typography**: Google Fonts — `Cinzel` (display/headings) + `Noto Serif` (body/HUD)

**Background Layers (Parallax)**:
1. Deep sky with moon and stars (slowest scroll)
2. Distant mountain silhouettes
3. Mid-ground pagoda/treeline silhouettes
4. Near-ground rooftop tiles (fastest background layer)
5. Ground platform the ninja runs on

**Ambient Effects**:
- Falling cherry blossom petals (Canvas particle system)
- Subtle fog/mist layer across mid-ground
- Player leaves a faint motion blur trail when running

---

## Player Character

**Appearance**: Silhouette ninja in white/silver, black gi, scarf trailing behind. Drawn programmatically via Canvas 2D API — no image assets required.

**States**:
- `running` — default looping animation (4-frame cycle)
- `jumping` — arched body, scarf trails upward
- `ducking` — crouched low, scarf flat
- `attacking` — forward punch/kick stance during combat
- `dead` — crumple animation, fade out

**Position**: Fixed at x = 15% of canvas width. Vertical position changes on jump/duck.

---

## Controls

| Action | Key |
|--------|-----|
| Jump | `Space` or `↑` |
| Duck | `Shift` (hold) |
| Combat input | `A`, `S`, `D`, `F` |
| Start / Restart | `Enter` |
| Pause | `Escape` |

---

## Core Mechanics

### 1. Running & Scrolling
- The world scrolls right-to-left at a **constant speed** of 400px/sec.
- Speed **never increases** — difficulty comes entirely from obstacle pattern complexity.
- Ground platform is a flat continuous surface at the bottom of the canvas.

### 2. Jumping
- Single jump — fixed height impulse on `Space`/`↑` while grounded.
- No double jump.
- Gravity pulls the player back down at a constant rate.
- Cannot jump while ducking or during a combat encounter.

### 3. Ducking
- Press and hold `Shift` to duck.
- Reduces player hitbox height by 60%.
- Used to dodge aerial projectiles (shurikens, arrows) flying at mid or head height.
- Cannot duck while airborne.

### 4. Obstacle Types

#### Ground Spikes
- Spike clusters anchored to the ground. Must be jumped over.
- 3 size variants: small (1 spike), medium (2–3 spikes), wide (4–5 spikes).
- Touching = instant death.

#### Aerial Projectiles
- Shurikens or arrows flying horizontally at mid or head height. Must be ducked under.
- Fly at two heights: mid (duck required) and low (jump clears them too).
- Touching = instant death.

#### Floating Platforms *(unlocked at score 300)*
- Elevated platforms the player can land on.
- Used in patterns that require jumping up to avoid ground hazards below.
- Some have spike tops — landing on a spiked platform = instant death.
- Always positioned at a height reachable by a single jump.

---

## Obstacle Pattern System

### Design Philosophy
All obstacles are delivered in **pre-authored pattern chunks** — short, self-contained sequences (roughly 3–6 seconds long) that are individually guaranteed to be solvable. The game randomly selects from a pool of available chunks based on the current difficulty tier. A **mandatory safe gap** (at least 1.5 seconds of clear ground) is always inserted between chunks so two chunks never accidentally merge into something impossible.

### Guaranteed Solvability Rules
- Every chunk has been designed and verified to be clearable at the constant scroll speed.
- No chunk requires frame-perfect timing — all action windows have at least 0.4 seconds of margin.
- Chunks are never concatenated back-to-back without a safe gap.
- Floating platforms are always reachable by a standard jump from the ground.

### Pattern Chunk Library

#### Tier 1 — Beginner (score 0–99)
| Chunk | Description |
|-------|-------------|
| `T1-A` | Single small spike, wide gap after |
| `T1-B` | Single mid-height projectile, wide gap after |
| `T1-C` | Two small spikes with a large gap between them |
| `T1-D` | Single medium spike |
| `T1-E` | Star cluster at jump height (reward chunk, no hazards) |

#### Tier 2 — Intermediate (score 100–299)
| Chunk | Description |
|-------|-------------|
| `T2-A` | Medium spike → projectile (jump then duck) |
| `T2-B` | Two medium spikes with a tight but fair gap |
| `T2-C` | Projectile → small spike (duck then jump) |
| `T2-D` | Wide spike cluster (requires full jump arc) |
| `T2-E` | Two projectiles in a row |
| `T2-F` | Small spike → star at jump height (jump clears both) |

#### Tier 3 — Advanced (score 300–599)
| Chunk | Description |
|-------|-------------|
| `T3-A` | Jump onto platform → jump off over ground spike below |
| `T3-B` | Spike → projectile → spike (jump, duck, jump sequence) |
| `T3-C` | Platform with spiked top beside ground spikes (must clear both) |
| `T3-D` | Rapid spike → projectile with minimal gap |
| `T3-E` | Three projectiles at alternating heights |
| `T3-F` | Wide spike → immediate projectile on landing (tight timing) |

#### Tier 4 — Expert (score 600–999)
| Chunk | Description |
|-------|-------------|
| `T4-A` | Spike gauntlet: small → medium → small in quick succession |
| `T4-B` | Platform hop: two elevated platforms with spike floors beneath |
| `T4-C` | Projectile volley (3 in a row) → spike on landing |
| `T4-D` | Spiked platform forcing jump-over rather than landing |
| `T4-E` | Jump → duck mid-air (projectile at head height while airborne) |
| `T4-F` | Complex: spike → platform jump → projectile on descent |

#### Tier 5 — Master (score 1000+)
| Chunk | Description |
|-------|-------------|
| `T5-A` | Full gauntlet: spike → volley → platform → spike |
| `T5-B` | Staggered projectiles at multiple heights: duck-jump-duck |
| `T5-C` | Platform chain (3 platforms) with ground spikes and aerial hazards |
| `T5-D` | Dense spike field with one precise jump window |
| `T5-E` | Everything: spike cluster → projectile volley → spiked platform |

### Difficulty Tier Unlocks
| Score Reached | New Chunk Pool Added |
|--------------|---------------------|
| 0 | Tier 1 only |
| 100 | + Tier 2 |
| 300 | + Tier 3 (platforms introduced) |
| 600 | + Tier 4 |
| 1000 | + Tier 5 |

Once a new tier unlocks, the game gradually increases the **proportion** of harder chunks selected, while still occasionally mixing in easier ones for pacing variety. The chunk scheduler also reduces the safe gap duration slightly at higher tiers (from 1.5s down to 1.0s minimum) to increase intensity without compromising fairness.

---

## Combat Encounters

### Trigger
- Regular enemies appear at random score intervals (roughly every 50–80 points earned).
- Boss enemies appear at score milestones: 200, 500, 1000, and every 500 thereafter.
- When an enemy appears, the world **pauses** (scrolling stops) and combat mode activates.

### Combat Flow
1. Enemy slides in from the right and faces the player.
2. A combo prompt appears: a sequence of highlighted key icons (e.g., `A → S → D`).
3. A circular timer ring depletes. Time allowed scales with enemy type.
4. Player inputs the full sequence. Correct keys highlight green one by one.
5. **Success**: Enemy defeated. Score bonus added. World resumes. Death animation plays.
6. **Failure** (wrong key or timeout): Instant death. Game over.

### Combo Sequences

| Enemy Type | Sequence Length | Timer | Score Reward |
|------------|----------------|-------|--------------|
| Grunt | 3 keys | 3.0s | +25 |
| Warrior | 4 keys | 2.5s | +50 |
| Elite | 5 keys | 2.0s | +75 |
| Boss | 6–7 keys | 2.0s | +150 |
| Boss (hard, score 1000+) | 8 keys | 1.8s | +200 |

- Keys randomly chosen from `[A, S, D, F]` each encounter.
- Displayed as large styled button icons centered on screen.
- Wrong key = instant death.

### Enemy Type Unlock by Score
| Score | Enemy Pool |
|-------|-----------|
| 0–199 | Grunt only |
| 200–499 | Grunt, Warrior |
| 500–999 | Grunt, Warrior, Elite |
| 1000+ | All types; Bosses more frequent |

### Boss Visual Distinction
- Larger silhouette with glowing red eyes.
- Entrance: dramatic leap from right edge with brief screen flash.
- Defeat: slow-motion collapse with red particle burst.

---

## Collectibles

### Stars
- Floating gold star icons appearing mid-run at various heights.
- Collected by running or jumping through them.
- Always placed at reachable heights — never conflict with nearby obstacles.
- Worth +10 points each.
- Appear as part of reward chunks or occasionally standalone between pattern chunks.

---

## Scoring

| Event | Points |
|-------|--------|
| Survival (per second) | +1 |
| Star collected | +10 |
| Grunt defeated | +25 |
| Warrior defeated | +50 |
| Elite defeated | +75 |
| Boss defeated | +150 |
| Boss defeated (hard) | +200 |

- Score displayed top-right as a running total.
- High score persisted in `localStorage`.
- "NEW BEST" banner appears on game over if high score beaten.

---

## HUD (Heads-Up Display)

- **Top-left**: Current difficulty tier label (e.g., "TIER: INTERMEDIATE")
- **Top-center**: Combat combo keys (visible during encounters only)
- **Top-right**: Score / High Score
- **Bottom-center**: Combat timer ring (visible during encounters only)

---

## Game Screens

### Title Screen
- Parallax background animates behind the title.
- Game title: **"影走り — Shadow Runner"** in Cinzel font.
- High score shown if previously set.
- "Press Enter to begin."

### Game Over Screen
- Overlay fades in over the game canvas.
- "GAME OVER" in large Cinzel text.
- Final score + high score.
- Cause of death: "Struck by spike" / "Hit by projectile" / "Combat failed."
- "Press Enter to restart."

### Pause Screen
- `Escape` pauses during running only (not during combat).
- Darkened overlay, "PAUSED" text, "Press Escape to resume."

---

## Technical Notes

- Canvas via `<canvas>` in `index.html`, sized to full window.
- Game loop uses `requestAnimationFrame` with delta-time for frame-rate independence.
- All sprites drawn programmatically via Canvas 2D API — no external image assets.
- Parallax layers are filled silhouette paths scrolled at different multiplied speeds.
- Pattern chunks defined as data objects in `game.js`. Each chunk specifies: obstacle types, relative x positions, heights, and the safe gap duration to insert after.
- Chunk selector function picks randomly from the current unlocked tier pool, weighted toward harder tiers as score increases.
- Safe gap enforced by chunk scheduler — never skipped.
- `localStorage` for high score persistence only.

---

## Out of Scope (for now)
- Mobile/touch controls
- Sound effects / music
- Multiple characters or skins
- Online leaderboards
