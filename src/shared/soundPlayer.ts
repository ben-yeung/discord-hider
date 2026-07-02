import type { SoundId } from './types'

// Shared Web Audio playback with a loudness limiter, used by both the content
// script (live alerts) and the popup (sound previews) so what you preview is
// exactly what you'll hear. See ADR-11 in the sound-alerts design spec.

const VOLUME_CEILING = 0.7 // hard cap below unity, leaves the limiter headroom

let audioCtx: AudioContext | null = null
let limiter: DynamicsCompressorNode | null = null
const buffers: Partial<Record<SoundId, AudioBuffer>> = {}

function ensureCtx(): AudioContext | null {
  const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
    .AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!audioCtx) {
    audioCtx = new AC()
    limiter = audioCtx.createDynamicsCompressor()
    // Brickwall-ish limiter: bound peak output regardless of source loudness.
    limiter.threshold.value = -3
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.003
    limiter.release.value = 0.1
    limiter.connect(audioCtx.destination)
  }
  return audioCtx
}

/** Resume the shared AudioContext. Must be driven by a user gesture. */
export function unlockAudio(): void {
  const ctx = ensureCtx()
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { /* gesture required */ })
}

async function loadBuffer(ctx: AudioContext, sound: SoundId): Promise<AudioBuffer | null> {
  const cached = buffers[sound]
  if (cached) return cached
  try {
    const url = chrome.runtime.getURL(`assets/sounds/${sound}.mp3`)
    const resp = await fetch(url)
    const arr = await resp.arrayBuffer()
    const buf = await ctx.decodeAudioData(arr)
    buffers[sound] = buf
    return buf
  } catch {
    return null
  }
}

/** Play a sound at the given 0..1 volume through the limiter graph. */
export async function playSound(sound: SoundId, volume: number): Promise<void> {
  const ctx = ensureCtx()
  if (!ctx || !limiter) return
  if (ctx.state === 'suspended') {
    try { await ctx.resume() } catch { /* gesture required; ignore */ }
  }
  const buf = await loadBuffer(ctx, sound)
  if (!buf) return
  const src = ctx.createBufferSource()
  src.buffer = buf
  const gain = ctx.createGain()
  gain.gain.value = Math.max(0, Math.min(1, volume)) * VOLUME_CEILING
  src.connect(gain).connect(limiter)
  src.start()
}
