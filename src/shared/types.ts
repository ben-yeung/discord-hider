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

export interface Settings {
  elements: Record<ElementKey, ElementConfig>
  channelNames: { [channelId: string]: string }
  channelOverrides: {
    [channelId: string]: Partial<Record<ElementKey, boolean>>
  }
  keywords: KeywordSettings
  topToolbarItems: Record<ToolbarItemKey, boolean>
}
