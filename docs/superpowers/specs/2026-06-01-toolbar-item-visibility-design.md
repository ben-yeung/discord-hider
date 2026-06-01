# Toolbar Item Visibility — Design Spec

**Date:** 2026-06-01  
**Status:** Approved

## Problem

When the top toolbar master toggle is turned off, the entire chrome row (all icon buttons and the search bar) disappears. Users have no way to keep specific items — in particular the search bar — accessible while hiding the rest.

## Goal

When the top toolbar is hidden, allow users to configure which individual items within it survive (remain visible). Defaults: search bar survives, all icon buttons are hidden.

## Scope

- Sub-item survival config only applies when the top toolbar master toggle is **OFF**
- When master toggle is **ON**, all toolbar items show normally (sub-item config has no effect)
- Channel-level overrides are out of scope for this feature

---

## Data Model

### New type

```typescript
// src/shared/types.ts
export type ToolbarItemKey =
  | 'threads'
  | 'notificationSettings'
  | 'pinnedMessages'
  | 'memberList'
  | 'searchBar'
```

### New field on `Settings`

```typescript
topToolbarItems: Record<ToolbarItemKey, boolean>
// true  = item stays visible when master topToolbar toggle is OFF
// false = item is hidden when master topToolbar toggle is OFF
```

### Defaults

```typescript
topToolbarItems: {
  threads:              false,
  notificationSettings: false,
  pinnedMessages:       false,
  memberList:           false,
  searchBar:            true,   // survives by default
}
```

---

## Selectors

Add to `src/content/selectors.ts`:

```typescript
export const TOOLBAR_ITEM_KEYS: readonly ToolbarItemKey[] = [
  'threads', 'notificationSettings', 'pinnedMessages', 'memberList', 'searchBar',
]

export const TOOLBAR_ITEM_LABELS: Record<ToolbarItemKey, string> = {
  threads:              'Threads',
  notificationSettings: 'Notification Settings',
  pinnedMessages:       'Pinned Messages',
  memberList:           'Member List',
  searchBar:            'Search Bar',
}

// CSS selector used to hide each item when it is NOT surviving
export const TOOLBAR_ITEM_SELECTORS: Record<ToolbarItemKey, string> = {
  threads:              '[aria-label="Threads"]',
  notificationSettings: '[aria-label="Notification Settings"]',
  pinnedMessages:       '[aria-label="Pinned Messages"]',
  memberList:           '[aria-label="Show Member List"]',
  searchBar:            'div[data-window-chrome="true"] div[class*="search__"]',
}
```

Icon buttons use stable `aria-label` attributes. The search bar uses a class-fragment match scoped to the chrome container.

---

## CSS Generation

### Current behaviour (to be replaced for topToolbar)

```
div[data-window-chrome="true"] { display: none !important; }
:root { --custom-app-top-bar-height: 0px !important; }
```

### New behaviour when topToolbar master toggle is OFF

`topToolbar` is excluded from the generic `ELEMENT_KEYS → display:none` map. A dedicated branch handles it:

```typescript
if (!resolveVisible('topToolbar', settings, channelId)) {
  for (const itemKey of TOOLBAR_ITEM_KEYS) {
    if (!settings.topToolbarItems[itemKey]) {
      rules.push(`${TOOLBAR_ITEM_SELECTORS[itemKey]} { display: none !important; }`)
    }
  }
  rules.push(':root { --custom-app-top-bar-height: 0px !important; }')
}
```

The toolbar container (`div[data-window-chrome="true"]`) is never hidden with `display: none`. Items not surviving get individual `display: none` rules. The `--custom-app-top-bar-height` CSS variable is still zeroed (controls a separate spacing element, not the toolbar container itself).

**Known layout consequence:** zeroing `--custom-app-top-bar-height` causes the content area to expand upward regardless of whether any toolbar items survive. When the search bar survives, it overlays the top of the chat content — this is intentional and expected.

---

## Storage

`getSettings` merges `topToolbarItems` so existing stored settings without the field get the defaults:

```typescript
topToolbarItems: { ...DEFAULT_SETTINGS.topToolbarItems, ...(stored.topToolbarItems ?? {}) },
```

New helper:

```typescript
export function setToolbarItemVisible(key: ToolbarItemKey, visible: boolean): Promise<void>
```

---

## Settings UI

### ToggleRow — `simple` prop

Add optional `simple?: boolean` to `ToggleRowProps`. When true, the picker (pipette) and reset buttons are not rendered. Used for toolbar sub-item rows.

### Top Toolbar row — expand/collapse

The Top Toolbar entry in the Global Visibility list gets a chevron button alongside the existing controls. Clicking toggles a local `expanded` state. When expanded, a sub-section renders below the row (indented) containing one `ToggleRow` (simple) per `ToolbarItemKey`.

Sub-rows are always expandable regardless of the master toggle state. A descriptor line explains: *"Controls which items remain visible when the toolbar is hidden."*

#### UI structure (expanded)

```
Top Toolbar   [toggle] [picker] [reset] [chevron ▲]
  Controls which items remain visible when the toolbar is hidden.
  Threads               [toggle]
  Notification Settings [toggle]
  Pinned Messages       [toggle]
  Member List           [toggle]
  Search Bar            [toggle]  ← default ON
```

---

## Files Changed

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `ToolbarItemKey`; add `topToolbarItems` to `Settings` |
| `src/content/selectors.ts` | Add `TOOLBAR_ITEM_KEYS`, `TOOLBAR_ITEM_LABELS`, `TOOLBAR_ITEM_SELECTORS` |
| `src/shared/storage.ts` | Add defaults; merge in `getSettings`; add `setToolbarItemVisible` |
| `src/content/styleManager.ts` | Exclude `topToolbar` from generic map; add item-level CSS branch |
| `src/shared/components/ToggleRow.tsx` | Add optional `simple` prop |
| `src/settings/Settings.tsx` | Expand/collapse sub-section for Top Toolbar row with per-item toggles |

## Tests to Update / Add

- `styleManager.test.ts`: cases for topToolbar hidden with various `topToolbarItems` combinations
- `Settings.test.tsx`: expand/collapse of toolbar sub-section; sub-item toggle calls correct handler
- `storage.test.ts`: `getSettings` merge when `topToolbarItems` is absent from stored data
