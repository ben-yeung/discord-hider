import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { saveSettings, setChannelOverride, removeChannelOverride } from '../shared/storage'
import { ELEMENT_KEYS, LABELS } from '../content/selectors'
import type { Settings, ElementKey } from '../shared/types'

interface Props {
  settings: Settings
  onSettingsChange: (s: Settings) => void
}

function extractChannelId(url: string): string | null {
  return url.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
}

export function ChannelOverrides({ settings, onSettingsChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const overrides = Object.entries(settings.channelOverrides)

  async function handleAdd() {
    const channelId = extractChannelId(urlInput)
    if (!channelId) return
    if (settings.channelOverrides[channelId] !== undefined) {
      setAdding(false)
      setUrlInput('')
      return
    }
    const next: Settings = {
      ...settings,
      channelOverrides: { ...settings.channelOverrides, [channelId]: {} },
    }
    await saveSettings(next)
    onSettingsChange(next)
    setAdding(false)
    setUrlInput('')
  }

  async function handleOverrideToggle(channelId: string, key: ElementKey) {
    const current = settings.channelOverrides[channelId]?.[key]
    // first toggle for a key without an override: flip away from global default
    const next = current === undefined ? !settings.elements[key].visible : !current
    await setChannelOverride(channelId, key, next)
    onSettingsChange({
      ...settings,
      channelOverrides: {
        ...settings.channelOverrides,
        [channelId]: { ...settings.channelOverrides[channelId], [key]: next },
      },
    })
  }

  async function handleRemove(channelId: string) {
    await removeChannelOverride(channelId)
    const next = {
      ...settings,
      channelOverrides: { ...settings.channelOverrides },
    }
    delete next.channelOverrides[channelId]
    onSettingsChange(next)
  }

  const channelId = extractChannelId(urlInput)

  return (
    <section>
      <p className="section-label">Per-Channel Overrides</p>

      {overrides.length === 0 && !adding && (
        <div className="empty-state">
          <span>No channel overrides configured</span>
          <button type="button" onClick={() => setAdding(true)}>+ Add Channel</button>
        </div>
      )}

      {overrides.map(([id, override]) => (
        <div key={id} className="channel-row">
          <span className="channel-id">{id}</span>
          {ELEMENT_KEYS.map(key => {
            const val = override[key]
            const effective = val ?? settings.elements[key].visible
            return (
              <button
                key={key}
                type="button"
                className={`mini-toggle${effective ? ' on' : ''}${val !== undefined ? ' custom' : ''}`}
                onClick={() => handleOverrideToggle(id, key)}
                title={LABELS[key]}
              >
                {LABELS[key].split(' ')[0]}
              </button>
            )
          })}
          <button type="button" className="icon-btn" onClick={() => handleRemove(id)} title="Remove override">
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {adding && (
        <div className="add-channel-form">
          <input
            type="text"
            placeholder="https://discord.com/channels/<server>/<channel>"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            autoFocus
          />
          <button type="button" onClick={handleAdd} disabled={!channelId}>Confirm</button>
          <button type="button" onClick={() => { setAdding(false); setUrlInput('') }}>Cancel</button>
        </div>
      )}

      {overrides.length > 0 && !adding && (
        <button type="button" className="add-btn" onClick={() => setAdding(true)}>+ Add Channel</button>
      )}
    </section>
  )
}
