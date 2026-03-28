import { useState } from 'react'
import { Comment, CommentResolution } from '../../types/firestore'
import { useAuth } from '../../context/AuthContext'
import { AutocompleteTextarea } from '../ui/AutocompleteTextarea'
import { RichText } from '../ui/RichText'

interface CommentItemProps {
  comment: Comment
  onSetResolution?: (resolution: CommentResolution) => void
  onEdit?: (newBody: string) => void
  diffCards?: string[]
  reviewerNames?: string[]
  cardColors?: Record<string, string>
}

export function CommentItem({ comment, onSetResolution, onEdit, diffCards = [], reviewerNames = [], cardColors }: CommentItemProps) {
  const { identity } = useAuth()
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState('')

  const date = comment.createdAt?.toDate?.()?.toLocaleDateString() || ''
  const isResolved = comment.resolution === 'resolved'
  const canEdit = !!onEdit && comment.authorId === identity.id

  function startEdit() {
    setEditBody(comment.body)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setEditBody('')
  }

  function saveEdit() {
    const trimmed = editBody.trim()
    if (!trimmed || trimmed === comment.body) { cancelEdit(); return }
    onEdit!(trimmed)
    setEditing(false)
    setEditBody('')
  }

  return (
    <div className={`flex gap-3 py-2.5 border-b border-slate-700/50 last:border-0 ${isResolved ? 'opacity-50' : ''}`}>
      {comment.authorPhotoURL ? (
        <img src={comment.authorPhotoURL} alt={comment.authorName ?? ''} loading="lazy" className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
          {comment.authorName?.[0] || '?'}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-slate-200">{comment.authorName}</span>
          <span className="text-xs text-slate-500">
            {date}
            {comment.updatedAt && <span className="ml-1 text-slate-600">(edited)</span>}
          </span>
          {isResolved && (
            <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">resolved</span>
          )}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {canEdit && !editing && (
              <button
                onClick={startEdit}
                className="touch-target p-2 -m-0.5 text-slate-600 hover:text-slate-400 transition-colors rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                aria-label="Edit comment"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
            {onSetResolution && !editing && (
              <button
                onClick={() => onSetResolution(isResolved ? 'none' : 'resolved')}
                className="touch-target p-2 -m-0.5 text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded"
                aria-label={isResolved ? 'Unresolve comment' : 'Mark comment as resolved'}
              >
                {isResolved ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                )}
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-2">
            <AutocompleteTextarea
              value={editBody}
              onChange={setEditBody}
              autoFocus
              diffCards={diffCards}
              reviewerNames={reviewerNames}
              rows={3}
              onKeyDown={e => {
                if (e.key === 'Escape') cancelEdit()
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit() }
              }}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={saveEdit}
                disabled={!editBody.trim() || editBody.trim() === comment.body}
                className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 rounded-lg transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-500"
              >
                Cancel
              </button>
              <span className="text-xs text-slate-600 ml-auto">Ctrl+Enter to save</span>
            </div>
          </div>
        ) : (
          <RichText body={comment.body} cardColors={cardColors} />
        )}
      </div>
    </div>
  )
}
