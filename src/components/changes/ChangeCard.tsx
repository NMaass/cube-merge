import { useState } from 'react'
import { Change, Comment, CommentResolution } from '../../types/firestore'
import { computeChangeType } from '../../lib/changes'
import { ChangeTypeBadge } from './ChangeTypeBadge'
import { CardInOutDisplay } from './CardInOutDisplay'
import { CommentThread } from './CommentThread'

interface ChangeCardProps {
  change: Change & { comments: Comment[] }
  onAddComment?: (body: string, resolution: CommentResolution) => void
  onSetCommentResolution?: (commentId: string, resolution: CommentResolution) => void
  onEdit?: () => void
  diffCards?: string[]
  reviewerNames?: string[]
}

export function ChangeCard({ change, onAddComment, onSetCommentResolution, onEdit, diffCards, reviewerNames }: ChangeCardProps) {
  const [expanded, setExpanded] = useState(false)
  const date = change.createdAt?.toDate?.()?.toLocaleDateString() || ''
  const commentCount = change.comments.length
  const displayType = computeChangeType(change.cardsOut, change.cardsIn, change.type)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      {/* Header row: avatar + author + type badge + date + actions */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
          {change.authorName?.[0] || '?'}
        </div>
        <span className="text-sm font-medium text-slate-300">{change.authorName}</span>
        <ChangeTypeBadge type={displayType} />
        {change.unresolved && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-700/60 whitespace-nowrap shrink-0">
            ⚠ Unresolved
          </span>
        )}
        <span className="text-xs text-slate-600 ml-auto">{date}</span>
        {onEdit && (
          <button
            onClick={onEdit}
            className="h-8 w-8 flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded transition-colors focus:outline-none"
            aria-label="Edit change"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      {/* Card names — primary content */}
      <div className="pl-1">
        <CardInOutDisplay cardsIn={change.cardsIn} cardsOut={change.cardsOut} type={change.type} />
      </div>

      {/* Initial comment — plain note under the cards */}
      {change.initialComment && (
        <p className="mt-2.5 pl-1 text-sm text-slate-200 leading-snug">{change.initialComment}</p>
      )}

      {/* Footer: comments chip */}
      <div className="mt-3 pl-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-700/60 hover:bg-slate-700 border border-slate-600/60 hover:border-slate-500 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}` : 'Add comment'}
          {commentCount > 0 && (
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
      </div>

      {expanded && (
        <CommentThread
          comments={change.comments}
          onAddComment={onAddComment}
          onSetResolution={onSetCommentResolution}
          diffCards={diffCards}
          reviewerNames={reviewerNames}
        />
      )}
    </div>
  )
}
