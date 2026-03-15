import { useEffect, useRef, useState } from 'react'

export type SuggestionKind = 'card' | 'reviewer'
export interface Suggestion { kind: SuggestionKind; value: string }

export type CaretAnchor = { top: number; left: number; lineHeight: number }

interface UseAutocompleteOptions {
  diffCards?: string[]
  reviewerNames?: string[]
}

const CSS_PROPS_TO_COPY = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
  'lineHeight', 'textIndent', 'wordSpacing',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
] as const

// Singleton mirror kept in the DOM permanently to avoid repeated append/remove reflows.
let sharedMirror: HTMLDivElement | null = null
let sharedMarker: HTMLSpanElement | null = null
let mirrorStyledFor: HTMLTextAreaElement | null = null

function getMirror(el: HTMLTextAreaElement): { mirror: HTMLDivElement; marker: HTMLSpanElement } {
  if (!sharedMirror) {
    sharedMirror = document.createElement('div')
    sharedMirror.setAttribute('aria-hidden', 'true')
    sharedMirror.style.cssText = 'position:absolute;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;white-space:pre-wrap;word-wrap:break-word;box-sizing:border-box;overflow:hidden;'
    sharedMarker = document.createElement('span')
    sharedMarker.textContent = '\u200b'
    document.body.appendChild(sharedMirror)
  }

  // Re-apply computed styles only when the source element changes or its width shifts.
  if (mirrorStyledFor !== el || sharedMirror.style.width !== el.offsetWidth + 'px') {
    const style = window.getComputedStyle(el)
    for (const prop of CSS_PROPS_TO_COPY) {
      const kebab = prop.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)
      sharedMirror.style.setProperty(kebab, style.getPropertyValue(kebab))
    }
    sharedMirror.style.width = el.offsetWidth + 'px'
    mirrorStyledFor = el
  }

  return { mirror: sharedMirror, marker: sharedMarker! }
}

function getCaretCoords(el: HTMLTextAreaElement, pos: number): CaretAnchor {
  const { mirror, marker } = getMirror(el)
  // Set text up to trigger position, then append the zero-width marker.
  mirror.textContent = el.value.slice(0, pos)
  mirror.appendChild(marker)

  const elRect = el.getBoundingClientRect()
  const markerTop = marker.offsetTop
  const markerLeft = marker.offsetLeft
  const markerHeight = marker.offsetHeight

  return {
    top: elRect.top - el.scrollTop + markerTop,
    left: elRect.left + markerLeft,
    lineHeight: markerHeight,
  }
}

export function useAutocomplete({ diffCards = [], reviewerNames = [] }: UseAutocompleteOptions) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [triggerStart, setTriggerStart] = useState(-1)
  const [anchor, setAnchor] = useState<CaretAnchor | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scryfallTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (scryfallTimer.current !== null) clearTimeout(scryfallTimer.current)
    }
  }, [])

  function findTrigger(text: string, pos: number): { kind: SuggestionKind; query: string; start: number } | null {
    let i = pos - 1
    while (i >= 0 && text[i] !== '\n') {
      if (text[i] === '/') return { kind: 'card', query: text.slice(i + 1, pos), start: i }
      if (text[i] === '@') return { kind: 'reviewer', query: text.slice(i + 1, pos), start: i }
      i--
    }
    return null
  }

  function onTextareaChange(value: string, cursor: number) {
    const trigger = findTrigger(value, cursor)
    if (trigger) {
      const q = trigger.query.toLowerCase()

      // Compute caret anchor synchronously
      if (textareaRef.current) {
        setAnchor(getCaretCoords(textareaRef.current, trigger.start))
      }

      setTriggerStart(trigger.start)

      if (trigger.kind === 'reviewer') {
        const items = reviewerNames
          .filter(n => !q || n.toLowerCase().includes(q))
          .slice(0, 6)
          .map(n => ({ kind: 'reviewer' as const, value: n }))
        setSuggestions(items)
        return
      }

      // Card search: local diff cards first
      const localMatches = diffCards
        .filter(c => !q || c.toLowerCase().includes(q))
        .slice(0, 8)
        .map(c => ({ kind: 'card' as const, value: c }))
      setSuggestions(localMatches)

      // Scryfall for queries >= 2 chars
      if (scryfallTimer.current !== null) clearTimeout(scryfallTimer.current)
      if (q.length >= 2) {
        scryfallTimer.current = setTimeout(async () => {
          try {
            const res = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}`)
            if (!res.ok) return
            const json = await res.json() as { data: string[] }
            const localSet = new Set(localMatches.map(s => s.value.toLowerCase()))
            const extra = json.data
              .filter(name => !localSet.has(name.toLowerCase()))
              .map(name => ({ kind: 'card' as const, value: name }))
            const merged = [...localMatches, ...extra].slice(0, 8)
            setSuggestions(merged)
          } catch {
            // silently ignore
          }
        }, 300)
      }
    } else {
      if (scryfallTimer.current !== null) clearTimeout(scryfallTimer.current)
      setSuggestions([])
      setTriggerStart(-1)
      setAnchor(null)
    }
  }

  function applySuggestion(s: Suggestion, body: string, onChange: (newBody: string) => void) {
    const el = textareaRef.current
    if (!el) return
    const cursor = el.selectionStart
    const insert = s.kind === 'card' ? `[[${s.value}]]` : `@${s.value}`
    const before = body.slice(0, triggerStart)
    const after = body.slice(cursor)
    const newBody = before + insert + ' ' + after
    onChange(newBody)
    setSuggestions([])
    setTriggerStart(-1)
    setAnchor(null)
    if (scryfallTimer.current !== null) clearTimeout(scryfallTimer.current)
    setTimeout(() => {
      el.focus()
      const newPos = triggerStart + insert.length + 1
      el.setSelectionRange(newPos, newPos)
    }, 0)
  }

  function dismiss() {
    if (scryfallTimer.current !== null) clearTimeout(scryfallTimer.current)
    setSuggestions([])
    setTriggerStart(-1)
    setAnchor(null)
  }

  return { textareaRef, suggestions, anchor, onTextareaChange, applySuggestion, dismiss }
}
