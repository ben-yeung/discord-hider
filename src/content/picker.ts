import { setElementSelector } from '../shared/storage'
import type { ElementKey } from '../shared/types'

const HIGHLIGHT = '2px solid #5865f2'

export function generateSelector(el: Element): string {
  const role = el.getAttribute('role')
  const ariaLabel = el.getAttribute('aria-label')
  if (role && ariaLabel) return `[role="${role}"][aria-label="${ariaLabel}"]`
  if (ariaLabel) return `[aria-label="${ariaLabel}"]`
  if (el.id) return `#${CSS.escape(el.id)}`
  return el.tagName.toLowerCase()
}

export function startPicker(key: ElementKey, onDone: () => void): void {
  let hovered: HTMLElement | null = null

  function cleanup(): void {
    document.removeEventListener('mouseover', onMouseOver, true)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('keydown', onKeyDown, true)
    if (hovered) hovered.style.outline = ''
  }

  function onMouseOver(e: MouseEvent): void {
    if (hovered) hovered.style.outline = ''
    hovered = e.target as HTMLElement
    hovered.style.outline = HIGHLIGHT
    e.stopPropagation()
  }

  function onClick(e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const selector = generateSelector(e.target as Element)
    cleanup()
    setElementSelector(key, selector).then(onDone).catch(() => onDone())
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') { cleanup(); onDone() }
  }

  document.addEventListener('mouseover', onMouseOver, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
}
