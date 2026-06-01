# Channel Name Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display human-readable channel names (instead of raw IDs) in all channel lists across the settings page and popup, with channel IDs accessible on hover.

**Architecture:** Add `channelNames: { [channelId: string]: string }` as a top-level field in `Settings`. The popup writes a channel name to this map on open (if absent) and on every channel-modifying action. All UI components resolve `channelNames[id] ?? id` for display, with `title={id}` or existing CSS hover effects surfacing the raw ID. `ChannelKeywordConfig.channelName` is removed — replaced entirely by the central map.

**Tech Stack:** TypeScript, React, Vitest, Chrome Extension APIs

---

## File Map

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `channelNames` to `Settings`; remove `channelName` from `ChannelKeywordConfig` |
| `src/shared/storage.ts` | Add `channelNames: {}` to `DEFAULT_SETTINGS`; expand `getSettings` merge; add `updateChannelName` helper |
| `src/shared/storage.test.ts` | Remove `channelName` from `ChannelKeywordConfig` fixtures; add tests for `updateChannelName` and `channelNames` merge |
| `src/popup/Popup.tsx` | Write name on open if absent; refresh name on every channel-mutating action; extract inline keyword toggle to handler |
| `src/popup/Popup.test.tsx` | Remove `channelName: null` from `settingsWithChannel` fixture |
| `src/settings/ChannelOverrides.tsx` | Show `channelNames[id] ?? id` with `title={id}` tooltip |
| `src/settings/settings.css` | Update `.channel-id` for truncation; update `.ch-kw-name` and `.ch-kw-name-wrap` for truncation |
| `src/settings/KeywordsSettings.tsx` | Replace `cfg.channelName` with `settings.channelNames[id]`; update `handleAddChannel` and `handleUrlFallbackConfirm`; import `updateChannelName` |
| `src/settings/KeywordsSettings.test.tsx` | Move `channelName` field from `ChannelKeywordConfig` fixture to top-level `channelNames`; update name-display assertion |

---

### Task 1: Update types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Replace the file contents**

```ts
export type ElementKey = 'serverList' | 'channelColumn' | 'topToolbar' | 'chatBar'

export interface ElementConfig {
  visible: boolean
  selector: string | null
}

export interface Keyword {
  id: string           // crypto.randomUUID() — used as CSS class suffix
  text: string         // case-insensitive substring to match
  color: string        // hex e.g. "#fde047"
  enabled: boolean     // eye-icon toggle
}

export interface ChannelKeywordConfig {
  inheritGlobals: boolean      // if true, global + channel keywords both apply
  keywords: Keyword[]
}

export interface KeywordSettings {
  enabled: boolean
  style: 'background' | 'chip'
  keywords: Keyword[]
  channelOverrides: {
    [channelId: string]: ChannelKeywordConfig
  }
}

export interface Settings {
  elements: Record<ElementKey, ElementConfig>
  channelNames: { [channelId: string]: string }
  channelOverrides: {
    [channelId: string]: Partial<Record<ElementKey, boolean>>
  }
  keywords: KeywordSettings
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add channelNames to Settings, remove channelName from ChannelKeywordConfig"
```

---

### Task 2: Update storage — defaults, merge, and new helper

**Files:**
- Modify: `src/shared/storage.ts`
- Modify: `src/shared/storage.test.ts`

- [ ] **Step 1: Write failing tests for `updateChannelName` and `channelNames` merge**

In `src/shared/storage.test.ts`, add `updateChannelName` to the first import block:

```ts
import {
  getSettings,
  setElementVisible,
  setElementSelector,
  setChannelOverride,
  removeChannelOverride,
  resetChannelToVisible,
  setToolbarItemVisible,
  updateChannelName,
  DEFAULT_SETTINGS,
} from './storage'
```

Add a new `describe('channelNames storage', ...)` block after the existing `topToolbarItems storage` block:

