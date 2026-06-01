# Discord Hider Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that toggles visibility of four Discord web UI elements, with a popup for quick toggling, a settings page for selector management and per-channel overrides, and a picker mode for re-targeting elements when Discord updates its DOM.

**Architecture:** A Vite multi-entry build compiles two React apps (popup, settings) and a separate IIFE content script. `chrome.storage.sync` is the sole state bus — popup and settings write to it; the content script listens for changes and rewrites a `<style>` tag in Discord's `<head>`. The only `chrome.runtime.sendMessage` call is `startPicker`, dispatched from the eyedropper button to activate the DOM picker overlay.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Lucide React, Vitest 2, @testing-library/react, happy-dom, @types/chrome

---

## File Map

| File | Responsibility |
|---|---|
| `manifest.json` | MV3 extension manifest |
| `popup.html` | Entry HTML for popup bundle |
| `settings.html` | Entry HTML for settings bundle |
| `vite.config.ts` | Multi-entry Vite build (popup + settings) + Vitest config |
| `vite.content.config.ts` | Separate IIFE build for content script |
| `.gitignore` | Excludes node_modules, dist, .superpowers |
| `src/test-setup.ts` | Global chrome API mocks + jest-dom matchers |
| `src/shared/types.ts` | `ElementKey`, `ElementConfig`, `Settings` types |
| `src/shared/storage.ts` | Typed `chrome.storage.sync` read/write helpers |
| `src/shared/storage.test.ts` | Tests for all storage helpers |
| `src/content/selectors.ts` | `ELEMENT_KEYS`, `LABELS`, `DEFAULT_SELECTORS` constants |
| `src/content/styleManager.ts` | `buildCSS()` + `applySettings()` — style tag injection |
| `src/content/styleManager.test.ts` | Tests for CSS generation and channel override resolution |
| `src/content/picker.ts` | `generateSelector()` + `startPicker()` — DOM picker overlay |
| `src/content/picker.test.ts` | Tests for selector generation and picker lifecycle |
| `src/content/index.ts` | Content script entry — wires storage listener + message handler |
| `src/shared/components/ToggleRow.tsx` | Shared row: label, switch, eyedropper, reset |
| `src/shared/components/ToggleRow.css` | Row styles |
| `src/shared/components/ToggleRow.test.tsx` | Tests for toggle row interactions |
| `src/popup/main.tsx` | React root mount for popup |
| `src/popup/Popup.tsx` | Popup app — 4 element rows + settings footer |
| `src/popup/popup.css` | Popup shell styles |
| `src/popup/Popup.test.tsx` | Tests for popup rendering and interactions |
| `src/settings/main.tsx` | React root mount for settings page |
| `src/settings/Settings.tsx` | Settings app — global toggles + channel overrides |
| `src/settings/ChannelOverrides.tsx` | Per-channel overrides section |
| `src/settings/settings.css` | Settings page styles |
| `src/settings/Settings.test.tsx` | Tests for settings rendering and interactions |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vite.content.config.ts`
- Create: `.gitignore`
- Create: `manifest.json`
- Create: `popup.html`
- Create: `settings.html`
- Create: `src/test-setup.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "discord-hider",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build && vite build --config vite.content.config.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "lucide-react": "^0.400.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/chrome": "^0.0.268",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "happy-dom": "^14.12.0",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vitest": "^2.0.3"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["chrome", "vitest/globals"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`** (popup + settings React bundles + Vitest)

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
  },
})
```

- [ ] **Step 4: Create `vite.content.config.ts`** (content script as IIFE — no React, no code splitting)

```ts
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'DiscordHiderContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
})
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
.superpowers/
*.local
```

- [ ] **Step 6: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Discord Hider",
  "version": "1.0.0",
  "description": "Toggle visibility of Discord UI elements",
  "permissions": ["storage", "tabs"],
  "host_permissions": ["https://discord.com/*"],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Discord Hider"
  },
  "options_ui": {
    "page": "settings.html",
    "open_in_tab": true
  },
  "content_scripts": [
    {
      "matches": ["https://discord.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 7: Create `popup.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Discord Hider</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/popup/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 8: Create `settings.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Discord Hider — Settings</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/settings/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 9: Create `src/test-setup.ts`**

```ts
import '@testing-library/jest-dom'
import { vi } from 'vitest'

