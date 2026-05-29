import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSelector, startPicker } from './picker'

describe('generateSelector', () => {
  it('uses role + aria-label when both present', () => {
    const el = document.createElement('nav')
    el.setAttribute('role', 'navigation')
    el.setAttribute('aria-label', 'Servers sidebar')
    expect(generateSelector(el)).toBe('[role="navigation"][aria-label="Servers sidebar"]')
  })

  it('uses aria-label alone when no role', () => {
    const el = document.createElement('div')
    el.setAttribute('aria-label', 'Channel list')
    expect(generateSelector(el)).toBe('[aria-label="Channel list"]')
  })

  it('uses id when no aria attributes', () => {
    const el = document.createElement('div')
    el.id = 'my-element'
    expect(generateSelector(el)).toBe('#my-element')
  })

  it('falls back to tagName when no stable attributes', () => {
    const el = document.createElement('section')
    expect(generateSelector(el)).toBe('section')
  })
})

describe('startPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let stored: Record<string, unknown> = {}
    vi.mocked(chrome.storage.sync.get).mockImplementation((_, cb) => {
      cb?.({ settings: stored.settings })
      return Promise.resolve({ settings: stored.settings })
    })
    vi.mocked(chrome.storage.sync.set).mockImplementation((items, cb) => {
      Object.assign(stored, items)
      cb?.()
      return Promise.resolve()
    })
  })

  it('highlights hovered element with purple outline', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    startPicker('chatBar', vi.fn())
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(el.style.outline).toBe('#5865f2 solid 2px')
    // cleanup listeners so they don't bleed into the next test
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.body.removeChild(el)
  })

  it('removes highlight from previous element on new hover', () => {
    const a = document.createElement('div')
    const b = document.createElement('div')
    document.body.appendChild(a)
    document.body.appendChild(b)
    startPicker('chatBar', vi.fn())
    a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(a.style.outline).toBe('')
    expect(b.style.outline).toBe('#5865f2 solid 2px')
    // cleanup listeners
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.body.removeChild(a)
    document.body.removeChild(b)
  })

  it('saves selector and calls onDone on click', async () => {
    const el = document.createElement('div')
    el.setAttribute('aria-label', 'Chat area')
    document.body.appendChild(el)
    const onDone = vi.fn()
    startPicker('chatBar', onDone)
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(chrome.storage.sync.set).toHaveBeenCalled()
    document.body.removeChild(el)
  })

  it('calls onDone on Escape without saving', () => {
    const onDone = vi.fn()
    startPicker('chatBar', onDone)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onDone).toHaveBeenCalled()
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()
  })

  it('cleans up outline on Escape', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    startPicker('chatBar', vi.fn())
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(el.style.outline).toBe('')
    document.body.removeChild(el)
  })
})
