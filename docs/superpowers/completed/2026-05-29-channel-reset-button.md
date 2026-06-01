# Channel Reset Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Reset #channel-name" button to the Elements tab that creates or overwrites a per-channel override forcing all elements visible, without touching other channels' settings.

**Architecture:** A new `resetChannelToVisible` storage function writes all four element keys to `true` in `Settings.channelOverrides[channelId]`. The popup fetches the channel name from the content script on mount and computes effective visibility per-element to decide whether to show the button.

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react, Chrome Extension MV3

---

### Task 1: `resetChannelToVisible` storage function

**Files:**
- Modify: `src/shared/storage.ts`
- Modify: `src/shared/storage.test.ts`

- [ ] **Step 1: Write failing tests**

Add these two cases inside the existing `describe('storage', ...)` block in `src/shared/storage.test.ts`. Add `resetChannelToVisible` to the import at the top of the file.

```ts
// At top of file, add to existing import:
import {
  getSettings,
  setElementVisible,
  setElementSelector,
  setChannelOverride,
  removeChannelOverride,
  resetChannelToVisible,   // <-- add this
  DEFAULT_SETTINGS,
} from './storage'
```

```ts
// Add inside describe('storage', ...) after the removeChannelOverride test:

it('resetChannelToVisible creates an all-visible override for a new channel', async () => {
  await resetChannelToVisible('789012')
  const s = await getSettings()
  expect(s.channelOverrides['789012']).toEqual({
    serverList: true,
    channelColumn: true,
    topToolbar: true,
    chatBar: true,
  })
})

it('resetChannelToVisible overwrites an existing partial override', async () => {
  await setChannelOverride('789012', 'chatBar', false)
  await setChannelOverride('789012', 'serverList', false)
  await resetChannelToVisible('789012')
  const s = await getSettings()
  expect(s.channelOverrides['789012']).toEqual({
    serverList: true,
    channelColumn: true,
    topToolbar: true,
    chatBar: true,
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/shared/storage.test.ts
```

Expected: two new tests fail with "resetChannelToVisible is not a function" or similar.

- [ ] **Step 3: Implement `resetChannelToVisible` in `src/shared/storage.ts`**

Add this export at the end of the file (after `removeChannelOverride`):

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/shared/storage.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/storage.ts src/shared/storage.test.ts
git commit -m "feat: add resetChannelToVisible storage function"
```

---

### Task 2: Popup CSS — reset button styles

**Files:**
- Modify: `src/popup/popup.css`

- [ ] **Step 1: Add `.popup-reset-section` and `.popup-reset-btn` to `src/popup/popup.css`**

Append to the end of the file:

```css
.popup-reset-section {
  padding: 10px 14px;
  background: #2b2d31;
  border-top: 1px solid #1e1f22;
}

