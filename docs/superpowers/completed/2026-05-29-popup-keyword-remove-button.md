# Popup Keyword Remove Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `X` remove button to each keyword row in the popup's Keywords tab, and label global keywords as `global` to mirror the existing `#channel` label on channel keywords.

**Architecture:** Two-file change confined to `src/popup/`. CSS gets one new rule; `Popup.tsx` gets new imports, a `handleRemoveKeyword` handler, and updated row JSX. TDD: write 2 failing tests first, then implement.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Lucide React, Vitest 2, @testing-library/react, happy-dom, @types/chrome

---

## File Map

| File | Change |
|---|---|
| `src/popup/popup.css` | Append `.popup-kw-remove-btn` + hover rule |
| `src/popup/Popup.tsx` | Import `X`; import `removeGlobalKeyword`, `removeChannelKeyword`; add `handleRemoveKeyword`; update keyword row render |
| `src/popup/Popup.test.tsx` | Append `describe('Popup keyword remove', ...)` with 2 tests |

---

## Task 1: CSS

**Files:**
- Modify: `src/popup/popup.css`

- [ ] **Step 1: Append to `src/popup/popup.css`**

Read the file first, then append exactly this block at the end:

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

- [ ] **Step 2: Commit**

```bash
git add src/popup/popup.css
git commit -m "feat: popup keyword remove button CSS"
```

---

## Task 2: Component + Tests (TDD)

**Files:**
- Modify: `src/popup/Popup.test.tsx`
- Modify: `src/popup/Popup.tsx`

- [ ] **Step 1: Write failing tests**

Read `src/popup/Popup.test.tsx` first. Append this describe block at the bottom of the file:

```tsx
describe('Popup keyword remove', () => {
  const settingsWithGlobal = {
    ...DEFAULT_SETTINGS,
    keywords: {
      enabled: true,
      style: 'background' as const,
      keywords: [{ id: 'g1', text: 'urgent', color: '#ef4444', enabled: true }],
      channelOverrides: {},
    },
  }

  const settingsWithChannel = {
    ...DEFAULT_SETTINGS,
    keywords: {
      enabled: true,
      style: 'background' as const,
      keywords: [],
      channelOverrides: {
        '456': {
          channelName: null,
          inheritGlobals: false,
          keywords: [{ id: 'c1', text: 'critical', color: '#5865f2', enabled: true }],
        },
      },
    },
  }

  it('removes a global keyword when X is clicked', async () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
      cb?.({ settings: settingsWithGlobal })
      return Promise.resolve({ settings: settingsWithGlobal })
    })
    vi.mocked(chrome.storage.sync.set).mockImplementation((_, cb) => { cb?.(); return Promise.resolve() })
    vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(() => {})
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://discord.com/' }] as chrome.tabs.Tab[])
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    await user.click(await screen.findByTitle('Remove keyword'))
    expect(chrome.storage.sync.set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          keywords: expect.objectContaining({
            keywords: [],
          }),
        }),
      }),
      expect.any(Function)
    )
  })

  it('removes a channel keyword when X is clicked', async () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
      cb?.({ settings: settingsWithChannel })
      return Promise.resolve({ settings: settingsWithChannel })
    })
    vi.mocked(chrome.storage.sync.set).mockImplementation((_, cb) => { cb?.(); return Promise.resolve() })
    vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(() => {})
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://discord.com/channels/111/456' }] as chrome.tabs.Tab[])
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    await user.click(await screen.findByTitle('Remove keyword'))
    expect(chrome.storage.sync.set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          keywords: expect.objectContaining({
            channelOverrides: expect.objectContaining({
              '456': expect.objectContaining({
                keywords: [],
              }),
            }),
          }),
        }),
      }),
      expect.any(Function)
    )
  })
})
```

- [ ] **Step 2: Run tests — verify new ones fail**

```bash
npm test -- Popup
```

Expected: the 2 new tests fail (X button not rendered yet). All existing Popup tests still pass.

- [ ] **Step 3: Update `src/popup/Popup.tsx`**

Read the file first. Make three targeted changes:

**3a. Update the lucide-react import** (add `X`):

Find:
```ts
import { Settings, Eye, EyeOff } from 'lucide-react'
```

Replace with:
```ts
import { Settings, Eye, EyeOff, X } from 'lucide-react'
```

**3b. Update the storage import** (add `removeGlobalKeyword`, `removeChannelKeyword`):

Find:
```ts
import {
  getSettings,
  saveSettings,
  setElementVisible,
  setElementSelector,
  updateGlobalKeyword,
  updateChannelKeyword,
  setKeywordMasterEnabled,
} from '../shared/storage'
```

Replace with:
```ts
import {
  getSettings,
  saveSettings,
  setElementVisible,
  setElementSelector,
  updateGlobalKeyword,
  updateChannelKeyword,
  setKeywordMasterEnabled,
  removeGlobalKeyword,
  removeChannelKeyword,
} from '../shared/storage'
```

**3c. Add `handleRemoveKeyword` after `handleAddChannelKeyword`:**

Find the line:
```ts
  function openSettings() { chrome.runtime.openOptionsPage(); window.close() }
```

Replace with:
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

  function openSettings() { chrome.runtime.openOptionsPage(); window.close() }
```

**3d. Update the keyword row render** — add the `global` label and X button:

Find:
```tsx
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
```

Replace with:
```tsx
                  <div key={kw.id} className={`popup-kw-row${kw.enabled ? '' : ' disabled'}`}>
                    <div className="popup-kw-circle" style={{ background: kw.color }} />
                    <span className="popup-kw-text">{kw.text}</span>
                    <span className="popup-kw-channel-label">{isChannel ? '#channel' : 'global'}</span>
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
                    <button
                      className="popup-kw-remove-btn"
                      title="Remove keyword"
                      onClick={() => handleRemoveKeyword(kw, isChannel)}
                    >
                      <X size={14} />
                    </button>
                  </div>
```

- [ ] **Step 4: Run all tests — verify they pass**

```bash
npm test
```

Expected: all test suites pass. Popup suite should now show 13 tests (4 original + 2 disabled + 5 keyword-add + 2 keyword-remove).

- [ ] **Step 5: Commit**

```bash
git add src/popup/Popup.tsx src/popup/Popup.test.tsx
git commit -m "feat: popup keyword remove button and global label"
```
