import { describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_SETTINGS } from '../shared/storage'
import type { Settings } from '../shared/types'
import {
  extractSnowflake,
  isNearListEnd,
  effectiveSound,
  effectiveVolume,
  isChannelEnabled,
  shouldPlay,
  processAddedNodes,
  arm,
  toggleArmMute,
  getSoundState,
  syncHeaderButton,
  __resetSoundState,
} from './soundAlerts'

const CID = '555'

function settingsWith(enabled: boolean, extra: Partial<{ sound: 'ding' | 'anime' | 'meet' | 'quack'; volume: number }> = {}): Settings {
  const s = structuredClone(DEFAULT_SETTINGS)
  s.soundAlerts.channels[CID] = { enabled, ...extra }
  return s
}

/** Realistic 18-digit, time-ordered snowflake id from a small ordinal. */
function sf(n: number): string {
  return String(100000000000000000n + BigInt(n))
}

function messageRow(n: number): HTMLLIElement {
  const li = document.createElement('li')
  li.id = `chat-messages-100-${sf(n)}`
  return li
}

/** Build an <ol> of message rows in the DOM and return [ol, rows]. */
function buildList(ns: number[]): { ol: HTMLOListElement; rows: HTMLLIElement[] } {
  const ol = document.createElement('ol')
  const rows = ns.map(n => {
    const li = messageRow(n)
    ol.appendChild(li)
    return li
  })
  document.body.appendChild(ol)
  return { ol, rows }
}

function nodeList(nodes: Node[]): NodeList {
  return nodes as unknown as NodeList
}

describe('soundAlerts pure helpers', () => {
  it('extractSnowflake reads the message id from a row id', () => {
    const li = document.createElement('li')
    li.id = 'chat-messages-123456789012345678-987654321098765432'
    expect(extractSnowflake(li)).toBe(987654321098765432n)
  })

  it('extractSnowflake returns null when there is no snowflake', () => {
    const li = document.createElement('li')
    li.id = 'not-a-message'
    expect(extractSnowflake(li)).toBeNull()
  })

  it('isNearListEnd distinguishes appended-at-bottom from prepended backscroll', () => {
    const { rows } = buildList([1, 2, 3, 4, 5])
    expect(isNearListEnd(rows[4])).toBe(true)   // last
    expect(isNearListEnd(rows[3])).toBe(true)   // within last 3
    expect(isNearListEnd(rows[0])).toBe(false)  // top (backscroll)
  })

  it('effectiveSound / effectiveVolume fall back to the global defaults', () => {
    expect(effectiveSound(undefined, 'ding')).toBe('ding')
    expect(effectiveSound({ enabled: true, sound: 'quack' }, 'ding')).toBe('quack')
    expect(effectiveVolume(undefined, 0.5)).toBe(0.5)
    expect(effectiveVolume({ enabled: true, volume: 0.2 }, 0.5)).toBe(0.2)
  })

  it('isChannelEnabled reflects the per-channel flag', () => {
    expect(isChannelEnabled(settingsWith(true), CID)).toBe(true)
    expect(isChannelEnabled(settingsWith(false), CID)).toBe(false)
    expect(isChannelEnabled(settingsWith(true), null)).toBe(false)
  })

  it('shouldPlay requires every gate to pass', () => {
    const base = {
      armed: true, muted: false, now: 10_000, quietUntil: 0, lastPlayedAt: 0,
      throttleMs: 1200, channelEnabled: true, snowflake: 100n,
      lastSeen: undefined as bigint | undefined, nearListEnd: true,
    }
    expect(shouldPlay(base)).toBe(true)
    expect(shouldPlay({ ...base, armed: false })).toBe(false)
    expect(shouldPlay({ ...base, muted: true })).toBe(false)
    expect(shouldPlay({ ...base, channelEnabled: false })).toBe(false)
    expect(shouldPlay({ ...base, now: 100, quietUntil: 1000 })).toBe(false) // quiet window
    expect(shouldPlay({ ...base, nearListEnd: false })).toBe(false)         // backscroll
    expect(shouldPlay({ ...base, snowflake: null })).toBe(false)
    expect(shouldPlay({ ...base, lastSeen: 100n })).toBe(false)             // not strictly newer
    expect(shouldPlay({ ...base, lastSeen: 99n })).toBe(true)               // newer
    expect(shouldPlay({ ...base, now: 500, lastPlayedAt: 0, throttleMs: 1200 })).toBe(false) // throttled
  })
})