```ts
describe('channelNames storage', () => {
  let stored: Record<string, unknown> = {}

  beforeEach(() => {
    stored = {}
    vi.clearAllMocks()
    vi.mocked(chrome.storage.sync.get).mockImplementation((keys, cb) => {
      const key = typeof keys === 'string' ? keys : (Object.keys(keys as object)[0] ?? '')
      cb?.({ [key]: stored[key] })
      return Promise.resolve({ [key]: stored[key] })
    })
    vi.mocked(chrome.storage.sync.set).mockImplementation((items, cb) => {
      Object.assign(stored, items)
      cb?.()
      return Promise.resolve()
    })
  })

  it('DEFAULT_SETTINGS has channelNames as empty object', async () => {
    const s = await getSettings()
    expect(s.channelNames).toEqual({})
  })

  it('updateChannelName persists the channel name', async () => {
    await updateChannelName('789012', '# general')
    const s = await getSettings()
    expect(s.channelNames['789012']).toBe('# general')
  })

  it('updateChannelName overwrites existing name', async () => {
    await updateChannelName('789012', '# general')
    await updateChannelName('789012', '# announcements')
    const s = await getSettings()
    expect(s.channelNames['789012']).toBe('# announcements')
  })

  it('getSettings fills in channelNames when absent from stored data', async () => {
    stored['settings'] = { elements: DEFAULT_SETTINGS.elements, channelOverrides: {} }
    const s = await getSettings()
    expect(s.channelNames).toEqual({})
  })

  it('getSettings merges stored channelNames with defaults', async () => {
    stored['settings'] = { ...DEFAULT_SETTINGS, channelNames: { '789012': 'general' } }
    const s = await getSettings()
    expect(s.channelNames['789012']).toBe('general')
  })
})
```

- [ ] **Step 2: Fix `ChannelKeywordConfig` fixtures in `storage.test.ts` — remove `channelName`**

Remove `channelName` from all `ChannelKeywordConfig` literals in the `keyword storage` describe block. The updated fixtures (replace each occurrence):

Line 178 area — `setChannelKeywordConfig creates channel entry`:
```ts
const cfg: ChannelKeywordConfig = { inheritGlobals: true, keywords: [kw1] }
await setChannelKeywordConfig('789012', cfg)
const s = await getSettings()
expect(s.keywords.channelOverrides['789012']).toEqual(cfg)
```

Line 185 area — `removeChannelKeywordConfig deletes channel entry`:
```ts
const cfg: ChannelKeywordConfig = { inheritGlobals: true, keywords: [] }
```

Line 193 area — `addChannelKeyword appends to channel keywords`:
```ts
const cfg: ChannelKeywordConfig = { inheritGlobals: true, keywords: [] }
```

Line 201 area — `updateChannelKeyword patches channel keyword by id`:
```ts
const cfg: ChannelKeywordConfig = { inheritGlobals: true, keywords: [kw1] }
```

Line 209 area — `removeChannelKeyword removes channel keyword by id`:
```ts
const cfg: ChannelKeywordConfig = { inheritGlobals: true, keywords: [kw1, kw2] }
```

- [ ] **Step 3: Run tests to confirm failures**

```bash
npm test
```

Expected: failures for `updateChannelName` (not yet defined) and TypeScript errors in fixture tests.

- [ ] **Step 4: Update `storage.ts` — add `channelNames` to `DEFAULT_SETTINGS`**

In `src/shared/storage.ts`, update `DEFAULT_SETTINGS`:

```ts
export const DEFAULT_SETTINGS: Settings = {
  elements: {
    serverList: { visible: true, selector: null },
    channelColumn: { visible: true, selector: null },
    topToolbar: { visible: true, selector: null },
    chatBar: { visible: true, selector: null },
  },
  channelNames: {},
  channelOverrides: {},
  keywords: {
    enabled: true,
    style: 'background',
    keywords: [],
    channelOverrides: {},
  },
}
```

- [ ] **Step 5: Update `getSettings` merge to include `channelNames`**

Replace the `resolve(...)` call in `getSettings`:

```ts
resolve({
  ...DEFAULT_SETTINGS,
  ...stored,
  channelNames: { ...DEFAULT_SETTINGS.channelNames, ...(stored.channelNames ?? {}) },
  keywords: { ...DEFAULT_SETTINGS.keywords, ...(stored.keywords ?? {}) },
})
```

