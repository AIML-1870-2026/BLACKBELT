# WeatherGlass — Spec Document

## Overview

**WeatherGlass** is a clean, glassmorphism-styled weather web app that fetches live weather data from the OpenWeatherMap API and presents it in a visually immersive, animated interface. The page dynamically shifts its background animation based on current conditions and gives users smart outfit and umbrella suggestions alongside standard weather data.

---

## API Details

- **Provider:** OpenWeatherMap
- **API Key:** `90bcec9d6f263b92dab1408d59dcff0c`
- **Endpoints used:**
  - Current weather: `https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=imperial`
  - 5-day forecast (for suggestion logic + hourly chart): `https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={API_KEY}&units=imperial`
  - Weather alerts: `https://api.openweathermap.org/data/3.0/onecall?lat={lat}&lon={lon}&appid={API_KEY}&units=imperial` *(use `lat`/`lon` from the current weather response; alerts are in `response.alerts[]`)*
  - Reverse geocoding (for geolocation): `https://api.openweathermap.org/geo/1.0/reverse?lat={lat}&lon={lon}&limit=1&appid={API_KEY}`
- **Units:** Imperial (°F)

---

## File Structure

```
WeatherGlass/
├── index.html
├── style.css
├── script.js
└── spec.md
```

No frameworks. Vanilla HTML, CSS, and JavaScript only.

---

## Design & Aesthetic

### Theme: Glassmorphism
- **Background:** Full-screen animated canvas layer behind all content (see Enhancement 1)
- **Cards:** Frosted glass panels using `backdrop-filter: blur()`, semi-transparent white backgrounds (`rgba(255,255,255,0.12)`), and `1px solid rgba(255,255,255,0.25)` borders
- **Shadows:** Soft diffuse box shadows, no hard drop shadows
- **Border radius:** Generous — `20px` to `28px` on all major cards

### Typography
- **Display font:** `Raleway` (for city name, temperature) — loaded from Google Fonts
- **Body font:** `DM Sans` — clean, modern, slightly warm
- **Accent/label font:** `DM Mono` — used for small labels like "HUMIDITY", "WIND", etc.

### Color Palette (CSS Variables)
```css
:root {
  --glass-bg: rgba(255, 255, 255, 0.12);
  --glass-border: rgba(255, 255, 255, 0.25);
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.7);
  --accent: #a8d8f0;
  --shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
```

---

## Layout

### Search Bar (top center)
- Centered input field with glass styling
- Placeholder: `"Search city..."`
- Search triggered by pressing Enter or clicking a search icon button
- Subtle focus glow on active state
- A **"Use My Location"** button sits beside the search bar (📍 icon + label)
  - Clicking it triggers the browser's native `Geolocation.getCurrentPosition()` prompt — the browser asks the user for permission before anything happens
  - If the user denies permission, show a small inline message below the bar: `"Location access denied. Please search by city name."`
  - If granted, reverse-geocode the coordinates using: `https://api.openweathermap.org/geo/1.0/reverse?lat={lat}&lon={lon}&limit=1&appid={API_KEY}` to get the city name, then proceed with a normal weather fetch
  - The city name returned is populated into the search input field so the user can see what location was detected

### Main Weather Card (center)
Displays after a successful search:
- **City name + country code** (large, Raleway)
- **Current temperature** (very large, dominant element)
- **Weather condition** (e.g., "Partly Cloudy") with a matching emoji icon
- **"Feels like"** temperature
- **High / Low** for the day

### Stats Row (below main card)
Four mini glass tiles in a row:
| Humidity | Wind Speed | Visibility | UV Index |
|----------|------------|------------|----------|
| `XX%` | `XX mph` | `XX mi` | `X` |

### ⚠️ Severe Weather Alert Banner (below search bar, above main card)
- Only renders if active alerts exist (see Enhancement 3)
- Visually distinct from all other cards — see enhancement section

### Suggestion Card (below stats)
See "Smart Suggestions" section below.

### Hourly Temperature Chart (below suggestion card)
- See Enhancement 4 for full detail
- A canvas-drawn smooth curve showing temps for the next 12 hours

### Sunrise & Sunset Tracker (below hourly chart)
- See Enhancement 5 for full detail
- A horizontal progress arc with a live sun position indicator

### 5-Day Forecast Strip (bottom)
A horizontal scrollable row of 5 small glass cards, one per day:
- Day name (Mon, Tue, etc.)
- Weather emoji
- High / Low temp

---

## Enhancement 1: Animated Weather Backgrounds

The background behind all glass content is a full-screen `<canvas>` element that renders a live particle/animation scene based on the current weather condition. The canvas is always present; only the animation type changes.

### Condition → Animation Mapping

