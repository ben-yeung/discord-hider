import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KeywordsSettings } from './KeywordsSettings'
import { DEFAULT_SETTINGS } from '../shared/storage'
import type { Settings } from '../shared/types'

const withKeywords: Settings = {
  ...DEFAULT_SETTINGS,
  keywords: {
    enabled: true,
    style: 'background',
    keywords: [
      { id: 'aaa', text: 'urgent', color: '#ef4444', enabled: true },
      { id: 'bbb', text: 'shipped', color: '#57f287', enabled: false },
    ],
    channelOverrides: {
      '789012': {
        channelName: '# sprint-planning',
        inheritGlobals: true,
        keywords: [{ id: 'ccc', text: 'sprint', color: '#a78bfa', enabled: true }],
      },
    },
  },
}

function setupStorage(data: Settings = DEFAULT_SETTINGS) {
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

describe('KeywordsSettings', () => {
  it('renders master highlighting toggle', async () => {
    render(<KeywordsSettings />)
    expect(await screen.findByText('Keyword highlighting')).toBeInTheDocument()
  })

  it('renders style preview buttons', async () => {
    render(<KeywordsSettings />)
    expect(await screen.findByText('Background')).toBeInTheDocument()
    expect(screen.getByText('Chip')).toBeInTheDocument()
  })

  it('renders global keyword list', async () => {
    setupStorage(withKeywords)
    render(<KeywordsSettings />)
    expect(await screen.findByText('urgent')).toBeInTheDocument()
    expect(screen.getByText('shipped')).toBeInTheDocument()
  })

  it('adds a global keyword on Add click', async () => {
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await screen.findByText('Keyword highlighting')
    await user.type(screen.getByPlaceholderText('New keyword…'), 'important')
    await user.click(screen.getByText('Add'))
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('does not add blank keyword', async () => {
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await screen.findByText('Keyword highlighting')
    await user.click(screen.getByText('Add'))
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()
  })

  it('adds keyword on Enter key', async () => {
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await screen.findByText('Keyword highlighting')
    await user.type(screen.getByPlaceholderText('New keyword…'), 'urgent{Enter}')
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('removes a global keyword on X click', async () => {
    setupStorage(withKeywords)
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await screen.findByText('urgent')
    const removeButtons = screen.getAllByTitle('Remove keyword')
    await user.click(removeButtons[0])
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('toggles keyword enabled on eye click', async () => {
    setupStorage(withKeywords)
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await screen.findByText('urgent')
    await user.click(screen.getAllByTitle('Toggle keyword visibility')[0])
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('renders per-channel section with channel name', async () => {
    setupStorage(withKeywords)
    render(<KeywordsSettings />)
    expect(await screen.findByText('# sprint-planning')).toBeInTheDocument()
  })

  it('renders channel keyword', async () => {
    setupStorage(withKeywords)
    render(<KeywordsSettings />)
    expect(await screen.findByText('sprint')).toBeInTheDocument()
  })

  it('removes a channel config on trash click', async () => {
    setupStorage(withKeywords)
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await screen.findByText('# sprint-planning')
    await user.click(screen.getByTitle('Remove channel'))
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })

  it('shows Add Channel button', async () => {
    render(<KeywordsSettings />)
    expect(await screen.findByText('+ Add Channel')).toBeInTheDocument()
  })

  it('shows URL fallback form when getChannelInfo fails', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([])
    const user = userEvent.setup()
    render(<KeywordsSettings />)
    await user.click(await screen.findByText('+ Add Channel'))
    expect(await screen.findByPlaceholderText(/discord\.com\/channels/)).toBeInTheDocument()
  })
})
