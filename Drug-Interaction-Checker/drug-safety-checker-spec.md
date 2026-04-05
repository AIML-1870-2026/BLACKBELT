# Drug Safety Checker — Project Specification

---

## Instructions for Claude Code

You are building a complete, fully functional web application from this spec. Read the entire document before writing any code. Follow these instructions exactly.

### What to build
Build every file in the File Structure section. Do not skip any file. Do not ask clarifying questions — all decisions are made in this spec. If something is ambiguous, use your best judgment and keep it consistent with the rest of the spec.

### File output
Create all files in a `drug-safety-checker/` project folder. The app must run by opening `index.html` directly in a browser with no build step, no Node.js, no local server required.

### Implementation order
Build in this order to avoid dependency issues:
1. `index.html` — full markup structure, all sections present, linked to CSS and JS files
2. `css/styles.css` — complete styles including all CSS variables, card components, tooltip styles, popup styles, severity bar, animations
3. `js/glossary.js` — terms dictionary object and `termHighlighter()` function
4. `js/api.js` — all API functions (RxNorm autocomplete, RxCUI resolution, RxNav interactions, OpenFDA label, OpenFDA adverse events)
5. `js/ui.js` — all card rendering functions, popup system, severity bar, tooltip injection
6. `js/app.js` — main app logic, event listeners, mode handling, orchestration

### API calls
All API endpoints are defined in the API Integration section. Use `fetch()` with `async/await`. All APIs are CORS-friendly and require no API key. Run OpenFDA label and adverse event calls in parallel using `Promise.all()` for each drug. Always resolve RxCUI before any other call.

### termHighlighter() requirements
- Run after every card's innerHTML is set
- Use case-insensitive regex with word boundaries (`\b`) to match terms
- Never double-wrap an already-wrapped term — check for existing `.term-tooltip` spans before processing
- Match the full term including slashes (e.g. "CYP450 / CYP3A4") by also matching common abbreviations separately

### Tooltip behavior
- Desktop: show on hover with 150ms delay, hide on mouse leave
- Mobile: show on tap, dismiss on tap elsewhere
- Use a single shared tooltip DOM element that repositions, not one per term
- Position above the term, centered, flip to below if not enough space above

### ? popup behavior
- One shared modal DOM element, content swapped on open
- Clicking the overlay background closes it
- Pressing Escape closes it
- Trap focus inside modal while open (accessibility)

### Error handling
Every API call must have a try/catch. Every card must handle the case where data is missing or the API returns nothing. Never show an empty card — either show a "data not available" message or hide the card entirely (black box warning card hides if no data; all others show a not-available message).

### Animations
Use CSS classes toggled by JavaScript, not inline styles. Cards get a `.card-visible` class added with a staggered `setTimeout` (50ms per card) after results render. Animations are defined in CSS using `transition` and `transform`.

### No external dependencies
Do not use jQuery, lodash, or any JS library. Do not use any CSS framework. Google Fonts is the only external resource allowed (loaded via `<link>` in `index.html`).

### Disclaimer
The disclaimer text must appear at the bottom of the page at all times, not just when results are shown.

---

## Overview

A client-side web application built in vanilla HTML, CSS, and JavaScript that allows users to look up drug safety profiles and check for drug-drug interactions. Designed as a polished school project showcase with a clean, clinical aesthetic.

---

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **No backend / no build tools** — pure static files, runs in browser
- **APIs**: RxNorm, RxNav Interactions, OpenFDA (all free, no API key required)
- **Fonts**: Google Fonts (clinical, refined choices — e.g. DM Sans + DM Serif Display)

---

## Application Modes

### Mode 1 — Single Drug Profile
User searches one drug and receives a full safety dashboard for that drug.

### Mode 2 — Drug Interaction Checker
User searches two drugs side by side and receives individual profiles for each plus an interaction analysis section between them.

Mode is determined automatically based on whether one or two drug search boxes are active.

---

## User Flow

### Input
1. User sees two search boxes side by side labeled **"Drug A"** and **"Drug B"**
   - Drug B is visually de-emphasized until Drug A has a valid selection
   - A **"Check Single Drug"** toggle collapses Drug B for single-drug mode
2. As the user types, **RxNorm autocomplete** suggestions appear (minimum 2 characters)
   - Suggestions show both brand name and generic name where available
   - If no suggestions found, free text is accepted as fallback
