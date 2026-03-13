import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Textarea'
import { CubeCard } from '../../types/cube'

interface PassModalProps {
  open: boolean
  onClose: () => void
  leftCards: CubeCard[]
  rightCards: CubeCard[]
  onSave: (comment: string, unresolved: boolean) => void
}

export function PassModal({ open, onClose, leftCards, rightCards, onSave }: PassModalProps) {
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
            <p key={c.name} className="text-sm py-0.5 text-cyan-300 select-none">↺ {c.name}</p>
          ))}
          {leftCards.length > 0 && rightCards.length > 0 && (
            <div className="border-t border-slate-600/60 my-1" />
          )}
          {rightCards.map(c => (
            <p key={c.name} className="text-sm py-0.5 text-orange-300 select-none">× {c.name}</p>
          ))}
        </div>

        <p className="text-xs text-slate-500 -mt-1">
          Left cards will be marked as <span className="text-cyan-400">kept</span>; right cards as <span className="text-orange-400">rejected</span>.
        </p>

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

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="pass" size="sm" onClick={handleSave}>Pass on Swap</Button>
        </div>
      </div>
    </Modal>
  )
}
