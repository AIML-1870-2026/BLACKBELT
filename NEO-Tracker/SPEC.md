# NEO Tracker — Project Specification

## Overview

A near-earth object (NEO) monitoring dashboard that pulls live data from three NASA/JPL APIs. The landing page is a full-screen interactive Earth visualization with asteroids floating around it as glowing colored dots. Five sidebar tabs switch the right context panel and bottom info bar to show different data views. Built in vanilla HTML, CSS, and JavaScript.

NASA API Key: `idFpPha8ealYNc2XBUqzJeWA1Pq4sbWRtDlpk7Bc`

---

## Aesthetic Direction

**Theme:** Clean, minimal sci-fi. Deep navy-black shell, ultra-thin borders, monospace data readouts, accent colors used only on data — not decoration. The Earth globe is the hero of the page. Everything else gets out of its way.

**Color palette:**
- Page background: `#060910`
- Globe canvas background: `#04060e`
- Panel background: `#050810`
- Panel border: `rgba(255, 255, 255, 0.05)`
- Primary text: `rgba(220, 238, 255, 0.92)`
- Muted text: `rgba(120, 155, 200, 0.38)`
- Live pip / active accent: `#3ddc84`
- Asteroid — very close (< 1 LD): `#E24B4A`
- Asteroid — moderate (1–5 LD): `#EF9F27`
- Asteroid — safe (> 5 LD): `#1D9E75`
- Moon: `rgba(225, 232, 245, 0.8)`
- GEO ring: `rgba(120, 175, 255, 0.55)` (dashed)
- LEO band fill: `rgba(100, 160, 255, 0.06)`
- Satellite dots on GEO ring: `rgba(140, 190, 255, 0.5)`

**Typography:**
- Headings: `'Space Grotesk'` via Google Fonts
- All data labels, readouts, nav items: `'JetBrains Mono'` via Google Fonts

**Layout:** Laptop-first, 1024px–1440px. Full-viewport, no page scroll.

---

## File Structure

```
index.html
style.css
js/
  config.js              — NASA API key (gitignore this file)
  api.js                 — all fetch functions, caching, error handling
  globe.js               — Earth canvas renderer, satellite rings, asteroid dots, interactions
  sidebar.js             — tab switching and sidebar state
  views/
    miss-distance.js     — Miss Distance right panel
    this-week.js         — This Week right panel
    size-speed.js        — Size & Speed right panel
    schedule.js          — Schedule right panel
    impact-risk.js       — Impact Risk right panel
  utils.js               — unit converters, formatters, helpers
.gitignore               — must include config.js
```

---

## APIs

### 1. NASA NeoWs (API key required)
- Base URL: `https://api.nasa.gov/neo/rest/v1/`
- Key stored in `config.js`, appended as `?api_key=KEY`
- Endpoints:
  - `feed?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` — 7-day feed (today ± 3 days)
  - `neo/{id}` — individual detail on demand
- Key fields: `name`, `estimated_diameter.meters.estimated_diameter_min/max`, `is_potentially_hazardous_asteroid`, `close_approach_data[0].miss_distance` (au / lunar / kilometers), `close_approach_data[0].relative_velocity.kilometers_per_second`, `close_approach_data[0].close_approach_date`

### 2. JPL SBDB Small Body Database (no key)
- Used to enrich the sidebar asteroid card when a dot is clicked
- Endpoint: `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr={designation}&phys-par=true&orbit=true`
- Key fields returned:
  - `orbit.elements` — semi-major axis (`a`, AU), eccentricity (`e`), inclination (`i`, deg), orbital period (`per`, days)
  - `phys_par` — absolute magnitude (`H`), diameter if known
  - `object.fullname` — full official designation
- Fetch is triggered only on dot click (not hover) to avoid unnecessary calls
- Show a small inline loading state in the expanded card section while fetching
- Cache each result in `sessionStorage` keyed by designation so repeat clicks don't re-fetch

### 3. NASA Sentry Impact Monitoring (no key)
- URL: `https://ssd-api.jpl.nasa.gov/sentry.api`
- Key fields: `des`, `fullname`, `ip` (impact probability), `ps` (Palermo scale), `ts` (Torino scale), `range`, `diameter`

