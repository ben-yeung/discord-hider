# Discord Hider

A Manifest V3 Chrome extension that toggles visibility of Discord web UI elements.

## Elements

| Element | Default selector |
|---|---|
| Server List | `nav[aria-label="Servers sidebar"]` |
| Channel Column | `div[class*="sidebarList"]` |
| Top Toolbar | `div[class*="toolbar"], div[data-window-chrome="true"]` |
| Chat Bar | `div[class*="channelTextArea"]` |

## Features

- **Popup** — toggle any of the 4 elements on/off with one click
- **Per-channel overrides** — hide or show elements differently per channel (configured in Settings)
- **Custom selectors** — use the eyedropper to pick a new element if Discord updates its DOM; reset back to default at any time
- **Sync storage** — settings persist across Chrome profiles via `chrome.storage.sync`

## Install

1. Clone the repo and `npm install`
2. `npm run build`
3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select the `dist/` folder

## Development

```bash
npm run build       # full build (popup + settings + content script)
npm test            # run all tests
```

## Stack

Vite 5 · React 18 · TypeScript 5 · Vitest
