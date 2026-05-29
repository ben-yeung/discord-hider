# Discord Hider — Chrome Extension Design

**Date:** 2026-05-29
**Status:** Approved

## Overview

A Chrome extension (Manifest V3) that lets users toggle the visibility of specific Discord web UI elements on `discord.com`. Built with Vite + React (multi-entry) and Lucide React for icons.

---

## Scope

### Elements (v1)

| Key | Label | Default selector |
|---|---|---|
| `serverList` | Server List | `nav[aria-label="Servers sidebar"]` |
| `channelColumn` | Channel Column | `nav[aria-label="Channels"]` |
| `topToolbar` | Top Toolbar | `div[class*="toolbar"]` |
| `chatBar` | Chat Bar | `div[class*="channelTextArea"]` |

Selectors are maintained in `src/content/selectors.ts` as a plain record — one line to update when Discord changes its DOM.

### Visibility rules

- **Global** toggle per element — the default state everywhere on Discord.
- **Per-channel override** — optional, keyed by Discord channel ID (parsed from `/channels/<guildId>/<channelId>`). Overrides win over the global setting for named keys only; unset keys fall back to global.

---

## Architecture

### Project structure

```
discord-hider/
├── manifest.json              # MV3 manifest
├── vite.config.ts             # multi-entry: popup, settings
├── .gitignore
├── package.json
├── src/
│   ├── popup/
│   │   ├── main.tsx
│   │   └── Popup.tsx          # toggle rows + Open Settings footer
│   ├── settings/
│   │   ├── main.tsx
│   │   └── Settings.tsx       # global toggles, per-channel overrides
│   ├── content/
│   │   ├── index.ts           # storage listener, style injection, picker mode
│   │   └── selectors.ts       # ElementKey → default CSS selector map
│   └── shared/
│       ├── storage.ts         # typed chrome.storage.sync read/write helpers
│       └── types.ts           # ElementKey, Settings, ChannelOverride types
└── dist/                      # Vite build output (what Chrome loads)
```

### Build

Vite builds two React entry points — `popup` and `settings` — each producing its own HTML + JS bundle. The content script is bundled separately as a plain IIFE (no React). The manifest references all three outputs.

### Data flow

```
Popup / Settings
      │ write
      ▼
chrome.storage.sync
      │ onChanged event
      ▼
Content script (discord.com)
      │ recompute rules
      ▼
<style> tag in <head>    →    element hidden / shown
```

No message passing for toggle state — storage acts as the shared state bus. The only message passed is `startPicker` from the popup to the content script.

---

## Storage Schema

```ts
type ElementKey = 'serverList' | 'channelColumn' | 'topToolbar' | 'chatBar'

interface ElementConfig {
  visible: boolean       // global toggle state
  selector: string | null  // null = use built-in default from selectors.ts
}

interface Settings {
  elements: Record<ElementKey, ElementConfig>
  channelOverrides: {
    [channelId: string]: Partial<Record<ElementKey, boolean>>
  }
}
```

`chrome.storage.sync` is used so settings roam across devices. Storage size is negligible.

---

## Popup UI

A compact 280px-wide popup with one row per element:

```
┌─────────────────────────────────────┐
│ Discord Hider                  v1.0 │
├─────────────────────────────────────┤
│ Server List        [●───] [💧] [↺] │
│ Channel Column     [●───] [💧] [↺] │
│ Top Toolbar        [───●] [💧] [↺] │
│ Chat Bar           [───●] [💧] [↺] │
├─────────────────────────────────────┤
│         ⚙ Open Settings            │
└─────────────────────────────────────┘
```

- **Switch toggle** — clicks write the new `visible` value to storage immediately.
- **Eyedropper (Lucide `Pipette`)** — sends `{ type: 'startPicker', key: ElementKey }` to the active Discord tab via `chrome.tabs.sendMessage`, then calls `window.close()` to dismiss the popup. Content script activates picker mode.
- **Reset (Lucide `RotateCcw`)** — visible but disabled (grey) when `selector` is null (already default); enabled when a custom selector is set.

---

## Settings Page UI

A full-page options page (`chrome.runtime.openOptionsPage()`). Two sections:

### Global Visibility

One row per element, same inline controls as the popup (toggle + eyedropper + reset). Each row also shows the active CSS selector below the label in small monospace text — grey when using the default, amber when a custom selector is active. The reset icon turns amber when a custom selector is set.

### Per-Channel Overrides

A list of configured channel overrides. Each entry shows the channel ID (or a user-supplied label) and per-element boolean overrides. Empty state shows "No channel overrides configured" + an **Add Channel** button.

Clicking **Add Channel** expands an inline form row with a text input for a Discord channel URL (e.g. `https://discord.com/channels/123456/789012`). On confirm, the channel ID is extracted from the URL path, a new override entry is created with all elements inheriting the global default (no keys set), and the user can then toggle individual elements in that row to override them.

---

## Content Script

**File:** `src/content/index.ts`

### Style injection

On load, inserts a `<style id="discord-hider">` tag into `document.head`. On every storage change event, recomputes the full CSS ruleset and replaces the style tag's `textContent`. Uses `display: none !important` per hidden element.

### Selector resolution

For each `ElementKey`:
1. If `selector` is non-null in storage → use custom selector.
2. Else → use built-in default from `selectors.ts`.
3. If the resolved selector matches no element → skip silently (no error thrown).

### Channel override resolution

Reads `window.location.pathname` on each storage change. If `channelOverrides[channelId]` exists and has an entry for a given key, that boolean wins. Otherwise the global `visible` value applies.

### Picker mode

Triggered by `chrome.runtime.onMessage` receiving `{ type: 'startPicker', key: ElementKey }`.

1. Adds a mouseover listener — highlights hovered elements with a purple `outline`.
2. On click — calls `generateSelector(element)` to produce a stable CSS selector (prefers `aria-label`, `role`, `data-*` attributes over randomized class names). Saves to `storage.elements[key].selector`. Exits picker mode.
3. On `Escape` keydown — exits picker mode with no changes.
4. Cleanup removes all listeners and outline styles on exit.

---

## .gitignore

```
node_modules/
dist/
.superpowers/
*.local
```

---

## Out of scope (v1)

- Keyword highlighting
- Keyboard shortcuts for toggling
- Sync/export of settings
- Firefox / other browser support
