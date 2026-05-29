import type { ElementKey } from '../shared/types'

export const ELEMENT_KEYS: readonly ElementKey[] = [
  'serverList',
  'channelColumn',
  'topToolbar',
  'chatBar',
]

export const DEFAULT_SELECTORS: Record<ElementKey, string> = {
  serverList: 'nav[aria-label="Servers sidebar"]',
  channelColumn: 'div[class*="sidebarList"]',
  topToolbar: 'div[class*="toolbar"], div[data-window-chrome="true"]',
  chatBar: 'div[class*="channelTextArea"]',
}

export const LABELS: Record<ElementKey, string> = {
  serverList: 'Server List',
  channelColumn: 'Channel Column',
  topToolbar: 'Top Toolbar',
  chatBar: 'Chat Bar',
}
