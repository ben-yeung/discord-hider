# Popup Keyword Remove Button

**Date:** 2026-05-29  
**Status:** Approved

## Goal

Add a remove (`X`) button to each keyword row in the popup's Keywords tab, with parity to the settings page. Also label global keywords as `global` to match the existing `#channel` label on channel keywords.

## Scope

Confined to the popup (`src/popup/`). Settings page is untouched. No new storage functions needed.

## Behaviour

### Keyword row layout (updated)

Each row in the Keywords tab now shows:

```
[color circle] [keyword text] [label?] [eye toggle] [X button]
```

- **Label** — shown for all keywords:
  - Global keyword → `global` (using existing `.popup-kw-channel-label` CSS class)
  - Channel keyword → `#channel` (existing, unchanged)
- **Eye toggle** — existing, unchanged
- **X button** — new; removes the keyword

### Remove action

| Keyword type | Action |
|---|---|
| Global | `removeGlobalKeyword(kw.id)` |
| Channel | `removeChannelKeyword(channelId, kw.id)` |

Local React state is updated immediately after the storage write (same immutable-spread pattern used by `handleAddChannelKeyword`).

No confirmation dialog — matches settings page behaviour.

### When `channelId` is null

Global keywords are still shown (and removable) when on Discord but not a channel page. The `X` button calls `removeGlobalKeyword`. The `global` label still appears.

## Files

| File | Change |
|---|---|
| `src/popup/popup.css` | Add `.popup-kw-remove-btn` rule |
| `src/popup/Popup.tsx` | Import `X`, import `removeGlobalKeyword`/`removeChannelKeyword`, add `handleRemoveKeyword`, render label + X button in each row |
| `src/popup/Popup.test.tsx` | Add 2 tests: remove global keyword, remove channel keyword |

## CSS

```css
.popup-kw-remove-btn {
  background: transparent;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  color: #4e5058;
  cursor: pointer;
  flex-shrink: 0;
}

.popup-kw-remove-btn:hover {
  color: #ed4245;
}
```

## Component changes

### New imports

```ts
import { Settings, Eye, EyeOff, X } from 'lucide-react'
import {
  // existing...
  removeGlobalKeyword,
  removeChannelKeyword,
} from '../shared/storage'
```

### New handler

```ts
async function handleRemoveKeyword(kw: Keyword, isChannel: boolean) {
  if (!settings) return
  if (isChannel && channelId) {
    await removeChannelKeyword(channelId, kw.id)
    const updated: SettingsType = {
      ...settings,
      keywords: {
        ...settings.keywords,
        channelOverrides: {
          ...settings.keywords.channelOverrides,
          [channelId]: {
            ...settings.keywords.channelOverrides[channelId],
            keywords: settings.keywords.channelOverrides[channelId].keywords.filter(k => k.id !== kw.id),
          },
        },
      },
    }
    setSettings(updated)
  } else {
    await removeGlobalKeyword(kw.id)
    setSettings(s =>
      s ? { ...s, keywords: { ...s.keywords, keywords: s.keywords.keywords.filter(k => k.id !== kw.id) } } : s
    )
  }
}
```

### Row render (updated)

```tsx
<div key={kw.id} className={`popup-kw-row${kw.enabled ? '' : ' disabled'}`}>
  <div className="popup-kw-circle" style={{ background: kw.color }} />
  <span className="popup-kw-text">{kw.text}</span>
  <span className="popup-kw-channel-label">{isChannel ? '#channel' : 'global'}</span>
  <button className="icon-btn" title="Toggle keyword visibility" onClick={...}>
    {kw.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
  </button>
  <button
    className="popup-kw-remove-btn"
    title="Remove keyword"
    onClick={() => handleRemoveKeyword(kw, isChannel)}
  >
    <X size={14} />
  </button>
</div>
```

## Tests

```
describe('Popup keyword remove')
  it('removes a global keyword when X is clicked')
  it('removes a channel keyword when X is clicked')
```

Each test:
- Renders popup on appropriate URL
- Navigates to Keywords tab
- Clicks the X button on a keyword row
- Asserts `chrome.storage.sync.set` was called with settings that exclude the removed keyword
