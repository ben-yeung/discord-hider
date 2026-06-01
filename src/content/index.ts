import { getSettings } from '../shared/storage'
import { applySettings } from './styleManager'
import { startPicker } from './picker'
import { applyKeywords, highlightNodes, getChannelName, startKeywordObserver } from './keywordHighlighter'
import type { ElementKey } from '../shared/types'

function getChannelId(): string | null {
  return window.location.pathname.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
}

async function applyAll(): Promise<void> {
  const s = await getSettings()
  applySettings(s)
  applyKeywords(s, getChannelId())
}

applyAll()

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'sync') applyAll()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'startPicker') {
    startPicker(message.key as ElementKey, applyAll)
  }
  if (message.type === 'getChannelInfo') {
    sendResponse({ channelId: getChannelId(), channelName: getChannelName() })
  }
})

// Re-apply everything when Discord navigates between channels. Discord is an
// SPA, so channel switches are same-document history changes (no reload).
// Visibility overrides are channel-scoped, so the CSS must be rebuilt on every
// navigation, not just the keyword highlights.
//
// The Navigation API's `navigatesuccess` fires after any same-document
// navigation commits (pushState/replaceState/back-forward), which is exactly
// when window.location reflects the new channel. Fall back to `popstate` for
// runtimes without the Navigation API (back/forward only).
interface NavigationLike {
  addEventListener(type: 'navigatesuccess', listener: () => void): void
}

const navigation = (window as unknown as { navigation?: NavigationLike }).navigation
if (navigation) {
  navigation.addEventListener('navigatesuccess', () => applyAll())
} else {
  window.addEventListener('popstate', () => applyAll())
}

// Highlight newly loaded messages without re-scanning the full DOM
startKeywordObserver(async nodes => {
  const s = await getSettings()
  highlightNodes(nodes, s, getChannelId())
})
