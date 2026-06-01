# Toolbar Item Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the top toolbar master toggle is OFF, let users choose which toolbar items (icon buttons + search bar) remain visible, with search bar surviving by default.

**Architecture:** Add `topToolbarItems: Record<ToolbarItemKey, boolean>` to `Settings`. In `buildCSS`, exclude the toolbar container from the generic `display:none` map and instead emit per-item hide rules. In the Settings UI, render a `TopToolbarRow` component with an expand/collapse chevron that shows per-item toggles using `ToggleRow simple`.

**Tech Stack:** TypeScript, React 18, Vitest, Testing Library, CSS (no new deps)

---

## File Map

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `ToolbarItemKey`; add `topToolbarItems` to `Settings` |
| `src/content/selectors.ts` | Add `TOOLBAR_ITEM_KEYS`, `TOOLBAR_ITEM_LABELS`, `TOOLBAR_ITEM_SELECTORS` |
| `src/shared/storage.ts` | Add defaults; update merge in `getSettings`; add `setToolbarItemVisible` |
| `src/content/styleManager.ts` | Exclude topToolbar from generic map; emit per-item hide rules |
| `src/content/styleManager.test.ts` | Fix `allHidden` fixture; add toolbar item CSS tests |
| `src/shared/components/ToggleRow.tsx` | Add `simple` and `extraActions` optional props |
| `src/shared/components/ToggleRow.test.tsx` | Add two tests for new props |
| `src/settings/TopToolbarRow.tsx` | New component — master toggle row + chevron + sub-item rows |
| `src/settings/TopToolbarRow.test.tsx` | New test file for TopToolbarRow |
| `src/settings/Settings.tsx` | Replace topToolbar `ToggleRow` with `TopToolbarRow`; add `handleItemToggle` |
| `src/settings/Settings.test.tsx` | Add two tests for expand button and sub-items |
| `src/settings/settings.css` | Add toolbar sub-item styles |

---

### Task 1: Add ToolbarItemKey type, update Settings, add selectors constants

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/content/selectors.ts`

No tests needed — pure type and constant definitions.

**Note:** After this task, `styleManager.test.ts` will have a TypeScript error on the `allHidden` fixture (missing `topToolbarItems`). This is expected and fixed in Task 3.

- [ ] **Step 1: Update types.ts**

Replace the full content of `src/shared/types.ts` with:

```typescript
export type ElementKey = 'serverList' | 'channelColumn' | 'topToolbar' | 'chatBar'

export type ToolbarItemKey = 'threads' | 'notificationSettings' | 'pinnedMessages' | 'memberList' | 'searchBar'

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
  channelName: string | null   // from document.title at save time
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
  channelOverrides: {
    [channelId: string]: Partial<Record<ElementKey, boolean>>
  }
  keywords: KeywordSettings
  topToolbarItems: Record<ToolbarItemKey, boolean>
}
```

- [ ] **Step 2: Update selectors.ts**

Replace the full content of `src/content/selectors.ts` with:

```typescript
import type { ElementKey, ToolbarItemKey } from "../shared/types";

export const ELEMENT_KEYS: readonly ElementKey[] = ["serverList", "channelColumn", "topToolbar", "chatBar"];

export const DEFAULT_SELECTORS: Record<ElementKey, string> = {
  serverList: 'nav[aria-label="Servers sidebar"]',
  channelColumn: 'div[class*="sidebarList"]',
  topToolbar: 'div[data-window-chrome="true"]',
  chatBar: 'div[class*="channelTextArea"]',
};

export const LABELS: Record<ElementKey, string> = {
  serverList: "Server List",
  channelColumn: "Channel Column",
  topToolbar: "Top Toolbar",
  chatBar: "Chat Bar",
};

export const TOOLBAR_ITEM_KEYS: readonly ToolbarItemKey[] = [
  'threads', 'notificationSettings', 'pinnedMessages', 'memberList', 'searchBar',
];

export const TOOLBAR_ITEM_LABELS: Record<ToolbarItemKey, string> = {
  threads: 'Threads',
  notificationSettings: 'Notification Settings',
  pinnedMessages: 'Pinned Messages',
  memberList: 'Member List',
  searchBar: 'Search Bar',
};

