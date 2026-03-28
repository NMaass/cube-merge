import { useState } from 'react'
import { Button } from '../ui/Button'
import { AutocompleteTextarea } from '../ui/AutocompleteTextarea'
import { ReviewerNameBadge } from '../ui/ReviewerNameBadge'
import { CommentResolution } from '../../types/firestore'

interface CommentComposerProps {
  onSubmit: (body: string, resolution: CommentResolution) => void
  diffCards?: string[]
  reviewerNames?: string[]
}

export function CommentComposer({ onSubmit, diffCards = [], reviewerNames = [] }: CommentComposerProps) {
  const [body, setBody] = useState('')

  function handleSubmit() {
    if (!body.trim()) return
    onSubmit(body, 'none')
    setBody('')
  }

  return (
    <div className="pt-2 space-y-2">
      <AutocompleteTextarea
        value={body}
        onChange={setBody}
        placeholder="Add a comment… / for cards, @ for names"
        diffCards={diffCards}
        reviewerNames={reviewerNames}
        rows={2}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            handleSubmit()
          }
        }}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={!body.trim()}>
          Post
        </Button>
        <ReviewerNameBadge className="ml-auto" />
      </div>
    </div>
  )
}