### Key storage
```js
// config.js
const NASA_KEY = 'idFpPha8ealYNc2XBUqzJeWA1Pq4sbWRtDlpk7Bc';
```
All API calls centralized in `api.js`. `config.js` listed in `.gitignore`.

### Caching
Cache every successful response in `sessionStorage` keyed by full request URL. Serve from cache if less than 5 minutes old. Show a small `cached · Xm ago` chip in the header when serving stale data.

---

## Page Layout

Single full-viewport shell. No page scroll.

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER BAR (50px)                                           │
│  [pip + title + subtitle]              [refresh]  [info]    │
├────────────┬─────────────────────────────┬───────────────────┤
│            │                             │                   │
│  SIDEBAR   │      GLOBE CANVAS           │  CONTEXT PANEL    │
│  224px     │    (Earth + everything)     │    268px          │
│            │      fills center           │                   │
│            │                             │                   │
├────────────┴─────────────────────────────┴───────────────────┤
│  BOTTOM INFO BAR (76px)                                      │
└──────────────────────────────────────────────────────────────┘
```

Globe canvas always visible. Only sidebar active state, right panel content, and bottom bar update on tab switch.

---

## Header Bar

- Left: small green live pip (6px, glowing) + `NEO TRACKER` in Space Grotesk uppercase + thin vertical divider + `near earth object monitor · live` in muted mono
- Right: two 26×26px icon buttons (refresh, info), rounded 5px, near-invisible border
- Bottom edge: `1px solid rgba(255,255,255,0.055)` border only — no gradient, no color

---

## Sidebar (224px)

### Navigation tabs
Section label `VIEWS` in 8.5px muted uppercase mono above the list.

| Icon shape | Label |
|---|---|
| Crosshair circle | Miss distance |
| Rising line chart | This week |
| Bar chart | Size & speed |
| Calendar | Schedule |
| Shield | Impact risk |

- Each row: 8px 14px padding, 10.5px mono, `border-left: 2px solid transparent`
- Active: `border-left: 2px solid #3ddc84`, background `rgba(61,220,132,0.05)`, full brightness text
- Hover: slight background lift, brighter text
- Miss Distance active by default

### Selected asteroid card (below a thin divider)
Appears when a dot is hovered or clicked on the globe. Persists while selected.

**Hover state** (populated from NeoWs data immediately, no extra fetch):
- Header row: colored pip (matching hazard color, with glow) + designation name in 11px semi-bold mono
- Three data rows (label left, value right):
  - `DISTANCE` → `X.XX LD`
  - `SIZE` → `~XX m`
  - `SPEED` → `XX.X km/s`
- Values right-aligned in the asteroid's hazard color
- If the asteroid passes inside the GEO ring: warning line in red at bottom: `⚠ passes inside satellite orbit zone`

