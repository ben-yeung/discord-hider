import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../shared/storage'
import { DEFAULT_SELECTORS } from './selectors'
import type { Settings } from '../shared/types'

const STYLE_ID = 'discord-hider-styles'

// channel '222' hides the chat bar via an override; channel '111' has no override
const settings: Settings = {
  ...DEFAULT_SETTINGS,
  channelOverrides: { '222': { chatBar: false } },
}

function navigateTo(channelId: string): void {
  window.location.href = `https://discord.com/channels/100/${channelId}`
}

function visibilityCSS(): string {
  return document.getElementById(STYLE_ID)?.textContent ?? ''
}

// Flush the floating applyAll() promise chain (getSettings resolves via a
// synchronous chrome.storage callback, so a few microtask turns suffice).
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

const chatBarHidden = `${DEFAULT_SELECTORS.chatBar} { display: none !important; }`

describe('content script channel switching', () => {
  beforeEach(() => {
    vi.resetModules()
    document.head.innerHTML = ''
    document.body.innerHTML = ''
    delete (window as unknown as { navigation?: unknown }).navigation
    ;(chrome.storage.sync.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_key: string, cb: (result: { settings: Settings }) => void) => cb({ settings }),
    )
  })

  afterEach(() => {
    delete (window as unknown as { navigation?: unknown }).navigation
  })

  it('re-applies channel overrides via the Navigation API navigatesuccess event', async () => {
    const handlers: Array<() => void> = []
    ;(window as unknown as { navigation: { addEventListener: (t: string, cb: () => void) => void } }).navigation = {
      addEventListener: (type, cb) => {
        if (type === 'navigatesuccess') handlers.push(cb)
      },
    }

    navigateTo('111')
    await import('./index')
    await flush()
    expect(visibilityCSS()).not.toContain(DEFAULT_SELECTORS.chatBar)

    // Discord finishes a same-document navigation to channel 222.
    navigateTo('222')
    handlers.forEach(cb => cb())
    await flush()

    expect(visibilityCSS()).toContain(chatBarHidden)
  })

  it('falls back to popstate when the Navigation API is unavailable', async () => {
    navigateTo('111')
    await import('./index')
    await flush()
    expect(visibilityCSS()).not.toContain(DEFAULT_SELECTORS.chatBar)

    navigateTo('222')
    window.dispatchEvent(new Event('popstate'))
    await flush()

    expect(visibilityCSS()).toContain(chatBarHidden)
  })
})
