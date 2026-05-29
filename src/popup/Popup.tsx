import { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'
import { getSettings, setElementVisible, setElementSelector } from '../shared/storage'
import { DEFAULT_SELECTORS, ELEMENT_KEYS, LABELS } from '../content/selectors'
import { ToggleRow } from '../shared/components/ToggleRow'
import type { Settings as SettingsType, ElementKey } from '../shared/types'
import './popup.css'

export function Popup() {
  const [settings, setSettings] = useState<SettingsType | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
    const listener = (_changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'sync') getSettings().then(setSettings)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'startPicker', key })
      window.close()
    } catch {
      // Not on Discord or content script not yet ready — popup stays open
    }
  }

  async function handleReset(key: ElementKey) {
    await setElementSelector(key, null)
    setSettings(s =>
      s ? { ...s, elements: { ...s.elements, [key]: { ...s.elements[key], selector: null } } } : s
    )
  }

  function openSettings() {
    chrome.runtime.openOptionsPage()
    window.close()
  }

  if (!settings) return null

  return (
    <div className="popup">
      <header className="popup-header">
        <span>Discord Hider</span>
      </header>
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
      <footer className="popup-footer">
        <button type="button" onClick={openSettings}>
          <Settings size={13} />
          Open Settings
        </button>
      </footer>
    </div>
  )
}
