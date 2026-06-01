import { ELEMENT_KEYS, DEFAULT_SELECTORS, TOOLBAR_ITEM_KEYS, TOOLBAR_ITEM_SELECTORS } from './selectors'
import type { Settings, ElementKey } from '../shared/types'

const STYLE_ID = 'discord-hider-styles'

function resolveSelector(key: ElementKey, settings: Settings): string {
  return settings.elements[key].selector ?? DEFAULT_SELECTORS[key]
}

function resolveVisible(key: ElementKey, settings: Settings, channelId: string | null): boolean {
  if (channelId !== null) {
    const override = settings.channelOverrides[channelId]?.[key]
    if (override !== undefined) return override
  }
  return settings.elements[key].visible
}

export function buildCSS(settings: Settings, channelId: string | null): string {
  const rules = ELEMENT_KEYS
    .filter(key => key !== 'topToolbar')
    .filter(key => !resolveVisible(key, settings, channelId))
    .map(key => `${resolveSelector(key, settings)} { display: none !important; }`)

  if (!resolveVisible('topToolbar', settings, channelId)) {
    for (const itemKey of TOOLBAR_ITEM_KEYS) {
      if (!settings.topToolbarItems[itemKey]) {
        rules.push(`${TOOLBAR_ITEM_SELECTORS[itemKey]} { display: none !important; }`)
      }
    }
    rules.push(':root { --custom-app-top-bar-height: 0px !important; }')
  }

  return rules.join('\n')
}

function getChannelId(): string | null {
  const match = window.location.pathname.match(/\/channels\/\d+\/(\d+)/)
  return match?.[1] ?? null
}

export function applySettings(settings: Settings): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = buildCSS(settings, getChannelId())
}
