import type { Settings, SoundId, SoundChannelConfig } from '../shared/types'
import { unlockAudio } from '../shared/soundPlayer'

// Sound alerts play a short effect when a genuinely-new message arrives in the
// open channel. See docs/superpowers/specs/2026-07-01-sound-alerts-design.md.
//
// The module splits into pure, testable decision helpers (shouldPlay,
// extractSnowflake, isNearListEnd, effective*, processAddedNodes) and guarded
// side-effects (Web Audio playback, header button injection). Arming and mute
// are ephemeral per-tab runtime state, never persisted — a reload returns to
// the muted default.

const QUIET_MS = 1500      // silence right after a channel navigation (bulk render)
const THROTTLE_MS = 1200   // coalesce bursts: at most one sound per window

// ---- runtime state (per tab, not persisted) ----
let armed = false
let muted = false
let quietUntil = 0
let lastPlayedAt = 0
const lastSeenId: Record<string, bigint> = {}

/** Reset all runtime state. Test-only. */
export function __resetSoundState(): void {
  armed = false
  muted = false
  quietUntil = 0
  lastPlayedAt = 0
  for (const k of Object.keys(lastSeenId)) delete lastSeenId[k]
}

// ---- pure helpers ----

export function isChannelEnabled(settings: Settings, channelId: string | null): boolean {
  if (!channelId) return false
  return settings.soundAlerts.channels[channelId]?.enabled === true
}

export function effectiveSound(cfg: SoundChannelConfig | undefined, def: SoundId): SoundId {
  return cfg?.sound ?? def
}

export function effectiveVolume(cfg: SoundChannelConfig | undefined, def: number): number {
  return cfg?.volume ?? def
}

/**
 * A message row carries an id like "chat-messages-<channelId>-<messageId>".
 * The message id is a snowflake (time-ordered), and is the last long digit run.
 */
export function extractSnowflake(el: Element): bigint | null {
  const id = (el as HTMLElement).id || ''
  const runs = id.match(/\d{17,25}/g)
  if (!runs) return null
  try {
    return BigInt(runs[runs.length - 1])
  } catch {
    return null
  }
}

/**
 * Live messages are appended at the end of the message list; backscroll
 * prepends at the top. Being among the last few siblings marks a genuine
 * append regardless of where the user has scrolled.
 */
export function isNearListEnd(row: Element): boolean {
  const parent = row.parentElement
  if (!parent) return true
  const items = parent.children
  const idx = Array.prototype.indexOf.call(items, row)
  return idx >= items.length - 3
}

export interface SoundGate {
  armed: boolean
  muted: boolean
  now: number
  quietUntil: number
  lastPlayedAt: number
  throttleMs: number
  channelEnabled: boolean
  snowflake: bigint | null
  lastSeen: bigint | undefined
  nearListEnd: boolean
}

/** The redundant filter that decides whether a candidate node fires a sound. */
export function shouldPlay(g: SoundGate): boolean {
  if (!g.channelEnabled) return false
  if (!g.armed || g.muted) return false
  if (g.now < g.quietUntil) return false
  if (!g.nearListEnd) return false
  if (g.snowflake === null) return false
  if (g.lastSeen !== undefined && g.snowflake <= g.lastSeen) return false
  if (g.now - g.lastPlayedAt < g.throttleMs) return false
  return true
}

// ---- DOM scanning ----

function messageRowsIn(node: Node): Element[] {
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const el = node as Element
  const rows: Element[] = []
  if (el.matches?.('[id^="chat-messages"]')) rows.push(el)
  el.querySelectorAll?.('[id^="chat-messages"]').forEach(r => rows.push(r))
  return rows
}

function maxRenderedSnowflake(): bigint | null {
  let max: bigint | null = null
  document.querySelectorAll('[id^="chat-messages"]').forEach(row => {
    const id = extractSnowflake(row)
    if (id !== null && (max === null || id > max)) max = id
  })
  return max
}

// ---- orchestration (uses runtime state; returns intents to keep effects out) ----

export interface PlayIntent {
  sound: SoundId
  volume: number
}

/**
 * Inspect a batch of added DOM nodes and return the sounds that should play.
 * Updates last-seen bookkeeping as a side effect on module state, but performs
 * no audio itself, so it is straightforward to test.
 */
