export type ElementKey = 'serverList' | 'channelColumn' | 'topToolbar' | 'chatBar'

export interface ElementConfig {
  visible: boolean
  selector: string | null
}

export interface Settings {
  elements: Record<ElementKey, ElementConfig>
  channelOverrides: {
    [channelId: string]: Partial<Record<ElementKey, boolean>>
  }
}
