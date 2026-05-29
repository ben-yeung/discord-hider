import { useState, useEffect } from 'react'
import { getSettings, setElementVisible, setElementSelector } from '../shared/storage'
import { DEFAULT_SELECTORS, ELEMENT_KEYS, LABELS } from '../content/selectors'
import { ToggleRow } from '../shared/components/ToggleRow'
import { ChannelOverrides } from './ChannelOverrides'
import { KeywordsSettings } from './KeywordsSettings'
import type { Settings as SettingsType, ElementKey } from '../shared/types'
import './settings.css'

type Tab = 'visibility' | 'keywords'

export function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [tab, setTab] = useState<Tab>('visibility')

  useEffect(() => {
    getSettings().then(setSettings)
    chrome.storage.onChanged.addListener((_changes, area) => {
      if (area === 'sync') getSettings().then(setSettings)
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
    const [t] = await chrome.tabs.query({ url: 'https://discord.com/*' })
    if (!t?.id) return
    try { await chrome.tabs.sendMessage(t.id, { type: 'startPicker', key }) } catch { /* no Discord tab */ }
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
      <div className="settings-tabs">
        <button className={`settings-tab${tab === 'visibility' ? ' active' : ''}`} onClick={() => setTab('visibility')}>
          Visibility
        </button>
        <button className={`settings-tab${tab === 'keywords' ? ' active' : ''}`} onClick={() => setTab('keywords')}>
          Keywords
        </button>
      </div>
      <main className="settings-main">
        {tab === 'visibility' && (
          <>
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
          </>
        )}
        {tab === 'keywords' && <KeywordsSettings />}
      </main>
    </div>
  )
}
