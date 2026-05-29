# Popup Disabled State & Per-Channel Keyword Add Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a disabled notice when the popup is opened on a non-Discord tab, and add a keyword input to the popup's Keywords tab that saves to the per-channel config when on a Discord channel page.

**Architecture:** `isDiscordPage` state (derived from the tab URL already queried on mount) gates the entire popup UI. A new `handleAddChannelKeyword` function creates the per-channel config if absent then appends via `addChannelKeyword`. All changes are confined to the popup — settings page is untouched.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Lucide React, Vitest 2, @testing-library/react, happy-dom, @types/chrome

**Prerequisite:** The keyword highlighter plan (`docs/superpowers/plans/2026-05-29-keyword-highlighter.md`) must be fully implemented — this plan builds on those files.

---

## File Map

| File | Change |
|---|---|
| `src/popup/popup.css` | Append disabled notice + keyword add row styles |
| `src/popup/Popup.tsx` | Add `isDiscordPage` state, `handleAddChannelKeyword`, conditional render |
| `src/popup/Popup.test.tsx` | Update global mock; add 7 new tests |

---

## Task 1: CSS Styles

**Files:**
- Modify: `src/popup/popup.css`

- [ ] **Step 1: Append to `src/popup/popup.css`**

Read the file first to see the current end, then append exactly this block:

```css
/* Disabled state */
.popup-disabled-notice {
  padding: 24px 16px;
  color: #949ba4;
  font-size: 13px;
  text-align: center;
}

/* Channel keyword add row */
.popup-kw-channel-note {
  padding: 10px 14px;
  color: #4e5058;
  font-size: 12px;
}

.popup-kw-add-row {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  gap: 8px;
  border-top: 1px solid #1e1f22;
}

.popup-kw-color-circle {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  cursor: pointer;
  position: relative;
}

.popup-kw-add-input {
  flex: 1;
  background: #1e1f22;
  border: 1px solid #4e5058;
  border-radius: 4px;
  padding: 0 8px;
  height: 26px;
  color: #dbdee1;
  font-size: 12px;
  font-family: inherit;
  box-sizing: border-box;
}

.popup-kw-add-btn {
  background: #5865f2;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  padding: 0 10px;
  height: 26px;
  cursor: pointer;
  font-family: inherit;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/popup.css
git commit -m "feat: popup disabled-state and keyword-add CSS"
```

---

## Task 2: Popup Component + Tests (TDD)

**Files:**
- Modify: `src/popup/Popup.test.tsx`
- Modify: `src/popup/Popup.tsx`

- [ ] **Step 1: Write failing tests**

Read the current `src/popup/Popup.test.tsx`. You need to make two changes:

**2a. Update the global `beforeEach`** — change the `chrome.tabs.query` mock from returning `[]` to returning a Discord tab (so existing element-tab tests keep passing after we add `isDiscordPage` gating):

Find:
```ts
  vi.mocked(chrome.tabs.query).mockResolvedValue([])
```

Replace with:
```ts
  vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://discord.com/' }] as chrome.tabs.Tab[])
```

**2b. Append a new describe block** at the bottom of the file:

