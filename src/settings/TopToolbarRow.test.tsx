import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TopToolbarRow } from './TopToolbarRow'
import { DEFAULT_SETTINGS } from '../shared/storage'
import type { ToolbarItemKey } from '../shared/types'

const defaultProps = {
  settings: DEFAULT_SETTINGS,
  onToggle: vi.fn(),
  onPick: vi.fn(),
  onReset: vi.fn(),
  onItemToggle: vi.fn() as (key: ToolbarItemKey) => void,
}

describe('TopToolbarRow', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the Top Toolbar label', () => {
    render(<TopToolbarRow {...defaultProps} />)
    expect(screen.getByText('Top Toolbar')).toBeInTheDocument()
  })

  it('renders the toolbar settings button', () => {
    render(<TopToolbarRow {...defaultProps} />)
    expect(screen.getByTitle('Toolbar item visibility settings')).toBeInTheDocument()
  })

  it('does not show sub-items before expansion', () => {
    render(<TopToolbarRow {...defaultProps} />)
    expect(screen.queryByText('Search Bar')).not.toBeInTheDocument()
    expect(screen.queryByText('Threads')).not.toBeInTheDocument()
  })

  it('shows all five sub-item labels after expand is clicked', async () => {
    const user = userEvent.setup()
    render(<TopToolbarRow {...defaultProps} />)
    await user.click(screen.getByTitle('Toolbar item visibility settings'))
    expect(screen.getByText('Search Bar')).toBeInTheDocument()
    expect(screen.getByText('Threads')).toBeInTheDocument()
    expect(screen.getByText('Notification Settings')).toBeInTheDocument()
    expect(screen.getByText('Pinned Messages')).toBeInTheDocument()
    expect(screen.getByText('Member List')).toBeInTheDocument()
  })

  it('calls onItemToggle with the correct key when a sub-item switch is clicked', async () => {
    const user = userEvent.setup()
    render(<TopToolbarRow {...defaultProps} />)
    await user.click(screen.getByTitle('Toolbar item visibility settings'))
    await user.click(screen.getByRole('switch', { name: 'Toggle Search Bar' }))
    expect(defaultProps.onItemToggle).toHaveBeenCalledWith('searchBar')
  })

  it('collapses sub-items when settings button is clicked a second time', async () => {
    const user = userEvent.setup()
    render(<TopToolbarRow {...defaultProps} />)
    await user.click(screen.getByTitle('Toolbar item visibility settings'))
    await user.click(screen.getByTitle('Toolbar item visibility settings'))
    expect(screen.queryByText('Search Bar')).not.toBeInTheDocument()
  })

  it('calls onToggle when master switch is clicked', async () => {
    const user = userEvent.setup()
    render(<TopToolbarRow {...defaultProps} />)
    await user.click(screen.getByRole('switch', { name: 'Toggle Top Toolbar' }))
    expect(defaultProps.onToggle).toHaveBeenCalled()
  })
})
