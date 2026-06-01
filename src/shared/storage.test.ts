import { describe, it, expect, beforeEach, vi } from 'vitest'
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
})

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
