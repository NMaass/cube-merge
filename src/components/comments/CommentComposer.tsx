import { useId, useState } from 'react'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { SuggestionMenu } from '../ui/SuggestionMenu'
import { ReviewerNameBadge } from '../ui/ReviewerNameBadge'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { CommentResolution } from '../../types/firestore'

interface CommentComposerProps {
  onSubmit: (body: string, resolution: CommentResolution) => void
  diffCards?: string[]
  reviewerNames?: string[]
}

export function CommentComposer({ onSubmit, diffCards = [], reviewerNames = [] }: CommentComposerProps) {
  const [body, setBody] = useState('')
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
        <ReviewerNameBadge className="ml-auto" />
      </div>
    </div>
  )
}
