import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Comment, CommentResolution } from '../../types/firestore'
import { getCachedImage } from '../../lib/imageCache'
import { useAuth } from '../../context/AuthContext'

interface CommentItemProps {
  comment: Comment
  onSetResolution?: (resolution: CommentResolution) => void
  onEdit?: (newBody: string) => void
}

/** Renders comment body — [[Card Name]] patterns become hoverable card mentions */
function CommentBody({ body }: { body: string }) {
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null)
  const [hoverCard, setHoverCard] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)

  // Parse [[Card Name]] mentions
  const segments: Array<{ text: string; isCard?: boolean }> = []
  const pattern = /\[\[([^\]]+)\]\]/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(body)) !== null) {
    if (match.index > last) segments.push({ text: body.slice(last, match.index) })
    segments.push({ text: match[1], isCard: true })
    last = match.index + match[0].length
  }
  if (last < body.length) segments.push({ text: body.slice(last) })

  function handleCardMouseMove(e: React.MouseEvent, name: string) {
    if (rafRef.current !== null) return
    const x = e.clientX, y = e.clientY
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const imgW = 180
      const imgH = 252
      let left = x + 20
      let top = y - imgH / 2
      if (left + imgW > window.innerWidth - 8) left = x - imgW - 20
      if (top < 8) top = 8
      if (top + imgH > window.innerHeight - 8) top = window.innerHeight - imgH - 8
      setHoverPos({ top, left })
      setHoverCard(name)
    })
  }

  return (
    <>
      <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
        {segments.map((seg, i) => {
          if (!seg.isCard) return <span key={i}>{seg.text}</span>
          return (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-700 text-amber-300 text-xs font-medium cursor-default hover:bg-slate-600 transition-colors"
              onMouseMove={e => handleCardMouseMove(e, seg.text)}
              onMouseLeave={() => {
                if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
                setHoverPos(null)
                setHoverCard(null)
              }}
            >
              <svg className="w-2.5 h-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7l9-4 9 4M3 7v10l9 4 9-4V7" /></svg>
              {seg.text}
            </span>
          )
        })}
      </p>
      {hoverPos && hoverCard && getCachedImage(hoverCard) && createPortal(
        <div
          className="hidden md:block pointer-events-none"
          style={{ position: 'fixed', top: hoverPos.top, left: hoverPos.left, zIndex: 9999 }}
        >
          <img
            src={getCachedImage(hoverCard)}
            alt={hoverCard}
            className="rounded-lg shadow-2xl border border-slate-600/50"
            style={{ width: 180 }}
          />
        </div>,
        document.body
      )}
    </>
  )
}

export function CommentItem({ comment, onSetResolution, onEdit }: CommentItemProps) {
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
                className="p-1.5 text-slate-600 hover:text-slate-400 transition-colors rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
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
                className="p-2 -m-1 text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded touch-target"
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
            <textarea
              autoFocus
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') cancelEdit()
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit() }
              }}
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={saveEdit}
                disabled={!editBody.trim() || editBody.trim() === comment.body}
                className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 rounded-lg transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
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
          <CommentBody body={comment.body} />
        )}
      </div>
    </div>
  )
}
