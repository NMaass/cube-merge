import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { AutocompleteTextarea } from '../ui/AutocompleteTextarea'
import { Change, Comment, ChangeType } from '../../types/firestore'
import { CubeCard } from '../../types/cube'
import { computeChangeType } from '../../lib/changes'

type WorkingChange = Change & { comments: Comment[] }

interface SplitChangeModalProps {
  open: boolean
  onClose: () => void
  change: WorkingChange
  onSplit: (originalUpdates: { cardsOut: CubeCard[]; cardsIn: CubeCard[]; type: ChangeType }, newChange: { cardsOut: CubeCard[]; cardsIn: CubeCard[]; type: ChangeType; comment: string }) => void
  diffCards?: string[]
  reviewerNames?: string[]
}

export function SplitChangeModal({ open, onClose, change, onSplit, diffCards = [], reviewerNames = [] }: SplitChangeModalProps) {
  const [splitOut, setSplitOut] = useState<Set<string>>(new Set())
  const [splitIn, setSplitIn] = useState<Set<string>>(new Set())
  const [comment, setComment] = useState('')

  const splitOutCards = change.cardsOut.filter(c => splitOut.has(c.name))
  const splitInCards = change.cardsIn.filter(c => splitIn.has(c.name))
  const hasSplit = splitOut.size > 0 || splitIn.size > 0

  const remainingOut = change.cardsOut.filter(c => !splitOut.has(c.name))
  const remainingIn = change.cardsIn.filter(c => !splitIn.has(c.name))
  const remainingHasCards = remainingOut.length > 0 || remainingIn.length > 0

  function toggle(set: Set<string>, name: string): Set<string> {
    const next = new Set(set)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    return next
  }

  function handleSplit() {
    if (!hasSplit || !remainingHasCards) return
    const newType = computeChangeType(splitOutCards, splitInCards, change.type)
    const remainingType = computeChangeType(remainingOut, remainingIn, change.type)
    onSplit(
      { cardsOut: remainingOut, cardsIn: remainingIn, type: remainingType },
      { cardsOut: splitOutCards, cardsIn: splitInCards, type: newType, comment }
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Split into two changes">
      <div className="space-y-4">
        <p className="text-sm text-slate-400">Check the cards to move into their own change. At least one card must stay here.</p>

        {change.cardsOut.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              {change.type === 'keep' ? 'Keeping' : 'Removing'}
            </div>
            {change.cardsOut.map(c => (
              <label key={c.name} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-slate-700/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitOut.has(c.name)}
                  onChange={() => setSplitOut(prev => toggle(prev, c.name))}
                  className="w-3.5 h-3.5 rounded accent-amber-500 shrink-0"
                />
                <span className={`text-sm ${change.type === 'keep' ? 'text-teal-300' : 'text-red-300'}`}>{c.name}</span>
              </label>
            ))}
          </div>
        )}

        {change.cardsIn.length > 0 && change.type !== 'keep' && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Adding</div>
            {change.cardsIn.map(c => (
              <label key={c.name} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-slate-700/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitIn.has(c.name)}
                  onChange={() => setSplitIn(prev => toggle(prev, c.name))}
                  className="w-3.5 h-3.5 rounded accent-amber-500 shrink-0"
                />
                <span className="text-sm text-green-300">{c.name}</span>
              </label>
            ))}
          </div>
        )}

        <AutocompleteTextarea
          value={comment}
          onChange={setComment}
          placeholder="Note for the new change (optional)… / for cards, @ for names"
          diffCards={diffCards}
          reviewerNames={reviewerNames}
          rows={2}
        />

        {hasSplit && !remainingHasCards && (
          <p className="text-xs text-amber-400">
            At least one card must stay in this change.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSplit} disabled={!hasSplit || !remainingHasCards}>
            Split
          </Button>
        </div>
      </div>
    </Modal>
  )
}
