export type ElementKey = 'serverList' | 'channelColumn' | 'topToolbar' | 'chatBar'

export type ToolbarItemKey = 'threads' | 'notificationSettings' | 'pinnedMessages' | 'memberList' | 'searchBar'

export interface ElementConfig {
  visible: boolean
  selector: string | null
}

export interface Keyword {
  id: string           // crypto.randomUUID() — used as CSS class suffix
  text: string         // case-insensitive substring to match
  color: string        // hex e.g. "#fde047"
  enabled: boolean     // eye-icon toggle
}

export interface ChannelKeywordConfig {
  channelName: string | null   // from document.title at save time
  inheritGlobals: boolean      // if true, global + channel keywords both apply
  keywords: Keyword[]
}

export interface KeywordSettings {
  enabled: boolean
  style: 'background' | 'chip'
  keywords: Keyword[]
  channelOverrides: {
    [channelId: string]: ChannelKeywordConfig
  }
}

export type SoundId = 'ding' | 'anime' | 'meet' | 'quack'

export interface SoundChannelConfig {
  enabled: boolean       // absent entry = off
  sound?: SoundId        // omitted = use the global default sound
  volume?: number        // 0..1; omitted = use the global default volume
}

export interface SoundAlertSettings {
  defaultSound: SoundId          // used when a channel has no sound of its own
  defaultVolume: number          // 0..1; used when a channel has no volume of its own
  channels: {
    [channelId: string]: SoundChannelConfig
  }
}

/**
 * Display metadata for a channel, captured from the live Discord tab whenever
 * we have one open. Purely cosmetic — used so the settings page can show a
 * human-readable name and guild bubble instead of a bare channel id.
 */
export interface ChannelMeta {
  name?: string        // channel name without a leading '#', e.g. "general"
  guildId?: string     // owning server; keys into `guilds`
}

/**
 * Display metadata for a guild (server). Normalized out of ChannelMeta so a
 * server's icon is stored once regardless of how many of its channels are
 * configured.
 */
export interface GuildMeta {
  name?: string        // server name, used for the bubble tooltip and initials fallback
  icon?: string        // cdn.discordapp.com icon URL; absent when the server has no custom icon
}

export interface Settings {
  elements: Record<ElementKey, ElementConfig>
  channelOverrides: {
    [channelId: string]: Partial<Record<ElementKey, boolean>>
  }
  keywords: KeywordSettings
  topToolbarItems: Record<ToolbarItemKey, boolean>
  soundAlerts: SoundAlertSettings
  channelMeta: {
    [channelId: string]: ChannelMeta
  }
  guilds: {
    [guildId: string]: GuildMeta
  }
}
