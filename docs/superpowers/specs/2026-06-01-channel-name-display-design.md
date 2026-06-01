# Channel Name Display — Design Spec

**Date:** 2026-06-01
**Status:** Approved

## Problem

Channel IDs are used as data keys throughout the extension (correct and stable). However, the Settings page and popup display raw numeric channel IDs in all channel lists, which is poor UX. Channel names should be the primary UI label, with the ID accessible on hover.

## Goal

Persist channel names alongside channel IDs and display them in all channel lists. Channel IDs remain the authoritative key in all storage structures.

---

## Data Model

### New field in `Settings`

```ts
channelNames: { [channelId: string]: string }
```

Added as a top-level field on the `Settings` interface. Default value: `{}`.

### Removed field

`ChannelKeywordConfig.channelName: string | null` is **removed**. The central map replaces it. Existing stored values in `channelName` are ignored on read (no migration needed — the field is simply dropped from the type and not written going forward).

No other data structures change. Channel IDs remain the keys for all overrides.

---

## Name Write Strategy

### On popup open — write if absent

When the popup initializes and both `channelId` and `channelName` are known (via `getChannelInfo` message), check `settings.channelNames[channelId]`:
- **Absent**: write the name to storage immediately. This ensures the settings page shows a name after the very first popup open on a channel.
- **Present**: do nothing on open. The stored name is good enough until the user makes a change.

### On any channel change — always refresh

Whenever the popup writes a channel override or keyword action (element toggle, keyword add, keyword remove, keyword toggle), include `channelNames[channelId] = channelName` in the same storage write. This keeps the name current without extra round-trips.

### URL-based additions — no name

When a channel is added via URL input (ChannelOverrides form, KeywordsSettings URL fallback), no channel name is available. The `channelNames` entry is left absent. The UI falls back to showing the raw ID until the user next opens the popup on that channel.

---

## UI Rendering

### Label resolution

```
display = channelNames[id] ?? id
```

All channel lists use this resolution. The raw `id` is always present as the `title` attribute on the label element, visible on hover.

### Long name truncation

CSS only — no JS truncation:

```css
overflow: hidden;
white-space: nowrap;
text-overflow: ellipsis;
max-width: <fits-layout>; /* set per component */
```

No fixed character limit. The ellipsis kicks in at the layout boundary, which varies by component.

---

## Affected Files

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `channelNames: { [channelId: string]: string }` to `Settings`; remove `channelName` from `ChannelKeywordConfig` |
| `src/shared/storage.ts` | Add `channelNames: {}` to `DEFAULT_SETTINGS`; include `channelNames` in `getSettings` merge; add `setChannelName(id, name)` helper |
| `src/popup/Popup.tsx` | On open: write name if absent. On each channel write: include name in same storage patch |
| `src/settings/ChannelOverrides.tsx` | Replace raw `{id}` with resolved name; add `title={id}` tooltip; apply ellipsis CSS |
| `src/settings/KeywordsSettings.tsx` | Replace `cfg.channelName` reads with `settings.channelNames[id]` from the local `settings` state it already manages |
| `src/content/keywordHighlighter.ts` | Remove `channelName` references if any remain after type change |

---

## Out of Scope

- Retroactively back-filling names for existing channel overrides added before this feature (names populate lazily on next popup open)
- Syncing names when a channel is renamed in Discord (next popup open on that channel will overwrite via the "on change" path)
- Showing channel names in the content script itself
