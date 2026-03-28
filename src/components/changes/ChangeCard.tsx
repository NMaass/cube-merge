import { useState } from 'react'
import { Change, Comment, CommentResolution } from '../../types/firestore'
import { computeChangeType } from '../../lib/changes'
import { CardInOutDisplay } from './CardInOutDisplay'
import { CommentThread } from './CommentThread'
import { RichText } from '../ui/RichText'

interface ChangeCardProps {
  change: Change & { comments: Comment[] }
  onAddComment?: (body: string, resolution: CommentResolution) => void
  onSetCommentResolution?: (commentId: string, resolution: CommentResolution) => void
  onEditComment?: (commentId: string, newBody: string) => void
  onEdit?: () => void
  onApprove?: () => void
  isApproved?: boolean
  diffCards?: string[]
  reviewerNames?: string[]
  /** Used for card search scroll-to highlighting */
  highlighted?: boolean
}

export function ChangeCard({ change, onAddComment, onSetCommentResolution, onEditComment, onEdit, onApprove, isApproved, diffCards, reviewerNames, highlighted }: ChangeCardProps) {
  const [expanded, setExpanded] = useState(false)
  const date = change.createdAt?.toDate?.()?.toLocaleDateString() || ''
  const commentCount = change.comments.length
  const displayType = computeChangeType(change.cardsOut, change.cardsIn, change.type)

  // Map card names to colors for [[card]] mentions in comments
  const cardColors: Record<string, string> = {}
  const outColor = displayType === 'keep' ? 'text-teal-400' : 'text-red-400'
  const inColor = displayType === 'reject' ? 'text-orange-400' : 'text-green-400'
  for (const c of change.cardsOut) cardColors[c.name] = outColor
  for (const c of change.cardsIn) cardColors[c.name] = inColor

  // Colored left border by change type
  const borderColors: Record<string, string> = {
    swap: 'border-l-amber-500',
    add: 'border-l-green-500',
    remove: 'border-l-red-500',
    keep: 'border-l-teal-500',
    reject: 'border-l-orange-500',
  }
  const borderAccent = `border-l-2 ${borderColors[displayType] ?? ''}`

  return (
    <div
      className={`bg-slate-800 border border-slate-700 rounded-xl p-4 ${borderAccent} ${highlighted ? 'ring-2 ring-amber-500/60' : ''} transition-shadow`}
      id={`change-${change.id}`}
      data-change-id={change.id}
    >
      {/* Header row: avatar + author + type badge + date + actions */}
      <div className="flex items-center gap-2 mb-3 min-w-0">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
            {change.authorName?.[0] || '?'}
          </div>
          <span className="text-sm font-medium text-slate-300 truncate">{change.authorName}</span>
          {change.unresolved && (
            <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" title="Unresolved" />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500">{date}</span>
          {onApprove && (
            <button
              onClick={onApprove}
              className={`touch-target inline-flex items-center justify-center gap-1.5 h-8 w-8 sm:w-auto sm:px-2.5 rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400/50 active:scale-[0.97] text-xs font-medium ${
                isApproved
                  ? 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30'
                  : 'bg-slate-700/40 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-green-400 hover:border-green-500/40'
              }`}
              aria-label={isApproved ? 'Unapprove change' : 'Approve change'}
              title={isApproved ? 'Unapprove' : 'Approve'}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="hidden sm:inline">{isApproved ? 'Approved' : 'Approve'}</span>
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="touch-target inline-flex items-center justify-center gap-1.5 h-8 w-8 sm:w-auto sm:px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/60 hover:text-amber-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 active:scale-[0.97] text-xs font-medium"
              aria-label="Edit change"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Card names — primary content */}
      <div className="pl-1">
        <CardInOutDisplay cardsIn={change.cardsIn} cardsOut={change.cardsOut} type={change.type} />
      </div>

      {/* Initial comment — plain note under the cards */}
      {change.initialComment && (
        <div className="mt-2.5 pl-1">
          <RichText body={change.initialComment} className="text-sm text-slate-400 leading-snug whitespace-pre-wrap" cardColors={cardColors} />
        </div>
      )}

      {/* Footer: compact chip on desktop, larger comment action on mobile */}
      <div className="mt-3 pl-1">
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="touch-target inline-flex w-full md:w-auto items-center justify-center md:justify-start gap-1.5 min-h-11 px-3 md:px-2.5 py-2 md:py-1 rounded-lg md:rounded-full bg-slate-700/60 hover:bg-slate-700 border border-slate-600/60 hover:border-slate-500 text-sm md:text-xs text-slate-300 md:text-slate-400 hover:text-slate-100 md:hover:text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <svg className="w-4 h-4 md:w-3 md:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="md:hidden">
            {commentCount > 0 ? `Comments (${commentCount})` : 'Add comment'}
          </span>
          <span className="hidden md:inline">
            {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}` : 'Add comment'}
          </span>
          <svg className={`w-4 h-4 md:w-3 md:h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {expanded && (
        <CommentThread
          comments={change.comments}
          onAddComment={onAddComment}
          onSetResolution={onSetCommentResolution}
          onEditComment={onEditComment}
          diffCards={diffCards}
          reviewerNames={reviewerNames}
          cardColors={cardColors}
        />
      )}
    </div>
  )
}
