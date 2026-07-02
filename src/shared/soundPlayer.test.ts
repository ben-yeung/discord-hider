import { describe, it, expect } from 'vitest'
import { playSound, unlockAudio } from './soundPlayer'

// happy-dom has no AudioContext, so the player must degrade gracefully rather
// than throw. (Real playback is exercised in the browser.)
describe('soundPlayer', () => {
  it('unlockAudio does not throw without Web Audio support', () => {
    expect(() => unlockAudio()).not.toThrow()
  })

  it('playSound resolves without throwing when Web Audio is unavailable', async () => {
    await expect(playSound('ding', 0.5)).resolves.toBeUndefined()
  })
})
