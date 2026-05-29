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
})