| Weather Condition | Background Gradient | Canvas Animation |
|---|---|---|
| Clear (day) | Warm golden-blue sky | Slow drifting sun rays (light beams) |
| Clear (night) | Deep navy to black | Twinkling star particles |
| Clouds | Cool grey-blue | Slowly drifting cloud puffs (bezier curves) |
| Rain / Drizzle | Dark teal-grey | Falling rain streaks with splash ripples |
| Thunderstorm | Deep purple-black | Rain + occasional lightning flash effect |
| Snow | Pale blue-white | Gently falling snowflake particles |
| Mist / Fog | Desaturated grey-blue | Slow horizontal fog wisps |
| Default | Soft blue gradient | Subtle floating orbs |

### Implementation Notes
- Use `requestAnimationFrame` loop
- Rain: draw short diagonal lines, reset at top when off-screen
- Snow: use circles of varying size and opacity, sine-wave drift
- Stars: random white dots that pulse opacity on a slow timer
- Lightning: occasional `fillRect` flash on the full canvas at low opacity
- All particles stored in arrays and updated each frame
- Canvas is `position: fixed`, `z-index: 0`; all content is `z-index: 1+`

---

## Enhancement 2: Smart Suggestions Panel

A glass card that provides personalized, plain-English recommendations based on current conditions. This is more conversational and specific than a typical weather widget.

### Suggestion Categories

#### 🧥 Clothing
Logic based on `feels_like` temperature (°F):
- `> 85°F` → "It's hot out. Go with shorts and a light tee. Sunscreen recommended."
- `70–85°F` → "Nice and warm. A t-shirt and light pants should do it."
- `55–69°F` → "Mild weather — bring a light jacket or hoodie just in case."
- `40–54°F` → "It's chilly. Layer up with a jacket and consider pants over shorts."
- `< 40°F` → "Bundle up — heavy coat, gloves, and a hat are a good call."

#### ☂️ Umbrella
Logic based on weather condition ID from API:
- Rain / Drizzle / Thunderstorm → "Yes, bring an umbrella. Rain is expected."
- Clouds (high humidity > 80%) → "Maybe bring one — conditions could turn rainy."
- Clear / Other → "No umbrella needed today."

#### 🕶️ Sunglasses
- Clear sky → "Sunglasses are a good idea — it'll be bright out."
- Otherwise → omit or say "Not necessary today."

#### 💨 Wind Advisory
- Wind speed > 20 mph → "It's quite windy — hold onto your hat and avoid umbrellas if possible."
- Wind speed > 30 mph → "Strong winds expected. Be careful outdoors."

#### ❄️ Freeze Warning
- Temp < 32°F → "Freezing temps — roads may be icy. Drive carefully."

### Suggestion Display
- Each active suggestion appears as its own line with an emoji prefix
- Rendered in a single glass card titled **"Today's Suggestions"**
- Empty state (before search): card is hidden

---

## Enhancement 3: Severe Weather Alert Banner

If the One Call API returns one or more active alerts for the searched location, a prominent alert banner is displayed directly below the search bar, above the main weather card.

### Visual Design
- **Background:** `rgba(220, 50, 50, 0.25)` — a red-tinted glass panel (distinct from the neutral glass cards)
- **Border:** `1px solid rgba(255, 100, 100, 0.5)` — warm red border
- **Icon:** ⚠️ emoji prefix
- **Content:** Alert event name (e.g., "Winter Storm Warning") + a short description excerpt (max ~120 characters, truncated with "…")
- **Source:** Attribution line in small text: e.g., `"via National Weather Service"`
- If multiple alerts exist, stack them vertically with a small gap between

### Behavior
- Banner is completely hidden when no alerts are present
- Fades in with the rest of the weather content on successful search
- If the One Call API fails or returns no `alerts` key, silently skip — do not show an error

---

## Enhancement 4: Hourly Temperature Chart

A glass card containing a hand-drawn canvas chart showing the temperature forecast for the next 12 hours (from the 5-day/3-hour forecast endpoint, using the first 4 data points = 12 hours).

### Data
- Pull the first 4 entries from `forecast.list[]`
- Each entry has a `dt_txt` timestamp and `main.temp`
- X-axis: time labels (e.g., "3PM", "6PM", "9PM", "12AM")
- Y-axis: temperature values (auto-scaled with 10°F padding above/below min/max)

### Visual Design
- Drawn on a `<canvas>` element inside a glass card titled **"Next 12 Hours"**
- Smooth bezier curve connecting the data points (not straight lines)
- Gradient fill below the curve: semi-transparent accent color fading to transparent
- Data point dots: small filled circles at each data point
- Temperature label above each dot (e.g., `"72°"`)
- Time label below the x-axis at each point
- No gridlines — keep it clean and minimal
- Canvas sized to fill the card width, ~160px tall

