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
