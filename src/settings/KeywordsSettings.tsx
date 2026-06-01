import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, X, Trash2 } from 'lucide-react'
import {
  getSettings,
  setKeywordMasterEnabled,
  setKeywordStyle,
  addGlobalKeyword,
  updateGlobalKeyword,
  removeGlobalKeyword,
  setChannelKeywordConfig,
  removeChannelKeywordConfig,
  addChannelKeyword,
  updateChannelKeyword,
  removeChannelKeyword,
  updateChannelName,
} from '../shared/storage'
import type { Settings, Keyword, ChannelKeywordConfig } from '../shared/types'

function extractChannelId(url: string): string | null {
  return url.match(/\/channels\/\d+\/(\d+)/)?.[1] ?? null
}

interface KwRowProps {
  keyword: Keyword
  onToggle: () => void
  onRemove: () => void
  onColorChange: (color: string) => void
}

function KeywordRow({ keyword, onToggle, onRemove, onColorChange }: KwRowProps) {
  const colorRef = useRef<HTMLInputElement>(null)
  return (
    <div className={`kw-row${keyword.enabled ? '' : ' disabled'}`}>
      <div className="kw-color-circle" style={{ background: keyword.color }} onClick={() => colorRef.current?.click()}>
        <input
          ref={colorRef}
          type="color"
          value={keyword.color}
          onChange={e => onColorChange(e.target.value)}
          aria-label={`Color for ${keyword.text}`}
        />
      </div>
      <span className="kw-text">{keyword.text}</span>
      <button className="icon-btn" title="Toggle keyword visibility" onClick={onToggle}>
        {keyword.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      <button className="icon-btn" title="Remove keyword" onClick={onRemove}>
        <X size={15} />
      </button>
    </div>
  )
}

export function KeywordsSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [newText, setNewText] = useState('')
  const [newColor, setNewColor] = useState('#5865f2')
  const [addingChannel, setAddingChannel] = useState(false)
  const [channelUrlInput, setChannelUrlInput] = useState('')
  const [channelNewTexts, setChannelNewTexts] = useState<Record<string, string>>({})
  const [channelNewColors, setChannelNewColors] = useState<Record<string, string>>({})
  const newColorRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSettings().then(setSettings)
    const listener = (_c: object, area: string) => {
      if (area === 'sync') getSettings().then(setSettings)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  async function handleAddGlobal() {
    if (!newText.trim()) return
    const kw: Keyword = { id: crypto.randomUUID(), text: newText.trim(), color: newColor, enabled: true }
    await addGlobalKeyword(kw)
    setNewText('')
  }

  async function handleAddChannel() {
    // Try to get channelId/channelName from active Discord tab
    let channelId: string | null = null
    let channelName: string | null = null
    try {
      const [tab] = await chrome.tabs.query({ active: true, url: 'https://discord.com/*' })
      if (tab?.id) {
        const info = await chrome.tabs.sendMessage(tab.id, { type: 'getChannelInfo' }) as
          { channelId: string | null; channelName: string | null }
        channelId = info.channelId
        channelName = info.channelName
      }
    } catch { /* no Discord tab */ }

    if (channelId) {
      const cfg: ChannelKeywordConfig = { inheritGlobals: true, keywords: [] }
      await setChannelKeywordConfig(channelId, cfg)
      if (channelName) await updateChannelName(channelId, channelName)
    } else {
      setAddingChannel(true)
    }
  }

  async function handleUrlFallbackConfirm() {
    const channelId = extractChannelId(channelUrlInput)
    if (!channelId) return
    const cfg: ChannelKeywordConfig = { inheritGlobals: true, keywords: [] }
    await setChannelKeywordConfig(channelId, cfg)
    setAddingChannel(false)
    setChannelUrlInput('')
  }

  if (!settings) return null
  const kws = settings.keywords

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Master controls */}
      <div className="kw-card" style={{ padding: '14px 16px', overflow: 'visible' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>Keyword highlighting</div>
            <div style={{ color: '#949ba4', fontSize: '12px', marginTop: '3px' }}>
              Master switch — disables all highlighting without deleting keywords
            </div>
          </div>
          <button
            className={`switch ${kws.enabled ? 'on' : 'off'}`}
            role="switch"
            aria-checked={kws.enabled}
            aria-label="Toggle keyword highlighting"
            onClick={async () => { await setKeywordMasterEnabled(!kws.enabled) }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#dbdee1', fontSize: '14px' }}>Highlight style</span>
          <div className="style-preview-wrap">
            <button
              className={`style-preview-btn${kws.style === 'background' ? ' active' : ''}`}
              onClick={async () => { await setKeywordStyle('background') }}
            >
              <span className="style-bg">Background</span>
            </button>
            <button
              className={`style-preview-btn${kws.style === 'chip' ? ' active' : ''}`}
              onClick={async () => { await setKeywordStyle('chip') }}
            >
              <span className="style-chip">Chip</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global keywords */}
      <section>
        <p className="section-label">Global Keywords</p>
        <div className="kw-card">
          {kws.keywords.map(kw => (
            <KeywordRow
              key={kw.id}
              keyword={kw}
              onToggle={() => updateGlobalKeyword(kw.id, { enabled: !kw.enabled })}
              onRemove={() => removeGlobalKeyword(kw.id)}
              onColorChange={color => updateGlobalKeyword(kw.id, { color })}
            />
          ))}
          <div className="kw-add-row">
            <div
              className="kw-color-circle"
              style={{ background: newColor }}
              onClick={() => newColorRef.current?.click()}
            >
              <input
                ref={newColorRef}
                type="color"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                aria-label="New keyword color"
              />
            </div>
            <input
              className="kw-add-input"
              type="text"
              placeholder="New keyword…"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddGlobal() }}
            />
            <button className="kw-add-btn" onClick={handleAddGlobal}>Add</button>
          </div>
        </div>
      </section>

      {/* Per-channel */}
      <section>
        <p className="section-label">Per-Channel Keywords</p>
        {Object.entries(kws.channelOverrides).map(([channelId, cfg]) => (
          <div key={channelId} className="ch-kw-card">
            <div className="ch-kw-header">
              <div className="ch-kw-name-row">
                <div className="ch-kw-name-wrap">
                  <span className="ch-kw-name">
                    {settings.channelNames[channelId] ?? channelId}
                  </span>
                  <span className="ch-kw-id">{channelId}</span>
                </div>
                <button
                  className="icon-btn"
                  title="Remove channel"
                  onClick={() => removeChannelKeywordConfig(channelId)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <label className="ch-kw-inherit">
                <input
                  type="checkbox"
                  checked={cfg.inheritGlobals}
                  style={{ width: '15px', height: '15px', accentColor: '#5865f2', margin: 0 }}
                  onChange={async e => {
                    await setChannelKeywordConfig(channelId, { ...cfg, inheritGlobals: e.target.checked })
                  }}
                />
                <span>Inherit global keywords</span>
              </label>
            </div>
            <div className="ch-kw-divider" />
            {cfg.keywords.map(kw => (
              <KeywordRow
                key={kw.id}
                keyword={kw}
                onToggle={() => updateChannelKeyword(channelId, kw.id, { enabled: !kw.enabled })}
                onRemove={() => removeChannelKeyword(channelId, kw.id)}
                onColorChange={color => updateChannelKeyword(channelId, kw.id, { color })}
              />
            ))}
            <div className="kw-add-row">
              <div
                className="kw-color-circle"
                style={{ background: channelNewColors[channelId] ?? '#5865f2' }}
                onClick={() => document.getElementById(`ch-color-${channelId}`)?.click()}
              >
                <input
                  id={`ch-color-${channelId}`}
                  type="color"
                  value={channelNewColors[channelId] ?? '#5865f2'}
                  onChange={e => setChannelNewColors(p => ({ ...p, [channelId]: e.target.value }))}
                  aria-label="New channel keyword color"
                />
              </div>
              <input
                className="kw-add-input"
                type="text"
                placeholder="Add channel keyword…"
                value={channelNewTexts[channelId] ?? ''}
                onChange={e => setChannelNewTexts(p => ({ ...p, [channelId]: e.target.value }))}
                onKeyDown={async e => {
                  if (e.key !== 'Enter') return
                  const text = channelNewTexts[channelId]?.trim()
                  if (!text) return
                  await addChannelKeyword(channelId, {
                    id: crypto.randomUUID(), text, color: channelNewColors[channelId] ?? '#5865f2', enabled: true,
                  })
                  setChannelNewTexts(p => ({ ...p, [channelId]: '' }))
                }}
              />
              <button
                className="kw-add-btn"
                onClick={async () => {
                  const text = channelNewTexts[channelId]?.trim()
                  if (!text) return
                  await addChannelKeyword(channelId, {
                    id: crypto.randomUUID(), text, color: channelNewColors[channelId] ?? '#5865f2', enabled: true,
                  })
                  setChannelNewTexts(p => ({ ...p, [channelId]: '' }))
                }}
              >
                Add
              </button>
            </div>
          </div>
        ))}

        {addingChannel && (
          <div className="ch-url-form">
            <input
              className="ch-url-input"
              type="text"
              placeholder="https://discord.com/channels/…"
              value={channelUrlInput}
              onChange={e => setChannelUrlInput(e.target.value)}
              autoFocus
            />
            <button className="kw-add-btn" onClick={handleUrlFallbackConfirm}>
              Confirm
            </button>
            <button
              className="kw-add-btn"
              style={{ background: 'transparent', border: '1px solid #4e5058', color: '#b5bac1' }}
              onClick={() => { setAddingChannel(false); setChannelUrlInput('') }}
            >
              Cancel
            </button>
          </div>
        )}

        <button className="add-channel-btn" onClick={handleAddChannel}>
          + Add Channel
        </button>
      </section>

    </div>
  )
}
