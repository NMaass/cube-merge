import { useId, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { CommentResolution } from '../../types/firestore'

interface CommentComposerProps {
  onSubmit: (body: string, resolution: CommentResolution) => void
  diffCards?: string[]
  reviewerNames?: string[]
}

type SuggestionKind = 'card' | 'reviewer'
interface Suggestion { kind: SuggestionKind; value: string }

export function CommentComposer({ onSubmit, diffCards = [], reviewerNames = [] }: CommentComposerProps) {
  const { identity, setName } = useAuth()
  const [body, setBody] = useState('')
  const [editingAuthor, setEditingAuthor] = useState(false)
  const [authorInput, setAuthorInput] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [triggerStart, setTriggerStart] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const instructionsId = useId()

  function findTrigger(text: string, pos: number): { kind: SuggestionKind; query: string; start: number } | null {
    // Walk back from cursor to find unbroken / or @ trigger
    let i = pos - 1
    while (i >= 0 && text[i] !== '\n') {
      if (text[i] === '/') return { kind: 'card', query: text.slice(i + 1, pos), start: i }
      if (text[i] === '@') return { kind: 'reviewer', query: text.slice(i + 1, pos), start: i }
      i--
    }
    return null
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    const cursor = e.target.selectionStart ?? value.length
    setBody(value)

    const trigger = findTrigger(value, cursor)
    if (trigger && trigger.query.length >= 0) {
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

  function selectSuggestion(s: Suggestion) {
    const el = textareaRef.current
    if (!el) return
    const cursor = el.selectionStart
    const insert = s.kind === 'card' ? `[[${s.value}]]` : `@${s.value}`
    const before = body.slice(0, triggerStart)
    const after = body.slice(cursor)
    const newBody = before + insert + ' ' + after
    setBody(newBody)
    setSuggestions([])
    setTriggerStart(-1)
    // Restore focus + place cursor after insertion
    setTimeout(() => {
      el.focus()
      const newPos = triggerStart + insert.length + 1
      el.setSelectionRange(newPos, newPos)
    }, 0)
  }

  function handleSubmit() {
    if (!body.trim()) return
    onSubmit(body, 'none')
    setBody('')
    setSuggestions([])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape' && suggestions.length > 0) {
      setSuggestions([])
    }
  }

  return (
    <div className="pt-2 space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder="Add a comment… (/ for cards, @ for names)"
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={2}
          aria-label="Comment text"
          aria-describedby={instructionsId}
        />
        <div id={instructionsId} className="sr-only">
          Type / followed by card names for autocomplete, or @ followed by reviewer names. Press Ctrl+Enter (or Cmd+Enter on Mac) to submit.
        </div>
        {suggestions.length > 0 && (
          <div role="listbox" aria-label="Suggestions" className="absolute left-0 right-0 bottom-full mb-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden z-50">
            {suggestions.map((s, i) => (
              <button
                key={i}
                role="option"
                aria-selected={false}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2 transition-colors"
                onMouseDown={e => { e.preventDefault(); selectSuggestion(s) }}
              >
                {s.kind === 'card' ? (
                  <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7l9-4 9 4M3 7v10l9 4 9-4V7" /></svg>
                ) : (
                  <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                )}
                <span className="truncate">{s.value}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={!body.trim()}>
          Post
        </Button>
        {editingAuthor ? (
          <form
            className="flex items-center gap-1 ml-auto"
            onSubmit={e => {
              e.preventDefault()
              const trimmed = authorInput.trim()
              if (trimmed) setName(trimmed)
              setEditingAuthor(false)
            }}
          >
            <input
              autoFocus
              type="text"
              value={authorInput}
              onChange={e => setAuthorInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setEditingAuthor(false) }}
              placeholder="Your name"
              aria-label="Your display name"
              className="h-8 w-28 bg-slate-700 border border-slate-600 rounded px-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!authorInput.trim()}
              className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingAuthor(false)}
              aria-label="Cancel name edit"
              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-500"
            >
              ✕
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => { setAuthorInput(identity.displayName === 'Reviewer' ? '' : identity.displayName); setEditingAuthor(true) }}
            className="text-xs text-slate-400 ml-auto hover:text-slate-200 transition-colors rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
            aria-label={`Posting as ${identity.displayName} — click to change name`}
          >
            as <strong className="text-slate-200 font-semibold">{identity.displayName}</strong>
          </button>
        )}
      </div>
    </div>
  )
}
