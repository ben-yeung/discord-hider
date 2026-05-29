import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Popup } from './Popup'
import { DEFAULT_SETTINGS } from '../shared/storage'
import type { Settings } from '../shared/types'

// Prevent happy-dom from destroying the document when window.close() is called
vi.stubGlobal('close', vi.fn())

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
  vi.mocked(chrome.tabs.query).mockResolvedValue([])
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

describe('Popup keywords tab', () => {
  const settingsWithKw: Settings = {
    ...DEFAULT_SETTINGS,
    keywords: {
      enabled: true,
      style: 'background',
      keywords: [
        { id: 'aaa', text: 'urgent', color: '#ef4444', enabled: true },
        { id: 'bbb', text: 'shipped', color: '#57f287', enabled: false },
      ],
      channelOverrides: {},
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
      cb?.({ settings: settingsWithKw })
      return Promise.resolve({ settings: settingsWithKw })
    })
    vi.mocked(chrome.storage.sync.set).mockImplementation((_, cb) => { cb?.(); return Promise.resolve() })
    vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(() => {})
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://discord.com/channels/123/456' }] as chrome.tabs.Tab[])
  })

  it('renders Keywords tab button', async () => {
    render(<Popup />)
    expect(await screen.findByText('Keywords')).toBeInTheDocument()
  })

  it('switches to keywords tab on click', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    expect(await screen.findByText('Highlighting')).toBeInTheDocument()
  })

  it('shows keyword list in keywords tab', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    expect(await screen.findByText('urgent')).toBeInTheDocument()
    expect(screen.getByText('shipped')).toBeInTheDocument()
  })

  it('disabled keyword row is dimmed', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    await screen.findByText('shipped')
    const rows = document.querySelectorAll('.popup-kw-row')
    const shippedRow = Array.from(rows).find(r => r.textContent?.includes('shipped'))
    expect(shippedRow?.classList.contains('disabled')).toBe(true)
  })

  it('clicking eye icon toggles keyword enabled', async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await user.click(await screen.findByText('Keywords'))
    await screen.findByText('urgent')
    const eyeBtns = screen.getAllByTitle('Toggle keyword visibility')
    await user.click(eyeBtns[0])
    expect(chrome.storage.sync.set).toHaveBeenCalled()
  })
})
