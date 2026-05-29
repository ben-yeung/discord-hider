import { useState, useEffect } from 'react'
import { getSettings, setElementVisible, setElementSelector } from '../shared/storage'
import { DEFAULT_SELECTORS, ELEMENT_KEYS, LABELS } from '../content/selectors'
import { ToggleRow } from '../shared/components/ToggleRow'
import { ChannelOverrides } from './ChannelOverrides'
import type { Settings as SettingsType, ElementKey } from '../shared/types'
import './settings.css'

export function Settings() {
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
    const [tab] = await chrome.tabs.query({ url: 'https://discord.com/*' })
    if (!tab?.id) return
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'startPicker', key })
    } catch {
      // No Discord tab available
    }
  }

  async function handleReset(key: ElementKey) {
    await setElementSelector(key, null)
    setSettings(s =>
      s ? { ...s, elements: { ...s.elements, [key]: { ...s.elements[key], selector: null } } } : s
    )
  }

  if (!settings) return null

  return (
    <div className="settings">
      <header className="settings-header">
        <h1>Discord Hider — Settings</h1>
      </header>
      <main className="settings-main">
        <section>
          <p className="section-label">Global Visibility</p>
          <div className="element-rows">
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
                showSelector
              />
            ))}
          </div>
        </section>
        <ChannelOverrides settings={settings} onSettingsChange={setSettings} />
      </main>
    </div>
  )
}
