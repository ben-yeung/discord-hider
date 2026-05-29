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
