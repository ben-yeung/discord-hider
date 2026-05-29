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
