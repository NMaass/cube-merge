import { useId, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { SuggestionMenu } from '../ui/SuggestionMenu'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { CommentResolution } from '../../types/firestore'

interface CommentComposerProps {
  onSubmit: (body: string, resolution: CommentResolution) => void
  diffCards?: string[]
  reviewerNames?: string[]
}

export function CommentComposer({ onSubmit, diffCards = [], reviewerNames = [] }: CommentComposerProps) {
  const { identity, setName } = useAuth()
  const [body, setBody] = useState('')
  const [editingAuthor, setEditingAuthor] = useState(false)
  const [authorInput, setAuthorInput] = useState('')
  const instructionsId = useId()

  const { textareaRef, suggestions, anchor, onTextareaChange, applySuggestion, dismiss } =
    useAutocomplete({ diffCards, reviewerNames })

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value)
    onTextareaChange(e.target.value, e.target.selectionStart ?? e.target.value.length)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape' && suggestions.length > 0) {
      dismiss()
    }
  }

  function handleSubmit() {
    if (!body.trim()) return
    onSubmit(body, 'none')
    setBody('')
    dismiss()
  }

  return (
    <div className="pt-2 space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder="Add a comment… / for cards, @ for names"
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
        <SuggestionMenu
          suggestions={suggestions}
          anchor={anchor}
          onSelect={s => applySuggestion(s, body, setBody)}
        />
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
              className="h-8 w-28 bg-slate-700 border border-slate-600 rounded px-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={!authorInput.trim()}
              className="px-2 py-1 text-xs text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
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
            className="text-xs text-slate-400 ml-auto hover:text-slate-200 transition-colors rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
            aria-label={`Posting as ${identity.displayName} — click to change name`}
          >
            as <strong className="text-slate-200 font-semibold">{identity.displayName}</strong>
          </button>
        )}
      </div>
    </div>
  )
}
