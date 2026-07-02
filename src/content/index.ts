import { getSettings } from '../shared/storage'
import { applySettings } from './styleManager'
import { startPicker } from './picker'
import { applyKeywords, highlightNodes, getChannelName, getGuildInfo, startKeywordObserver } from './keywordHighlighter'
import { onNavigate, processAddedNodes, toggleArmMute, getSoundState, syncHeaderButton, isChannelEnabled } from './soundAlerts'
import { playSound } from '../shared/soundPlayer'
import type { ElementKey } from '../shared/types'

function getChannelId(): string | null {
  return window.location.pathname.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
}

function getGuildId(): string | null {
  return window.location.pathname.match(/\/channels\/(\d+)\/\d+/)?.[1] ?? null
}

async function applyAll(): Promise<void> {
  const s = await getSettings()
  applySettings(s)
  applyKeywords(s, getChannelId())
  onNavigate(s, getChannelId())
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
    const guildId = getGuildId()
    const guild = getGuildInfo(guildId)
    sendResponse({
      channelId: getChannelId(),
      channelName: getChannelName(),
      guildId,
      guildName: guild.name,
      guildIcon: guild.icon,
    })
  }
  if (message.type === 'getSoundState') {
    sendResponse(getSoundState())
  }
  if (message.type === 'toggleSoundArmMute') {
    sendResponse(toggleArmMute())
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

// Highlight newly loaded messages without re-scanning the full DOM, and fire
// per-channel sound alerts for genuinely-new messages in the open channel.
startKeywordObserver(async nodes => {
  const s = await getSettings()
  const channelId = getChannelId()
  highlightNodes(nodes, s, channelId)
  // Self-heal the header button if Discord rendered the header after load.
  syncHeaderButton(isChannelEnabled(s, channelId))
  for (const intent of processAddedNodes(nodes, s, channelId)) {
    void playSound(intent.sound, intent.volume)
  }
})
