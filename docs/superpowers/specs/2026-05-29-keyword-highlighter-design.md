# Discord Hider — Keyword Highlighter Design

**Date:** 2026-05-29
**Status:** Approved

## Overview

Adds keyword highlighting to the Discord Hider extension. The content script scans Discord message text nodes and wraps keyword matches in `<span>` elements styled via injected CSS. Keywords are configured globally or per-channel, each with a user-chosen color. The popup and settings page each gain a **Keywords** tab alongside the existing Elements tab.

---

## Scope

### Behaviour

- Keywords are matched **case-insensitively** as **substrings** (e.g. `react` matches `React`, `REACT`, `overreacting`).
- Each keyword has a custom color (hex, user-chosen via `<input type="color">`).
- A global **style** toggle switches all highlights between two modes:
  - **Background** — solid color fill behind the matched text (like a text marker).
  - **Chip** — translucent color fill + matching border + border-radius, Discord tag aesthetic.
- A global **master toggle** disables all highlighting without deleting keywords.
- Keywords can be enabled/disabled individually via an eye icon (eye = visible, eye-off = hidden/dimmed row).

### Scoping

- **Global keywords** apply everywhere on Discord.
- **Per-channel overrides** add channel-specific keywords. Each channel entry has an **Inherit global keywords** checkbox (default: checked). When checked, global + channel keywords both apply. When unchecked, only channel keywords apply.
- Channel names are captured at save time by querying the active Discord tab (`document.title`, which Discord sets to `# channel-name`). Falls back to `null` if no Discord tab is reachable; the UI shows the channel ID instead.

---

## Data Model

Extends the existing `Settings` type. Storage key `"settings"` is unchanged.

```ts
interface Keyword {
  id: string           // crypto.randomUUID() — used as CSS class suffix (.dh-kw-<id>)
  text: string         // case-insensitive substring to match
  color: string        // hex e.g. "#fde047"
  enabled: boolean     // per-keyword eye toggle
}

interface ChannelKeywordConfig {
  channelName: string | null   // extracted from document.title at save time
  inheritGlobals: boolean      // if true, global + channel keywords both apply
  keywords: Keyword[]          // channel-specific keywords
}

interface KeywordSettings {
  enabled: boolean                                    // master on/off
  style: 'background' | 'chip'                        // global style
  keywords: Keyword[]                                 // global keyword list
  channelOverrides: {
    [channelId: string]: ChannelKeywordConfig
  }
}

// Added field on existing Settings interface:
// keywords: KeywordSettings
```

`DEFAULT_SETTINGS.keywords`:

```ts
{
  enabled: true,
  style: 'background',
  keywords: [],
  channelOverrides: {},
}
```

---

## Architecture

### New and modified files

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `Keyword`, `ChannelKeywordConfig`, `KeywordSettings`; extend `Settings` |
| `src/shared/storage.ts` | Extend `DEFAULT_SETTINGS`; add keyword storage helpers |
| `src/shared/storage.test.ts` | Tests for new keyword helpers |
| `src/content/keywordHighlighter.ts` | DOM highlighter module (new) |
| `src/content/keywordHighlighter.test.ts` | Tests for highlighter (new) |
| `src/content/index.ts` | Wire `keywordHighlighter` into storage listener |
| `src/settings/Settings.tsx` | Add tab bar; route to Keywords tab |
| `src/settings/KeywordsSettings.tsx` | Keywords tab component (new) |
| `src/settings/KeywordsSettings.test.tsx` | Tests for Keywords settings (new) |
| `src/settings/settings.css` | Add tab bar styles + keyword component styles |
| `src/popup/Popup.tsx` | Add tab bar; route to Keywords tab |
| `src/popup/popup.css` | Add tab bar styles + keyword row styles |

---

## Content Script — Keyword Highlighter

**File:** `src/content/keywordHighlighter.ts`

### CSS injection

