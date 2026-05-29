import type { Settings, ElementKey, ElementConfig } from './types'

export const DEFAULT_SETTINGS: Settings = {
  elements: {
    serverList: { visible: true, selector: null },
    channelColumn: { visible: true, selector: null },
    topToolbar: { visible: true, selector: null },
    chatBar: { visible: true, selector: null },
  },
  channelOverrides: {},
  keywords: {
    enabled: false,
    style: 'background',
    keywords: [],
    channelOverrides: {},
  },
}

export function getSettings(): Promise<Settings> {
  return new Promise(resolve => {
    chrome.storage.sync.get('settings', result => {
      resolve((result.settings as Settings | undefined) ?? structuredClone(DEFAULT_SETTINGS))
    })
  })
}

export function saveSettings(settings: Settings): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.sync.set({ settings }, resolve)
  })
}

async function patchElement(key: ElementKey, patch: Partial<ElementConfig>): Promise<void> {
  const s = await getSettings()
  s.elements[key] = { ...s.elements[key], ...patch }
  await saveSettings(s)
}

export function setElementVisible(key: ElementKey, visible: boolean): Promise<void> {
  return patchElement(key, { visible })
}

export function setElementSelector(key: ElementKey, selector: string | null): Promise<void> {
  return patchElement(key, { selector })
}

export async function setChannelOverride(
  channelId: string,
  key: ElementKey,
  visible: boolean,
): Promise<void> {
  const s = await getSettings()
  s.channelOverrides[channelId] = { ...s.channelOverrides[channelId], [key]: visible }
  await saveSettings(s)
}

export async function removeChannelOverride(channelId: string): Promise<void> {
  const s = await getSettings()
  delete s.channelOverrides[channelId]
  await saveSettings(s)
}
