# Keyword Highlighter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-keyword CSS highlighting to Discord messages — keywords are global or per-channel, each with a user-chosen color, managed via a new Keywords tab in both the popup and settings page.

**Architecture:** The content script scans Discord message text nodes with `document.createTreeWalker`, wraps matches in `<span data-dh-kw>` elements, and styles them via a dedicated `<style id="discord-hider-keywords">` tag. `chrome.storage.sync` remains the sole state bus. A `MutationObserver` highlights newly-loaded messages; a `setInterval` re-applies highlights when Discord navigates between channels. The popup and settings page each gain a tab bar (Elements / Keywords) — pure React state, no routing.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Lucide React, Vitest 2, @testing-library/react, happy-dom, @types/chrome

**Prerequisite:** The v1 extension plan (`docs/superpowers/plans/2026-05-29-discord-hider.md`) must be fully implemented first — this plan builds on those files.

---

## File Map

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `Keyword`, `ChannelKeywordConfig`, `KeywordSettings`; extend `Settings` |
| `src/shared/storage.ts` | Extend `DEFAULT_SETTINGS`; add keyword helpers; merge-on-load for backward compat |
| `src/shared/storage.test.ts` | Add tests for keyword storage helpers |
| `src/content/keywordHighlighter.ts` | New — pure + DOM highlighting logic |
| `src/content/keywordHighlighter.test.ts` | New — tests for highlighter |
| `src/content/index.ts` | Replace — wire `applyKeywords`, `getChannelInfo` message, SPA nav, MutationObserver |
| `src/settings/Settings.tsx` | Add tab bar (Visibility / Keywords), route to `KeywordsSettings` |
| `src/settings/KeywordsSettings.tsx` | New — Keywords tab component |
| `src/settings/KeywordsSettings.test.tsx` | New — tests for Keywords settings |
| `src/settings/settings.css` | Add tab bar + keyword component styles |
| `src/popup/Popup.tsx` | Add tab bar (Elements / Keywords), route to popup keywords view |
| `src/popup/popup.css` | Add tab bar + popup keyword row styles |

---

## Task 1: Extend Types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Replace `src/shared/types.ts` with the extended version**

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
}
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: extend Settings type with keyword types"
```

---

## Task 2: Keyword Storage Helpers

**Files:**
- Modify: `src/shared/storage.ts`
- Modify: `src/shared/storage.test.ts`

- [ ] **Step 1: Write failing tests — append to `src/shared/storage.test.ts`**

Add these imports at the top of the existing test file:

```ts
import {
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
} from './storage'
import type { Keyword, ChannelKeywordConfig } from './types'
```

Then add a new `describe` block at the bottom of the file:

```ts
describe('keyword storage', () => {
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

  const kw1: Keyword = { id: 'aaa', text: 'urgent', color: '#ef4444', enabled: true }
  const kw2: Keyword = { id: 'bbb', text: 'shipped', color: '#57f287', enabled: true }

  it('DEFAULT_SETTINGS includes keywords with empty lists', async () => {
    const s = await getSettings()
    expect(s.keywords).toEqual({
      enabled: true,
      style: 'background',
      keywords: [],
      channelOverrides: {},
    })
  })

  it('setKeywordMasterEnabled persists enabled flag', async () => {
    await setKeywordMasterEnabled(false)
    const s = await getSettings()
    expect(s.keywords.enabled).toBe(false)
  })

  it('setKeywordStyle persists style', async () => {
    await setKeywordStyle('chip')
    const s = await getSettings()
    expect(s.keywords.style).toBe('chip')
  })

  it('addGlobalKeyword appends keyword', async () => {
    await addGlobalKeyword(kw1)
    const s = await getSettings()
    expect(s.keywords.keywords).toEqual([kw1])
  })

  it('updateGlobalKeyword patches by id', async () => {
    await addGlobalKeyword(kw1)
    await updateGlobalKeyword('aaa', { enabled: false })
    const s = await getSettings()
    expect(s.keywords.keywords[0].enabled).toBe(false)
  })

  it('removeGlobalKeyword removes by id', async () => {
    await addGlobalKeyword(kw1)
    await addGlobalKeyword(kw2)
    await removeGlobalKeyword('aaa')
    const s = await getSettings()
    expect(s.keywords.keywords).toEqual([kw2])
  })

  it('setChannelKeywordConfig creates channel entry', async () => {
    const cfg: ChannelKeywordConfig = { channelName: '# general', inheritGlobals: true, keywords: [kw1] }
    await setChannelKeywordConfig('789012', cfg)
    const s = await getSettings()
    expect(s.keywords.channelOverrides['789012']).toEqual(cfg)
  })

  it('removeChannelKeywordConfig deletes channel entry', async () => {
    const cfg: ChannelKeywordConfig = { channelName: '# general', inheritGlobals: true, keywords: [] }
    await setChannelKeywordConfig('789012', cfg)
    await removeChannelKeywordConfig('789012')
    const s = await getSettings()
    expect(s.keywords.channelOverrides['789012']).toBeUndefined()
  })

  it('addChannelKeyword appends to channel keywords', async () => {
    const cfg: ChannelKeywordConfig = { channelName: null, inheritGlobals: true, keywords: [] }
    await setChannelKeywordConfig('789012', cfg)
    await addChannelKeyword('789012', kw1)
    const s = await getSettings()
    expect(s.keywords.channelOverrides['789012'].keywords).toEqual([kw1])
  })

  it('updateChannelKeyword patches channel keyword by id', async () => {
    const cfg: ChannelKeywordConfig = { channelName: null, inheritGlobals: true, keywords: [kw1] }
    await setChannelKeywordConfig('789012', cfg)
    await updateChannelKeyword('789012', 'aaa', { color: '#fff' })
    const s = await getSettings()
    expect(s.keywords.channelOverrides['789012'].keywords[0].color).toBe('#fff')
  })

  it('removeChannelKeyword removes channel keyword by id', async () => {
    const cfg: ChannelKeywordConfig = { channelName: null, inheritGlobals: true, keywords: [kw1, kw2] }
    await setChannelKeywordConfig('789012', cfg)
    await removeChannelKeyword('789012', 'aaa')
    const s = await getSettings()
    expect(s.keywords.channelOverrides['789012'].keywords).toEqual([kw2])
  })

  it('getSettings merges missing keywords field from DEFAULT_SETTINGS', async () => {
    // Simulate a settings object stored before the keywords feature
    stored['settings'] = { elements: DEFAULT_SETTINGS.elements, channelOverrides: {} }
    const s = await getSettings()
    expect(s.keywords).toEqual(DEFAULT_SETTINGS.keywords)
  })
})
```

- [ ] **Step 2: Run tests — verify new tests fail**

```bash
npm test -- storage
```

Expected: new tests fail with `setKeywordMasterEnabled is not a function` or similar.

- [ ] **Step 3: Replace `src/shared/storage.ts` with the extended version**

```ts
import type { Settings, ElementKey, ElementConfig, Keyword, ChannelKeywordConfig, KeywordSettings } from './types'

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
}