**Click state** (triggers a JPL SBDB fetch for that asteroid's designation):
- Card expands below the hover data with a thin divider and an `ORBITAL ELEMENTS` section label
- While fetching: pulsing skeleton row placeholder
- Once resolved, display four additional rows in slightly more muted color to visually separate the two data sources:
  - `SEMI-MAJOR AXIS` → `X.XXX AU`
  - `ECCENTRICITY` → `0.XXX`
  - `INCLINATION` → `XX.X°`
  - `ORBITAL PERIOD` → `XXX days`
- If SBDB fetch fails: single muted line `orbital data unavailable`
- Cache each result in `sessionStorage` keyed by designation so repeat clicks don't re-fetch

---

## Globe Canvas (center, fills remaining width)

Implemented in `globe.js` using HTML5 Canvas 2D API. Canvas fills 100% of the center column. Cursor is `grab`, becomes `grabbing` while dragging.

### Earth globe
- Load texture from: `https://unpkg.com/three-globe/example/img/earth-night.jpg`
- Fallback if texture fails: dark blue radial gradient circle
- Clip canvas to circle using `ctx.clip()` then `drawImage()`
- Auto-rotates slowly: increment `texOffset` each frame (~0.1px/frame), wrap seamlessly by drawing the texture twice side by side
- **Left-click drag:** user drags to spin — `texOffset += (deltaX * 0.6)`, pause auto-rotate while dragging
- **Scroll wheel:** zoom in/out (scale factor clamped 0.7–2.2×), zooms the whole scene around center
- **Right-click drag:** pan the entire scene (translate cx/cy)
- Atmospheric rim: radial gradient overlaid inside the clipped circle, dark edge → transparent center
- Outer glow ring: arc stroke at `earthR * 1.04`, `rgba(55,125,255,0.2)`, lineWidth `earthR * 0.07`

### Satellite orbit rings
Drawn before the Earth so they appear behind it. Radii are in canvas coordinates derived from the same `ldToRadius()` scale used for asteroid dots.

**LEO band:**
- A filled annulus between the Earth's edge (`earthR * 1.06`) and the GEO ring radius
- Fill: `rgba(100, 160, 255, 0.06)` — just barely visible, a ghost of blue
- Inner edge dashed stroke: `rgba(100, 155, 255, 0.2)`, 0.5px, dash `[2, 8]`

**GEO ring (geosynchronous orbit, ~0.11 LD / 42,164 km):**
- Dashed circle stroke: `rgba(120, 175, 255, 0.55)`, 0.8px, dash `[4, 8]`
- Small label `GEO` in 8px muted mono at the right-hand edge of the ring
- 5 tiny satellite dots (1.5px radius, `rgba(140,190,255,0.5)`) drift along the ring at evenly spaced angles, animated slowly with `Date.now() * 0.00015`

**Important:** Make the rings clearly visible but not loud. They should read as context, not as primary UI elements. The target opacity feel is: you notice them immediately but they don't compete with the asteroid dots.

### Moon reference
- White dot (4.5px radius) at `ldToRadius(1.0)` distance from Earth center, fixed at a consistent angle (e.g. directly right)
- Label `Moon (1 LD)` in 8.5px muted mono beside it

### Asteroid dots
Source: NeoWs weekly feed.

**Color by miss distance:**
- `#E24B4A` — < 1 LD
- `#EF9F27` — 1–5 LD
- `#1D9E75` — > 5 LD

**Size:** log-scaled to estimated diameter. Min 3px radius, max 6px radius.

**Glow bloom:** radial gradient centered on dot, same color, fading to transparent at 3× dot radius. Opacity center stop `0xbb`, outer stop `0x00`.

**Positioning:**
- Radial distance: `ldToRadius(missDistanceLD)` — same linear scale as the Moon and GEO ring
- Angle: `(index / total) * 2π` + small deterministic per-asteroid jitter (use asteroid name hash as seed) so dots don't stack
- Dots inside the GEO ring radius will visually appear between Earth and the GEO ring — this is the intended alarming effect

**Labels:** designation name in 8.5px muted mono beside each dot. Toggle on/off via a `Labels` button floating bottom-left of the canvas.

**Hover:** highlight dot with a white outer ring (1px stroke, `rgba(255,255,255,0.6)`), populate the sidebar card, update the bottom bar.

**Click:** lock the selection. Click canvas background to deselect.

### Floating canvas controls
Top-right of the globe area, stacked vertically:
- `+` zoom in
- `−` zoom out
- `↺` reset zoom and pan to default

Bottom-left of the globe area:
- `Labels` toggle button — shows/hides asteroid name labels

All buttons: 26×26px, `border-radius: 5px`, `border: 1px solid rgba(255,255,255,0.07)`, `background: rgba(4,6,14,0.85)`.

---

## Right Context Panel (268px)

Scrolls internally if content overflows. Content swaps on tab change.

### 1. Miss Distance (default)
- Eyebrow: `ACTIVE VIEW` in 8.5px uppercase muted mono
- Title: `How close is close?` in 18px Space Grotesk bold
- Subheading: `Miss distance` in 10px `#3ddc84` uppercase mono
- Body: explains the colored dots and Moon reference
- Divider
- Color legend: three rows (pip + label) for red/amber/green thresholds
- Divider
- Orbit legend: two rows with a short dashed line swatch + label for GEO ring and LEO band
- Hint box: `Drag to spin · Scroll to zoom · Right-drag to pan`

### 2. This Week
- Title: `This week's passes`
- Scrollable list, one row per NEO sorted by approach date (soonest first)
- Each row: hazard pip, name, date, distance in LD
- Clicking a row selects that asteroid on the globe

### 3. Size & Speed
- Title: `Size & speed`
- Toggle: `Diameter` | `Velocity` (small pill buttons)
- Horizontal bar chart, one bar per NEO this week
- Bars colored by hazard color, labeled with value
- Hover a bar to highlight the corresponding dot on the globe

### 4. Schedule
- Title: `Approach schedule`
- One section per day of the current week
- Today highlighted with subtle accent background
- Each day: list of NEO passes with name, UTC time, and miss distance in LD
- Empty days: muted `No passes`

### 5. Impact Risk
- Title: `Sentry impact monitor`
- Card list sorted by Palermo scale descending
- Each card: name, Palermo scale value with color band (green PS < −2 / amber −2 to 0 / red PS > 0), Torino scale badge, impact probability, year range, diameter
- Footer: link to `https://sentry.jpl.nasa.gov`

---

## Bottom Info Bar (76px)

Always visible. Updates on asteroid hover/click.

### Default state
- Centered muted text: `Hover or click an asteroid to see details`
- Italic disclaimer: `Dot positions are illustrative — actual flyby geometry depends on orbital mechanics at closest approach.`

### Asteroid selected
- `◈` icon (color matches hazard color of selected asteroid)
- `[Designation] will pass at [X.XX LD] — about [XXX,XXX km] from Earth`
- If asteroid is inside GEO ring: append ` · inside satellite belt` in red
- Disclaimer italic text right-aligned

---

## Shared Utilities (`utils.js`)

- `auToLD(au)` — 1 AU = 389.17 LD
- `ldToKm(ld)` — 1 LD = 384,400 km
- `hToDiameter(h)` — `D = 1329 / sqrt(0.15) * 10^(-H/5)` meters
- `ldToRadius(ld, earthR, canvasMin)` — maps LD to canvas px radius (Moon at 1 LD = `earthR * 1.6`, max LD ~12 = `canvasMin * 0.46`)
- `isInsideGEO(ld)` — returns `true` if `ld < 0.11`
- `formatDate(iso)` — `Apr 2, 2026`
- `formatNumber(n)` — comma-separated integer
- `getHazardColor(ld)` — returns hex color string
- `dotRadius(diameterM)` — log-scaled canvas radius, clamped 3–6px
- `hashAngle(name)` — deterministic angle jitter from asteroid name string
- `showLoading(el)` / `showError(el, msg)` — skeleton and error states
- `debounce(fn, ms)`

---

## Error Handling

- Each panel shows a styled error card (not blank) if its API call fails
- Retry button re-fetches just that API
- 10-second timeout per request
- Panels are independent — one failure doesn't break others
- If NeoWs fails: globe shows `Could not load asteroid data — click to retry` overlay

---

## Loading States

- Earth globe and satellite rings render immediately on page load (no data needed)
- Asteroid dots fade in (CSS opacity transition, 400ms) once NeoWs resolves
- Right panel and bottom bar show pulsing skeleton placeholders while fetching
- Sidebar asteroid count badge on `This week` tab shows `···` until data loads

---

## Responsive Behavior

- 1024px+: full three-column layout
- 768px–1023px: context panel hidden; globe fills more width; sidebar stays
- Below 768px: sidebar collapses to icon-only rail; context panel becomes bottom drawer

---

## Implementation Notes

- No external JS libraries or CSS frameworks — pure vanilla
- All fetch calls in `api.js` only; view files call api functions, never `fetch` directly
- Globe texture scrolling: maintain a `texOffset` float, draw texture at `(texOffset % textureWidth)` and `(texOffset % textureWidth) + textureWidth` for seamless tiling
- Asteroid angles are deterministic per render (use `hashAngle(name)` jitter) so layout is stable across re-renders and tab switches
- GEO ring radius in canvas coords: `ldToRadius(0.11)` — use the same function as asteroid positioning so the rings and dots share the exact same distance scale
- LEO band inner edge: `earthR * 1.06` (just outside the atmospheric glow ring)
- Store active tab in `localStorage` key `neo_active_tab`
- Store distance unit preference (LD vs km) in `localStorage` key `neo_unit`
- All distances default to LD with km as secondary value
- Bottom bar distance updates on hover (no click required)
