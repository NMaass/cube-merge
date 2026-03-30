import { useEffect } from 'react'
import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { AutocompleteTextarea } from '../ui/AutocompleteTextarea'
import { UnresolvedCheckbox } from '../ui/UnresolvedCheckbox'
import { ReviewerNameBadge } from '../ui/ReviewerNameBadge'
import { useEditMode } from '../../context/EditModeContext'
import { useCardPreview } from '../../hooks/useCardPreview'
import { FullscreenCardModal } from '../cards/FullscreenCardModal'
import { PreviewableCardRow } from '../changes/PreviewableCardRow'
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
  decline: 'Decline Cards',
}

export function ChangeModal({ open, onClose, selectedLeftCards, selectedRightCards, onSave, forceType, allDiffCards, reviewerNames }: ChangeModalProps) {
  const { actionType, clearSelection } = useEditMode()
  const [comment, setComment] = useState('')
  const [unresolved, setUnresolved] = useState(false)
  const { setPreviewCard, previewModalProps } = useCardPreview()

  const type = forceType ?? actionType ?? 'add'

  const diffCardNames = allDiffCards ?? [
    ...selectedLeftCards.map(c => c.name),
    ...selectedRightCards.map(c => c.name),
  ]

  // Reset transient state when modal closes
  useEffect(() => {
    if (!open) {
      previewModalProps.onClose()
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
          {(() => {
            const neg = forceType === 'keep' || forceType === 'reject' || forceType === 'decline'
            return (
              <>
                {selectedLeftCards.map(c => (
                  <PreviewableCardRow key={c.name} card={c}
                    colorClass={neg ? 'text-teal-300' : 'text-red-300'}
                    prefix={neg ? '↺' : '−'}
                    onPreview={setPreviewCard} />
                ))}
                {selectedRightCards.map(c => (
                  <PreviewableCardRow key={c.name} card={c}
                    colorClass={neg ? 'text-orange-300' : 'text-green-300'}
                    prefix={neg ? '×' : '+'}
                    onPreview={setPreviewCard} />
                ))}
              </>
            )
          })()}
        </div>

        <AutocompleteTextarea
          value={comment}
          onChange={setComment}
          diffCards={diffCardNames}
          reviewerNames={reviewerNames}
          rows={3}
        />

        <UnresolvedCheckbox checked={unresolved} onChange={setUnresolved} />

        <div className="flex items-center justify-between">
          <ReviewerNameBadge />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} size="sm">Save</Button>
          </div>
        </div>
      </div>

      <FullscreenCardModal {...previewModalProps} />
    </Modal>
  )
}
