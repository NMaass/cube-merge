import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Textarea'
import { useAuth } from '../../context/AuthContext'
import { useEditMode } from '../../context/EditModeContext'
import { getCachedImage } from '../../lib/imageCache'
import { CubeCard } from '../../types/cube'
import { ChangeType } from '../../types/firestore'

interface ChangeModalProps {
  open: boolean
  onClose: () => void
  selectedLeftCards: CubeCard[]
  selectedRightCards: CubeCard[]
  onSave: (type: ChangeType, cardsOut: CubeCard[], cardsIn: CubeCard[], comment: string, unresolved: boolean) => void
  forceType?: ChangeType
}

const TYPE_TITLES: Record<ChangeType, string> = {
  add: 'Add Cards',
  remove: 'Remove Cards',
  swap: 'Swap Cards',
  keep: 'Keep Cards',
  reject: 'Reject Cards',
}

function PreviewableCardRow({ card, colorClass, prefix }: { card: CubeCard; colorClass: string; prefix: string }) {
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
      <div
        className={`text-sm py-0.5 cursor-default select-none ${imageUrl ? 'hover:opacity-80' : ''} ${colorClass}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverPos(null)}
      >
        {prefix} {card.name}
      </div>
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

export function ChangeModal({ open, onClose, selectedLeftCards, selectedRightCards, onSave, forceType }: ChangeModalProps) {
  const { identity } = useAuth()
  const { actionType, clearSelection } = useEditMode()
  const [comment, setComment] = useState('')
  const [unresolved, setUnresolved] = useState(false)

  const type = forceType ?? actionType ?? 'add'

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
                <PreviewableCardRow key={c.name} card={c} colorClass="text-orange-300" prefix="×" />
              ))
            : forceType === 'keep'
            ? selectedLeftCards.map(c => (
                <PreviewableCardRow key={c.name} card={c} colorClass="text-cyan-300" prefix="↺" />
              ))
            : (
              <>
                {selectedLeftCards.map(c => (
                  <PreviewableCardRow key={c.name} card={c} colorClass="text-red-300" prefix="−" />
                ))}
                {selectedRightCards.map(c => (
                  <PreviewableCardRow key={c.name} card={c} colorClass="text-green-300" prefix="+" />
                ))}
              </>
            )}
        </div>

        <Textarea
          placeholder="Add a note (optional)..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
        />

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
          <span className="text-xs text-slate-500">
            as <strong className="text-slate-400">{identity.displayName}</strong>
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} size="sm">Save</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