Alongside the existing `<style id="discord-hider-styles">` tag, inserts a second `<style id="discord-hider-keywords">` tag. On every `applyKeywords` call, rewrites this tag with one rule per enabled keyword:

```css
/* background style */
.dh-kw-<id> {
  background: <color>;
  color: #1a1a1a;
  border-radius: 2px;
  padding: 0 2px;
}

/* chip style */
.dh-kw-<id> {
  background: <color>30;
  color: <color>;
  border: 1px solid <color>70;
  border-radius: 3px;
  padding: 0 3px;
}
```

Color contrast for background style: if the hex luminance is above 0.5 use `#1a1a1a`, otherwise `#fff`.

### DOM manipulation

`applyKeywords(settings: Settings, channelId: string | null): void`

1. **Remove existing highlights** — query `span[data-dh-kw]`, replace each with its child nodes, then call `.normalize()` on the parent element to merge split text nodes back together.
2. **Compute effective keyword list**:
   - If `!settings.keywords.enabled` → empty list (master off).
   - If channel has a `ChannelKeywordConfig` with `inheritGlobals: true` → merge global + channel keywords, deduplicating by `text` (channel keyword wins on conflict).
   - If channel has a `ChannelKeywordConfig` with `inheritGlobals: false` → channel keywords only.
   - If no channel config → global keywords only.
   - Filter to `keyword.enabled === true`.
3. **Walk text nodes** — query `[class*="messageContent"]` elements. For each, walk descendant text nodes. For each enabled keyword, build a case-insensitive `RegExp` and split text nodes on matches. Replace each match with `<span data-dh-kw="<id>" class="dh-kw-<id>">matchedText</span>`.
4. **Update style tag** — write CSS rules for the effective keyword list.

### MutationObserver

Watches the Discord messages scroll container (`[class*="scroller"]`) for `childList` mutations. On each new node added, runs the text-node walk on that node only (avoids re-scanning the full DOM). Uses `{ subtree: true }`.

### SPA channel navigation

Listens to `popstate` and a `setInterval` polling `window.location.pathname` (Discord uses history pushState, not hashchange). On channel change: re-reads settings, re-runs `applyKeywords` with the new `channelId`.

### Channel name capture

`getChannelName(): string | null` — reads `document.title`, strips the leading `# ` prefix if present. Used by the settings page when saving a new channel entry via `chrome.tabs.sendMessage`.

---

## Settings Page UI

### Tab bar

The settings page header gains a tab bar beneath the existing `<h1>`:

```
[ Visibility ]  [ Keywords ]
```

Active tab: white text, 2px `#5865f2` bottom border. Inactive: `#b5bac1`, no border. Switching tabs is pure React state — no routing.

### Keywords tab (`KeywordsSettings.tsx`)

**Master controls card** (`#2b2d31`, `border-radius: 6px`):

- **Keyword highlighting** — label + subtitle + existing-style switch toggle.
- **Highlight style** — label + two style-preview buttons. The active button renders itself using its own highlight style (e.g. the Background button has a yellow `background` on its text). The inactive button renders its own style but is dimmed to `opacity: 0.45`.

**Global Keywords section** (section label + `#2b2d31` card):

Each keyword row: `padding: 10px 14px`, `gap: 10px`. Left to right:
- Color circle (`18px`, `border-radius: 50%`, no border) — clicking opens native `<input type="color">` via a hidden input.
- Keyword text (`flex: 1`, `14px`).
- Eye / EyeOff icon button (Lucide `Eye` / `EyeOff`, `16px`) — toggles `keyword.enabled`.
- X icon button (Lucide `X`, `15px`, muted) — deletes keyword.

Disabled keywords: entire row at `opacity: 0.45`, shows `EyeOff`.

Add keyword row (bottom of card): same `padding: 14px`. Color circle (default `#5865f2`) + text input (`height: 30px`) + Add button (`height: 30px`, `background: #5865f2`). Pressing Enter or clicking Add saves the keyword (ignores blank input).

**Per-Channel Keywords section**:

