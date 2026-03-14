import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Textarea'
import { SuggestionMenu } from '../ui/SuggestionMenu'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useAuth } from '../../context/AuthContext'
import { useEditMode } from '../../context/EditModeContext'
import { getCachedImage } from '../../lib/imageCache'
import { FullscreenCardModal } from '../cards/FullscreenCardModal'
import { CubeCard } from '../../types/cube'
import { ChangeType } from '../../types/firestore'

interface ChangeModalProps {
  open: boolean
  onClose: () => void
  selectedLeftCards: CubeCard[]
  selectedRightCards: CubeCard[]
  onSave: (type: ChangeType, cardsOut: CubeCard[], cardsIn: CubeCard[], comment: string, unresolved: boolean) => void
  forceType?: ChangeType
  allDiffCards?: string[]
  reviewerNames?: string[]
}

const TYPE_TITLES: Record<ChangeType, string> = {
  add: 'Add Cards',
  remove: 'Remove Cards',
  swap: 'Swap Cards',
  keep: 'Keep Cards',
  reject: 'Reject Cards',
}

function PreviewableCardRow({ card, colorClass, prefix, onPreview }: {
  card: CubeCard
  colorClass: string
  prefix: string
  onPreview: (card: CubeCard) => void
}) {
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null)
  const imageUrl = getCachedImage(card.name)

  function handleMouseMove(e: React.MouseEvent) {
    if (!imageUrl) return
    const imgW = 180, imgH = 252
    let left = e.clientX + 20
    let top = e.clientY - imgH / 2
    if (left + imgW > window.innerWidth - 8) left = e.clientX - imgW - 20
    if (top < 8) top = 8
    if (top + imgH > window.innerHeight - 8) top = window.innerHeight - imgH - 8
    setHoverPos({ top, left })
  }

  return (
    <>
      <button
        type="button"
        className={`w-full text-left text-sm py-1 select-none ${imageUrl ? 'cursor-pointer hover:opacity-80 active:opacity-60' : 'cursor-default'} ${colorClass} focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverPos(null)}
        onClick={() => imageUrl && onPreview(card)}
        aria-label={imageUrl ? `Preview ${card.name}` : card.name}
      >
        {prefix} {card.name}
      </button>
      {hoverPos && imageUrl && createPortal(
        <div
          className="hidden md:block pointer-events-none"
          style={{ position: 'fixed', top: hoverPos.top, left: hoverPos.left, zIndex: 9999 }}
        >
          <img
            src={imageUrl}
            alt={card.name}
            className="rounded-lg shadow-2xl border border-slate-600/50"
            style={{ width: 180 }}
          />
        </div>,
        document.body
      )}
    </>
  )
}

export function ChangeModal({ open, onClose, selectedLeftCards, selectedRightCards, onSave, forceType, allDiffCards, reviewerNames }: ChangeModalProps) {
  const { identity, setName } = useAuth()
  const { actionType, clearSelection } = useEditMode()
  const [comment, setComment] = useState('')
  const [unresolved, setUnresolved] = useState(false)
  const [editingAuthor, setEditingAuthor] = useState(false)
  const [authorInput, setAuthorInput] = useState('')
  const [previewCard, setPreviewCard] = useState<CubeCard | null>(null)

  const type = forceType ?? actionType ?? 'add'

  const diffCardNames = allDiffCards ?? [
    ...selectedLeftCards.map(c => c.name),
    ...selectedRightCards.map(c => c.name),
  ]
  const { textareaRef, suggestions, anchor, onTextareaChange, applySuggestion, dismiss } =
    useAutocomplete({ diffCards: diffCardNames, reviewerNames })

  // Reset transient state when modal closes
  useEffect(() => {
    if (!open) {
      setEditingAuthor(false)
      setAuthorInput('')
      setPreviewCard(null)
      dismiss()
    }
  }, [open])

  function handleSave() {
    const finalCardsOut = forceType === 'reject' ? [] : selectedLeftCards
    const finalCardsIn = forceType === 'keep' ? [] : selectedRightCards
    onSave(type, finalCardsOut, finalCardsIn, comment, unresolved)
    clearSelection()
    setComment('')
    setUnresolved(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={TYPE_TITLES[type]}>
      <div className="space-y-4">
        <div className="bg-slate-700/50 rounded-lg p-3 space-y-0.5">
          {forceType === 'reject'
            ? selectedRightCards.map(c => (
                <PreviewableCardRow key={c.name} card={c} colorClass="text-orange-300" prefix="×" onPreview={setPreviewCard} />
              ))
            : forceType === 'keep'
            ? selectedLeftCards.map(c => (
                <PreviewableCardRow key={c.name} card={c} colorClass="text-teal-300" prefix="↺" onPreview={setPreviewCard} />
              ))
            : (
              <>
                {selectedLeftCards.map(c => (
                  <PreviewableCardRow key={c.name} card={c} colorClass="text-red-300" prefix="−" onPreview={setPreviewCard} />
                ))}
                {selectedRightCards.map(c => (
                  <PreviewableCardRow key={c.name} card={c} colorClass="text-green-300" prefix="+" onPreview={setPreviewCard} />
                ))}
              </>
            )}
        </div>

        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="Add a note (optional)… (/ for cards)"
            value={comment}
            onChange={e => {
              setComment(e.target.value)
              onTextareaChange(e.target.value, e.target.selectionStart ?? e.target.value.length)
            }}
            onKeyDown={e => { if (e.key === 'Escape' && suggestions.length > 0) { e.stopPropagation(); dismiss() } }}
            rows={3}
          />
          <SuggestionMenu
            suggestions={suggestions}
            anchor={anchor}
            onSelect={s => applySuggestion(s, comment, setComment)}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unresolved}
            onChange={e => setUnresolved(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-yellow-500"
          />
          <span className="text-sm text-slate-300">Mark as unresolved</span>
        </label>

        <div className="flex items-center justify-between">
          {editingAuthor ? (
            <form
              className="flex items-center gap-1"
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
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
              aria-label={`Posting as ${identity.displayName} — click to change name`}
            >
              as <strong className="text-slate-300">{identity.displayName}</strong>
            </button>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} size="sm">Save</Button>
          </div>
        </div>
      </div>

      <FullscreenCardModal
        open={!!previewCard}
        onClose={() => setPreviewCard(null)}
        cardName={previewCard?.name ?? ''}
        imageUrl={previewCard ? getCachedImage(previewCard.name) ?? undefined : undefined}
      />
    </Modal>
  )
}