### Implementation Notes
- Use `ctx.bezierCurveTo()` or the catmull-rom → bezier conversion approach for smooth curves
- Color the curve and fill using `--accent` (`#a8d8f0`)
- Draw labels using `DM Mono` font at small size (~11px)

---

## Enhancement 5: Sunrise & Sunset Tracker

A glass card that visually shows where the sun currently is in its arc between today's sunrise and sunset times, using a live progress bar styled as a horizon arc.

### Data
- `sys.sunrise` and `sys.sunset` from the current weather response (Unix timestamps in seconds)
- Current time via `Date.now() / 1000`

### Visual Design
- Card title: **"Daylight"**
- A horizontal arc drawn on a `<canvas>` — a semicircle representing the sky from east (left) to west (right)
- A sun icon (🌤 or a drawn yellow circle) moves along the arc based on current time as a percentage between sunrise and sunset
- Below the arc: two labels on the left and right edges — `"🌅 6:42 AM"` and `"🌇 7:58 PM"` (formatted from the Unix timestamps)
- If current time is before sunrise or after sunset, the sun is parked at the left or right edge respectively and the card shows a moon icon instead
- Progress percentage shown in small text below the arc: e.g., `"67% of daylight passed"`

### Arc Implementation Notes
- Draw a `ctx.arc()` semicircle as a stroke (the sky path)
- Calculate sun position angle: `angle = π * progress` where `progress = (now - sunrise) / (sunset - sunrise)`, clamped 0–1
- Sun x/y position derived from the arc center and radius using `cos` and `sin`
- Arc drawn in a warm gold/yellow color (`#f9d87a`); the track in `rgba(255,255,255,0.15)`
- Canvas ~200px wide, ~110px tall

---

## Behavior & States

### Empty / Initial State
- Background animation runs with the default floating orbs
- Search bar is centered in the page
- No weather card or suggestion card visible

### Loading State
- After search is submitted, show a subtle spinner or pulsing skeleton inside the main card area
- Background transitions to a neutral gradient while loading

### Success State
- Background animation switches to match the returned weather condition
- Weather card, stats row, suggestion card, and forecast strip all appear with a smooth fade-in

### Error State
- If the city is not found (API 404), show an inline error message below the search bar: `"City not found. Please check the spelling and try again."`
- No card content displayed

---

## Interactivity

- **Enter key** triggers search from the input field
- **Search button** (magnifying glass icon) also triggers search
- **"Use My Location" button** (📍) triggers browser geolocation permission prompt — does NOT auto-fire on page load
  - On permission grant: reverse-geocodes coordinates → populates city name into input → fetches weather automatically
  - On permission denial: shows inline error message, no weather fetch attempted
- Background animation transitions smoothly when condition changes (fade out old canvas state, fade in new)
- Stats tiles have a subtle hover lift effect (`transform: translateY(-2px)`)
- Forecast cards display in a full non-scrolling row on laptop

---

## Responsive Design

- **Laptop-first layout** — designed and optimized for viewport widths of 1024px–1440px
- Content is centered in a max-width container (~860px) with generous side padding
- Stats row always displays as a single horizontal row of four tiles — no wrapping
- Forecast strip displays all 5 days in a single non-scrolling row
- Hourly chart and sunrise tracker sit side-by-side in a two-column row on laptop
- Font sizes are fixed (not fluid) — sized for desktop readability
- No special handling for mobile or tablet breakpoints; the layout is not required to work below ~900px

---

## Stretch Challenge Summary

| # | Enhancement | Description |
|---|---|---|
| 1 | Animated Weather Backgrounds | Canvas-based animation that changes based on live weather condition |
| 2 | Smart Suggestions Panel | Clothing, umbrella, wind, and sun advice based on real weather data |
| 3 | Severe Weather Alert Banner | Red-tinted glass banner that appears when active weather alerts exist |
| 4 | Hourly Temperature Chart | Smooth bezier canvas chart of temps for the next 12 hours |
| 5 | Sunrise & Sunset Tracker | Live arc showing sun position between today's sunrise and sunset |

All five enhancements are fully integrated into the main layout and are not optional add-ons.

---

## Notes for Implementation

- All API calls made in `script.js` using `fetch()`
- No external JS libraries — pure vanilla
- API key is stored as a `const` at the top of `script.js`
- Weather condition is determined using the `weather[0].id` field from the API response (OpenWeatherMap condition codes)
- Icons use emoji only — no icon library needed
- Accessibility: input has a `label`, contrast ratios maintained despite glass effect by using white text on dark-enough backgrounds
