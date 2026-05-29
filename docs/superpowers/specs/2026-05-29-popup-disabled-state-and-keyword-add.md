# Popup Disabled State & Per-Channel Keyword Add

**Date:** 2026-05-29
**Status:** Approved

## Goal

Two related improvements to the popup:
1. Show a disabled state when the active tab is not on `https://discord.com/*` — prevents user confusion and avoids sending messages to non-Discord content scripts.
2. Add a keyword input to the popup's Keywords tab that saves new keywords to the per-channel config when on a Discord channel page.

The settings page is unaffected.

## Scope

**In scope:**
- `src/popup/Popup.tsx` — disabled state guard + keyword add row
- `src/popup/popup.css` — styles for disabled notice + add row
- `src/popup/Popup.test.tsx` — tests for both behaviors

**Out of scope:**
- Settings page (no changes)
- Global keyword add from popup (popup always saves per-channel)
- Keyword remove/edit from popup (toggle-only, unchanged)

## Behavior

### Disabled State

The `useEffect` tab query already runs on mount. Extend it to also detect whether the active tab URL starts with `https://discord.com/`.

- **Not on discord.com:** render only the header + a centered notice ("Discord Hider only works on Discord.") + footer (Open Settings). No tabs, no controls.
- **On discord.com:** render normally (existing behavior unchanged).

The `isDiscordPage` boolean is derived from the tab URL in the same `useEffect` as `channelId`. State: `const [isDiscordPage, setIsDiscordPage] = useState(false)`.

### Keyword Add Row

Shown only when `channelId` is set (URL is `discord.com/channels/:server/:channel`).

- Renders at the bottom of the keyword list: small color swatch (18×18 circle, default `#5865f2`) + text input (`placeholder="Add channel keyword…"`) + Add button.
- On submit (button click or Enter): if `channelId` has no existing config in `settings.keywords.channelOverrides`, create one with `{ channelName: null, inheritGlobals: true, keywords: [] }` via `setChannelKeywordConfig`, then append via `addChannelKeyword`. If config already exists, call `addChannelKeyword` directly.
- Guard: blank input does not trigger save.
- After save: clear text input, keep color for next entry.

When on discord.com but no `channelId` (e.g., DMs, home): add row is absent; a small note reads "Navigate to a channel to add keywords." replaces it.

## Data Flow

```
useEffect → chrome.tabs.query → setIsDiscordPage, setChannelId
                                      ↓
                             isDiscordPage === false → show disabled notice
                             isDiscordPage === true, channelId === null → show note, no add row
                             isDiscordPage === true, channelId set → show add row
                                      ↓
                             handleAddChannelKeyword(text, color)
                                      ↓
                             channelOverrides[channelId] exists?
                               yes → addChannelKeyword(channelId, kw)
                               no  → setChannelKeywordConfig(channelId, cfg)
                                      then addChannelKeyword(channelId, kw)
```

## CSS

All styles added to `src/popup/popup.css` (settings.css is not imported by the popup):
- `.popup-disabled-notice` — centered, muted text, padding 24px 16px
- `.popup-kw-channel-note` — small muted note in keyword section when no channelId
- `.popup-kw-add-row` — flex row, padding 10px 14px, gap 8px
- `.popup-kw-add-input` — same pattern as settings `.kw-add-input` (dark bg, border, 30px height)
- `.popup-kw-add-btn` — same pattern as settings `.kw-add-btn` (blurple, 30px height)
- `.popup-kw-color-circle` — 14×14 circle (matching existing `.popup-kw-circle` size)

## Tests

New tests in `Popup.test.tsx`:
1. Shows disabled notice when active tab is not discord.com
2. Does not render tab bar when not on discord.com
3. Shows "Navigate to a channel" note when on discord.com but no channelId
4. Shows add row when channelId is set
5. Adds a channel keyword on Add click (creates config if missing)
6. Adds a channel keyword on Enter key
7. Does not add blank keyword
