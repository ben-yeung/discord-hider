import { useState, useEffect } from 'react'
import { Settings, Eye, EyeOff } from 'lucide-react'
import {
  getSettings,
  setElementVisible,
  setElementSelector,
  updateGlobalKeyword,
  updateChannelKeyword,
  setKeywordMasterEnabled,
} from '../shared/storage'
import { DEFAULT_SELECTORS, ELEMENT_KEYS, LABELS } from '../content/selectors'
import { ToggleRow } from '../shared/components/ToggleRow'
import type { Settings as SettingsType, ElementKey, Keyword } from '../shared/types'
import './popup.css'

type Tab = 'elements' | 'keywords'

export function Popup() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [tab, setTab] = useState<Tab>('elements')
  const [channelId, setChannelId] = useState<string | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
    chrome.storage.onChanged.addListener((_changes, area) => {
      if (area === 'sync') getSettings().then(setSettings)
    })
    chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
      const id = t?.url?.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
      setChannelId(id)
    })
  }, [])

  async function handleToggle(key: ElementKey) {
    if (!settings) return
    const next = !settings.elements[key].visible
    await setElementVisible(key, next)
    setSettings(s =>
      s ? { ...s, elements: { ...s.elements, [key]: { ...s.elements[key], visible: next } } } : s
    )
  }

  async function handlePick(key: ElementKey) {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!t?.id) return
    try { await chrome.tabs.sendMessage(t.id, { type: 'startPicker', key }) } catch { /* not on Discord */ }
    window.close()
  }

  async function handleReset(key: ElementKey) {
    await setElementSelector(key, null)
    setSettings(s =>
      s ? { ...s, elements: { ...s.elements, [key]: { ...s.elements[key], selector: null } } } : s
    )
  }

  function openSettings() { chrome.runtime.openOptionsPage(); window.close() }

  if (!settings) return null

  // Build display list: global keywords + any channel-specific keywords for current channel
  const channelCfg = channelId ? settings.keywords.channelOverrides[channelId] : undefined
  const channelKwIds = new Set(
    (channelCfg?.keywords ?? []).map(k => k.id)
  )
  const displayKeywords: Keyword[] = channelCfg
    ? channelCfg.inheritGlobals
      ? (() => {
          const channelTexts = new Set(channelCfg.keywords.map(k => k.text.toLowerCase()))
          return [
            ...settings.keywords.keywords.filter(k => !channelTexts.has(k.text.toLowerCase())),
            ...channelCfg.keywords,
          ]
        })()
      : channelCfg.keywords
    : settings.keywords.keywords

  return (
    <div className="popup">
      <header className="popup-header">
        <span>Discord Hider</span>
      </header>

      <div className="popup-tabs">
        <button className={`popup-tab${tab === 'elements' ? ' active' : ''}`} onClick={() => setTab('elements')}>
          Elements
        </button>
        <button className={`popup-tab${tab === 'keywords' ? ' active' : ''}`} onClick={() => setTab('keywords')}>
          Keywords
        </button>
      </div>

      {tab === 'elements' && (
        <div className="popup-rows">
          {ELEMENT_KEYS.map(key => (
            <ToggleRow
              key={key}
              label={LABELS[key]}
              visible={settings.elements[key].visible}
              selector={settings.elements[key].selector}
              defaultSelector={DEFAULT_SELECTORS[key]}
              onToggle={() => handleToggle(key)}
              onPick={() => handlePick(key)}
              onReset={() => handleReset(key)}
            />
          ))}
        </div>
      )}

      {tab === 'keywords' && (
        <div className="popup-kw-rows">
          <div className="popup-kw-master">
            <span>Highlighting</span>
            <button
              className={`switch ${settings.keywords.enabled ? 'on' : 'off'}`}
              role="switch"
              aria-checked={settings.keywords.enabled}
              aria-label="Toggle keyword highlighting"
              onClick={() => setKeywordMasterEnabled(!settings.keywords.enabled)}
            />
          </div>
          {displayKeywords.map(kw => {
            const isChannel = channelKwIds.has(kw.id)
            return (
              <div key={kw.id} className={`popup-kw-row${kw.enabled ? '' : ' disabled'}`}>
                <div className="popup-kw-circle" style={{ background: kw.color }} />
                <span className="popup-kw-text">{kw.text}</span>
                {isChannel && <span className="popup-kw-channel-label">#channel</span>}
                <button
                  className="icon-btn"
                  title="Toggle keyword visibility"
                  onClick={() =>
                    isChannel && channelId
                      ? updateChannelKeyword(channelId, kw.id, { enabled: !kw.enabled })
                      : updateGlobalKeyword(kw.id, { enabled: !kw.enabled })
                  }
                >
                  {kw.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <footer className="popup-footer">
        <button onClick={openSettings}>
          <Settings size={13} />
          Open Settings
        </button>
      </footer>
    </div>
  )
}