3. User selects a drug (or submits free text) for one or both boxes
4. User clicks **"Analyze"** button
5. Results dashboard renders below

### Output — Results Dashboard
Results appear as a card-based dashboard. Cards animate in on load.

---

## API Integration

### 1. RxNorm (Name Normalization + Autocomplete)
**Base URL**: `https://rxnav.nlm.nih.gov/REST/`

| Purpose | Endpoint |
|---|---|
| Autocomplete suggestions | `GET /spellingsuggestions.json?name={query}` |
| Resolve name to RxCUI | `GET /rxcui.json?name={drugName}&search=1` |
| Get drug display info | `GET /rxcui/{id}/properties.json` |

**Usage**: Every drug input is resolved to an RxCUI before any other API call. RxCUI is the universal key used across all subsequent calls.

**Fallback**: If RxNorm cannot resolve a name, attempt OpenFDA lookup directly by name string.

---

### 2. RxNav Interactions (Drug-Drug Interactions)
**Base URL**: `https://rxnav.nlm.nih.gov/REST/interaction/`

| Purpose | Endpoint |
|---|---|
| Single drug interactions | `GET /interaction.json?rxcui={id}` |
| Multi-drug interaction list | `GET /list.json?rxcuis={id1}+{id2}` |

**Returns**: Interaction pairs with severity level and description. Severity values: `high`, `moderate`, `low`, `unknown`.

**Usage**: In dual-drug mode, call the list endpoint with both RxCUIs. In single-drug mode, call the single endpoint to show known interactions with common drugs (optional enhancement).

---

### 3. OpenFDA (Adverse Events, Warnings, Contraindications)
**Base URL**: `https://api.fda.gov/drug/`

| Purpose | Endpoint | Notes |
|---|---|---|
| Drug label (warnings, contraindications, boxed warnings) | `GET /label.json?search=openfda.generic_name:"{name}"&limit=1` | Parse `boxed_warning`, `warnings`, `contraindications` fields |
| Adverse events (FAERS) | `GET /event.json?search=patient.drug.medicinalproduct:"{name}"&count=patient.reaction.reactionmeddrapt.exact&limit=10` | Returns top 10 reported reactions by frequency |

**Usage**: Run both label and event queries in parallel for each drug after RxCUI resolution.

---

## Results Dashboard — Card Definitions

All cards share a consistent card component structure:
- White background, subtle border, soft drop shadow
- Color-coded header bar (severity-driven or section-type-driven)
- Collapsible body for long content

### Card 1 — Drug Profile Card (one per drug)
**Header color**: Blue (neutral/informational)

**Contents**:
- Drug name (brand + generic)
- RxCUI identifier
- Drug class (if available from RxNorm)
- Brief description (from OpenFDA label `description` field if available)

---

### Card 2 — Black Box Warnings Card (one per drug, only if present)
**Header color**: Red (critical)

**Contents**:
- FDA boxed warning text (from OpenFDA label `boxed_warning` field)
- Prominent warning icon
- Note: "This drug carries an FDA Black Box Warning — the most serious warning type"

**Visibility**: Only rendered if `boxed_warning` field is present in label data. If absent, card is hidden entirely (not shown as empty).

---

### Card 3 — Contraindications Card (one per drug)
**Header color**: Orange (serious)

**Contents**:
- Contraindications text from OpenFDA label
- If none found: "No contraindication data available from FDA label"

---

### Card 4 — Adverse Events Card (one per drug)
**Header color**: Yellow (moderate concern)

**Contents**:
- Top 10 reported adverse reactions from FAERS
- Displayed as a ranked list with reaction name and report count
- Small disclaimer: "Based on voluntary self-reports to FDA. Frequency does not imply causation."

---

### Card 5 — Interaction Analysis Card (dual-drug mode only)
**Header color**: Severity-driven (see below)

**Contents**:
- List of interaction pairs found between Drug A and Drug B
- Each interaction shows:
  - Interaction description
  - Severity badge (color-coded)
  - Source label (e.g. "DrugBank via RxNav")
- If no interactions found: green header, "No known interactions found between these drugs"

**Severity color coding**:
| Severity | Badge Color | Header Color |
|---|---|---|
| High | Red `#DC2626` | Red tint |
| Moderate | Orange `#EA580C` | Orange tint |
| Low | Yellow `#CA8A04` | Yellow tint |
| None found | Green `#16A34A` | Green tint |
| Unknown | Gray `#6B7280` | Gray tint |