```tsx
describe('Popup disabled state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
      cb?.({ settings: DEFAULT_SETTINGS })
      return Promise.resolve({ settings: DEFAULT_SETTINGS })
    })
    vi.mocked(chrome.storage.sync.set).mockImplementation((_, cb) => { cb?.(); return Promise.resolve() })
    vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(() => {})
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://example.com/some-page' }] as chrome.tabs.Tab[])
  })

  it('shows disabled notice when not on discord.com', async () => {
    render(<Popup />)
    expect(await screen.findByText('Discord Hider only works on Discord.')).toBeInTheDocument()
  })

  it('does not render tab bar when not on discord.com', async () => {
    render(<Popup />)
    await screen.findByText('Discord Hider only works on Discord.')
    expect(screen.queryByText('Elements')).toBeNull()
    expect(screen.queryByText('Keywords')).toBeNull()
  })
})

describe('Popup keyword add row', () => {
  const settingsNoChannelOverride = {
    ...DEFAULT_SETTINGS,
    keywords: {
      enabled: true,
      style: 'background' as const,
      keywords: [{ id: 'aaa', text: 'urgent', color: '#ef4444', enabled: true }],
      channelOverrides: {},
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
      cb?.({ settings: settingsNoChannelOverride })
      return Promise.resolve({ settings: settingsNoChannelOverride })
    })
    vi.mocked(chrome.storage.sync.set).mockImplementation((_, cb) => { cb?.(); return Promise.resolve() })
    vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(() => {})
    // On a Discord channel page
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://discord.com/channels/111/456' }] as chrome.tabs.Tab[])
  })

  it('shows Navigate note when on discord.com but no channel', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://discord.com/' }] as chrome.tabs.Tab[])
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    expect(await screen.findByText('Navigate to a channel to add keywords.')).toBeInTheDocument()
  })

  it('shows add row when on a channel page', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    expect(await screen.findByPlaceholderText('Add channel keyword…')).toBeInTheDocument()
  })

  it('adds channel keyword on Add click (creates config if missing)', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    await user.type(await screen.findByPlaceholderText('Add channel keyword…'), 'critical')
    await user.click(screen.getByText('Add'))
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('adds channel keyword on Enter key', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    await user.type(await screen.findByPlaceholderText('Add channel keyword…'), 'critical{Enter}')
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('does not add blank channel keyword', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    await screen.findByPlaceholderText('Add channel keyword…')
    await user.click(screen.getByText('Add'))
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — verify new ones fail**

```bash
npm test -- Popup
```

Expected: the 7 new tests fail. The 4 original `describe('Popup')` tests should still pass (we updated their mock to return a Discord URL).

- [ ] **Step 3: Replace `src/popup/Popup.tsx`**

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
  setChannelKeywordConfig,
  addChannelKeyword,
} from '../shared/storage'
import { DEFAULT_SELECTORS, ELEMENT_KEYS, LABELS } from '../content/selectors'
import { ToggleRow } from '../shared/components/ToggleRow'
import type { Settings as SettingsType, ElementKey, Keyword, ChannelKeywordConfig } from '../shared/types'
import './popup.css'

type Tab = 'elements' | 'keywords'

export function Popup() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [tab, setTab] = useState<Tab>('elements')
  const [channelId, setChannelId] = useState<string | null>(null)
  const [isDiscordPage, setIsDiscordPage] = useState(false)
  const [newKwText, setNewKwText] = useState('')
  const [newKwColor, setNewKwColor] = useState('#5865f2')

  useEffect(() => {
    getSettings().then(setSettings)
    const listener = (_changes: object, area: string) => {
      if (area === 'sync') getSettings().then(setSettings)
    }
    chrome.storage.onChanged.addListener(listener)
    chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
      const url = t?.url ?? ''
      setIsDiscordPage(url.startsWith('https://discord.com/'))
      const id = url.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
      setChannelId(id)
    })
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
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!t?.id) return
    try { await chrome.tabs.sendMessage(t.id, { type: 'startPicker', key }); window.close() } catch { /* not on Discord */ }
  }

  async function handleReset(key: ElementKey) {
    await setElementSelector(key, null)
    setSettings(s =>
      s ? { ...s, elements: { ...s.elements, [key]: { ...s.elements[key], selector: null } } } : s
    )
  }

  async function handleAddChannelKeyword() {
    if (!newKwText.trim() || !channelId || !settings) return
    const kw: Keyword = { id: crypto.randomUUID(), text: newKwText.trim(), color: newKwColor, enabled: true }
    if (!settings.keywords.channelOverrides[channelId]) {
      const cfg: ChannelKeywordConfig = { channelName: null, inheritGlobals: true, keywords: [] }
      await setChannelKeywordConfig(channelId, cfg)
    }
    await addChannelKeyword(channelId, kw)
    setNewKwText('')
  }

  function openSettings() { chrome.runtime.openOptionsPage(); window.close() }

  if (!settings) return null

  const channelCfg = channelId ? settings.keywords.channelOverrides[channelId] : undefined
  const channelKwIds = new Set((channelCfg?.keywords ?? []).map(k => k.id))
  const displayKeywords: Keyword[] = channelCfg
    ? channelCfg.inheritGlobals
      ? (() => {
          const channelTexts = new Set(channelCfg.keywords.map(k => k.text.toLowerCase()))
          return [
            ...settings.keywords.keywords.filter(k => !channelTexts.has(k.text.toLowerCase())),
            ...channelCfg.keywords,
          ]
        })()
      : channelCfg.keywords
    : settings.keywords.keywords

  return (
    <div className="popup">
      <header className="popup-header">
        <span>Discord Hider</span>
      </header>

      {!isDiscordPage ? (
        <p className="popup-disabled-notice">Discord Hider only works on Discord.</p>
      ) : (
        <>
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
              {displayKeywords.map(kw => {
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
              {channelId ? (
                <div className="popup-kw-add-row">
                  <div
                    className="popup-kw-color-circle"
                    style={{ background: newKwColor }}
                    onClick={() => document.getElementById('popup-kw-color')?.click()}
                  >
                    <input
                      id="popup-kw-color"
                      type="color"
                      value={newKwColor}
                      onChange={e => setNewKwColor(e.target.value)}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', padding: 0, border: 'none' }}
                      aria-label="New keyword color"
                    />
                  </div>
                  <input
                    className="popup-kw-add-input"
                    type="text"
                    placeholder="Add channel keyword…"
                    value={newKwText}
                    onChange={e => setNewKwText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddChannelKeyword() }}
                  />
                  <button className="popup-kw-add-btn" onClick={handleAddChannelKeyword}>Add</button>
                </div>
              ) : (
                <p className="popup-kw-channel-note">Navigate to a channel to add keywords.</p>
              )}
            </div>
          )}
        </>
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

- [ ] **Step 4: Run all tests — verify they pass**

```bash
npm test
```

Expected: all test suites pass. Popup suite should show 4 original + 5 keyword-tab + 2 disabled-state + 5 keyword-add = 16 tests. Full suite ~106 tests.

- [ ] **Step 5: Commit**

```bash
git add src/popup/Popup.tsx src/popup/Popup.test.tsx
git commit -m "feat: popup disabled state and per-channel keyword add"
```