export function processAddedNodes(
  nodes: NodeList,
  settings: Settings,
  channelId: string | null,
  now: number = Date.now(),
): PlayIntent[] {
  const intents: PlayIntent[] = []
  if (!channelId) return intents
  const cfg = settings.soundAlerts.channels[channelId]
  const enabled = cfg?.enabled === true
  if (!enabled) return intents

  for (const node of Array.from(nodes)) {
    for (const row of messageRowsIn(node)) {
      const snowflake = extractSnowflake(row)
      if (snowflake === null) continue
      const lastSeen = lastSeenId[channelId]
      const play = shouldPlay({
        armed, muted, now, quietUntil, lastPlayedAt,
        throttleMs: THROTTLE_MS,
        channelEnabled: enabled,
        snowflake, lastSeen,
        nearListEnd: isNearListEnd(row),
      })
      // Track the newest id regardless of whether we play (so throttled or
      // backgrounded messages don't retrigger later).
      if (lastSeen === undefined || snowflake > lastSeen) lastSeenId[channelId] = snowflake
      if (play) {
        lastPlayedAt = now
        intents.push({
          sound: effectiveSound(cfg, settings.soundAlerts.defaultSound),
          volume: effectiveVolume(cfg, settings.soundAlerts.defaultVolume),
        })
      }
    }
  }
  return intents
}

/** Call on load and on every channel navigation. */
export function onNavigate(settings: Settings, channelId: string | null): void {
  quietUntil = Date.now() + QUIET_MS
  if (channelId) {
    const max = maxRenderedSnowflake()
    if (max !== null && (lastSeenId[channelId] === undefined || max > lastSeenId[channelId])) {
      lastSeenId[channelId] = max
    }
  }
  syncHeaderButton(isChannelEnabled(settings, channelId))
}

// ---- arming / mute ----

export function getSoundState(): { armed: boolean; muted: boolean } {
  return { armed, muted }
}

/** Unlock audio for the tab. Must be driven by a page user gesture. */
export function arm(): void {
  armed = true
  muted = false
  unlockAudio()
}

/** The header/popup control: arm on first use, then toggle tab-wide mute. */
export function toggleArmMute(): { armed: boolean; muted: boolean } {
  if (!armed) arm()
  else muted = !muted
  const el = document.getElementById(BTN_ID)
  if (el) renderButton(el as HTMLButtonElement)
  return getSoundState()
}

// ---- header button injection ----

const BTN_ID = 'dh-sound-unlock'

const ICONS = {
  locked: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  armed: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  muted: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>',
}

function renderButton(btn: HTMLButtonElement): void {
  const state = !armed ? 'locked' : muted ? 'muted' : 'armed'
  const label = state === 'locked' ? 'Unlock Sound' : state === 'armed' ? 'Sound On' : 'Muted'
  const color = state === 'locked' ? '#f0b232' : state === 'armed' ? '#6ee79a' : '#949ba4'
  btn.innerHTML = `${ICONS[state]}<span style="margin-left:6px">${label}</span>`
  btn.style.color = color
  btn.style.borderColor = state === 'armed' ? '#3ba55d' : state === 'locked' ? '#f0b232' : '#4e5058'
  btn.title = state === 'locked'
    ? 'Unlock alert sounds for this tab'
    : state === 'armed' ? 'Alerts on — click to mute this tab' : 'Muted — click to unmute this tab'
  btn.setAttribute('aria-label', btn.title)
}

/**
 * The search bar in the channel header toolbar - our button sits just to its
 * left. The toolbar (div[class*="toolbar__"]) holds the header icon buttons and
 * the search box (div[class*="search__"]); we pick the toolbar that actually
 * contains a search box rather than assuming a fixed ancestor.
 */
function findSearchBar(): Element | null {
  for (const toolbar of Array.from(document.querySelectorAll('div[class*="toolbar__"]'))) {
    const search = toolbar.querySelector('div[class*="search__"]')
    if (search) return search
  }
  return null
}

/**
 * Ensure the in-header Unlock/Mute button reflects the current channel's
 * enabled state. Removes it when the channel has no alerts; (re)injects it
 * otherwise. Called on every navigation because Discord rebuilds the header.
 */
export function syncHeaderButton(channelEnabled: boolean): void {
  const existing = document.getElementById(BTN_ID) as HTMLButtonElement | null
  if (!channelEnabled) {
    existing?.remove()
    return
  }
  // Already present: leave it be. Arm/mute state changes re-render it directly
  // (toggleArmMute), and the tab-wide arm state does not change on navigation.
  if (existing && existing.isConnected) return
  const search = findSearchBar()
  if (!search || !search.parentElement) return
  const btn = document.createElement('button')
  btn.id = BTN_ID
  btn.type = 'button'
  btn.style.cssText =
    'display:inline-flex;align-items:center;height:26px;padding:0 10px;margin:0 8px;' +
    'font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;' +
    'background:transparent;border:1px solid #4e5058;border-radius:4px;'
  btn.addEventListener('click', () => { toggleArmMute() })
  renderButton(btn)
  // Insert immediately before the search bar so the button sits to its left.
  search.parentElement.insertBefore(btn, search)
}
