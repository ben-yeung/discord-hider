import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Popup } from './Popup'
import { DEFAULT_SETTINGS } from '../shared/storage'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'close').mockImplementation(() => {})
  vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
    cb?.({ settings: DEFAULT_SETTINGS })
    return Promise.resolve({ settings: DEFAULT_SETTINGS })
  })
  vi.mocked(chrome.storage.sync.set).mockImplementation((_, cb) => {
    cb?.()
    return Promise.resolve()
  })
  vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(() => {})
  vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://discord.com/' }] as chrome.tabs.Tab[])
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
    expect(chrome.storage.sync.set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          keywords: expect.objectContaining({
            channelOverrides: expect.objectContaining({
              '456': expect.objectContaining({
                keywords: expect.arrayContaining([
                  expect.objectContaining({ text: 'critical', enabled: true })
                ])
              })
            })
          })
        })
      }),
      expect.any(Function)
    )
  })

  it('adds channel keyword on Enter key', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    await user.type(await screen.findByPlaceholderText('Add channel keyword…'), 'critical{Enter}')
    expect(chrome.storage.sync.set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          keywords: expect.objectContaining({
            channelOverrides: expect.objectContaining({
              '456': expect.objectContaining({
                keywords: expect.arrayContaining([
                  expect.objectContaining({ text: 'critical', enabled: true })
                ])
              })
            })
          })
        })
      }),
      expect.any(Function)
    )
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
