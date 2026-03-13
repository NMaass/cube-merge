import { useEffect, useRef, useState } from 'react'

export type SuggestionKind = 'card' | 'reviewer'
export interface Suggestion { kind: SuggestionKind; value: string }

interface UseAutocompleteOptions {
  diffCards?: string[]
  reviewerNames?: string[]
}

export function useAutocomplete({ diffCards = [], reviewerNames = [] }: UseAutocompleteOptions) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [triggerStart, setTriggerStart] = useState(-1)
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (suggestions.length > 0 && textareaRef.current) {
      const rect = textareaRef.current.getBoundingClientRect()
      setAnchor({ top: rect.top, left: rect.left, width: rect.width })
    } else {
      setAnchor(null)
    }
  }, [suggestions.length])

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
      let items: Suggestion[] = []
      if (trigger.kind === 'card' && diffCards.length > 0) {
        items = diffCards
          .filter(c => !q || c.toLowerCase().includes(q))
          .slice(0, 8)
          .map(c => ({ kind: 'card' as const, value: c }))
      } else if (trigger.kind === 'reviewer' && reviewerNames.length > 0) {
        items = reviewerNames
          .filter(n => !q || n.toLowerCase().includes(q))
          .slice(0, 6)
          .map(n => ({ kind: 'reviewer' as const, value: n }))
      }
      setSuggestions(items)
      setTriggerStart(trigger.start)
    } else {
      setSuggestions([])
      setTriggerStart(-1)
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
    setTimeout(() => {
      el.focus()
      const newPos = triggerStart + insert.length + 1
      el.setSelectionRange(newPos, newPos)
    }, 0)
  }

  function dismiss() {
    setSuggestions([])
    setTriggerStart(-1)
  }

  return { textareaRef, suggestions, anchor, onTextareaChange, applySuggestion, dismiss }
}