.popup-reset-btn {
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

- [ ] **Step 2: Commit**

```bash
git add src/popup/popup.css
git commit -m "feat: add popup reset button styles"
```

---

### Task 3: Popup — channel name state and Reset button

**Files:**
- Modify: `src/popup/Popup.tsx`
- Modify: `src/popup/Popup.test.tsx`

- [ ] **Step 1: Write failing tests**

Add a new `describe` block at the end of `src/popup/Popup.test.tsx`. The import for `resetChannelToVisible` is not needed in tests — we assert on `chrome.storage.sync.set` instead (same pattern as existing tests). Add `resetChannelToVisible` to the storage import only if you want to spy on it directly; the set-assertion approach below avoids that.

```ts
describe('Popup reset button', () => {
  const settingsWithHiddenElement = {
    ...DEFAULT_SETTINGS,
    elements: {
      ...DEFAULT_SETTINGS.elements,
      serverList: { visible: false, selector: null },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'close').mockImplementation(() => {})
    vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
      cb?.({ settings: settingsWithHiddenElement })
      return Promise.resolve({ settings: settingsWithHiddenElement })
    })
    vi.mocked(chrome.storage.sync.set).mockImplementation((_, cb) => {
      cb?.()
      return Promise.resolve()
    })
    vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(() => {})
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 1, url: 'https://discord.com/channels/111/456' },
    ] as chrome.tabs.Tab[])
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({
      channelId: '456',
      channelName: 'general',
    })
  })

  it('shows Reset button with channel name when on a channel and an element is hidden', async () => {
    render(<Popup />)
    expect(await screen.findByText('Reset #general')).toBeInTheDocument()
  })

  it('shows fallback label when channel name is unavailable', async () => {
    vi.mocked(chrome.tabs.sendMessage).mockRejectedValue(new Error('not available'))
    render(<Popup />)
    expect(await screen.findByText('Reset this channel')).toBeInTheDocument()
  })

  it('does not show Reset button when all elements are visible', async () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
      cb?.({ settings: DEFAULT_SETTINGS })
      return Promise.resolve({ settings: DEFAULT_SETTINGS })
    })
    render(<Popup />)
    await screen.findByText('Server List')
    expect(screen.queryByText(/Reset/)).toBeNull()
  })

  it('does not show Reset button when not on a channel page', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 1, url: 'https://discord.com/' },
    ] as chrome.tabs.Tab[])
    render(<Popup />)
    await screen.findByText('Server List')
    expect(screen.queryByText(/Reset/)).toBeNull()
  })

  it('clicking Reset button writes all-visible channel override to storage', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Reset #general'))
    expect(chrome.storage.sync.set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          channelOverrides: expect.objectContaining({
            '456': {
              serverList: true,
              channelColumn: true,
              topToolbar: true,
              chatBar: true,
            },
          }),
        }),
      }),
      expect.any(Function),
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/popup/Popup.test.tsx
```

Expected: the five new tests fail (Reset button not yet rendered).

- [ ] **Step 3: Update `src/popup/Popup.tsx`**

**3a — Add `resetChannelToVisible` to the storage import:**

```ts
import {
  getSettings,
  setElementVisible,
  setElementSelector,
  updateGlobalKeyword,
  updateChannelKeyword,
  setKeywordMasterEnabled,
  resetChannelToVisible,
} from '../shared/storage'
```

**3b — Add `channelName` state (after the existing `channelId` state line):**

```ts
const [channelName, setChannelName] = useState<string | null>(null)
```

**3c — Replace the `chrome.tabs.query` call inside `useEffect` with this version that also fetches the channel name:**

Old code:
```ts
chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
  const id = t?.url?.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
  setChannelId(id)
})
```

New code:
```ts
chrome.tabs.query({ active: true, currentWindow: true }).then(async ([t]) => {
  const id = t?.url?.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
  setChannelId(id)
  if (t?.id && id) {
    try {
      const info = await chrome.tabs.sendMessage(t.id, { type: 'getChannelInfo' })
      setChannelName(info?.channelName ?? null)
    } catch { /* not on Discord or content script not ready */ }
  }
})
```

**3d — Compute `anyHidden` in the render body (add after the `displayKeywords` computation and before `return`):**

```ts
const anyHidden = channelId !== null && ELEMENT_KEYS.some(
  key => !(settings.channelOverrides[channelId]?.[key] ?? settings.elements[key].visible)
)
```

**3e — Add the Reset button section between the elements rows block and the keywords rows block:**

Locate this section in the JSX:
```tsx
{tab === 'elements' && (
  <div className="popup-rows">
    ...
  </div>
)}

{tab === 'keywords' && (
```

Insert between them:
```tsx
{tab === 'elements' && anyHidden && channelId && (
  <div className="popup-reset-section">
    <button
      className="popup-reset-btn"
      onClick={() => resetChannelToVisible(channelId)}
    >
      {channelName ? `Reset #${channelName}` : 'Reset this channel'}
    </button>
  </div>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/popup/Popup.test.tsx
```

Expected: all tests pass including the five new ones.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/popup/Popup.tsx src/popup/Popup.test.tsx
git commit -m "feat: add Reset #channel-name button to elements tab"
```