- [ ] **Step 6: Add `updateChannelName` helper at the end of storage.ts**

```ts
export async function updateChannelName(channelId: string, name: string): Promise<void> {
  const s = await getSettings()
  s.channelNames[channelId] = name
  await saveSettings(s)
}
```

- [ ] **Step 7: Run tests and confirm pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/shared/storage.ts src/shared/storage.test.ts
git commit -m "feat: channelNames storage — DEFAULT_SETTINGS, merge, updateChannelName helper"
```

---

### Task 3: Update `Popup.tsx` — write name on open if absent, refresh on changes

**Files:**
- Modify: `src/popup/Popup.tsx`
- Modify: `src/popup/Popup.test.tsx`

- [ ] **Step 1: Fix `settingsWithChannel` fixture in `Popup.test.tsx`**

Remove `channelName: null` from the `ChannelKeywordConfig` object in `settingsWithChannel` (around line 184):

```ts
const settingsWithChannel = {
  ...DEFAULT_SETTINGS,
  keywords: {
    enabled: true,
    style: 'background' as const,
    keywords: [],
    channelOverrides: {
      '456': {
        inheritGlobals: false,
        keywords: [{ id: 'c1', text: 'critical', color: '#5865f2', enabled: true }],
      },
    },
  },
}
```

- [ ] **Step 2: Run tests to confirm they pass (no regressions)**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Update `Popup.tsx` — import `updateChannelName` and refactor**

Add `updateChannelName` and `getSettings` to the storage import at the top of `Popup.tsx`:

```ts
import {
  getSettings,
  saveSettings,
  setElementVisible,
  setElementSelector,
  updateGlobalKeyword,
  updateChannelKeyword,
  setKeywordMasterEnabled,
  setChannelOverride,
  removeGlobalKeyword,
  removeChannelKeyword,
  resetChannelToVisible,
  updateChannelName,
} from '../shared/storage'
```

- [ ] **Step 4: Write name on open if absent — update `useEffect`**

In the `useEffect`, replace the `if (t?.id && id)` block:

```ts
if (t?.id && id) {
  try {
    const info = await chrome.tabs.sendMessage(t.id, { type: 'getChannelInfo' })
    const name = info?.channelName ?? null
    setChannelName(name)
    if (name) {
      const s = await getSettings()
      if (!s.channelNames[id]) {
        await updateChannelName(id, name)
      }
    }
  } catch { /* not on Discord or content script not ready */ }
}
```

- [ ] **Step 5: Refresh name on `handleToggle`**

Replace the `if (channelId)` branch inside `handleToggle`:

```ts
if (channelId) {
  await setChannelOverride(channelId, key, next)
  if (channelName) await updateChannelName(channelId, channelName)
  setSettings(s => s ? {
    ...s,
    channelOverrides: { ...s.channelOverrides, [channelId]: { ...s.channelOverrides[channelId], [key]: next } },
  } : s)
}
```

- [ ] **Step 6: Extract keyword toggle to handler and refresh name**

Add a `handleKeywordToggle` function before the `return`:

```ts
async function handleKeywordToggle(kw: Keyword, isChannel: boolean) {
  if (isChannel && channelId) {
    await updateChannelKeyword(channelId, kw.id, { enabled: !kw.enabled })
    if (channelName) await updateChannelName(channelId, channelName)
  } else {
    await updateGlobalKeyword(kw.id, { enabled: !kw.enabled })
  }
}
```

Replace the inline `onClick` on the Eye/EyeOff button (previously calling `updateChannelKeyword`/`updateGlobalKeyword` directly):

```tsx
onClick={() => handleKeywordToggle(kw, isChannel)}
```

- [ ] **Step 7: Refresh name on `handleAddChannelKeyword`**

Update `handleAddChannelKeyword` to include the channel name in the same write and remove `channelName` from `ChannelKeywordConfig`:

```ts
async function handleAddChannelKeyword() {
  if (!newKwText.trim() || !channelId || !settings) return
  const kw: Keyword = { id: crypto.randomUUID(), text: newKwText.trim(), color: newKwColor, enabled: true }
  const s = await getSettings()

  const existingConfig = s.keywords.channelOverrides[channelId]
  const updated: SettingsType = {
    ...s,
    channelNames: channelName ? { ...s.channelNames, [channelId]: channelName } : s.channelNames,
    keywords: {
      ...s.keywords,
      channelOverrides: {
        ...s.keywords.channelOverrides,
        [channelId]: {
          inheritGlobals: existingConfig?.inheritGlobals ?? true,
          keywords: [...(existingConfig?.keywords ?? []), kw],
        },
      },
    },
  }

  await saveSettings(updated)
  setSettings(updated)
  setNewKwText('')
}
```

- [ ] **Step 8: Refresh name on `handleRemoveKeyword`**

Replace `handleRemoveKeyword` in full:

```ts
async function handleRemoveKeyword(kw: Keyword, isChannel: boolean) {
  if (!settings) return
  if (isChannel && channelId) {
    await removeChannelKeyword(channelId, kw.id)
    if (channelName) await updateChannelName(channelId, channelName)
    setSettings(s => {
      if (!s) return s
      return {
        ...s,
        keywords: {
          ...s.keywords,
          channelOverrides: {
            ...s.keywords.channelOverrides,
            [channelId]: {
              ...s.keywords.channelOverrides[channelId],
              keywords: s.keywords.channelOverrides[channelId].keywords.filter(k => k.id !== kw.id),
            },
          },
        },
      }
    })
  } else {
    await removeGlobalKeyword(kw.id)
    setSettings(s =>
      s ? { ...s, keywords: { ...s.keywords, keywords: s.keywords.keywords.filter(k => k.id !== kw.id) } } : s
    )
  }
}
```

- [ ] **Step 9: Run tests and confirm pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/popup/Popup.tsx src/popup/Popup.test.tsx
git commit -m "feat: popup writes channel name on open (if absent) and on every channel mutation"
```