export function getSettings(): Promise<Settings> {
  return new Promise(resolve => {
    chrome.storage.sync.get('settings', result => {
      const stored = result.settings as Partial<Settings> | undefined
      if (!stored) { resolve(DEFAULT_SETTINGS); return }
      resolve({
        ...DEFAULT_SETTINGS,
        ...stored,
        keywords: { ...DEFAULT_SETTINGS.keywords, ...(stored.keywords ?? {}) },
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

- [ ] **Step 4: Run all storage tests — verify they pass**

```bash
npm test -- storage
```

Expected: all tests pass (original 7 + new 12 = 19 passed).

- [ ] **Step 5: Commit**

```bash
git add src/shared/storage.ts src/shared/storage.test.ts
git commit -m "feat: keyword storage helpers"
```

---

## Task 3: Keyword Highlighter Module

**Files:**
- Create: `src/content/keywordHighlighter.test.ts`
- Create: `src/content/keywordHighlighter.ts`

- [ ] **Step 1: Write failing tests — `src/content/keywordHighlighter.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildKeywordCSS,
  computeEffectiveKeywords,
  removeHighlights,
  applyKeywords,
  getChannelName,
} from './keywordHighlighter'
import { DEFAULT_SETTINGS } from '../shared/storage'
import type { Settings, Keyword } from '../shared/types'

const kw1: Keyword = { id: 'aaa', text: 'urgent', color: '#ef4444', enabled: true }
const kw2: Keyword = { id: 'bbb', text: 'shipped', color: '#57f287', enabled: true }
const kwOff: Keyword = { id: 'ccc', text: 'draft', color: '#fde047', enabled: false }

const settingsWithKeywords: Settings = {
  ...DEFAULT_SETTINGS,
  keywords: {
    enabled: true,
    style: 'background',
    keywords: [kw1, kw2, kwOff],
    channelOverrides: {},
  },
}

describe('buildKeywordCSS', () => {
  it('returns empty string when no enabled keywords', () => {
    expect(buildKeywordCSS([], 'background')).toBe('')
  })

  it('generates background rule for enabled keyword', () => {
    const css = buildKeywordCSS([kw1], 'background')
    expect(css).toContain('.dh-kw-aaa')
    expect(css).toContain('background: #ef4444')
  })

  it('generates chip rule for chip style', () => {
    const css = buildKeywordCSS([kw1], 'chip')
    expect(css).toContain('.dh-kw-aaa')
    expect(css).toContain('border-radius: 3px')
    expect(css).toContain('#ef444430')
  })

  it('uses dark text color for light background colors', () => {
    const lightKw: Keyword = { id: 'zzz', text: 'test', color: '#fde047', enabled: true }
    const css = buildKeywordCSS([lightKw], 'background')
    expect(css).toContain('color: #1a1a1a')
  })

  it('uses light text color for dark background colors', () => {
    const darkKw: Keyword = { id: 'zzz', text: 'test', color: '#1e1f22', enabled: true }
    const css = buildKeywordCSS([darkKw], 'background')
    expect(css).toContain('color: #fff')
  })

  it('skips disabled keywords', () => {
    const css = buildKeywordCSS([kwOff], 'background')
    expect(css).toBe('')
  })
})

describe('computeEffectiveKeywords', () => {
  it('returns empty list when master is disabled', () => {
    const s: Settings = { ...settingsWithKeywords, keywords: { ...settingsWithKeywords.keywords, enabled: false } }
    expect(computeEffectiveKeywords(s, null)).toEqual([])
  })

  it('returns only enabled global keywords when no channel config', () => {
    const result = computeEffectiveKeywords(settingsWithKeywords, null)
    expect(result.map(k => k.id)).toEqual(['aaa', 'bbb'])
  })

  it('returns only enabled global keywords for unknown channelId', () => {
    const result = computeEffectiveKeywords(settingsWithKeywords, '999')
    expect(result.map(k => k.id)).toEqual(['aaa', 'bbb'])
  })

  it('merges global + channel keywords when inheritGlobals is true', () => {
    const s: Settings = {
      ...settingsWithKeywords,
      keywords: {
        ...settingsWithKeywords.keywords,
        channelOverrides: {
          '789': { channelName: null, inheritGlobals: true, keywords: [kw2] },
        },
      },
    }
    // kw2 text 'shipped' conflicts — channel kw2 wins, still just one 'shipped'
    const result = computeEffectiveKeywords(s, '789')
    expect(result.find(k => k.text === 'shipped')).toBeDefined()
    expect(result.find(k => k.text === 'urgent')).toBeDefined()
  })

  it('channel keyword overrides global with same text', () => {
    const channelKw: Keyword = { id: 'zzz', text: 'shipped', color: '#ff0000', enabled: true }
    const s: Settings = {
      ...settingsWithKeywords,
      keywords: {
        ...settingsWithKeywords.keywords,
        channelOverrides: {
          '789': { channelName: null, inheritGlobals: true, keywords: [channelKw] },
        },
      },
    }
    const result = computeEffectiveKeywords(s, '789')
    const shipped = result.find(k => k.text === 'shipped')
    expect(shipped?.color).toBe('#ff0000')
  })

  it('returns only channel keywords when inheritGlobals is false', () => {
    const channelKw: Keyword = { id: 'zzz', text: 'sprint', color: '#a78bfa', enabled: true }
    const s: Settings = {
      ...settingsWithKeywords,
      keywords: {
        ...settingsWithKeywords.keywords,
        channelOverrides: {
          '789': { channelName: null, inheritGlobals: false, keywords: [channelKw] },
        },
      },
    }
    const result = computeEffectiveKeywords(s, '789')
    expect(result).toEqual([channelKw])
  })
})

describe('removeHighlights', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('unwraps existing highlight spans and normalizes text', () => {
    document.body.innerHTML = '<p>hello <span data-dh-kw="aaa" class="dh-kw-aaa">urgent</span> world</p>'
    removeHighlights()
    expect(document.body.innerHTML).toBe('<p>hello urgent world</p>')
  })

  it('does nothing when no highlights exist', () => {
    document.body.innerHTML = '<p>hello world</p>'
    removeHighlights()
    expect(document.body.innerHTML).toBe('<p>hello world</p>')
  })
})

describe('applyKeywords', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('wraps matched text in a span with the keyword id class', () => {
    document.body.innerHTML = '<div class="messageContent-abc">this is urgent</div>'
    applyKeywords(settingsWithKeywords, null)
    const span = document.querySelector('.dh-kw-aaa')
    expect(span).not.toBeNull()
    expect(span?.textContent).toBe('urgent')
  })

  it('is case-insensitive', () => {
    document.body.innerHTML = '<div class="messageContent-abc">URGENT deadline</div>'
    applyKeywords(settingsWithKeywords, null)
    expect(document.querySelector('.dh-kw-aaa')).not.toBeNull()
  })

  it('does not wrap disabled keywords', () => {
    document.body.innerHTML = '<div class="messageContent-abc">draft document</div>'
    applyKeywords(settingsWithKeywords, null)
    expect(document.querySelector('.dh-kw-ccc')).toBeNull()
  })

  it('injects a style tag with CSS rules', () => {
    document.body.innerHTML = '<div class="messageContent-abc">urgent</div>'
    applyKeywords(settingsWithKeywords, null)
    const style = document.getElementById('discord-hider-keywords')
    expect(style?.textContent).toContain('.dh-kw-aaa')
  })

  it('removes previous highlights before re-applying', () => {
    document.body.innerHTML = '<div class="messageContent-abc">urgent shipped</div>'
    applyKeywords(settingsWithKeywords, null)
    applyKeywords(settingsWithKeywords, null)
    const spans = document.querySelectorAll('.dh-kw-aaa')
    expect(spans.length).toBe(1)
  })

  it('does not highlight when master is disabled', () => {
    const s: Settings = { ...settingsWithKeywords, keywords: { ...settingsWithKeywords.keywords, enabled: false } }
    document.body.innerHTML = '<div class="messageContent-abc">urgent</div>'
    applyKeywords(s, null)
    expect(document.querySelector('[data-dh-kw]')).toBeNull()
  })

  it('skips invalid regex patterns silently', () => {
    const badKw: Keyword = { id: 'bad', text: '(', color: '#fff', enabled: true }
    const s: Settings = { ...settingsWithKeywords, keywords: { ...settingsWithKeywords.keywords, keywords: [badKw] } }
    document.body.innerHTML = '<div class="messageContent-abc">hello</div>'
    expect(() => applyKeywords(s, null)).not.toThrow()
  })
})

describe('getChannelName', () => {
  it('returns null when title has no # prefix', () => {
    document.title = 'Discord'
    expect(getChannelName()).toBeNull()
  })

  it('extracts channel name from Discord-style title', () => {
    document.title = '# general — Text Channels — My Server'
    expect(getChannelName()).toBe('# general')
  })

  it('handles title with just the channel name', () => {
    document.title = '# sprint-planning'
    expect(getChannelName()).toBe('# sprint-planning')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- keywordHighlighter
```

Expected: `Cannot find module './keywordHighlighter'`

- [ ] **Step 3: Create `src/content/keywordHighlighter.ts`**

```ts
import type { Settings, Keyword } from '../shared/types'

const STYLE_ID = 'discord-hider-keywords'

function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function buildKeywordCSS(keywords: Keyword[], style: 'background' | 'chip'): string {
  return keywords
    .filter(k => k.enabled)
    .map(k => {
      if (style === 'background') {
        const textColor = hexLuminance(k.color) > 0.5 ? '#1a1a1a' : '#fff'
        return `.dh-kw-${k.id} { background: ${k.color}; color: ${textColor}; border-radius: 2px; padding: 0 2px; }`
      }
      return `.dh-kw-${k.id} { background: ${k.color}30; color: ${k.color}; border: 1px solid ${k.color}70; border-radius: 3px; padding: 0 3px; }`
    })
    .join('\n')
}

export function computeEffectiveKeywords(settings: Settings, channelId: string | null): Keyword[] {
  if (!settings.keywords.enabled) return []
  const channelCfg = channelId ? settings.keywords.channelOverrides[channelId] : undefined
  let keywords: Keyword[]
  if (channelCfg) {
    if (channelCfg.inheritGlobals) {
      const channelTexts = new Set(channelCfg.keywords.map(k => k.text.toLowerCase()))
      const globals = settings.keywords.keywords.filter(k => !channelTexts.has(k.text.toLowerCase()))
      keywords = [...globals, ...channelCfg.keywords]
    } else {
      keywords = channelCfg.keywords
    }
  } else {
    keywords = settings.keywords.keywords
  }
  return keywords.filter(k => k.enabled)
}

export function removeHighlights(): void {
  document.querySelectorAll('span[data-dh-kw]').forEach(span => {
    const parent = span.parentNode
    if (!parent) return
    while (span.firstChild) parent.insertBefore(span.firstChild, span)
    parent.removeChild(span)
    if (parent instanceof Element) parent.normalize()
  })
}

function walkTextNodes(root: Element, keywords: Keyword[]): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode()) !== null) {
    if ((node as Text).textContent?.trim()) textNodes.push(node as Text)
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? ''
    if (!text || !textNode.parentNode) continue

    type Match = { start: number; end: number; keyword: Keyword; matched: string }
    const matches: Match[] = []

    for (const kw of keywords) {
      let regex: RegExp
      try {
        regex = new RegExp(kw.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      } catch {
        continue
      }
      let m: RegExpExecArray | null
      while ((m = regex.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, keyword: kw, matched: m[0] })
      }
    }

    if (matches.length === 0) continue

    matches.sort((a, b) => a.start - b.start || b.end - a.end)
    const nonOverlapping: Match[] = []
    let lastEnd = 0
    for (const m of matches) {
      if (m.start >= lastEnd) { nonOverlapping.push(m); lastEnd = m.end }
    }

    const fragment = document.createDocumentFragment()
    let pos = 0
    for (const m of nonOverlapping) {
      if (m.start > pos) fragment.appendChild(document.createTextNode(text.slice(pos, m.start)))
      const span = document.createElement('span')
      span.setAttribute('data-dh-kw', m.keyword.id)
      span.className = `dh-kw-${m.keyword.id}`
      span.textContent = m.matched
      fragment.appendChild(span)
      pos = m.end
    }
    if (pos < text.length) fragment.appendChild(document.createTextNode(text.slice(pos)))

    textNode.parentNode.replaceChild(fragment, textNode)
  }
}

export function applyKeywords(settings: Settings, channelId: string | null): void {
  removeHighlights()
  const keywords = computeEffectiveKeywords(settings, channelId)

  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = STYLE_ID
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = buildKeywordCSS(keywords, settings.keywords.style)

  if (keywords.length === 0) return
  document.querySelectorAll('[class*="messageContent"]').forEach(el => {
    walkTextNodes(el as Element, keywords)
  })
}

export function highlightNodes(nodes: NodeList, settings: Settings, channelId: string | null): void {
  const keywords = computeEffectiveKeywords(settings, channelId)
  if (keywords.length === 0) return
  nodes.forEach(node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    if (el.matches('[class*="messageContent"]')) walkTextNodes(el, keywords)
    el.querySelectorAll('[class*="messageContent"]').forEach(mc => walkTextNodes(mc as Element, keywords))
  })
}

export function getChannelName(): string | null {
  const match = document.title.match(/^(#\s*.+?)(?:\s*[—–-]|$)/)
  return match ? match[1].trim() : null
}

export function startKeywordObserver(
  onNew: (nodes: NodeList) => void,
): MutationObserver {
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) onNew(m.addedNodes)
    }
  })
  const target = document.querySelector('[class*="scroller"]') ?? document.body
  observer.observe(target, { childList: true, subtree: true })
  return observer
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- keywordHighlighter
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/keywordHighlighter.ts src/content/keywordHighlighter.test.ts
git commit -m "feat: keyword highlighter module"
```

---

## Task 4: Content Script Entry Point

**Files:**
- Modify: `src/content/index.ts`

- [ ] **Step 1: Replace `src/content/index.ts`**

```ts
import { getSettings } from '../shared/storage'
import { applySettings } from './styleManager'
import { startPicker } from './picker'
import { applyKeywords, highlightNodes, getChannelName, startKeywordObserver } from './keywordHighlighter'
import type { ElementKey } from '../shared/types'

function getChannelId(): string | null {
  return window.location.pathname.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
}

async function applyAll(): Promise<void> {
  const s = await getSettings()
  applySettings(s)
  applyKeywords(s, getChannelId())
}

applyAll()

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'sync') applyAll()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'startPicker') {
    startPicker(message.key as ElementKey, applyAll)
  }
  if (message.type === 'getChannelInfo') {
    sendResponse({ channelId: getChannelId(), channelName: getChannelName() })
  }
})

// Re-highlight when Discord navigates between channels (SPA — uses history.pushState)
let lastPath = window.location.pathname
setInterval(async () => {
  const path = window.location.pathname
  if (path !== lastPath) {
    lastPath = path
    const s = await getSettings()
    applyKeywords(s, getChannelId())
  }
}, 500)

window.addEventListener('popstate', async () => {
  const s = await getSettings()
  applyKeywords(s, getChannelId())
})

// Highlight newly loaded messages without re-scanning the full DOM
startKeywordObserver(async nodes => {
  const s = await getSettings()
  highlightNodes(nodes, s, getChannelId())
})
```

- [ ] **Step 2: Verify the content script builds**

```bash
npx vite build --config vite.content.config.ts
```

Expected: `dist/content.js` created, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: wire keyword highlighter into content script"
```

---

## Task 5: Settings Page Tab Bar

**Files:**
- Modify: `src/settings/Settings.tsx`
- Modify: `src/settings/settings.css`

- [ ] **Step 1: Add tab bar styles to `src/settings/settings.css`**

Append to the existing file:

```css
/* Tab bar */
.settings-tabs {
  display: flex;
  padding: 0 24px;
  border-bottom: 1px solid #1e1f22;
  background: #2b2d31;
}

.settings-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #b5bac1;
  padding: 12px 16px;
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
}

.settings-tab.active {
  color: #fff;
  border-bottom-color: #5865f2;
  font-weight: 600;
}

/* Keyword rows */
.kw-card { background: #2b2d31; border-radius: 6px; overflow: hidden; }

.kw-row {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  gap: 10px;
  border-bottom: 1px solid #1e1f22;
}

.kw-row:last-child { border-bottom: none; }
.kw-row.disabled { opacity: 0.45; }

.kw-color-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  cursor: pointer;
  position: relative;
}

.kw-color-circle input[type="color"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  padding: 0;
  border: none;
  width: 100%;
  height: 100%;
}

.kw-text { flex: 1; color: #dbdee1; font-size: 14px; }

.kw-add-row {
  display: flex;
  align-items: center;
  padding: 14px;
  gap: 10px;
}

.kw-add-input {
  flex: 1;
  background: #1e1f22;
  border: 1px solid #4e5058;
  border-radius: 4px;
  padding: 0 10px;
  height: 30px;
  color: #dbdee1;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}

.kw-add-btn {
  background: #5865f2;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
  padding: 0 14px;
  height: 30px;
  cursor: pointer;
  font-family: inherit;
  flex-shrink: 0;
}

/* Style preview toggles */
.style-preview-wrap { display: flex; gap: 10px; align-items: center; }

.style-preview-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  padding: 0;
  opacity: 0.45;
}

.style-preview-btn.active { opacity: 1; }

.style-bg {
  background: #fde047;
  color: #1a1a1a;
  padding: 3px 10px;
  border-radius: 2px;
  font-size: 13px;
  font-weight: 600;
  display: inline-block;
}

.style-chip {
  background: rgba(88,101,242,0.19);
  color: #c9cdfb;
  padding: 3px 10px;
  border-radius: 3px;
  border: 1px solid rgba(88,101,242,0.44);
  font-size: 13px;
  display: inline-block;
}

/* Channel keyword cards */
.ch-kw-card {
  background: #2b2d31;
  border-radius: 6px;
  margin-bottom: 8px;
}

.ch-kw-header { padding: 12px 14px 10px; }

.ch-kw-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ch-kw-name-wrap { display: flex; align-items: center; gap: 8px; }

.ch-kw-name { color: #dbdee1; font-size: 14px; font-weight: 600; }

.ch-kw-id {
  color: #4e5058;
  font-size: 10px;
  font-family: monospace;
  opacity: 0;
  transition: opacity 0.15s;
}

.ch-kw-name-wrap:hover .ch-kw-id { opacity: 1; }

.ch-kw-inherit {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  cursor: pointer;
}

.ch-kw-inherit span { color: #b5bac1; font-size: 13px; }

.ch-kw-divider { height: 1px; background: #1e1f22; }

/* Add Channel button */
.add-channel-btn {
  width: 100%;
  background: #232428;
  border: none;
  border-radius: 6px;
  color: #b5bac1;
  font-size: 14px;
  font-family: inherit;
  padding: 14px;
  cursor: pointer;
  text-align: center;
  display: block;
}

.add-channel-btn:hover { background: #2b2d31; color: #dbdee1; }

/* URL fallback form */
.ch-url-form {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.ch-url-input {
  flex: 1;
  background: #1e1f22;
  border: 1px solid #4e5058;
  border-radius: 4px;
  padding: 0 8px;
  height: 30px;
  color: #dbdee1;
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}
```

- [ ] **Step 2: Update `src/settings/Settings.tsx` to add tab bar**

```tsx
import { useState, useEffect } from 'react'
import { getSettings, setElementVisible, setElementSelector } from '../shared/storage'
import { DEFAULT_SELECTORS, ELEMENT_KEYS, LABELS } from '../content/selectors'
import { ToggleRow } from '../shared/components/ToggleRow'
import { ChannelOverrides } from './ChannelOverrides'
import { KeywordsSettings } from './KeywordsSettings'
import type { Settings as SettingsType, ElementKey } from '../shared/types'
import './settings.css'

type Tab = 'visibility' | 'keywords'

export function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [tab, setTab] = useState<Tab>('visibility')

  useEffect(() => {
    getSettings().then(setSettings)
    chrome.storage.onChanged.addListener((_changes, area) => {
      if (area === 'sync') getSettings().then(setSettings)
    })
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
                {ELEMENT_KEYS.map(key => (
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
                ))}
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

- [ ] **Step 3: Run settings tests**

```bash
npm test -- Settings
```

Expected: existing 8 tests still pass (the tab bar is additive).

- [ ] **Step 4: Commit**

```bash
git add src/settings/Settings.tsx src/settings/settings.css
git commit -m "feat: add tab bar to settings page"
```

---

## Task 6: Keywords Settings Component

**Files:**
- Create: `src/settings/KeywordsSettings.test.tsx`
- Create: `src/settings/KeywordsSettings.tsx`

- [ ] **Step 1: Write failing tests — `src/settings/KeywordsSettings.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KeywordsSettings } from './KeywordsSettings'
import { DEFAULT_SETTINGS } from '../shared/storage'
import type { Settings } from '../shared/types'

const withKeywords: Settings = {
  ...DEFAULT_SETTINGS,
  keywords: {
    enabled: true,
    style: 'background',
    keywords: [
      { id: 'aaa', text: 'urgent', color: '#ef4444', enabled: true },
      { id: 'bbb', text: 'shipped', color: '#57f287', enabled: false },
    ],
    channelOverrides: {
      '789012': {
        channelName: '# sprint-planning',
        inheritGlobals: true,
        keywords: [{ id: 'ccc', text: 'sprint', color: '#a78bfa', enabled: true }],
      },
    },
  },
}

function setupStorage(data: Settings = DEFAULT_SETTINGS) {
  vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
    cb?.({ settings: data })
    return Promise.resolve({ settings: data })
  })
  vi.mocked(chrome.storage.sync.set).mockImplementation((_, cb) => {
    cb?.()
    return Promise.resolve()
  })
  vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(() => {})
}

beforeEach(() => {
  vi.clearAllMocks()
  setupStorage()
})

describe('KeywordsSettings', () => {
  it('renders master highlighting toggle', async () => {
    render(<KeywordsSettings />)
    expect(await screen.findByText('Keyword highlighting')).toBeInTheDocument()
  })

  it('renders style preview buttons', async () => {
    render(<KeywordsSettings />)
    expect(await screen.findByText('Background')).toBeInTheDocument()
    expect(screen.getByText('Chip')).toBeInTheDocument()
  })

  it('renders global keyword list', async () => {
    setupStorage(withKeywords)
    render(<KeywordsSettings />)
    expect(await screen.findByText('urgent')).toBeInTheDocument()
    expect(screen.getByText('shipped')).toBeInTheDocument()
  })

  it('adds a global keyword on Add click', async () => {
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await screen.findByText('Keyword highlighting')
    await user.type(screen.getByPlaceholderText('New keyword…'), 'important')
    await user.click(screen.getByText('Add'))
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('does not add blank keyword', async () => {
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await screen.findByText('Keyword highlighting')
    await user.click(screen.getByText('Add'))
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()
  })

  it('adds keyword on Enter key', async () => {
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await screen.findByText('Keyword highlighting')
    await user.type(screen.getByPlaceholderText('New keyword…'), 'urgent{Enter}')
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('removes a global keyword on X click', async () => {
    setupStorage(withKeywords)
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await screen.findByText('urgent')
    const removeButtons = screen.getAllByTitle('Remove keyword')
    await user.click(removeButtons[0])
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('toggles keyword enabled on eye click', async () => {
    setupStorage(withKeywords)
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await screen.findByText('urgent')
    await user.click(screen.getAllByTitle('Toggle keyword visibility')[0])
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('renders per-channel section with channel name', async () => {
    setupStorage(withKeywords)
    render(<KeywordsSettings />)
    expect(await screen.findByText('# sprint-planning')).toBeInTheDocument()
  })

  it('renders channel keyword', async () => {
    setupStorage(withKeywords)
    render(<KeywordsSettings />)
    expect(await screen.findByText('sprint')).toBeInTheDocument()
  })

  it('removes a channel config on trash click', async () => {
    setupStorage(withKeywords)
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await screen.findByText('# sprint-planning')
    await user.click(screen.getByTitle('Remove channel'))
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('shows Add Channel button', async () => {
    render(<KeywordsSettings />)
    expect(await screen.findByText('+ Add Channel')).toBeInTheDocument()
  })

  it('shows URL fallback form when getChannelInfo fails', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([])
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await user.click(await screen.findByText('+ Add Channel'))
    expect(await screen.findByPlaceholderText(/discord\.com\/channels/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- KeywordsSettings
```

Expected: `Cannot find module './KeywordsSettings'`

- [ ] **Step 3: Create `src/settings/KeywordsSettings.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, X, Trash2 } from 'lucide-react'
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
} from '../shared/storage'
import type { Settings, Keyword, ChannelKeywordConfig } from '../shared/types'

function extractChannelId(url: string): string | null {
  return url.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
}

interface KwRowProps {
  keyword: Keyword
  onToggle: () => void
  onRemove: () => void
  onColorChange: (color: string) => void
}

function KeywordRow({ keyword, onToggle, onRemove, onColorChange }: KwRowProps) {
  const colorRef = useRef<HTMLInputElement>(null)
  return (
    <div className={`kw-row${keyword.enabled ? '' : ' disabled'}`}>
      <div className="kw-color-circle" style={{ background: keyword.color }} onClick={() => colorRef.current?.click()}>
        <input
          ref={colorRef}
          type="color"
          value={keyword.color}
          onChange={e => onColorChange(e.target.value)}
          aria-label={`Color for ${keyword.text}`}
        />
      </div>
      <span className="kw-text">{keyword.text}</span>
      <button className="icon-btn" title="Toggle keyword visibility" onClick={onToggle}>
        {keyword.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      <button className="icon-btn" title="Remove keyword" onClick={onRemove}>
        <X size={15} />
      </button>
    </div>
  )
}

export function KeywordsSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [newText, setNewText] = useState('')
  const [newColor, setNewColor] = useState('#5865f2')
  const [addingChannel, setAddingChannel] = useState(false)
  const [channelUrlInput, setChannelUrlInput] = useState('')
  const [channelNewTexts, setChannelNewTexts] = useState<Record<string, string>>({})
  const [channelNewColors, setChannelNewColors] = useState<Record<string, string>>({})
  const newColorRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSettings().then(setSettings)
    chrome.storage.onChanged.addListener((_c, area) => {
      if (area === 'sync') getSettings().then(setSettings)
    })
  }, [])

  async function handleAddGlobal() {
    if (!newText.trim()) return
    const kw: Keyword = { id: crypto.randomUUID(), text: newText.trim(), color: newColor, enabled: true }
    await addGlobalKeyword(kw)
    setNewText('')
  }

  async function handleAddChannel() {
    // Try to get channelId/channelName from active Discord tab
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
      const cfg: ChannelKeywordConfig = { channelName, inheritGlobals: true, keywords: [] }
      await setChannelKeywordConfig(channelId, cfg)
    } else {
      setAddingChannel(true)
    }
  }

  async function handleUrlFallbackConfirm() {
    const channelId = extractChannelId(channelUrlInput)
    if (!channelId) return
    const cfg: ChannelKeywordConfig = { channelName: null, inheritGlobals: true, keywords: [] }
    await setChannelKeywordConfig(channelId, cfg)
    setAddingChannel(false)
    setChannelUrlInput('')
  }

  if (!settings) return null
  const kws = settings.keywords

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Master controls */}
      <div className="kw-card" style={{ padding: '14px 16px', overflow: 'visible' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>Keyword highlighting</div>
            <div style={{ color: '#949ba4', fontSize: '12px', marginTop: '3px' }}>
              Master switch — disables all highlighting without deleting keywords
            </div>
          </div>
          <button
            className={`switch ${kws.enabled ? 'on' : 'off'}`}
            role="switch"
            aria-checked={kws.enabled}
            aria-label="Toggle keyword highlighting"
            onClick={async () => { await setKeywordMasterEnabled(!kws.enabled) }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#dbdee1', fontSize: '14px' }}>Highlight style</span>
          <div className="style-preview-wrap">
            <button
              className={`style-preview-btn${kws.style === 'background' ? ' active' : ''}`}
              onClick={async () => { await setKeywordStyle('background') }}
            >
              <span className="style-bg">Background</span>
            </button>
            <button
              className={`style-preview-btn${kws.style === 'chip' ? ' active' : ''}`}
              onClick={async () => { await setKeywordStyle('chip') }}
            >
              <span className="style-chip">Chip</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global keywords */}
      <section>
        <p className="section-label">Global Keywords</p>
        <div className="kw-card">
          {kws.keywords.map(kw => (
            <KeywordRow
              key={kw.id}
              keyword={kw}
              onToggle={() => updateGlobalKeyword(kw.id, { enabled: !kw.enabled })}
              onRemove={() => removeGlobalKeyword(kw.id)}
              onColorChange={color => updateGlobalKeyword(kw.id, { color })}
            />
          ))}
          <div className="kw-add-row">
            <div
              className="kw-color-circle"
              style={{ background: newColor }}
              onClick={() => newColorRef.current?.click()}
            >
              <input
                ref={newColorRef}
                type="color"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                aria-label="New keyword color"
              />
            </div>
            <input
              className="kw-add-input"
              type="text"
              placeholder="New keyword…"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddGlobal() }}
            />
            <button className="kw-add-btn" onClick={handleAddGlobal}>Add</button>
          </div>
        </div>
      </section>

      {/* Per-channel */}
      <section>
        <p className="section-label">Per-Channel Keywords</p>
        {Object.entries(kws.channelOverrides).map(([channelId, cfg]) => (
          <div key={channelId} className="ch-kw-card">
            <div className="ch-kw-header">
              <div className="ch-kw-name-row">
                <div className="ch-kw-name-wrap">
                  <span className="ch-kw-name">{cfg.channelName ?? `#${channelId}`}</span>
                  {cfg.channelName && <span className="ch-kw-id">{channelId}</span>}
                </div>
                <button
                  className="icon-btn"
                  title="Remove channel"
                  onClick={() => removeChannelKeywordConfig(channelId)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <label className="ch-kw-inherit">
                <input
                  type="checkbox"
                  checked={cfg.inheritGlobals}
                  style={{ width: '15px', height: '15px', accentColor: '#5865f2', margin: 0 }}
                  onChange={async e => {
                    await setChannelKeywordConfig(channelId, { ...cfg, inheritGlobals: e.target.checked })
                  }}
                />
                <span>Inherit global keywords</span>
              </label>
            </div>
            <div className="ch-kw-divider" />
            {cfg.keywords.map(kw => (
              <KeywordRow
                key={kw.id}
                keyword={kw}
                onToggle={() => updateChannelKeyword(channelId, kw.id, { enabled: !kw.enabled })}
                onRemove={() => removeChannelKeyword(channelId, kw.id)}
                onColorChange={color => updateChannelKeyword(channelId, kw.id, { color })}
              />
            ))}
            <div className="kw-add-row">
              <div
                className="kw-color-circle"
                style={{ background: channelNewColors[channelId] ?? '#5865f2' }}
                onClick={() => document.getElementById(`ch-color-${channelId}`)?.click()}
              >
                <input
                  id={`ch-color-${channelId}`}
                  type="color"
                  value={channelNewColors[channelId] ?? '#5865f2'}
                  onChange={e => setChannelNewColors(p => ({ ...p, [channelId]: e.target.value }))}
                  aria-label="New channel keyword color"
                />
              </div>
              <input
                className="kw-add-input"
                type="text"
                placeholder="Add channel keyword…"
                value={channelNewTexts[channelId] ?? ''}
                onChange={e => setChannelNewTexts(p => ({ ...p, [channelId]: e.target.value }))}
                onKeyDown={async e => {
                  if (e.key !== 'Enter') return
                  const text = channelNewTexts[channelId]?.trim()
                  if (!text) return
                  await addChannelKeyword(channelId, {
                    id: crypto.randomUUID(), text, color: channelNewColors[channelId] ?? '#5865f2', enabled: true,
                  })
                  setChannelNewTexts(p => ({ ...p, [channelId]: '' }))
                }}
              />
              <button
                className="kw-add-btn"
                onClick={async () => {
                  const text = channelNewTexts[channelId]?.trim()
                  if (!text) return
                  await addChannelKeyword(channelId, {
                    id: crypto.randomUUID(), text, color: channelNewColors[channelId] ?? '#5865f2', enabled: true,
                  })
                  setChannelNewTexts(p => ({ ...p, [channelId]: '' }))
                }}
              >
                Add
              </button>
            </div>
          </div>
        ))}

        {addingChannel && (
          <div className="ch-url-form">
            <input
              className="ch-url-input"
              type="text"
              placeholder="https://discord.com/channels/…"
              value={channelUrlInput}
              onChange={e => setChannelUrlInput(e.target.value)}
              autoFocus
            />
            <button className="kw-add-btn" onClick={handleUrlFallbackConfirm}>
              Confirm
            </button>
            <button
              className="kw-add-btn"
              style={{ background: 'transparent', border: '1px solid #4e5058', color: '#b5bac1' }}
              onClick={() => { setAddingChannel(false); setChannelUrlInput('') }}
            >
              Cancel
            </button>
          </div>
        )}

        <button className="add-channel-btn" onClick={handleAddChannel}>
          + Add Channel
        </button>
      </section>

    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- KeywordsSettings
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/settings/KeywordsSettings.tsx src/settings/KeywordsSettings.test.tsx
git commit -m "feat: keywords settings tab component"
```

---

## Task 7: Popup Tab Bar and Keywords Tab

**Files:**
- Modify: `src/popup/Popup.tsx`
- Modify: `src/popup/popup.css`

- [ ] **Step 1: Append popup tab and keyword row styles to `src/popup/popup.css`**

```css
/* Tab bar */
.popup-tabs {
  display: flex;
  border-bottom: 1px solid #1e1f22;
}

.popup-tab {
  flex: 1;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #b5bac1;
  padding: 9px 0;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}

.popup-tab.active {
  color: #fff;
  border-bottom-color: #5865f2;
  font-weight: 600;
}

/* Keyword rows */
.popup-kw-rows { background: #2b2d31; }

.popup-kw-row {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  gap: 10px;
  border-bottom: 1px solid #1e1f22;
}

.popup-kw-row.disabled { opacity: 0.45; }

.popup-kw-circle {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}

.popup-kw-text { flex: 1; color: #dbdee1; font-size: 13px; }

.popup-kw-channel-label { color: #4e5058; font-size: 10px; }

.popup-kw-master {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  gap: 10px;
  border-bottom: 1px solid #1e1f22;
}

.popup-kw-master span { flex: 1; color: #dbdee1; font-size: 13px; }
```

- [ ] **Step 2: Write failing tests — append to `src/popup/Popup.test.tsx`**

Add these imports at the top of the existing popup test file:

```tsx
import type { Settings } from '../shared/types'
```

Then add a new describe block at the bottom:

```tsx
describe('Popup keywords tab', () => {
  const settingsWithKw: Settings = {
    ...DEFAULT_SETTINGS,
    keywords: {
      enabled: true,
      style: 'background',
      keywords: [
        { id: 'aaa', text: 'urgent', color: '#ef4444', enabled: true },
        { id: 'bbb', text: 'shipped', color: '#57f287', enabled: false },
      ],
      channelOverrides: {},
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
      cb?.({ settings: settingsWithKw })
      return Promise.resolve({ settings: settingsWithKw })
    })
    vi.mocked(chrome.storage.sync.set).mockImplementation((_, cb) => { cb?.(); return Promise.resolve() })
    vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(() => {})
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://discord.com/channels/123/456' }] as chrome.tabs.Tab[])
  })

  it('renders Keywords tab button', async () => {
    render(<Popup />)
    expect(await screen.findByText('Keywords')).toBeInTheDocument()
  })

  it('switches to keywords tab on click', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    expect(await screen.findByText('Highlighting')).toBeInTheDocument()
  })

  it('shows keyword list in keywords tab', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    expect(await screen.findByText('urgent')).toBeInTheDocument()
    expect(screen.getByText('shipped')).toBeInTheDocument()
  })

  it('disabled keyword row is dimmed', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    await screen.findByText('shipped')
    const rows = document.querySelectorAll('.popup-kw-row')
    const shippedRow = Array.from(rows).find(r => r.textContent?.includes('shipped'))
    expect(shippedRow?.classList.contains('disabled')).toBe(true)
  })

  it('clicking eye icon toggles keyword enabled', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    await screen.findByText('urgent')
    const eyeBtns = screen.getAllByTitle('Toggle keyword visibility')
    await user.click(eyeBtns[0])
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run tests — verify new tests fail**

```bash
npm test -- Popup
```

Expected: new 5 tests fail.

- [ ] **Step 4: Replace `src/popup/Popup.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { Settings, Eye, EyeOff } from 'lucide-react'
import {
  getSettings,
  setElementVisible,
  setElementSelector,
  updateGlobalKeyword,
  updateChannelKeyword,
  setKeywordMasterEnabled,
} from '../shared/storage'
import { DEFAULT_SELECTORS, ELEMENT_KEYS, LABELS } from '../content/selectors'
import { ToggleRow } from '../shared/components/ToggleRow'
import { computeEffectiveKeywords } from '../content/keywordHighlighter'
import type { Settings as SettingsType, ElementKey, Keyword } from '../shared/types'
import './popup.css'

type Tab = 'elements' | 'keywords'

export function Popup() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [tab, setTab] = useState<Tab>('elements')
  const [channelId, setChannelId] = useState<string | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
    chrome.storage.onChanged.addListener((_changes, area) => {
      if (area === 'sync') getSettings().then(setSettings)
    })
    chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
      const id = t?.url?.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
      setChannelId(id)
    })
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
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!t?.id) return
    try { await chrome.tabs.sendMessage(t.id, { type: 'startPicker', key }) } catch { /* not on Discord */ }
    window.close()
  }

  async function handleReset(key: ElementKey) {
    await setElementSelector(key, null)
    setSettings(s =>
      s ? { ...s, elements: { ...s.elements, [key]: { ...s.elements[key], selector: null } } } : s
    )
  }

  function openSettings() { chrome.runtime.openOptionsPage(); window.close() }

  if (!settings) return null

  const effectiveKeywords = computeEffectiveKeywords(settings, channelId)
  const channelKwIds = new Set(
    channelId ? (settings.keywords.channelOverrides[channelId]?.keywords ?? []).map(k => k.id) : []
  )

  return (
    <div className="popup">
      <header className="popup-header">
        <span>Discord Hider</span>
      </header>

      <div className="popup-tabs">
        <button className={`popup-tab${tab === 'elements' ? ' active' : ''}`} onClick={() => setTab('elements')}>
          Elements
        </button>
        <button className={`popup-tab${tab === 'keywords' ? ' active' : ''}`} onClick={() => setTab('keywords')}>
          Keywords
        </button>
      </div>

      {tab === 'elements' && (
        <div className="popup-rows">
          {ELEMENT_KEYS.map(key => (
            <ToggleRow
              key={key}
              label={LABELS[key]}
              visible={settings.elements[key].visible}
              selector={settings.elements[key].selector}
              defaultSelector={DEFAULT_SELECTORS[key]}
              onToggle={() => handleToggle(key)}
              onPick={() => handlePick(key)}
              onReset={() => handleReset(key)}
            />
          ))}
        </div>
      )}

      {tab === 'keywords' && (
        <div className="popup-kw-rows">
          <div className="popup-kw-master">
            <span>Highlighting</span>
            <button
              className={`switch ${settings.keywords.enabled ? 'on' : 'off'}`}
              role="switch"
              aria-checked={settings.keywords.enabled}
              aria-label="Toggle keyword highlighting"
              onClick={() => setKeywordMasterEnabled(!settings.keywords.enabled)}
            />
          </div>
          {effectiveKeywords.map(kw => {
            const isChannel = channelKwIds.has(kw.id)
            return (
              <div key={kw.id} className={`popup-kw-row${kw.enabled ? '' : ' disabled'}`}>
                <div className="popup-kw-circle" style={{ background: kw.color }} />
                <span className="popup-kw-text">{kw.text}</span>
                {isChannel && <span className="popup-kw-channel-label">#channel</span>}
                <button
                  className="icon-btn"
                  title="Toggle keyword visibility"
                  onClick={() =>
                    isChannel && channelId
                      ? updateChannelKeyword(channelId, kw.id, { enabled: !kw.enabled })
                      : updateGlobalKeyword(kw.id, { enabled: !kw.enabled })
                  }
                >
                  {kw.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <footer className="popup-footer">
        <button onClick={openSettings}>
          <Settings size={13} />
          Open Settings
        </button>
      </footer>
    </div>
  )
}
```

- [ ] **Step 5: Run all tests — verify they pass**

```bash
npm test
```

Expected: all test suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/popup/Popup.tsx src/popup/popup.css src/popup/Popup.test.tsx
git commit -m "feat: popup tab bar and keywords tab"
```

---

## Task 8: Full Build and Manual Verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: `dist/` contains `popup.html`, `settings.html`, popup JS chunks, `content.js`. No errors.

- [ ] **Step 2: Load in Chrome and verify**

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** → select `dist/`.
2. Navigate to `https://discord.com` in any channel.
3. Open the popup → verify Elements tab is default, Keywords tab is present.
4. Switch to Keywords tab → verify "Highlighting" master toggle shows.
5. Open Settings → Visibility tab is default, Keywords tab is present.
6. In Keywords tab: add a keyword ("urgent", any color) → verify it appears in the list.
7. Send or find a message containing "urgent" → verify it is highlighted in Discord.
8. Toggle the keyword off via the eye icon → verify highlight disappears.
9. Add a per-channel override for the current channel → verify channel keywords appear in popup.
10. Uncheck "Inherit global keywords" for the channel → verify global keywords no longer highlight in that channel.
11. Switch to a different channel → verify global keywords highlight again.
12. Toggle master switch off → verify all highlights disappear.
13. Test chip style → switch Highlight style to "Chip" and verify the visual style changes.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: keyword highlighter v1 complete"
```
