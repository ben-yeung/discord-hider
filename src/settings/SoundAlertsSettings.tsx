import { useState } from 'react'
import { Trash2, ShieldCheck } from 'lucide-react'
import {
  setSoundDefaultSound,
  setSoundDefaultVolume,
  setSoundChannelEnabled,
  setSoundChannelSound,
  setSoundChannelVolume,
  removeSoundChannel,
} from '../shared/storage'
import { SOUND_IDS, SOUND_LABELS } from '../content/selectors'
import type { Settings, SoundId } from '../shared/types'

interface Props {
  settings: Settings
  onSettingsChange: (s: Settings) => void
}

export function SoundAlertsSettings({ settings, onSettingsChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const sa = settings.soundAlerts
  const channels = Object.entries(sa.channels)

  function patch(next: Settings) { onSettingsChange(next) }

  async function handleDefaultSound(sound: SoundId) {
    await setSoundDefaultSound(sound)
    patch({ ...settings, soundAlerts: { ...sa, defaultSound: sound } })
  }

  function handleDefaultVolumeLocal(volume: number) {
    patch({ ...settings, soundAlerts: { ...sa, defaultVolume: volume } })
  }
  async function handleDefaultVolumeCommit(volume: number) {
    await setSoundDefaultVolume(volume)
  }

  async function handleChannelEnable(channelId: string) {
    const next = !(sa.channels[channelId]?.enabled ?? false)
    await setSoundChannelEnabled(channelId, next)
    patch({
      ...settings,
      soundAlerts: { ...sa, channels: { ...sa.channels, [channelId]: { ...sa.channels[channelId], enabled: next } } },
    })
  }

  async function handleChannelSound(channelId: string, value: string) {
    const sound = value === 'default' ? undefined : (value as SoundId)
    await setSoundChannelSound(channelId, sound)
    const cfg = { ...sa.channels[channelId], enabled: sa.channels[channelId]?.enabled ?? false }
    if (sound === undefined) delete cfg.sound; else cfg.sound = sound
    patch({ ...settings, soundAlerts: { ...sa, channels: { ...sa.channels, [channelId]: cfg } } })
  }

  function handleChannelVolumeLocal(channelId: string, volume: number) {
    const cfg = { ...sa.channels[channelId], enabled: sa.channels[channelId]?.enabled ?? false, volume }
    patch({ ...settings, soundAlerts: { ...sa, channels: { ...sa.channels, [channelId]: cfg } } })
  }
  async function handleChannelVolumeCommit(channelId: string, volume: number) {
    await setSoundChannelVolume(channelId, volume)
  }

  async function handleRemove(channelId: string) {
    await removeSoundChannel(channelId)
    const next = { ...settings, soundAlerts: { ...sa, channels: { ...sa.channels } } }
    delete next.soundAlerts.channels[channelId]
    patch(next)
  }

  async function handleAddCurrent() {
    const [t] = await chrome.tabs.query({ url: 'https://discord.com/*' })
    if (!t?.id) return
    try {
      const info = await chrome.tabs.sendMessage(t.id, { type: 'getChannelInfo' })
      const id = info?.channelId as string | undefined
      if (id && sa.channels[id] === undefined) {
        await setSoundChannelEnabled(id, true)
        patch({ ...settings, soundAlerts: { ...sa, channels: { ...sa.channels, [id]: { enabled: true } } } })
      }
    } catch { /* no Discord tab / content script not ready */ }
  }

  function extractChannelId(url: string): string | null {
    return url.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
  }

  async function handleAddUrl() {
    const id = extractChannelId(urlInput)
    if (!id) return
    if (sa.channels[id] === undefined) {
      await setSoundChannelEnabled(id, true)
      patch({ ...settings, soundAlerts: { ...sa, channels: { ...sa.channels, [id]: { enabled: true } } } })
    }
    setAdding(false)
    setUrlInput('')
  }

  return (
    <>
      <section>
        <p className="section-label">Global</p>
        <div className="element-rows">
          <div className="card-row">
            <div className="grow snd-set-lbl">
              Default volume
              <small><ShieldCheck size={11} /> Used by channels without their own · limiter caps peak loudness</small>
            </div>
            <div className="snd-set-vol">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(sa.defaultVolume * 100)}
                onChange={e => handleDefaultVolumeLocal(Number(e.target.value) / 100)}
                onPointerUp={e => handleDefaultVolumeCommit(Number((e.target as HTMLInputElement).value) / 100)}
                onKeyUp={e => handleDefaultVolumeCommit(Number((e.target as HTMLInputElement).value) / 100)}
                aria-label="Default volume"
              />
              <span className="snd-set-vol-val">{Math.round(sa.defaultVolume * 100)}%</span>
            </div>
          </div>
          <div className="card-row">
            <div className="grow snd-set-lbl">Default sound<small>Played when a channel has no sound of its own</small></div>
            <div className="snd-set-seg">
              {SOUND_IDS.map(id => (
                <button
                  key={id}
                  type="button"
                  className={`snd-set-chip${sa.defaultSound === id ? ' sel' : ''}`}
                  onClick={() => handleDefaultSound(id)}
                >
                  {SOUND_LABELS[id]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <p className="section-label">Per-Channel</p>

        {channels.length === 0 && !adding && (
          <div className="empty-state">
            <span>No channels have sound alerts</span>
            <button type="button" onClick={handleAddCurrent}>+ Add current channel</button>
          </div>
        )}

        {channels.map(([id, cfg]) => (
          <div key={id} className="snd-ch-row">
            <span className="channel-id grow">{id}</span>
            <button
              type="button"
              className={`mini-toggle${cfg.enabled ? ' on' : ''}`}
              onClick={() => handleChannelEnable(id)}
            >
              {cfg.enabled ? 'On' : 'Off'}
            </button>
            <select
              className="snd-ch-sound-sel"
              value={cfg.sound ?? 'default'}
              onChange={e => handleChannelSound(id, e.target.value)}
              aria-label="Channel sound"
            >
              <option value="default">Default ({SOUND_LABELS[sa.defaultSound]})</option>
              {SOUND_IDS.map(sid => (
                <option key={sid} value={sid}>{SOUND_LABELS[sid]}</option>
              ))}
            </select>
            <div className="snd-ch-vol">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((cfg.volume ?? sa.defaultVolume) * 100)}
                onChange={e => handleChannelVolumeLocal(id, Number(e.target.value) / 100)}
                onPointerUp={e => handleChannelVolumeCommit(id, Number((e.target as HTMLInputElement).value) / 100)}
                onKeyUp={e => handleChannelVolumeCommit(id, Number((e.target as HTMLInputElement).value) / 100)}
                aria-label="Channel volume"
              />
              <span className="snd-ch-vol-val">{Math.round((cfg.volume ?? sa.defaultVolume) * 100)}%</span>
            </div>
            <button type="button" className="icon-btn" onClick={() => handleRemove(id)} title="Remove channel">
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
            <button type="button" onClick={handleAddUrl} disabled={!extractChannelId(urlInput)}>Confirm</button>
            <button type="button" onClick={() => { setAdding(false); setUrlInput('') }}>Cancel</button>
          </div>
        )}

        {channels.length > 0 && !adding && (
          <div className="snd-add-actions">
            <button type="button" className="add-btn" onClick={handleAddCurrent}>+ Add current channel</button>
            <button type="button" className="add-btn secondary" onClick={() => setAdding(true)}>+ Add by URL</button>
          </div>
        )}
      </section>
    </>
  )
}