describe('processAddedNodes', () => {
  beforeEach(() => {
    __resetSoundState()
    document.body.innerHTML = ''
  })

  it('returns no intent when the tab is not armed', () => {
    const { rows } = buildList([100, 200])
    const intents = processAddedNodes(nodeList([rows[1]]), settingsWith(true), CID, 10_000)
    expect(intents).toEqual([])
  })

  it('plays for a new bottom-anchored message once armed', () => {
    arm()
    const { rows } = buildList([100, 200, 300])
    const intents = processAddedNodes(nodeList([rows[2]]), settingsWith(true), CID, 10_000)
    expect(intents).toHaveLength(1)
    expect(intents[0]).toEqual({ sound: 'ding', volume: 0.5 })
  })

  it('uses the per-channel sound and volume when set', () => {
    arm()
    const { rows } = buildList([100, 200])
    const intents = processAddedNodes(nodeList([rows[1]]), settingsWith(true, { sound: 'quack', volume: 0.9 }), CID, 10_000)
    expect(intents[0]).toEqual({ sound: 'quack', volume: 0.9 })
  })

  it('ignores backscroll (older id at the top of the list)', () => {
    arm()
    // seed last-seen by playing a newer bottom message first
    const { ol, rows } = buildList([500, 600])
    processAddedNodes(nodeList([rows[1]]), settingsWith(true), CID, 10_000)
    // now an older message is prepended at the top
    const old = messageRow(100)
    ol.insertBefore(old, ol.firstChild)
    const intents = processAddedNodes(nodeList([old]), settingsWith(true), CID, 20_000)
    expect(intents).toEqual([])
  })

  it('does not play for a disabled channel', () => {
    arm()
    const { rows } = buildList([100, 200])
    const intents = processAddedNodes(nodeList([rows[1]]), settingsWith(false), CID, 10_000)
    expect(intents).toEqual([])
  })

  it('coalesces a burst to a single sound within the throttle window', () => {
    arm()
    const { ol } = buildList([100])
    const a = messageRow(200); ol.appendChild(a)
    const b = messageRow(300); ol.appendChild(b)
    // same timestamp -> second is throttled
    const intents = processAddedNodes(nodeList([a, b]), settingsWith(true), CID, 10_000)
    expect(intents).toHaveLength(1)
  })
})

describe('arm / mute state machine', () => {
  beforeEach(() => { __resetSoundState(); document.body.innerHTML = '' })

  it('toggleArmMute arms first, then toggles mute tab-wide', () => {
    expect(getSoundState()).toEqual({ armed: false, muted: false })
    expect(toggleArmMute()).toEqual({ armed: true, muted: false })  // first click arms
    expect(toggleArmMute()).toEqual({ armed: true, muted: true })   // then mutes
    expect(toggleArmMute()).toEqual({ armed: true, muted: false })  // unmutes
  })
})

describe('syncHeaderButton', () => {
  beforeEach(() => { __resetSoundState(); document.body.innerHTML = '' })

  function buildHeader(): void {
    const chrome = document.createElement('div')
    chrome.setAttribute('data-window-chrome', 'true')
    const toolbar = document.createElement('div')
    toolbar.className = 'toolbar__abc'
    chrome.appendChild(toolbar)
    document.body.appendChild(chrome)
  }

  it('injects the button once when the channel is enabled', () => {
    buildHeader()
    syncHeaderButton(true)
    syncHeaderButton(true) // idempotent
    expect(document.querySelectorAll('#dh-sound-unlock')).toHaveLength(1)
  })

  it('removes the button when the channel is disabled', () => {
    buildHeader()
    syncHeaderButton(true)
    syncHeaderButton(false)
    expect(document.getElementById('dh-sound-unlock')).toBeNull()
  })

  it('does nothing when there is no header anchor', () => {
    syncHeaderButton(true)
    expect(document.getElementById('dh-sound-unlock')).toBeNull()
  })
})