Object.defineProperty(global, 'chrome', {
  value: {
    storage: {
      sync: {
        get: vi.fn(),
        set: vi.fn(),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    runtime: {
      onMessage: {
        addListener: vi.fn(),
      },
      openOptionsPage: vi.fn(),
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
    },
  },
  writable: true,
})
```

- [ ] **Step 10: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` populated, no errors.

- [ ] **Step 11: Verify Vitest is wired**

Create a temporary smoke test:

```bash
echo "import { describe, it, expect } from 'vitest'
describe('smoke', () => { it('works', () => expect(1).toBe(1)) })" > src/smoke.test.ts
```

Run: `npm test`
Expected: `1 passed`

Then delete the smoke test: `rm src/smoke.test.ts`

- [ ] **Step 12: Commit**

```bash
git add package.json tsconfig.json vite.config.ts vite.content.config.ts .gitignore manifest.json popup.html settings.html src/test-setup.ts
git commit -m "feat: scaffold project — Vite, React, MV3 manifest, Vitest"
```

---

## Task 2: Shared Types and Storage Helpers

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/storage.test.ts`
- Create: `src/shared/storage.ts`

- [ ] **Step 1: Create `src/shared/types.ts`**

```ts
export type ElementKey = 'serverList' | 'channelColumn' | 'topToolbar' | 'chatBar'

export interface ElementConfig {
  visible: boolean
  selector: string | null
}

export interface Settings {
  elements: Record<ElementKey, ElementConfig>
  channelOverrides: {
    [channelId: string]: Partial<Record<ElementKey, boolean>>
  }
}
```

- [ ] **Step 2: Write failing tests — `src/shared/storage.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSettings,
  setElementVisible,
  setElementSelector,
  setChannelOverride,
  removeChannelOverride,
  DEFAULT_SETTINGS,
} from './storage'

describe('storage', () => {
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

  it('returns DEFAULT_SETTINGS when nothing is stored', async () => {
    const s = await getSettings()
    expect(s).toEqual(DEFAULT_SETTINGS)
  })

  it('setElementVisible persists the new visible value', async () => {
    await setElementVisible('chatBar', false)
    const s = await getSettings()
    expect(s.elements.chatBar.visible).toBe(false)
  })

  it('setElementSelector persists a custom selector', async () => {
    await setElementSelector('serverList', '[data-custom]')
    const s = await getSettings()
    expect(s.elements.serverList.selector).toBe('[data-custom]')
  })

  it('setElementSelector with null clears the custom selector', async () => {
    await setElementSelector('serverList', '[data-custom]')
    await setElementSelector('serverList', null)
    const s = await getSettings()
    expect(s.elements.serverList.selector).toBeNull()
  })

  it('setChannelOverride creates an override entry for the channel', async () => {
    await setChannelOverride('789012', 'chatBar', false)
    const s = await getSettings()
    expect(s.channelOverrides['789012']).toEqual({ chatBar: false })
  })

  it('setChannelOverride merges with existing override keys', async () => {
    await setChannelOverride('789012', 'chatBar', false)
    await setChannelOverride('789012', 'serverList', false)
    const s = await getSettings()
    expect(s.channelOverrides['789012']).toEqual({ chatBar: false, serverList: false })
  })

  it('removeChannelOverride deletes the channel entry', async () => {
    await setChannelOverride('789012', 'chatBar', false)
    await removeChannelOverride('789012')
    const s = await getSettings()
    expect(s.channelOverrides['789012']).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
npm test -- storage
```

Expected: `Cannot find module './storage'` or similar.

- [ ] **Step 4: Implement `src/shared/storage.ts`**

```ts
import type { Settings, ElementKey, ElementConfig } from './types'

export const DEFAULT_SETTINGS: Settings = {
  elements: {
    serverList: { visible: true, selector: null },
    channelColumn: { visible: true, selector: null },
    topToolbar: { visible: true, selector: null },
    chatBar: { visible: true, selector: null },
  },
  channelOverrides: {},
}

export function getSettings(): Promise<Settings> {
  return new Promise(resolve => {
    chrome.storage.sync.get('settings', result => {
      resolve((result.settings as Settings | undefined) ?? DEFAULT_SETTINGS)
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
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test -- storage
```

Expected: `7 passed`

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/shared/storage.ts src/shared/storage.test.ts
git commit -m "feat: shared types and storage helpers"
```

---

## Task 3: Content Script — Selectors and Style Manager

**Files:**
- Create: `src/content/selectors.ts`
- Create: `src/content/styleManager.test.ts`
- Create: `src/content/styleManager.ts`

- [ ] **Step 1: Create `src/content/selectors.ts`**

```ts
import type { ElementKey } from '../shared/types'

export const ELEMENT_KEYS: readonly ElementKey[] = [
  'serverList',
  'channelColumn',
  'topToolbar',
  'chatBar',
]

export const DEFAULT_SELECTORS: Record<ElementKey, string> = {
  serverList: 'nav[aria-label="Servers sidebar"]',
  channelColumn: 'nav[aria-label="Channels"]',
  topToolbar: 'div[class*="toolbar"]',
  chatBar: 'div[class*="channelTextArea"]',
}

export const LABELS: Record<ElementKey, string> = {
  serverList: 'Server List',
  channelColumn: 'Channel Column',
  topToolbar: 'Top Toolbar',
  chatBar: 'Chat Bar',
}
```

- [ ] **Step 2: Write failing tests — `src/content/styleManager.test.ts`**

```ts
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
})
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
npm test -- styleManager
```

Expected: `Cannot find module './styleManager'`

- [ ] **Step 4: Implement `src/content/styleManager.ts`**

```ts
import { ELEMENT_KEYS, DEFAULT_SELECTORS } from './selectors'
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
  return ELEMENT_KEYS
    .filter(key => !resolveVisible(key, settings, channelId))
    .map(key => `${resolveSelector(key, settings)} { display: none !important; }`)
    .join('\n')
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

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test -- styleManager
```

Expected: `6 passed`

- [ ] **Step 6: Commit**

```bash
git add src/content/selectors.ts src/content/styleManager.ts src/content/styleManager.test.ts
git commit -m "feat: content script selectors and style manager"
```

---

## Task 4: Content Script — Picker Mode

**Files:**
- Create: `src/content/picker.test.ts`
- Create: `src/content/picker.ts`

- [ ] **Step 1: Write failing tests — `src/content/picker.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSelector, startPicker } from './picker'

describe('generateSelector', () => {
  it('uses role + aria-label when both present', () => {
    const el = document.createElement('nav')
    el.setAttribute('role', 'navigation')
    el.setAttribute('aria-label', 'Servers sidebar')
    expect(generateSelector(el)).toBe('[role="navigation"][aria-label="Servers sidebar"]')
  })

  it('uses aria-label alone when no role', () => {
    const el = document.createElement('div')
    el.setAttribute('aria-label', 'Channel list')
    expect(generateSelector(el)).toBe('[aria-label="Channel list"]')
  })

  it('uses id when no aria attributes', () => {
    const el = document.createElement('div')
    el.id = 'my-element'
    expect(generateSelector(el)).toBe('#my-element')
  })

  it('falls back to tagName when no stable attributes', () => {
    const el = document.createElement('section')
    expect(generateSelector(el)).toBe('section')
  })
})

describe('startPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let stored: Record<string, unknown> = {}
    vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
      cb?.({ settings: stored.settings })
      return Promise.resolve({ settings: stored.settings })
    })
    vi.mocked(chrome.storage.sync.set).mockImplementation((items, cb) => {
      Object.assign(stored, items)
      cb?.()
      return Promise.resolve()
    })
  })

  it('highlights hovered element with purple outline', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    startPicker('chatBar', vi.fn())
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(el.style.outline).toBe('2px solid #5865f2')
    // cleanup listeners so they don't bleed into the next test
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.body.removeChild(el)
  })

  it('removes highlight from previous element on new hover', () => {
    const a = document.createElement('div')
    const b = document.createElement('div')
    document.body.appendChild(a)
    document.body.appendChild(b)
    startPicker('chatBar', vi.fn())
    a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(a.style.outline).toBe('')
    expect(b.style.outline).toBe('2px solid #5865f2')
    // cleanup listeners
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.body.removeChild(a)
    document.body.removeChild(b)
  })

  it('saves selector and calls onDone on click', async () => {
    const el = document.createElement('div')
    el.setAttribute('aria-label', 'Chat area')
    document.body.appendChild(el)
    const onDone = vi.fn()
    startPicker('chatBar', onDone)
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(chrome.storage.sync.set).toHaveBeenCalled()
    document.body.removeChild(el)
  })

  it('calls onDone on Escape without saving', () => {
    const onDone = vi.fn()
    startPicker('chatBar', onDone)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onDone).toHaveBeenCalled()
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()
  })

  it('cleans up outline on Escape', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    startPicker('chatBar', vi.fn())
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(el.style.outline).toBe('')
    document.body.removeChild(el)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- picker
```

Expected: `Cannot find module './picker'`

- [ ] **Step 3: Implement `src/content/picker.ts`**

```ts
import { setElementSelector } from '../shared/storage'
import type { ElementKey } from '../shared/types'

const HIGHLIGHT = '2px solid #5865f2'

export function generateSelector(el: Element): string {
  const role = el.getAttribute('role')
  const ariaLabel = el.getAttribute('aria-label')
  if (role && ariaLabel) return `[role="${role}"][aria-label="${CSS.escape(ariaLabel)}"]`
  if (ariaLabel) return `[aria-label="${CSS.escape(ariaLabel)}"]`
  if (el.id) return `#${CSS.escape(el.id)}`
  return el.tagName.toLowerCase()
}

export function startPicker(key: ElementKey, onDone: () => void): void {
  let hovered: HTMLElement | null = null

  function cleanup(): void {
    document.removeEventListener('mouseover', onMouseOver, true)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('keydown', onKeyDown)
    if (hovered) hovered.style.outline = ''
  }

  function onMouseOver(e: MouseEvent): void {
    if (hovered) hovered.style.outline = ''
    hovered = e.target as HTMLElement
    hovered.style.outline = HIGHLIGHT
    e.stopPropagation()
  }

  function onClick(e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const selector = generateSelector(e.target as Element)
    cleanup()
    setElementSelector(key, selector).then(onDone)
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') { cleanup(); onDone() }
  }

  document.addEventListener('mouseover', onMouseOver, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- picker
```

Expected: `9 passed`

- [ ] **Step 5: Commit**

```bash
git add src/content/picker.ts src/content/picker.test.ts
git commit -m "feat: content script picker mode"
```

---

## Task 5: Content Script Entry Point

**Files:**
- Create: `src/content/index.ts`

- [ ] **Step 1: Create `src/content/index.ts`**

```ts
import { getSettings } from '../shared/storage'
import { applySettings } from './styleManager'
import { startPicker } from './picker'
import type { ElementKey } from '../shared/types'

getSettings().then(applySettings)

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'sync') getSettings().then(applySettings)
})

chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'startPicker') {
    startPicker(message.key as ElementKey, () => getSettings().then(applySettings))
  }
})
```

- [ ] **Step 2: Verify the content script builds**

```bash
vite build --config vite.content.config.ts
```

Expected: `dist/content.js` created with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: content script entry point"
```

---

## Task 6: Shared ToggleRow Component

**Files:**
- Create: `src/shared/components/ToggleRow.test.tsx`
- Create: `src/shared/components/ToggleRow.tsx`
- Create: `src/shared/components/ToggleRow.css`

- [ ] **Step 1: Write failing tests — `src/shared/components/ToggleRow.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ToggleRow } from './ToggleRow'

const base = {
  label: 'Chat Bar',
  visible: true,
  selector: null as string | null,
  defaultSelector: 'div[class*="channelTextArea"]',
  onToggle: vi.fn(),
  onPick: vi.fn(),
  onReset: vi.fn(),
}

describe('ToggleRow', () => {
  it('renders the label', () => {
    render(<ToggleRow {...base} />)
    expect(screen.getByText('Chat Bar')).toBeInTheDocument()
  })

  it('calls onToggle when switch is clicked', async () => {
    const user = userEvent.setup()
    render(<ToggleRow {...base} />)
    await user.click(screen.getByRole('switch'))
    expect(base.onToggle).toHaveBeenCalled()
  })

  it('calls onPick when eyedropper button is clicked', async () => {
    const user = userEvent.setup()
    render(<ToggleRow {...base} />)
    await user.click(screen.getByTitle('Pick element on page'))
    expect(base.onPick).toHaveBeenCalled()
  })

  it('reset button is disabled when selector is null', () => {
    render(<ToggleRow {...base} selector={null} />)
    expect(screen.getByTitle('Reset to default selector')).toBeDisabled()
  })

  it('reset button is enabled when a custom selector is set', () => {
    render(<ToggleRow {...base} selector='[data-custom]' />)
    expect(screen.getByTitle('Reset to default selector')).not.toBeDisabled()
  })

  it('calls onReset when reset button is clicked', async () => {
    const user = userEvent.setup()
    render(<ToggleRow {...base} selector='[data-custom]' />)
    await user.click(screen.getByTitle('Reset to default selector'))
    expect(base.onReset).toHaveBeenCalled()
  })

  it('does not show selector text when showSelector is false (default)', () => {
    render(<ToggleRow {...base} selector='[data-custom]' />)
    expect(screen.queryByText(/\[data-custom\]/)).not.toBeInTheDocument()
  })

  it('shows selector text when showSelector is true', () => {
    render(<ToggleRow {...base} selector='[data-custom]' showSelector />)
    expect(screen.getByText(/\[data-custom\]/)).toBeInTheDocument()
  })

  it('shows default selector text when showSelector is true and selector is null', () => {
    render(<ToggleRow {...base} selector={null} showSelector />)
    expect(screen.getByText(/channelTextArea/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- ToggleRow
```

Expected: `Cannot find module './ToggleRow'`

- [ ] **Step 3: Implement `src/shared/components/ToggleRow.tsx`**

```tsx
import { Pipette, RotateCcw } from 'lucide-react'
import './ToggleRow.css'

interface ToggleRowProps {
  label: string
  visible: boolean
  selector: string | null
  defaultSelector: string
  onToggle: () => void
  onPick: () => void
  onReset: () => void
  showSelector?: boolean
}

export function ToggleRow({
  label, visible, selector, defaultSelector,
  onToggle, onPick, onReset, showSelector = false,
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
        className={`switch ${visible ? 'on' : 'off'}`}
        onClick={onToggle}
        role="switch"
        aria-checked={visible}
        aria-label={`Toggle ${label}`}
      />
      <button
        className="icon-btn"
        onClick={onPick}
        title="Pick element on page"
        aria-label={`Pick ${label} element`}
      >
        <Pipette size={15} />
      </button>
      <button
        className={`icon-btn reset${isCustom ? ' active' : ''}`}
        onClick={onReset}
        disabled={!isCustom}
        title="Reset to default selector"
        aria-label={`Reset ${label} selector`}
      >
        <RotateCcw size={14} />
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/shared/components/ToggleRow.css`**

```css
.toggle-row {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  gap: 10px;
  border-bottom: 1px solid #1e1f22;
}

.toggle-row:last-child {
  border-bottom: none;
}

.toggle-row-label {
  flex: 1;
  min-width: 0;
}

.toggle-row-label > span {
  display: block;
  color: #dbdee1;
  font-size: 13px;
}

.selector {
  display: block;
  font-size: 10px;
  color: #949ba4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
  margin-top: 2px;
}

.selector.custom {
  color: #f0b232;
}

.switch {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: none;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.15s;
}

.switch.on  { background: #5865f2; }
.switch.off { background: #4e5058; }

.switch::after {
  content: '';
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: left 0.15s, right 0.15s;
}

.switch.on::after  { right: 2px; left: auto; }
.switch.off::after { left: 2px; right: auto; }

.icon-btn {
  background: none;
  border: none;
  color: #b5bac1;
  cursor: pointer;
  padding: 3px;
  display: flex;
  align-items: center;
  border-radius: 3px;
  flex-shrink: 0;
}

.icon-btn:hover:not(:disabled) {
  color: #fff;
  background: #3b3d45;
}

.icon-btn:disabled {
  color: #4e5058;
  cursor: not-allowed;
}

.icon-btn.reset.active { color: #f0b232; }
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test -- ToggleRow
```

Expected: `9 passed`

- [ ] **Step 6: Commit**

```bash
git add src/shared/components/
git commit -m "feat: shared ToggleRow component"
```

---

## Task 7: Popup

**Files:**
- Create: `src/popup/Popup.test.tsx`
- Create: `src/popup/Popup.tsx`
- Create: `src/popup/main.tsx`
- Create: `src/popup/popup.css`

- [ ] **Step 1: Write failing tests — `src/popup/Popup.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Popup } from './Popup'
import { DEFAULT_SETTINGS } from '../shared/storage'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
    cb?.({ settings: DEFAULT_SETTINGS })
    return Promise.resolve({ settings: DEFAULT_SETTINGS })
  })
  vi.mocked(chrome.storage.sync.set).mockImplementation((_, cb) => {
    cb?.()
    return Promise.resolve()
  })
  vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(() => {})
})

describe('Popup', () => {
  it('renders all 4 element labels', async () => {
    render(<Popup />)
    expect(await screen.findByText('Server List')).toBeInTheDocument()
    expect(screen.getByText('Channel Column')).toBeInTheDocument()
    expect(screen.getByText('Top Toolbar')).toBeInTheDocument()
    expect(screen.getByText('Chat Bar')).toBeInTheDocument()
  })

  it('renders the Open Settings button', async () => {
    render(<Popup />)
    expect(await screen.findByText(/Open Settings/)).toBeInTheDocument()
  })

  it('writes to storage when a toggle is clicked', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    const switches = await screen.findAllByRole('switch')
    await user.click(switches[0])
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('calls openOptionsPage and closes popup when Open Settings clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(chrome.runtime.openOptionsPage).mockImplementation(() => {})
    render(<Popup />)
    await user.click(await screen.findByText(/Open Settings/))
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- Popup
```

Expected: `Cannot find module './Popup'`

- [ ] **Step 3: Implement `src/popup/Popup.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'
import { getSettings, setElementVisible, setElementSelector } from '../shared/storage'
import { DEFAULT_SELECTORS, ELEMENT_KEYS, LABELS } from '../content/selectors'
import { ToggleRow } from '../shared/components/ToggleRow'
import type { Settings as SettingsType, ElementKey } from '../shared/types'
import './popup.css'

export function Popup() {
  const [settings, setSettings] = useState<SettingsType | null>(null)

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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'startPicker', key })
    } catch {
      // Not on Discord or content script not yet ready — ignore
    }
    window.close()
  }

  async function handleReset(key: ElementKey) {
    await setElementSelector(key, null)
    setSettings(s =>
      s ? { ...s, elements: { ...s.elements, [key]: { ...s.elements[key], selector: null } } } : s
    )
  }

  function openSettings() {
    chrome.runtime.openOptionsPage()
    window.close()
  }

  if (!settings) return null

  return (
    <div className="popup">
      <header className="popup-header">
        <span>Discord Hider</span>
      </header>
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

- [ ] **Step 4: Create `src/popup/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Popup } from './Popup'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
)
```

- [ ] **Step 5: Create `src/popup/popup.css`**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #1e1f22;
  font-family: system-ui, -apple-system, sans-serif;
  width: 280px;
  min-width: 280px;
}

.popup-header {
  background: #2b2d31;
  padding: 12px 16px;
  border-bottom: 1px solid #1e1f22;
}

.popup-header span {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
}

.popup-rows { background: #2b2d31; }

.popup-footer {
  padding: 10px 14px;
  background: #2b2d31;
  border-top: 1px solid #1e1f22;
}

.popup-footer button {
  width: 100%;
  background: transparent;
  border: 1px solid #4e5058;
  border-radius: 4px;
  padding: 6px;
  color: #b5bac1;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.popup-footer button:hover {
  border-color: #6d6f78;
  color: #dbdee1;
}
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
npm test -- Popup
```

Expected: `4 passed`

- [ ] **Step 7: Commit**

```bash
git add src/popup/
git commit -m "feat: popup UI"
```

---

## Task 8: Settings Page

**Files:**
- Create: `src/settings/Settings.test.tsx`
- Create: `src/settings/Settings.tsx`
- Create: `src/settings/ChannelOverrides.tsx`
- Create: `src/settings/main.tsx`
- Create: `src/settings/settings.css`

- [ ] **Step 1: Write failing tests — `src/settings/Settings.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Settings } from './Settings'
import { DEFAULT_SETTINGS } from '../shared/storage'
import type { Settings as SettingsType } from '../shared/types'

const withOverride: SettingsType = {
  ...DEFAULT_SETTINGS,
  channelOverrides: { '789012': { chatBar: false } },
}

function setupStorage(data: SettingsType = DEFAULT_SETTINGS) {
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

describe('Settings', () => {
  it('renders all 4 element labels', async () => {
    render(<Settings />)
    expect(await screen.findByText('Server List')).toBeInTheDocument()
    expect(screen.getByText('Channel Column')).toBeInTheDocument()
    expect(screen.getByText('Top Toolbar')).toBeInTheDocument()
    expect(screen.getByText('Chat Bar')).toBeInTheDocument()
  })

  it('shows selector text for each row', async () => {
    render(<Settings />)
    expect(await screen.findByText(/Servers sidebar/)).toBeInTheDocument()
  })

  it('shows empty-state message when no overrides', async () => {
    render(<Settings />)
    expect(await screen.findByText(/No channel overrides/)).toBeInTheDocument()
  })

  it('shows Add Channel button', async () => {
    render(<Settings />)
    expect(await screen.findByText('+ Add Channel')).toBeInTheDocument()
  })

  it('shows inline URL form when Add Channel is clicked', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(await screen.findByText('+ Add Channel'))
    expect(screen.getByPlaceholderText(/discord\.com\/channels/)).toBeInTheDocument()
  })

  it('adds a channel override when a valid Discord URL is submitted', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(await screen.findByText('+ Add Channel'))
    await user.type(
      screen.getByPlaceholderText(/discord\.com\/channels/),
      'https://discord.com/channels/111/789012'
    )
    await user.click(screen.getByText('Confirm'))
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('renders existing channel override rows', async () => {
    setupStorage(withOverride)
    render(<Settings />)
    expect(await screen.findByText('789012')).toBeInTheDocument()
  })

  it('removes a channel override when delete is clicked', async () => {
    setupStorage(withOverride)
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(await screen.findByTitle('Remove override'))
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- Settings
```

Expected: `Cannot find module './Settings'`

- [ ] **Step 3: Implement `src/settings/ChannelOverrides.tsx`**

```tsx
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { saveSettings, setChannelOverride, removeChannelOverride } from '../shared/storage'
import { ELEMENT_KEYS, LABELS } from '../content/selectors'
import type { Settings, ElementKey } from '../shared/types'

interface Props {
  settings: Settings
  onSettingsChange: (s: Settings) => void
}

function extractChannelId(url: string): string | null {
  return url.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
}

export function ChannelOverrides({ settings, onSettingsChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const overrides = Object.entries(settings.channelOverrides)

  async function handleAdd() {
    const channelId = extractChannelId(urlInput)
    if (!channelId) return
    const next: Settings = {
      ...settings,
      channelOverrides: { ...settings.channelOverrides, [channelId]: {} },
    }
    await saveSettings(next)
    onSettingsChange(next)
    setAdding(false)
    setUrlInput('')
  }

  async function handleOverrideToggle(channelId: string, key: ElementKey) {
    const current = settings.channelOverrides[channelId]?.[key]
    const next = current === undefined ? !settings.elements[key].visible : !current
    await setChannelOverride(channelId, key, next)
    onSettingsChange({
      ...settings,
      channelOverrides: {
        ...settings.channelOverrides,
        [channelId]: { ...settings.channelOverrides[channelId], [key]: next },
      },
    })
  }

  async function handleRemove(channelId: string) {
    await removeChannelOverride(channelId)
    const next = {
      ...settings,
      channelOverrides: { ...settings.channelOverrides },
    }
    delete next.channelOverrides[channelId]
    onSettingsChange(next)
  }

  const channelId = extractChannelId(urlInput)

  return (
    <section>
      <p className="section-label">Per-Channel Overrides</p>

      {overrides.length === 0 && !adding && (
        <div className="empty-state">
          <span>No channel overrides configured</span>
          <button onClick={() => setAdding(true)}>+ Add Channel</button>
        </div>
      )}

      {overrides.map(([id, override]) => (
        <div key={id} className="channel-row">
          <span className="channel-id">{id}</span>
          {ELEMENT_KEYS.map(key => {
            const val = override[key]
            const effective = val ?? settings.elements[key].visible
            return (
              <button
                key={key}
                className={`mini-toggle${effective ? ' on' : ''}${val !== undefined ? ' custom' : ''}`}
                onClick={() => handleOverrideToggle(id, key)}
                title={LABELS[key]}
              >
                {LABELS[key].split(' ')[0]}
              </button>
            )
          })}
          <button className="icon-btn" onClick={() => handleRemove(id)} title="Remove override">
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {adding && (
        <div className="add-channel-form">
          <input
            type="text"
            placeholder="https://discord.com/channels/…"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            autoFocus
          />
          <button onClick={handleAdd} disabled={!channelId}>Confirm</button>
          <button onClick={() => { setAdding(false); setUrlInput('') }}>Cancel</button>
        </div>
      )}

      {overrides.length > 0 && !adding && (
        <button className="add-btn" onClick={() => setAdding(true)}>+ Add Channel</button>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Implement `src/settings/Settings.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { getSettings, setElementVisible, setElementSelector } from '../shared/storage'
import { DEFAULT_SELECTORS, ELEMENT_KEYS, LABELS } from '../content/selectors'
import { ToggleRow } from '../shared/components/ToggleRow'
import { ChannelOverrides } from './ChannelOverrides'
import type { Settings as SettingsType, ElementKey } from '../shared/types'
import './settings.css'

export function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null)

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
    const [tab] = await chrome.tabs.query({ url: 'https://discord.com/*' })
    if (!tab?.id) return
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'startPicker', key })
    } catch {
      // No Discord tab available
    }
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
      <main className="settings-main">
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
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Create `src/settings/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Settings } from './Settings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Settings />
  </StrictMode>
)
```

