import type { Settings, Keyword } from '../shared/types'

const STYLE_ID = 'discord-hider-keywords'

function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function buildKeywordCSS(keywords: Keyword[], style: 'background' | 'chip'): string {
  return keywords
    .filter(k => k.enabled)
    .map(k => {
      if (style === 'background') {
        const textColor = hexLuminance(k.color) > 0.5 ? '#1a1a1a' : '#fff'
        return `.dh-kw-${k.id} { background: ${k.color}; color: ${textColor}; border-radius: 2px; padding: 0 2px; }`
      }
      return `.dh-kw-${k.id} { background: ${k.color}30; color: ${k.color}; border: 1px solid ${k.color}70; border-radius: 3px; padding: 0 3px; }`
    })
    .join('\n')
}

export function computeEffectiveKeywords(settings: Settings, channelId: string | null): Keyword[] {
  if (!settings.keywords.enabled) return []
  const channelCfg = channelId ? settings.keywords.channelOverrides[channelId] : undefined
  let keywords: Keyword[]
  if (channelCfg) {
    if (channelCfg.inheritGlobals) {
      const channelTexts = new Set(channelCfg.keywords.map(k => k.text.toLowerCase()))
      const globals = settings.keywords.keywords.filter(k => !channelTexts.has(k.text.toLowerCase()))
      keywords = [...globals, ...channelCfg.keywords]
    } else {
      keywords = channelCfg.keywords
    }
  } else {
    keywords = settings.keywords.keywords
  }
  return keywords.filter(k => k.enabled)
}

export function removeHighlights(): void {
  document.querySelectorAll('span[data-dh-kw]').forEach(span => {
    const parent = span.parentNode
    if (!parent) return
    while (span.firstChild) parent.insertBefore(span.firstChild, span)
    parent.removeChild(span)
    if (parent instanceof Element) parent.normalize()
  })
}

function walkTextNodes(root: Element, keywords: Keyword[]): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode()) !== null) {
    if ((node as Text).textContent?.trim()) textNodes.push(node as Text)
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? ''
    if (!text || !textNode.parentNode) continue

    type Match = { start: number; end: number; keyword: Keyword; matched: string }
    const matches: Match[] = []

    for (const kw of keywords) {
      let regex: RegExp
      try {
        regex = new RegExp(kw.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      } catch {
        continue
      }
      let m: RegExpExecArray | null
      while ((m = regex.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, keyword: kw, matched: m[0] })
      }
    }

    if (matches.length === 0) continue

    matches.sort((a, b) => a.start - b.start || b.end - a.end)
    const nonOverlapping: Match[] = []
    let lastEnd = 0
    for (const m of matches) {
      if (m.start >= lastEnd) { nonOverlapping.push(m); lastEnd = m.end }
    }

    const fragment = document.createDocumentFragment()
    let pos = 0
    for (const m of nonOverlapping) {
      if (m.start > pos) fragment.appendChild(document.createTextNode(text.slice(pos, m.start)))
      const span = document.createElement('span')
      span.setAttribute('data-dh-kw', m.keyword.id)
      span.className = `dh-kw-${m.keyword.id}`
      span.textContent = m.matched
      fragment.appendChild(span)
      pos = m.end
    }
    if (pos < text.length) fragment.appendChild(document.createTextNode(text.slice(pos)))

    textNode.parentNode.replaceChild(fragment, textNode)
  }
}

export function applyKeywords(settings: Settings, channelId: string | null): void {
  removeHighlights()
  const keywords = computeEffectiveKeywords(settings, channelId)

  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = STYLE_ID
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = buildKeywordCSS(keywords, settings.keywords.style)

  if (keywords.length === 0) return
  document.querySelectorAll('[class*="messageContent"]').forEach(el => {
    walkTextNodes(el as Element, keywords)
  })
}

export function highlightNodes(nodes: NodeList, settings: Settings, channelId: string | null): void {
  const keywords = computeEffectiveKeywords(settings, channelId)
  if (keywords.length === 0) return
  nodes.forEach(node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    if (el.matches('[class*="messageContent"]')) walkTextNodes(el, keywords)
    el.querySelectorAll('[class*="messageContent"]').forEach(mc => walkTextNodes(mc as Element, keywords))
  })
}

export function getChannelName(): string | null {
  const match = document.title.match(/^(#[^—–]+?)(?:\s+[—–]|$)/)
  return match ? match[1].trim() : null
}

export function startKeywordObserver(
  onNew: (nodes: NodeList) => void,
): MutationObserver {
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) onNew(m.addedNodes)
    }
  })
  const target = document.querySelector('[class*="scroller"]') ?? document.body
  observer.observe(target, { childList: true, subtree: true })
  return observer
}