---

## Visual Design

### Aesthetic Direction
Clean, clinical, trustworthy. Inspired by modern medical reference tools and healthcare dashboards. Feels like something a pharmacist would actually use — not a toy.

### Color Palette
```
--color-primary:     #1D4ED8   /* Deep medical blue */
--color-primary-lt:  #EFF6FF   /* Light blue background tints */
--color-surface:     #FFFFFF   /* Card backgrounds */
--color-bg:          #F8FAFC   /* Page background */
--color-border:      #E2E8F0   /* Subtle borders */
--color-text:        #0F172A   /* Near-black text */
--color-text-muted:  #64748B   /* Secondary text */
--color-danger:      #DC2626   /* Red — high severity */
--color-warning:     #EA580C   /* Orange — moderate */
--color-caution:     #CA8A04   /* Yellow — low */
--color-safe:        #16A34A   /* Green — no interaction */
--color-unknown:     #6B7280   /* Gray — unknown */
```

### Typography
- **Display / headings**: DM Serif Display (Google Fonts)
- **Body / UI**: DM Sans (Google Fonts)
- Base font size: 16px
- Card titles: 1.1rem, medium weight
- Drug names: 1.4rem, serif display

### Layout
- Max content width: 1200px, centered
- Header: app name + subtitle + mode toggle
- Search section: two search boxes side by side with "Analyze" button centered below
- Results: CSS Grid, 2-column on desktop, 1-column on mobile
- Interaction card: full width, always at bottom of results

### Animations
- Cards fade + slide up on render (`opacity 0→1`, `translateY 20px→0`)
- Staggered delay per card (50ms increments)
- Autocomplete dropdown slides down smoothly
- Loading spinner while API calls are in flight

---

## Loading & Error States

### Loading
- Spinner replaces results area while fetching
- Text: "Analyzing [Drug Name]..."

### Error States
| Scenario | Message |
|---|---|
| Drug not found in RxNorm | "Could not find '[name]' — try a different spelling or brand name" |
| OpenFDA returns no label | "FDA label data not available for this drug" |
| No interaction data | "No interaction data found — this does not confirm safety" |
| Network error | "Unable to reach drug database — check your connection" |

---

## Educational Features (Stretch Goals)

Three layered educational features help non-medical users understand what they're reading without cluttering the primary interface.

---

### Feature 1 — Contextual ? Popups

Every card title and every severity badge has a small `?` icon beside it. Clicking it opens a focused modal explaining that specific concept in plain language. Clicking outside or pressing Escape closes it.

**Card-level popups:**

| Trigger | Plain-language explanation shown |
|---|---|
| `?` on Drug Profile card | "This shows basic identifying information about the drug — its official name, the ID number used by the US government to track it, and what category of medication it belongs to." |
| `?` on Black Box Warning card | "A Black Box Warning is the FDA's most serious warning. It means the drug has risks serious enough that doctors and patients must be clearly informed before use. Not all drugs have one — seeing this means extra caution is warranted." |
| `?` on Contraindications card | "Contraindications are situations where this drug should NOT be used — for example, if you have a certain condition or are taking another medication. Always review these with a doctor or pharmacist." |
| `?` on Adverse Events card | "These are side effects that people voluntarily reported to the FDA after taking this drug. They are not proven to be caused by the drug — just reported alongside its use. More reports means it was reported more often, not necessarily that it's more dangerous." |
| `?` on Interaction card | "A drug interaction means two drugs may affect each other when taken together. This can make one drug stronger, weaker, or cause unexpected side effects. Always tell your doctor or pharmacist about every medication you take." |

**Severity badge popups:**

| Trigger | Plain-language explanation shown |
|---|---|
| `?` on High badge | "High severity means this interaction is considered clinically significant and potentially dangerous. These combinations are often avoided entirely or require very careful monitoring by a doctor." |
| `?` on Moderate badge | "Moderate severity means the interaction may cause problems for some people. A doctor or pharmacist may need to adjust doses or monitor you more closely." |
| `?` on Low badge | "Low severity means the interaction exists but is unlikely to cause serious harm for most people. Still worth mentioning to your healthcare provider." |
| `?` on Unknown badge | "Interaction data exists but severity has not been fully established. Treat with caution and consult a professional." |

