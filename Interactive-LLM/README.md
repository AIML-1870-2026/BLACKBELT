# LLM Switchboard v1.0

Query Anthropic Claude and OpenAI GPT side-by-side with real-time streaming responses.

## Live Demo

Hosted on GitHub Pages — no install required:
`https://aiml-1870-2026.github.io/BlackBelt/Interactive-LLM/`

## Usage

1. Open the live link above
2. Click **API KEYS ▼** and paste your keys:
   - Anthropic key: `sk-ant-...`
   - OpenAI key: `sk-...`
3. Keys are saved to `sessionStorage` only — cleared when the tab closes, never stored on any server
4. Model dropdowns populate automatically after key entry
5. Type a query (or pick a preset), then click **▶ TRANSMIT** or press `Ctrl+Enter`

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Transmit query |
| `Escape` | Abort active streams |
| `Ctrl+L` | Clear panels |
| `Ctrl+K` | Open API key drawer |

## Features

- **Parallel streaming** — both models stream tokens simultaneously, in real time
- **JSON Mode** — force JSON-only output with an optional schema hint
- **Chat Mode** — maintains full conversation history per provider
- **Diff Mode** — word-level diff highlighting once both responses complete
- **Abort** — cancel mid-stream at any time, retains partial response
- **8 Preset prompts** — built-in templates, editable after selection

## Local Development

```bash
npm install
npm start
# open http://localhost:3000
```