// CSS selector used to hide each item when it is not surviving
export const TOOLBAR_ITEM_SELECTORS: Record<ToolbarItemKey, string> = {
  threads: '[aria-label="Threads"]',
  notificationSettings: '[aria-label="Notification Settings"]',
  pinnedMessages: '[aria-label="Pinned Messages"]',
  memberList: '[aria-label="Show Member List"]',
  searchBar: 'div[data-window-chrome="true"] div[class*="search__"]',
};
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts src/content/selectors.ts
git commit -m "feat: add ToolbarItemKey type and toolbar item selector constants"
```

---

### Task 2: Update storage — defaults, merge, setToolbarItemVisible

**Files:**
- Modify: `src/shared/storage.ts`
- Modify: `src/shared/storage.test.ts`

- [ ] **Step 1: Write failing tests**

Add this describe block to the end of `src/shared/storage.test.ts` (inside the file, after the existing `keyword storage` describe block). Also add `setToolbarItemVisible` to the import at the top:

```typescript
// Change the first import line to:
import {
  getSettings,
  setElementVisible,
  setElementSelector,
  setChannelOverride,
  removeChannelOverride,
  resetChannelToVisible,
  setToolbarItemVisible,
  DEFAULT_SETTINGS,
} from './storage'
```

Add at the end of the file:

```typescript
describe('topToolbarItems storage', () => {
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

  it('getSettings fills in default topToolbarItems when field is absent from stored data', async () => {
    stored['settings'] = {
      elements: DEFAULT_SETTINGS.elements,
      channelOverrides: {},
      keywords: DEFAULT_SETTINGS.keywords,
    }
    const s = await getSettings()
    expect(s.topToolbarItems).toEqual(DEFAULT_SETTINGS.topToolbarItems)
  })

  it('setToolbarItemVisible persists the new value', async () => {
    await setToolbarItemVisible('searchBar', false)
    const s = await getSettings()
    expect(s.topToolbarItems.searchBar).toBe(false)
  })

  it('setToolbarItemVisible for one key does not affect other keys', async () => {
    await setToolbarItemVisible('threads', true)
    const s = await getSettings()
    expect(s.topToolbarItems.memberList).toBe(DEFAULT_SETTINGS.topToolbarItems.memberList)
    expect(s.topToolbarItems.searchBar).toBe(DEFAULT_SETTINGS.topToolbarItems.searchBar)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test
```

Expected: the three new tests fail with errors about `setToolbarItemVisible` not existing and `topToolbarItems` not being on DEFAULT_SETTINGS.

- [ ] **Step 3: Implement storage changes**

Replace the full content of `src/shared/storage.ts` with:

```typescript
import type { Settings, ElementKey, ElementConfig, Keyword, ChannelKeywordConfig, KeywordSettings, ToolbarItemKey } from './types'

export const DEFAULT_SETTINGS: Settings = {
  elements: {
    serverList: { visible: true, selector: null },
    channelColumn: { visible: true, selector: null },
    topToolbar: { visible: true, selector: null },
    chatBar: { visible: true, selector: null },
  },
  channelOverrides: {},
  keywords: {
    enabled: true,
    style: 'background',
    keywords: [],
    channelOverrides: {},
  },
  topToolbarItems: {
    threads: false,
    notificationSettings: false,
    pinnedMessages: false,
    memberList: false,
    searchBar: true,
  },
}

export function getSettings(): Promise<Settings> {
  return new Promise(resolve => {
    chrome.storage.sync.get('settings', result => {
      const stored = result.settings as Partial<Settings> | undefined
      if (!stored) { resolve(structuredClone(DEFAULT_SETTINGS)); return }
      resolve({
        ...DEFAULT_SETTINGS,
        ...stored,
        keywords: { ...DEFAULT_SETTINGS.keywords, ...(stored.keywords ?? {}) },
        topToolbarItems: { ...DEFAULT_SETTINGS.topToolbarItems, ...(stored.topToolbarItems ?? {}) },
      })
    })
  })
}

export function saveSettings(settings: Settings): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.sync.set({ settings }, resolve)
  })
}

async function patchElement(key: ElementKey, patch: Partial<ElementConfig>): Promise<void> {
  const s = await getSettings()
  s.elements[key] = { ...s.elements[key], ...patch }
  await saveSettings(s)
}

export function setElementVisible(key: ElementKey, visible: boolean): Promise<void> {
  return patchElement(key, { visible })
}

export function setElementSelector(key: ElementKey, selector: string | null): Promise<void> {
  return patchElement(key, { selector })
}

export async function setChannelOverride(
  channelId: string,
  key: ElementKey,
  visible: boolean,
): Promise<void> {
  const s = await getSettings()
  s.channelOverrides[channelId] = { ...s.channelOverrides[channelId], [key]: visible }
  await saveSettings(s)
}

export async function removeChannelOverride(channelId: string): Promise<void> {
  const s = await getSettings()
  delete s.channelOverrides[channelId]
  await saveSettings(s)
}

export async function resetChannelToVisible(channelId: string): Promise<void> {
  const s = await getSettings()
  s.channelOverrides[channelId] = {
    serverList: true,
    channelColumn: true,
    topToolbar: true,
    chatBar: true,
  }
  await saveSettings(s)
}

export async function setToolbarItemVisible(key: ToolbarItemKey, visible: boolean): Promise<void> {
  const s = await getSettings()
  s.topToolbarItems[key] = visible
  await saveSettings(s)
}

async function patchKeywords(patch: Partial<KeywordSettings>): Promise<void> {
  const s = await getSettings()
  s.keywords = { ...s.keywords, ...patch }
  await saveSettings(s)
}

export function setKeywordMasterEnabled(enabled: boolean): Promise<void> {
  return patchKeywords({ enabled })
}

export function setKeywordStyle(style: 'background' | 'chip'): Promise<void> {
  return patchKeywords({ style })
}

export async function addGlobalKeyword(keyword: Keyword): Promise<void> {
  const s = await getSettings()
  s.keywords.keywords = [...s.keywords.keywords, keyword]
  await saveSettings(s)
}

export async function updateGlobalKeyword(id: string, patch: Partial<Keyword>): Promise<void> {
  const s = await getSettings()
  s.keywords.keywords = s.keywords.keywords.map(k => k.id === id ? { ...k, ...patch } : k)
  await saveSettings(s)
}

export async function removeGlobalKeyword(id: string): Promise<void> {
  const s = await getSettings()
  s.keywords.keywords = s.keywords.keywords.filter(k => k.id !== id)
  await saveSettings(s)
}

export async function setChannelKeywordConfig(channelId: string, config: ChannelKeywordConfig): Promise<void> {
  const s = await getSettings()
  s.keywords.channelOverrides[channelId] = config
  await saveSettings(s)
}

export async function removeChannelKeywordConfig(channelId: string): Promise<void> {
  const s = await getSettings()
  delete s.keywords.channelOverrides[channelId]
  await saveSettings(s)
}

export async function addChannelKeyword(channelId: string, keyword: Keyword): Promise<void> {
  const s = await getSettings()
  const cfg = s.keywords.channelOverrides[channelId]
  if (!cfg) return
  cfg.keywords = [...cfg.keywords, keyword]
  await saveSettings(s)
}

export async function updateChannelKeyword(channelId: string, id: string, patch: Partial<Keyword>): Promise<void> {
  const s = await getSettings()
  const cfg = s.keywords.channelOverrides[channelId]
  if (!cfg) return
  cfg.keywords = cfg.keywords.map(k => k.id === id ? { ...k, ...patch } : k)
  await saveSettings(s)
}

export async function removeChannelKeyword(channelId: string, id: string): Promise<void> {
  const s = await getSettings()
  const cfg = s.keywords.channelOverrides[channelId]
  if (!cfg) return
  cfg.keywords = cfg.keywords.filter(k => k.id !== id)
  await saveSettings(s)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test
```

Expected: all tests pass, including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/shared/storage.ts src/shared/storage.test.ts
git commit -m "feat: add topToolbarItems defaults and setToolbarItemVisible"
```

---

### Task 3: Update buildCSS to emit per-item hide rules for topToolbar

**Files:**
- Modify: `src/content/styleManager.test.ts`
- Modify: `src/content/styleManager.ts`

- [ ] **Step 1: Fix the allHidden fixture and write failing tests**

Replace the full content of `src/content/styleManager.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest'
import { buildCSS } from './styleManager'
import { DEFAULT_SELECTORS } from './selectors'
import { DEFAULT_SETTINGS } from '../shared/storage'
import type { Settings } from '../shared/types'

const allHidden: Settings = {
  elements: {
    serverList: { visible: false, selector: null },
    channelColumn: { visible: false, selector: null },
    topToolbar: { visible: false, selector: null },
    chatBar: { visible: false, selector: null },
  },
  channelOverrides: {},
  keywords: {
    enabled: false,
    style: 'background',
    keywords: [],
    channelOverrides: {},
  },
  topToolbarItems: {
    threads: false,
    notificationSettings: false,
    pinnedMessages: false,
    memberList: false,
    searchBar: false,
  },
}

describe('buildCSS', () => {
  it('returns empty string when all elements are visible', () => {
    expect(buildCSS(DEFAULT_SETTINGS, null)).toBe('')
  })

  it('generates display:none rule for each hidden element', () => {
    const css = buildCSS(allHidden, null)
    expect(css).toContain(`${DEFAULT_SELECTORS.serverList} { display: none !important; }`)
    expect(css).toContain(`${DEFAULT_SELECTORS.chatBar} { display: none !important; }`)
  })

  it('zeroes --custom-app-top-bar-height when topToolbar is hidden', () => {
    const css = buildCSS(allHidden, null)
    expect(css).toContain(':root { --custom-app-top-bar-height: 0px !important; }')
  })

  it('does not zero --custom-app-top-bar-height when topToolbar is visible', () => {
    const css = buildCSS(DEFAULT_SETTINGS, null)
    expect(css).not.toContain('--custom-app-top-bar-height')
  })

  it('uses custom selector instead of default when selector is set', () => {
    const settings: Settings = {
      ...allHidden,
      elements: {
        ...allHidden.elements,
        chatBar: { visible: false, selector: '[data-my-chatbar]' },
      },
    }
    const css = buildCSS(settings, null)
    expect(css).toContain('[data-my-chatbar] { display: none !important; }')
    expect(css).not.toContain(DEFAULT_SELECTORS.chatBar)
  })

  it('channel override false hides a globally-visible element', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      channelOverrides: { '789012': { chatBar: false } },
    }
    const css = buildCSS(settings, '789012')
    expect(css).toContain(`${DEFAULT_SELECTORS.chatBar} { display: none !important; }`)
  })

  it('channel override true shows a globally-hidden element', () => {
    const settings: Settings = {
      ...allHidden,
      channelOverrides: { '789012': { chatBar: true } },
    }
    const css = buildCSS(settings, '789012')
    expect(css).not.toContain(DEFAULT_SELECTORS.chatBar)
  })

  it('unrelated channel override does not affect current channel', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      channelOverrides: { '000000': { chatBar: false } },
    }
    const css = buildCSS(settings, '789012')
    expect(css).toBe('')
  })

  it('hides each toolbar item individually when topToolbar is hidden and all items are false', () => {
    const css = buildCSS(allHidden, null)
    expect(css).toContain('[aria-label="Threads"] { display: none !important; }')
    expect(css).toContain('[aria-label="Notification Settings"] { display: none !important; }')
    expect(css).toContain('[aria-label="Pinned Messages"] { display: none !important; }')
    expect(css).toContain('[aria-label="Show Member List"] { display: none !important; }')
    expect(css).toContain('div[data-window-chrome="true"] div[class*="search__"] { display: none !important; }')
  })

  it('does not hide a surviving toolbar item when topToolbar is hidden', () => {
    const settings: Settings = {
      ...allHidden,
      topToolbarItems: { ...allHidden.topToolbarItems, searchBar: true },
    }
    const css = buildCSS(settings, null)
    expect(css).not.toContain('search__')
    expect(css).toContain('[aria-label="Threads"] { display: none !important; }')
  })

  it('does not emit display:none for the toolbar container element when topToolbar is hidden', () => {
    const css = buildCSS(allHidden, null)
    expect(css).not.toContain('div[data-window-chrome="true"] { display: none !important; }')
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

```bash
npm run test
```

Expected: the 3 new tests at the bottom fail. All previously-passing tests still pass (the allHidden fixture is now valid TypeScript).

- [ ] **Step 3: Implement the buildCSS change**

Replace the full content of `src/content/styleManager.ts` with:

```typescript
import { ELEMENT_KEYS, DEFAULT_SELECTORS, TOOLBAR_ITEM_KEYS, TOOLBAR_ITEM_SELECTORS } from './selectors'
import type { Settings, ElementKey } from '../shared/types'

const STYLE_ID = 'discord-hider-styles'

function resolveSelector(key: ElementKey, settings: Settings): string {
  return settings.elements[key].selector ?? DEFAULT_SELECTORS[key]
}

function resolveVisible(key: ElementKey, settings: Settings, channelId: string | null): boolean {
  if (channelId !== null) {
    const override = settings.channelOverrides[channelId]?.[key]
    if (override !== undefined) return override
  }
  return settings.elements[key].visible
}

export function buildCSS(settings: Settings, channelId: string | null): string {
  const rules = ELEMENT_KEYS
    .filter(key => key !== 'topToolbar')
    .filter(key => !resolveVisible(key, settings, channelId))
    .map(key => `${resolveSelector(key, settings)} { display: none !important; }`)

  if (!resolveVisible('topToolbar', settings, channelId)) {
    for (const itemKey of TOOLBAR_ITEM_KEYS) {
      if (!settings.topToolbarItems[itemKey]) {
        rules.push(`${TOOLBAR_ITEM_SELECTORS[itemKey]} { display: none !important; }`)
      }
    }
    rules.push(':root { --custom-app-top-bar-height: 0px !important; }')
  }

  return rules.join('\n')
}

function getChannelId(): string | null {
  const match = window.location.pathname.match(/\/channels\/\d+\/(\d+)/)
  return match?.[1] ?? null
}

export function applySettings(settings: Settings): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = buildCSS(settings, getChannelId())
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/styleManager.ts src/content/styleManager.test.ts
git commit -m "feat: emit per-item CSS rules for topToolbar instead of hiding container"
```

---

### Task 4: Add simple and extraActions props to ToggleRow

**Files:**
- Modify: `src/shared/components/ToggleRow.test.tsx`
- Modify: `src/shared/components/ToggleRow.tsx`

- [ ] **Step 1: Write failing tests**

Add these two tests inside the existing `describe('ToggleRow', ...)` block in `src/shared/components/ToggleRow.test.tsx`, after the last existing `it(...)`:

```typescript
  it('does not render picker or reset buttons when simple is true', () => {
    render(<ToggleRow {...base} simple />)
    expect(screen.queryByTitle('Pick element on page')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Reset to default selector')).not.toBeInTheDocument()
  })

  it('renders extraActions content when provided', () => {
    render(<ToggleRow {...base} extraActions={<button>chevron</button>} />)
    expect(screen.getByText('chevron')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test
```

Expected: the 2 new tests fail — `simple` prop not recognised, picker/reset still render; `extraActions` prop not rendered.

- [ ] **Step 3: Implement the updated ToggleRow**

Replace the full content of `src/shared/components/ToggleRow.tsx` with:

```typescript
import type { ReactNode } from 'react'
import { Pipette, RotateCcw } from 'lucide-react'
import './ToggleRow.css'

interface ToggleRowProps {
  label: string
  visible: boolean
  onToggle: () => void
  selector?: string | null
  defaultSelector?: string
  onPick?: () => void
  onReset?: () => void
  showSelector?: boolean
  simple?: boolean
  extraActions?: ReactNode
}

export function ToggleRow({
  label, visible, onToggle,
  selector = null, defaultSelector = '',
  onPick, onReset,
  showSelector = false, simple = false, extraActions,
}: ToggleRowProps) {
  const isCustom = selector !== null
  const displaySelector = selector ?? defaultSelector

  return (
    <div className="toggle-row">
      <div className="toggle-row-label">
        <span>{label}</span>
        {showSelector && (
          <code className={`selector${isCustom ? ' custom' : ''}`}>
            {displaySelector}{isCustom ? ' — custom' : ''}
          </code>
        )}
      </div>
      <button
        type="button"
        className={`switch ${visible ? 'on' : 'off'}`}
        onClick={onToggle}
        role="switch"
        aria-checked={visible}
        aria-label={`Toggle ${label}`}
      />
      {!simple && (
        <>
          <button
            type="button"
            className="icon-btn"
            onClick={onPick}
            title="Pick element on page"
            aria-label={`Pick ${label} element`}
          >
            <Pipette size={15} />
          </button>
          <button
            type="button"
            className={`icon-btn reset${isCustom ? ' active' : ''}`}
            onClick={onReset}
            disabled={!isCustom}
            title="Reset to default selector"
            aria-label={`Reset ${label} selector`}
          >
            <RotateCcw size={14} />
          </button>
        </>
      )}
      {extraActions}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/ToggleRow.tsx src/shared/components/ToggleRow.test.tsx
git commit -m "feat: add simple and extraActions props to ToggleRow"
```

---

### Task 5: Create TopToolbarRow component

**Files:**
- Create: `src/settings/TopToolbarRow.tsx`
- Create: `src/settings/TopToolbarRow.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/settings/TopToolbarRow.test.tsx` with this content:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TopToolbarRow } from './TopToolbarRow'
import { DEFAULT_SETTINGS } from '../shared/storage'
import type { ToolbarItemKey } from '../shared/types'

const defaultProps = {
  settings: DEFAULT_SETTINGS,
  onToggle: vi.fn(),
  onPick: vi.fn(),
  onReset: vi.fn(),
  onItemToggle: vi.fn() as (key: ToolbarItemKey) => void,
}

describe('TopToolbarRow', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the Top Toolbar label', () => {
    render(<TopToolbarRow {...defaultProps} />)
    expect(screen.getByText('Top Toolbar')).toBeInTheDocument()
  })

  it('renders the expand chevron button', () => {
    render(<TopToolbarRow {...defaultProps} />)
    expect(screen.getByTitle('Expand toolbar item visibility')).toBeInTheDocument()
  })

  it('does not show sub-items before expansion', () => {
    render(<TopToolbarRow {...defaultProps} />)
    expect(screen.queryByText('Search Bar')).not.toBeInTheDocument()
    expect(screen.queryByText('Threads')).not.toBeInTheDocument()
  })

  it('shows all five sub-item labels after expand is clicked', async () => {
    const user = userEvent.setup()
    render(<TopToolbarRow {...defaultProps} />)
    await user.click(screen.getByTitle('Expand toolbar item visibility'))
    expect(screen.getByText('Search Bar')).toBeInTheDocument()
    expect(screen.getByText('Threads')).toBeInTheDocument()
    expect(screen.getByText('Notification Settings')).toBeInTheDocument()
    expect(screen.getByText('Pinned Messages')).toBeInTheDocument()
    expect(screen.getByText('Member List')).toBeInTheDocument()
  })

  it('calls onItemToggle with the correct key when a sub-item switch is clicked', async () => {
    const user = userEvent.setup()
    render(<TopToolbarRow {...defaultProps} />)
    await user.click(screen.getByTitle('Expand toolbar item visibility'))
    await user.click(screen.getByRole('switch', { name: 'Toggle Search Bar' }))
    expect(defaultProps.onItemToggle).toHaveBeenCalledWith('searchBar')
  })

  it('collapses sub-items when chevron is clicked a second time', async () => {
    const user = userEvent.setup()
    render(<TopToolbarRow {...defaultProps} />)
    await user.click(screen.getByTitle('Expand toolbar item visibility'))
    await user.click(screen.getByTitle('Collapse toolbar item visibility'))
    expect(screen.queryByText('Search Bar')).not.toBeInTheDocument()
  })

  it('calls onToggle when master switch is clicked', async () => {
    const user = userEvent.setup()
    render(<TopToolbarRow {...defaultProps} />)
    await user.click(screen.getByRole('switch', { name: 'Toggle Top Toolbar' }))
    expect(defaultProps.onToggle).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test
```

Expected: all 7 new tests fail with "TopToolbarRow not found".

- [ ] **Step 3: Create TopToolbarRow.tsx**

Create `src/settings/TopToolbarRow.tsx` with this content:

```typescript
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ToggleRow } from '../shared/components/ToggleRow'
import { TOOLBAR_ITEM_KEYS, TOOLBAR_ITEM_LABELS, DEFAULT_SELECTORS } from '../content/selectors'
import type { Settings, ToolbarItemKey } from '../shared/types'

interface TopToolbarRowProps {
  settings: Settings
  onToggle: () => void
  onPick: () => void
  onReset: () => void
  onItemToggle: (key: ToolbarItemKey) => void
}

export function TopToolbarRow({ settings, onToggle, onPick, onReset, onItemToggle }: TopToolbarRowProps) {
  const [expanded, setExpanded] = useState(false)
  const { topToolbar } = settings.elements
  const chevronTitle = expanded ? 'Collapse toolbar item visibility' : 'Expand toolbar item visibility'

  return (
    <div className="toolbar-row-group">
      <ToggleRow
        label="Top Toolbar"
        visible={topToolbar.visible}
        selector={topToolbar.selector}
        defaultSelector={DEFAULT_SELECTORS.topToolbar}
        onToggle={onToggle}
        onPick={onPick}
        onReset={onReset}
        showSelector
        extraActions={
          <button
            type="button"
            className="icon-btn"
            onClick={() => setExpanded(e => !e)}
            title={chevronTitle}
            aria-label={chevronTitle}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        }
      />
      {expanded && (
        <div className="toolbar-sub-items">
          <p className="toolbar-sub-desc">Controls which items remain visible when the toolbar is hidden.</p>
          {TOOLBAR_ITEM_KEYS.map(key => (
            <ToggleRow
              key={key}
              label={TOOLBAR_ITEM_LABELS[key]}
              visible={settings.topToolbarItems[key]}
              onToggle={() => onItemToggle(key)}
              simple
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/settings/TopToolbarRow.tsx src/settings/TopToolbarRow.test.tsx
git commit -m "feat: TopToolbarRow component with expand/collapse sub-item toggles"
```

---

### Task 6: Wire TopToolbarRow into Settings

**Files:**
- Modify: `src/settings/Settings.test.tsx`
- Modify: `src/settings/Settings.tsx`

- [ ] **Step 1: Write failing tests**

Add these two tests inside the existing `describe('Settings', ...)` block in `src/settings/Settings.test.tsx`, after the last existing `it(...)`:

```typescript
  it('renders the toolbar expand chevron for Top Toolbar row', async () => {
    render(<Settings />)
    expect(await screen.findByTitle('Expand toolbar item visibility')).toBeInTheDocument()
  })

  it('shows toolbar sub-item labels after expand is clicked', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(await screen.findByTitle('Expand toolbar item visibility'))
    expect(screen.getByText('Search Bar')).toBeInTheDocument()
    expect(screen.getByText('Threads')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test
```

Expected: 2 new tests fail — expand button not found in rendered Settings output.

- [ ] **Step 3: Implement Settings.tsx changes**

Replace the full content of `src/settings/Settings.tsx` with:

```typescript
import { useState, useEffect } from 'react'
import { getSettings, setElementVisible, setElementSelector, setToolbarItemVisible } from '../shared/storage'
import { DEFAULT_SELECTORS, ELEMENT_KEYS, LABELS } from '../content/selectors'
import { ToggleRow } from '../shared/components/ToggleRow'
import { TopToolbarRow } from './TopToolbarRow'
import { ChannelOverrides } from './ChannelOverrides'
import { KeywordsSettings } from './KeywordsSettings'
import type { Settings as SettingsType, ElementKey, ToolbarItemKey } from '../shared/types'
import './settings.css'

type Tab = 'visibility' | 'keywords'

export function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [tab, setTab] = useState<Tab>('visibility')

  useEffect(() => {
    getSettings().then(setSettings)
    const listener = (_changes: object, area: string) => {
      if (area === 'sync') getSettings().then(setSettings)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  async function handleToggle(key: ElementKey) {
    if (!settings) return
    const next = !settings.elements[key].visible
    await setElementVisible(key, next)
    setSettings(s =>
      s ? { ...s, elements: { ...s.elements, [key]: { ...s.elements[key], visible: next } } } : s
    )
  }

  async function handlePick(key: ElementKey) {
    const [t] = await chrome.tabs.query({ url: 'https://discord.com/*' })
    if (!t?.id) return
    try { await chrome.tabs.sendMessage(t.id, { type: 'startPicker', key }) } catch { /* no Discord tab */ }
  }

  async function handleReset(key: ElementKey) {
    await setElementSelector(key, null)
    setSettings(s =>
      s ? { ...s, elements: { ...s.elements, [key]: { ...s.elements[key], selector: null } } } : s
    )
  }

  async function handleItemToggle(key: ToolbarItemKey) {
    if (!settings) return
    const next = !settings.topToolbarItems[key]
    await setToolbarItemVisible(key, next)
    setSettings(s =>
      s ? { ...s, topToolbarItems: { ...s.topToolbarItems, [key]: next } } : s
    )
  }

  if (!settings) return null

  return (
    <div className="settings">
      <header className="settings-header">
        <h1>Discord Hider — Settings</h1>
      </header>
      <div className="settings-tabs">
        <button className={`settings-tab${tab === 'visibility' ? ' active' : ''}`} onClick={() => setTab('visibility')}>
          Visibility
        </button>
        <button className={`settings-tab${tab === 'keywords' ? ' active' : ''}`} onClick={() => setTab('keywords')}>
          Keywords
        </button>
      </div>
      <main className="settings-main">
        {tab === 'visibility' && (
          <>
            <section>
              <p className="section-label">Global Visibility</p>
              <div className="element-rows">
                {ELEMENT_KEYS.map(key =>
                  key === 'topToolbar' ? (
                    <TopToolbarRow
                      key={key}
                      settings={settings}
                      onToggle={() => handleToggle(key)}
                      onPick={() => handlePick(key)}
                      onReset={() => handleReset(key)}
                      onItemToggle={handleItemToggle}
                    />
                  ) : (
                    <ToggleRow
                      key={key}
                      label={LABELS[key]}
                      visible={settings.elements[key].visible}
                      selector={settings.elements[key].selector}
                      defaultSelector={DEFAULT_SELECTORS[key]}
                      onToggle={() => handleToggle(key)}
                      onPick={() => handlePick(key)}
                      onReset={() => handleReset(key)}
                      showSelector
                    />
                  )
                )}
              </div>
            </section>
            <ChannelOverrides settings={settings} onSettingsChange={setSettings} />
          </>
        )}
        {tab === 'keywords' && <KeywordsSettings />}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/settings/Settings.tsx src/settings/Settings.test.tsx
git commit -m "feat: wire TopToolbarRow into Settings visibility tab"
```

---

### Task 7: Add CSS for toolbar sub-items

**Files:**
- Modify: `src/settings/settings.css`

- [ ] **Step 1: Add toolbar sub-item styles**

Append this block to the end of `src/settings/settings.css`:

```css
/* Toolbar sub-items */
.toolbar-row-group {
  border-bottom: 1px solid #1e1f22;
}

.toolbar-row-group:last-child {
  border-bottom: none;
}

/* Prevent the Top Toolbar toggle-row from adding its own border — group handles it */
.toolbar-row-group > .toggle-row {
  border-bottom: none;
}

.toolbar-sub-items {
  background: #232428;
}

.toolbar-sub-items .toggle-row {
  padding-left: 28px;
}

.toolbar-sub-items .toggle-row:last-child {
  border-bottom: none;
}

.toolbar-sub-desc {
  padding: 8px 14px 4px 28px;
  color: #949ba4;
  font-size: 11px;
}
```

- [ ] **Step 2: Run tests to verify nothing broke**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/settings/settings.css
git commit -m "feat: add CSS for toolbar sub-item expand section"
```