**Popup UI spec:**
- Centered modal, max width 480px
- White card, rounded corners, subtle shadow
- Title in DM Serif Display, body in DM Sans
- Single close button (`×`) top right
- Background overlay: `rgba(0,0,0,0.3)`
- Animate in: fade + scale from 0.95 → 1.0

---

### Feature 2 — Severity Explainer Bar

A horizontal legend rendered at the top of the results section, always visible once results load. Gives users a reference key before they read any cards.

**Layout**: Four colored pills in a row, each showing:
- Colored dot
- Severity label
- One-line plain description

**Content:**
| Color | Label | Description |
|---|---|---|
| Red | High | Potentially dangerous — avoid or use only under medical supervision |
| Orange | Moderate | Use with caution — doctor may need to adjust treatment |
| Yellow | Low | Minor concern — mention to your pharmacist |
| Green | None found | No known interactions — does not guarantee safety |

**UI spec:**
- Sits in a light gray pill-row container above the card grid
- Compact — single line on desktop, wraps on mobile
- Label text: 0.8rem, DM Sans, muted color
- Dots: 10px circles in their respective severity colors

---

### Feature 3 — Medical Term Tooltips

Common medical terms appearing in OpenFDA label text are automatically detected and wrapped with a tooltip trigger. Hovering (desktop) or tapping (mobile) shows a plain-language definition in a small floating tooltip.

**Implementation approach:**
- After card content is rendered, run a `termHighlighter()` function that scans card text nodes
- Match against a predefined terms dictionary (hardcoded in `js/glossary.js`)
- Wrap matched terms in `<span class="term-tooltip" data-def="...">` 
- CSS + JS handles tooltip display on hover/tap

**Terms dictionary (initial set — expand as needed):**

| Term | Plain-language definition |
|---|---|
| QT prolongation | A change in heart rhythm that can lead to dangerous irregular heartbeats |
| CYP450 / CYP3A4 | Liver enzymes that break down drugs — if two drugs use the same enzyme, one can build up to dangerous levels |
| contraindicated | Should not be used — the risks outweigh any benefit in this situation |
| bradycardia | Abnormally slow heart rate |
| tachycardia | Abnormally fast heart rate |
| hepatotoxicity | Liver damage caused by a drug or chemical |
| nephrotoxicity | Kidney damage caused by a drug or chemical |
| hypotension | Abnormally low blood pressure |
| hypertension | Abnormally high blood pressure |
| serotonin syndrome | A potentially life-threatening reaction from too much serotonin activity, often from combining certain antidepressants |
| anticoagulant | A drug that prevents blood clotting ("blood thinner") |
| MAOI | A type of antidepressant that has many dangerous interactions with other drugs and foods |
| NSAID | Non-steroidal anti-inflammatory drug — common pain relievers like ibuprofen and naproxen |
| arrhythmia | Irregular heartbeat |
| bioavailability | How much of a drug actually reaches the bloodstream after you take it |

**Tooltip UI spec:**
- Small dark pill tooltip (`#1e293b` background, white text)
- Appears above the term, centered
- Max width: 260px, wraps if needed
- 0.75rem font size
- Fade in on hover, 150ms delay to avoid accidental triggers
- On mobile: tap to toggle, tap elsewhere to dismiss
- Underlined term with dotted underline to signal interactivity

---

### New file: `js/glossary.js`
Exports the terms dictionary and the `termHighlighter()` function. Called by `ui.js` after each card renders.

---

## Disclaimer
A persistent disclaimer renders at the bottom of every page:

> "This tool is for educational purposes only and is not a substitute for professional medical advice. Always consult a licensed healthcare provider before making medication decisions."

---

## File Structure

```
drug-safety-checker/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js          # Main app logic, mode handling, UI state
│   ├── api.js          # All API calls (RxNorm, RxNav, OpenFDA)
│   ├── ui.js           # Card rendering, DOM manipulation
│   └── glossary.js     # Terms dictionary + termHighlighter() function
└── assets/
    └── (any icons or images)
```

---

## Out of Scope (for this version)
- User accounts or saved searches
- PDF export
- Mobile app
- Backend / server-side logic
- DrugBank direct integration
- DDInter integration
- More than 2 drugs at once
