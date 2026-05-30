# Channel Reset Button — Design Spec

**Date:** 2026-05-29
**Status:** Approved

## Overview

Add a "Reset #channel-name" button to the Elements tab of the popup. When clicked, it creates or overwrites a per-channel override that forces all elements visible on the current channel, without affecting any other channel's settings.

## Behaviour

- The button appears at the bottom of the Elements tab when **all of these are true**:
  - The popup is open on a Discord channel page (a channel ID is present in the URL)
  - At least one element is currently hidden on that channel (after applying channel overrides on top of global toggles)
- The button is absent when everything is already visible, or when not on a channel page.
- **Label:** "Reset #channel-name", where the channel name is fetched from the content script via the existing `getChannelInfo` message. Falls back to "Reset this channel" if the name is unavailable.
- **Click action:** Calls `resetChannelToVisible(channelId)`, which writes `channelOverrides[channelId] = { serverList: true, channelColumn: true, topToolbar: true, chatBar: true }` — creating or overwriting the entry.
- After the click, `chrome.storage.onChanged` fires, the popup re-renders, all toggles show as on, and the button disappears.
- The override persists. Every subsequent visit to that channel shows all elements regardless of global toggles.

## Effective visibility resolution

To determine whether any element is hidden, the popup uses the same logic as `styleManager.ts`:

```
visible = channelOverrides[channelId]?.[key] ?? elements[key].visible
```

If this resolves to `false` for any element key, the button is shown.

## Files changed

### `src/shared/storage.ts`

New export:

```ts
export async function resetChannelToVisible(channelId: string): Promise<void>
```

Reads settings, sets `channelOverrides[channelId]` to all element keys mapped to `true`, saves. Creates the entry if it doesn't exist; overwrites any existing partial override.

### `src/popup/Popup.tsx`

- Add `channelName: string | null` state (initially `null`).
- In the mount `useEffect`, after resolving `channelId` from the active tab URL, send `getChannelInfo` to the content script and store `channelName`. Wrap in try/catch — silently ignore if not on Discord or content script isn't ready.
- Compute `anyHidden` from `settings` + `channelId` using the resolution logic above.
- Conditionally render the Reset button between `.popup-rows` and `.popup-footer` when `anyHidden && channelId`.

### `src/popup/popup.css`

New class `.popup-reset-btn`:

```css
.popup-reset-btn {
  /* identical shape to .popup-footer button */
  width: 100%;
  background: transparent;
  border: 1px solid #5865f2;
  border-radius: 4px;
  padding: 6px;
  color: #8891f2;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.popup-reset-btn:hover {
  border-color: #7983f5;
  color: #a8b0f8;
}
```

Sits in a wrapper `div.popup-reset-section` styled the same as `.popup-footer` (padding: 10px 14px, background: #2b2d31, border-top: 1px solid #1e1f22).

## Testing

- **`storage.test.ts`** — `resetChannelToVisible`:
  - Creates a new entry when no override exists.
  - Overwrites an existing partial entry (e.g., only some keys set).
- **`Popup.test.tsx`**:
  - Button renders when `channelId` is set and at least one element resolves to hidden.
  - Button is absent when all elements are visible.
  - Button is absent when not on a channel (no `channelId`).
  - Clicking the button calls `resetChannelToVisible` with the correct channel ID.

## Out of scope

- Removing or undoing a channel whitelist (no "un-reset" action in this version).
- Per-channel element toggling (the existing toggles remain global-only).
- Visual indicator for an already-whitelisted channel.
