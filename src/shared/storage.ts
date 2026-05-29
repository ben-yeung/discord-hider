import type { Settings, ElementKey, ElementConfig, Keyword, ChannelKeywordConfig, KeywordSettings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  elements: {
    serverList: { visible: true, selector: null },
    channelColumn: { visible: true, selector: null },
    topToolbar: { visible: true, selector: null },
    chatBar: { visible: true, selector: null },
  },
  channelOverrides: {},
  keywords: {
    enabled: true,
    style: 'background',
    keywords: [],
    channelOverrides: {},
  },
}

export function getSettings(): Promise<Settings> {
  return new Promise(resolve => {
    chrome.storage.sync.get('settings', result => {
      const stored = result.settings as Partial<Settings> | undefined
      if (!stored) { resolve(DEFAULT_SETTINGS); return }
      resolve({
        ...DEFAULT_SETTINGS,
        ...stored,
        keywords: { ...DEFAULT_SETTINGS.keywords, ...(stored.keywords ?? {}) },
      })
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

async function patchKeywords(patch: Partial<KeywordSettings>): Promise<void> {
  const s = await getSettings()
  s.keywords = { ...s.keywords, ...patch }
  await saveSettings(s)
}

export function setKeywordMasterEnabled(enabled: boolean): Promise<void> {
  return patchKeywords({ enabled })
}

export function setKeywordStyle(style: 'background' | 'chip'): Promise<void> {
  return patchKeywords({ style })
}

export async function addGlobalKeyword(keyword: Keyword): Promise<void> {
  const s = await getSettings()
  s.keywords.keywords = [...s.keywords.keywords, keyword]
  await saveSettings(s)
}

export async function updateGlobalKeyword(id: string, patch: Partial<Keyword>): Promise<void> {
  const s = await getSettings()
  s.keywords.keywords = s.keywords.keywords.map(k => k.id === id ? { ...k, ...patch } : k)
  await saveSettings(s)
}

export async function removeGlobalKeyword(id: string): Promise<void> {
  const s = await getSettings()
  s.keywords.keywords = s.keywords.keywords.filter(k => k.id !== id)
  await saveSettings(s)
}

export async function setChannelKeywordConfig(channelId: string, config: ChannelKeywordConfig): Promise<void> {
  const s = await getSettings()
  s.keywords.channelOverrides[channelId] = config
  await saveSettings(s)
}

export async function removeChannelKeywordConfig(channelId: string): Promise<void> {
  const s = await getSettings()
  delete s.keywords.channelOverrides[channelId]
  await saveSettings(s)
}

export async function addChannelKeyword(channelId: string, keyword: Keyword): Promise<void> {
  const s = await getSettings()
  const cfg = s.keywords.channelOverrides[channelId]
  if (!cfg) return
  cfg.keywords = [...cfg.keywords, keyword]
  await saveSettings(s)
}

export async function updateChannelKeyword(channelId: string, id: string, patch: Partial<Keyword>): Promise<void> {
  const s = await getSettings()
  const cfg = s.keywords.channelOverrides[channelId]
  if (!cfg) return
  cfg.keywords = cfg.keywords.map(k => k.id === id ? { ...k, ...patch } : k)
  await saveSettings(s)
}

export async function removeChannelKeyword(channelId: string, id: string): Promise<void> {
  const s = await getSettings()
  const cfg = s.keywords.channelOverrides[channelId]
  if (!cfg) return
  cfg.keywords = cfg.keywords.filter(k => k.id !== id)
  await saveSettings(s)
}