Each channel card (`#2b2d31`, `border-radius: 6px`, `margin-bottom: 8px`):

- **Header** (`padding: 12px 14px 10px`):
  - Row 1: channel name (`# name`, bold, `14px`) with channel ID fading in on hover (CSS `opacity: 0` → `1`) + trash icon (Lucide `Trash2`, muted) right-aligned.
  - Row 2: `<label>` with `<input type="checkbox">` + "Inherit global keywords" (`13px`, `#b5bac1`) — left-aligned.
- Divider (`1px`, `#1e1f22`).
- Keyword rows (same style as global rows).
- Add channel keyword row: same `padding: 14px`, input `height: 30px`, Add button `height: 30px`.

**Add Channel button** (below all channel cards):

Full-width `<button>`, `background: #232428`, `border-radius: 6px`, centered text `+ Add Channel`, `14px`, `#b5bac1`. Hover lifts to `#2b2d31`. Clicking queries the active Discord tab via `chrome.tabs.sendMessage({ type: 'getChannelInfo' })` to capture `channelId` and `channelName`, then creates a new `ChannelKeywordConfig` entry. If no Discord tab responds, shows a URL input fallback (same pattern as existing element channel overrides).

---

## Popup UI

### Tab bar

Below the existing header, a two-tab bar replaces the current single-view layout:

```
[ Elements ]  [ Keywords ]
```

Same active/inactive style as settings tab bar. Default active tab: Elements (preserves existing behaviour on open).

### Keywords tab

- **Highlighting toggle row**: label `"Highlighting"` + switch toggle. `padding: 10px 14px`.
- **Effective keyword list**: shows the computed effective keywords for the currently active Discord tab's channel. Reads `channelId` from the active tab URL. Global and channel-specific keywords are merged per the scoping rules above. Channel-specific keywords show a small `#channel` label (`10px`, `#4e5058`) before the eye icon to distinguish them.
- Each keyword row: `padding: 8px 14px`. Color circle `14px` + keyword text (`13px`) + optional `#channel` label + Eye/EyeOff icon button (`14px`). No delete in popup — management is in Settings.
- Disabled keywords: dimmed `opacity: 0.45`.
- **Footer**: same "Open Settings" button as Elements tab.

---

## Storage Helpers

New helpers in `src/shared/storage.ts`:

```ts
setKeywordMasterEnabled(enabled: boolean): Promise<void>
setKeywordStyle(style: 'background' | 'chip'): Promise<void>
addGlobalKeyword(keyword: Keyword): Promise<void>
updateGlobalKeyword(id: string, patch: Partial<Keyword>): Promise<void>
removeGlobalKeyword(id: string): Promise<void>
setChannelKeywordConfig(channelId: string, config: ChannelKeywordConfig): Promise<void>
removeChannelKeywordConfig(channelId: string): Promise<void>
addChannelKeyword(channelId: string, keyword: Keyword): Promise<void>
updateChannelKeyword(channelId: string, id: string, patch: Partial<Keyword>): Promise<void>
removeChannelKeyword(channelId: string, id: string): Promise<void>
```

---

## Content Script Message Protocol

New message types handled in `src/content/index.ts`:

| type | direction | payload | response |
|---|---|---|---|
| `getChannelInfo` | settings → content | — | `{ channelId: string \| null, channelName: string \| null }` |

Existing `startPicker` message is unchanged.

---

## Error handling

- If a keyword `text` produces an invalid `RegExp` (e.g. bare `(`), catch the error and skip that keyword silently.
- If `[class*="messageContent"]` matches nothing (Discord DOM changed), `applyKeywords` exits silently — no error thrown.
- If `getChannelInfo` message receives no response (no Discord tab open), the "+ Add Channel" button falls back to a URL input form.

---

## Out of scope

- Regex keyword matching (user-entered regex patterns).
- Keyword import/export.
- Per-keyword style override (style is global).
- Highlighting in voice/video channel metadata or server/channel names.
- Keyword match count badge in popup.
