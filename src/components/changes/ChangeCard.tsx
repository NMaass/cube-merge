import { useState } from 'react'
import { Change, Comment, CommentResolution } from '../../types/firestore'
import { computeChangeType, isNegativePolarity } from '../../lib/changes'
import { CardInOutDisplay } from './CardInOutDisplay'
import { CommentThread } from './CommentThread'
import { RichText } from '../ui/RichText'

interface ChangeCardProps {
  change: Change & { comments: Comment[] }
  onAddComment?: (body: string, resolution: CommentResolution) => void
  onSetCommentResolution?: (commentId: string, resolution: CommentResolution) => void
  onEditComment?: (commentId: string, newBody: string) => void
  onEdit?: () => void
  isSeen?: boolean
  currentUserName?: string
  diffCards?: string[]
  reviewerNames?: string[]
  /** Used for card search scroll-to highlighting */
  highlighted?: boolean
}

export function ChangeCard({ change, onAddComment, onSetCommentResolution, onEditComment, onEdit, isSeen = true, currentUserName, diffCards, reviewerNames, highlighted }: ChangeCardProps) {
  // Auto-expand if current user is @mentioned in any comment
  const mentionedInComments = currentUserName && !/^Reviewer\d*$/.test(currentUserName) &&
    change.comments.some(cm => cm.body.toLowerCase().includes(`@${currentUserName.toLowerCase()}`))
  const [expanded, setExpanded] = useState(!!mentionedInComments)
  const date = change.createdAt?.toDate?.()?.toLocaleDateString() || ''
  const commentCount = change.comments.length
  const displayType = computeChangeType(change.cardsOut, change.cardsIn, change.type)

  // Map card names to colors for [[card]] mentions in comments
  const negative = isNegativePolarity(displayType)
  const cardColors: Record<string, string> = {}
  const outColor = negative ? 'text-teal-400' : 'text-red-400'
  const inColor = negative ? 'text-orange-400' : 'text-green-400'
  for (const c of change.cardsOut) cardColors[c.name] = outColor
  for (const c of change.cardsIn) cardColors[c.name] = inColor

  // Colored left border by change type
  const borderColors: Record<string, string> = {
    swap: 'border-l-amber-500',
    add: 'border-l-green-500',
    remove: 'border-l-red-500',
    keep: 'border-l-teal-500',
    reject: 'border-l-orange-500',
    decline: 'border-l-purple-500',
  }
  const borderAccent = `border-l-2 ${borderColors[displayType] ?? ''}`
  const unseenRing = !isSeen ? 'ring-1 ring-amber-500/30 bg-slate-800/90' : ''

  return (
    <div
      className={`bg-slate-800 border border-slate-700 rounded-lg p-3 ${borderAccent} ${unseenRing} ${highlighted ? 'ring-2 ring-amber-500/60' : ''} transition-shadow`}
      id={`change-${change.id}`}
      data-change-id={change.id}
    >
      {/* Header row: avatar + author + actions */}
      <div className="flex items-center gap-1.5 mb-2 min-w-0">
        <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
          {change.authorName?.[0] || '?'}
        </div>
        <span className="text-xs font-medium text-slate-400 truncate flex-1 min-w-0">{change.authorName}</span>
        <span className="hidden sm:inline text-[11px] text-slate-600 shrink-0">{date}</span>
        {onEdit && (
          <button
            onClick={onEdit}
            className="touch-target inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md bg-slate-700/60 border border-slate-600/50 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 active:scale-[0.97] text-xs font-medium"
            aria-label="Edit change"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Edit</span>
          </button>
        )}
      </div>

      {/* Card names — primary content */}
      <CardInOutDisplay cardsIn={change.cardsIn} cardsOut={change.cardsOut} type={change.type} />

      {/* Initial comment — plain note under the cards */}
      {change.initialComment && (
        <div className="mt-1.5">
          <RichText body={change.initialComment} className="text-xs text-slate-400 leading-snug whitespace-pre-wrap" cardColors={cardColors} />
        </div>
      )}

      {/* Full-width comment button */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="touch-target w-full mt-2 flex items-center justify-center gap-2 min-h-[44px] px-3 py-2 rounded-md bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 text-sm text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}` : 'Add comment'}
        <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

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
