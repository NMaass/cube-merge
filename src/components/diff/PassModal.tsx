import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { AutocompleteTextarea } from '../ui/AutocompleteTextarea'
import { UnresolvedCheckbox } from '../ui/UnresolvedCheckbox'
import { CubeCard } from '../../types/cube'

interface PassModalProps {
  open: boolean
  onClose: () => void
  leftCards: CubeCard[]
  rightCards: CubeCard[]
  onSave: (comment: string, unresolved: boolean) => void
  diffCards?: string[]
  reviewerNames?: string[]
}

export function PassModal({ open, onClose, leftCards, rightCards, onSave, diffCards = [], reviewerNames = [] }: PassModalProps) {
  const [comment, setComment] = useState('')
  const [unresolved, setUnresolved] = useState(false)

  useEffect(() => {
    if (!open) {
      setComment('')
      setUnresolved(false)
    }
  }, [open])

  function handleSave() {
    onSave(comment, unresolved)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Pass on Swap">
      <div className="space-y-4">
        {/* Card summary: keep left, reject right */}
        <div className="bg-slate-700/50 rounded-lg p-3 space-y-0.5">
          {leftCards.map(c => (
            <p key={c.name} className="text-sm py-0.5 text-teal-300 select-none">↺ {c.name}</p>
          ))}
          {leftCards.length > 0 && rightCards.length > 0 && (
            <div className="border-t border-slate-600/60 my-1" />
          )}
          {rightCards.map(c => (
            <p key={c.name} className="text-sm py-0.5 text-orange-300 select-none">× {c.name}</p>
          ))}
        </div>

        <p className="text-xs text-slate-500 -mt-1">
          Left cards will be marked as <span className="text-teal-400">kept</span>; right cards as <span className="text-orange-400">rejected</span>.
        </p>

        <AutocompleteTextarea
          value={comment}
          onChange={setComment}
          diffCards={diffCards}
          reviewerNames={reviewerNames}
          rows={3}
        />

        <UnresolvedCheckbox checked={unresolved} onChange={setUnresolved} />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="pass" size="sm" onClick={handleSave}>Pass on Swap</Button>
        </div>
      </div>
    </Modal>
  )
}
