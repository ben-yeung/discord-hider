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

// Re-highlight when Discord navigates between channels (SPA — uses history.pushState)
let lastPath = window.location.pathname
setInterval(async () => {
  const path = window.location.pathname
  if (path !== lastPath) {
    lastPath = path
    const s = await getSettings()
    applyKeywords(s, getChannelId())
  }
}, 500)

window.addEventListener('popstate', async () => {
  const s = await getSettings()
  applyKeywords(s, getChannelId())
})

// Highlight newly loaded messages without re-scanning the full DOM
startKeywordObserver(async nodes => {
  const s = await getSettings()
  highlightNodes(nodes, s, getChannelId())
})
