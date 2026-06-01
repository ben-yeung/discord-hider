import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ToggleRow } from './ToggleRow'

const base = {
  label: 'Chat Bar',
  visible: true,
  selector: null as string | null,
  defaultSelector: 'div[class*="channelTextArea"]',
  onToggle: vi.fn(),
  onPick: vi.fn(),
  onReset: vi.fn(),
}

describe('ToggleRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the label', () => {
    render(<ToggleRow {...base} />)
    expect(screen.getByText('Chat Bar')).toBeInTheDocument()
  })

  it('calls onToggle when switch is clicked', async () => {
    const user = userEvent.setup()
    render(<ToggleRow {...base} />)
    await user.click(screen.getByRole('switch'))
    expect(base.onToggle).toHaveBeenCalled()
  })

  it('calls onPick when eyedropper button is clicked', async () => {
    const user = userEvent.setup()
    render(<ToggleRow {...base} />)
    await user.click(screen.getByTitle('Pick element on page'))
    expect(base.onPick).toHaveBeenCalled()
  })

  it('reset button is disabled when selector is null', () => {
    render(<ToggleRow {...base} selector={null} />)
    expect(screen.getByTitle('Reset to default selector')).toBeDisabled()
  })

  it('reset button is enabled when a custom selector is set', () => {
    render(<ToggleRow {...base} selector='[data-custom]' />)
    expect(screen.getByTitle('Reset to default selector')).not.toBeDisabled()
  })

  it('calls onReset when reset button is clicked', async () => {
    const user = userEvent.setup()
    render(<ToggleRow {...base} selector='[data-custom]' />)
    await user.click(screen.getByTitle('Reset to default selector'))
    expect(base.onReset).toHaveBeenCalled()
  })

  it('does not show selector text when showSelector is false (default)', () => {
    render(<ToggleRow {...base} selector='[data-custom]' />)
    expect(screen.queryByText(/\[data-custom\]/)).not.toBeInTheDocument()
  })

  it('shows selector text when showSelector is true', () => {
    render(<ToggleRow {...base} selector='[data-custom]' showSelector />)
    expect(screen.getByText(/\[data-custom\]/)).toBeInTheDocument()
  })

  it('shows default selector text when showSelector is true and selector is null', () => {
    render(<ToggleRow {...base} selector={null} showSelector />)
    expect(screen.getByText(/channelTextArea/)).toBeInTheDocument()
  })

  it('does not render picker button when showPicker is false, but still renders reset', () => {
    render(<ToggleRow {...base} showPicker={false} />)
    expect(screen.queryByTitle('Pick element on page')).not.toBeInTheDocument()
    expect(screen.getByTitle('Reset to default selector')).toBeInTheDocument()
  })

  it('does not render picker or reset buttons when simple is true', () => {
    render(<ToggleRow {...base} simple />)
    expect(screen.queryByTitle('Pick element on page')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Reset to default selector')).not.toBeInTheDocument()
  })

  it('renders extraActions content when provided', () => {
    render(<ToggleRow {...base} extraActions={<button>chevron</button>} />)
    expect(screen.getByText('chevron')).toBeInTheDocument()
  })
})
