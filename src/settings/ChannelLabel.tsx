import type { Settings, GuildMeta } from '../shared/types'

interface GuildBubbleProps {
  guild: GuildMeta | undefined
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '#'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function GuildBubble({ guild }: GuildBubbleProps) {
  const title = guild?.name ?? undefined
  if (guild?.icon) {
    return <img className="guild-bubble" src={guild.icon} alt={guild.name ?? ''} title={title} />
  }
  return (
    <span className="guild-bubble guild-bubble-fallback" title={title}>
      {guild?.name ? initials(guild.name) : '#'}
    </span>
  )
}

interface ChannelLabelProps {
  channelId: string
  settings: Settings
  /** Legacy name source (e.g. keyword config) used when channelMeta has none yet. */
  fallbackName?: string | null
}

/**
 * Renders a channel as a guild-icon bubble plus its name, falling back to the
 * raw channel id when no name has been captured. The bubble disambiguates
 * channels that share a name across different servers.
 */
export function ChannelLabel({ channelId, settings, fallbackName }: ChannelLabelProps) {
  const meta = settings.channelMeta[channelId]
  const name = meta?.name ?? (fallbackName || null)
  const guild = meta?.guildId ? settings.guilds[meta.guildId] : undefined

  return (
    <div className="ch-label">
      <GuildBubble guild={guild} />
      <div className="ch-label-text">
        <span className="ch-label-name">{name ? `#${name}` : channelId}</span>
        {name && <span className="ch-label-id">{channelId}</span>}
      </div>
    </div>
  )
}