---

### Task 4: Update `ChannelOverrides.tsx` — display name with tooltip and truncation

**Files:**
- Modify: `src/settings/ChannelOverrides.tsx`
- Modify: `src/settings/settings.css`

- [ ] **Step 1: Update the channel label in `ChannelOverrides.tsx`**

Replace the `<span className="channel-id">{id}</span>` line inside the `overrides.map`:

```tsx
<span className="channel-id" title={id}>
  {settings.channelNames[id] ?? id}
</span>
```

- [ ] **Step 2: Update `.channel-id` CSS in `settings.css` to support truncation**

Replace the existing `.channel-id` rule (line 79):

```css
.channel-id {
  flex: 1;
  min-width: 0;
  color: #b5bac1;
  font-size: 13px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: default;
}
```

(`min-width: 0` is required so the flex item can shrink below its content width, enabling the ellipsis to appear.)

- [ ] **Step 3: Run tests to confirm no regressions**

```bash
npm test
```

Expected: all tests pass. `Settings.test.tsx` line 76 (`findByText('789012')`) still passes because the `withOverride` fixture uses `DEFAULT_SETTINGS` which has `channelNames: {}` — so the display falls back to the raw ID.

- [ ] **Step 4: Commit**

```bash
git add src/settings/ChannelOverrides.tsx src/settings/settings.css
git commit -m "feat: ChannelOverrides shows channel name with ID tooltip and ellipsis truncation"
```

---

### Task 5: Update `KeywordsSettings.tsx` — use `channelNames` map

**Files:**
- Modify: `src/settings/KeywordsSettings.tsx`
- Modify: `src/settings/settings.css`
- Modify: `src/settings/KeywordsSettings.test.tsx`

- [ ] **Step 1: Update `KeywordsSettings.test.tsx` — move name to `channelNames`**

Replace the `withKeywords` fixture to remove `channelName` from `ChannelKeywordConfig` and add it to the top-level `channelNames` map:

```ts
const withKeywords: Settings = {
  ...DEFAULT_SETTINGS,
  channelNames: { '789012': '# sprint-planning' },
  keywords: {
    enabled: true,
    style: 'background',
    keywords: [
      { id: 'aaa', text: 'urgent', color: '#ef4444', enabled: true },
      { id: 'bbb', text: 'shipped', color: '#57f287', enabled: false },
    ],
    channelOverrides: {
      '789012': {
        inheritGlobals: true,
        keywords: [{ id: 'ccc', text: 'sprint', color: '#a78bfa', enabled: true }],
      },
    },
  },
}
```

- [ ] **Step 2: Run tests to confirm failures (name now comes from wrong place)**

```bash
npm test
```

Expected: `renders per-channel section with channel name` fails because `KeywordsSettings.tsx` still reads `cfg.channelName`.

- [ ] **Step 3: Add `updateChannelName` import to `KeywordsSettings.tsx`**

```ts
import {
  getSettings,
  setKeywordMasterEnabled,
  setKeywordStyle,
  addGlobalKeyword,
  updateGlobalKeyword,
  removeGlobalKeyword,
  setChannelKeywordConfig,
  removeChannelKeywordConfig,
  addChannelKeyword,
  updateChannelKeyword,
  removeChannelKeyword,
  updateChannelName,
} from '../shared/storage'
```

- [ ] **Step 4: Update channel name display in `KeywordsSettings.tsx`**

Replace the `ch-kw-name-wrap` JSX inside the `Object.entries(kws.channelOverrides).map` (previously showed `cfg.channelName ?? \`#${channelId}\`` and conditionally rendered `ch-kw-id`):

```tsx
<div className="ch-kw-name-wrap">
  <span className="ch-kw-name">
    {settings.channelNames[channelId] ?? channelId}
  </span>
  <span className="ch-kw-id">{channelId}</span>
</div>
```

(`ch-kw-id` is always rendered now — not conditional — and fades in on hover via existing CSS.)

- [ ] **Step 5: Update `handleAddChannel` — remove `channelName` from config, call `updateChannelName`**

Replace `handleAddChannel`:

```ts
async function handleAddChannel() {
  let channelId: string | null = null
  let channelName: string | null = null
  try {
    const [tab] = await chrome.tabs.query({ active: true, url: 'https://discord.com/*' })
    if (tab?.id) {
      const info = await chrome.tabs.sendMessage(tab.id, { type: 'getChannelInfo' }) as
        { channelId: string | null; channelName: string | null }
      channelId = info.channelId
      channelName = info.channelName
    }
  } catch { /* no Discord tab */ }

  if (channelId) {
    const cfg: ChannelKeywordConfig = { inheritGlobals: true, keywords: [] }
    await setChannelKeywordConfig(channelId, cfg)
    if (channelName) await updateChannelName(channelId, channelName)
  } else {
    setAddingChannel(true)
  }
}
```

- [ ] **Step 6: Update `handleUrlFallbackConfirm` — remove `channelName: null` from config**

Replace `handleUrlFallbackConfirm`:

```ts
async function handleUrlFallbackConfirm() {
  const channelId = extractChannelId(channelUrlInput)
  if (!channelId) return
  const cfg: ChannelKeywordConfig = { inheritGlobals: true, keywords: [] }
  await setChannelKeywordConfig(channelId, cfg)
  setAddingChannel(false)
  setChannelUrlInput('')
}
```

- [ ] **Step 7: Add truncation CSS for `.ch-kw-name` and update `.ch-kw-name-wrap` in `settings.css`**

Replace the `.ch-kw-name-wrap` rule (currently line 291):

```css
.ch-kw-name-wrap { display: flex; align-items: center; gap: 8px; min-width: 0; }
```

Replace the `.ch-kw-name` rule (currently line 293):

```css
.ch-kw-name {
  color: #dbdee1;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 300px;
}
```

- [ ] **Step 8: Run tests and confirm pass**

```bash
npm test
```

Expected: all tests pass including `renders per-channel section with channel name` (which now reads from `settings.channelNames`).

- [ ] **Step 9: Commit**

```bash
git add src/settings/KeywordsSettings.tsx src/settings/KeywordsSettings.test.tsx src/settings/settings.css
git commit -m "feat: KeywordsSettings resolves channel names from central channelNames map"
```