- [ ] **Step 6: Create `src/settings/settings.css`**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #1e1f22;
  font-family: system-ui, -apple-system, sans-serif;
  color: #dbdee1;
  min-height: 100vh;
}

.settings-header {
  background: #2b2d31;
  padding: 14px 24px;
  border-bottom: 1px solid #1e1f22;
}

.settings-header h1 {
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.settings-main {
  max-width: 580px;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-label {
  color: #b5bac1;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.element-rows {
  background: #2b2d31;
  border-radius: 6px;
  overflow: hidden;
}

.empty-state {
  background: #2b2d31;
  border-radius: 6px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.empty-state span { flex: 1; color: #949ba4; font-size: 13px; }

.empty-state button, .add-btn {
  background: #5865f2;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  padding: 5px 12px;
  cursor: pointer;
  font-family: inherit;
}

.add-btn { margin-top: 8px; display: block; }

.channel-row {
  background: #2b2d31;
  border-radius: 6px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.channel-id { flex: 1; color: #b5bac1; font-size: 12px; font-family: monospace; }

.mini-toggle {
  padding: 3px 6px;
  border-radius: 3px;
  border: 1px solid #4e5058;
  font-size: 10px;
  cursor: pointer;
  color: #b5bac1;
  background: transparent;
  font-family: inherit;
}

.mini-toggle.on { background: #5865f2; border-color: #5865f2; color: #fff; }
.mini-toggle.custom { border-color: #f0b232; }

.add-channel-form {
  background: #2b2d31;
  border-radius: 6px;
  padding: 10px 14px;
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.add-channel-form input {
  flex: 1;
  background: #1e1f22;
  border: 1px solid #4e5058;
  border-radius: 4px;
  padding: 6px 8px;
  color: #dbdee1;
  font-size: 12px;
  font-family: inherit;
}

.add-channel-form button {
  background: #5865f2;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  padding: 5px 10px;
  cursor: pointer;
  font-family: inherit;
}

.add-channel-form button:disabled { opacity: 0.5; cursor: not-allowed; }

.add-channel-form button:last-child {
  background: transparent;
  border: 1px solid #4e5058;
  color: #b5bac1;
}

.icon-btn {
  background: none;
  border: none;
  color: #b5bac1;
  cursor: pointer;
  padding: 3px;
  display: flex;
  align-items: center;
  border-radius: 3px;
}

.icon-btn:hover { color: #fff; background: #3b3d45; }
```

- [ ] **Step 7: Run tests — verify they pass**

```bash
npm test -- Settings
```

Expected: `8 passed`

- [ ] **Step 8: Run all tests**

```bash
npm test
```

Expected: All test suites pass.

- [ ] **Step 9: Commit**

```bash
git add src/settings/
git commit -m "feat: settings page with per-channel overrides"
```

---

## Task 9: Full Build and Manual Verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: `dist/` contains `popup.html`, `settings.html`, popup JS chunks, `content.js`. No errors.

- [ ] **Step 2: Load the extension in Chrome**

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select the `dist/` folder
4. Extension "Discord Hider" should appear with no errors

- [ ] **Step 3: Manual verification checklist**

Navigate to `https://discord.com` and verify each item:

- [ ] Opening the extension popup shows all 4 element rows with switch toggles
- [ ] Toggling "Server List" OFF hides the server sidebar immediately (no page reload)
- [ ] Toggling it back ON shows it again immediately
- [ ] Repeat for Channel Column, Top Toolbar, Chat Bar
- [ ] Clicking the eyedropper icon on any row closes the popup and activates the picker (purple highlight on hover)
- [ ] Clicking an element in picker mode saves the selector (verify in Settings page)
- [ ] Pressing Escape cancels picker mode without any change
- [ ] The Reset button in Settings is amber and clickable when a custom selector is set
- [ ] Clicking Reset restores the default selector
- [ ] Opening Settings via the popup footer button works
- [ ] In Settings, clicking **Add Channel**, entering the current channel URL, and clicking Confirm adds a row
- [ ] Per-channel toggles in that row override the global setting for that channel only
- [ ] Deleting a channel override removes the row

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: verified build — discord-hider v1.0 complete"
```
