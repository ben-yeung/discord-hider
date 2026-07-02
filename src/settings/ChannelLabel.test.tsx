import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChannelLabel } from './ChannelLabel'
import { DEFAULT_SETTINGS } from '../shared/storage'
import type { Settings } from '../shared/types'

function withMeta(partial: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...partial }
}

describe('ChannelLabel', () => {
  it('falls back to the raw channel id when no name is known', () => {
    render(<ChannelLabel channelId="456" settings={DEFAULT_SETTINGS} />)
    expect(screen.getByText('456')).toBeInTheDocument()
  })

  it('renders the captured channel name with the id as a subtitle', () => {
    const settings = withMeta({
      channelMeta: { '456': { name: 'general', guildId: '111' } },
      guilds: { '111': { name: 'My Server' } },
    })
    render(<ChannelLabel channelId="456" settings={settings} />)
    expect(screen.getByText('#general')).toBeInTheDocument()
    expect(screen.getByText('456')).toBeInTheDocument()
  })

  it('renders the guild icon as an image when available', () => {
    const settings = withMeta({
      channelMeta: { '456': { name: 'general', guildId: '111' } },
      guilds: { '111': { name: 'My Server', icon: 'https://cdn.discordapp.com/icons/111/a.webp' } },
    })
    render(<ChannelLabel channelId="456" settings={settings} />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.src).toBe('https://cdn.discordapp.com/icons/111/a.webp')
    expect(img.title).toBe('My Server')
  })

  it('shows initials when the guild has no icon', () => {
    const settings = withMeta({
      channelMeta: { '456': { name: 'general', guildId: '111' } },
      guilds: { '111': { name: 'My Server' } },
    })
    render(<ChannelLabel channelId="456" settings={settings} />)
    expect(screen.getByText('MS')).toBeInTheDocument()
  })

  it('uses the legacy fallback name when channelMeta has none', () => {
    render(<ChannelLabel channelId="456" settings={DEFAULT_SETTINGS} fallbackName="sprint-planning" />)
    expect(screen.getByText('#sprint-planning')).toBeInTheDocument()
  })
})
