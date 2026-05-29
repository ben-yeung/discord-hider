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
