import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { AutocompleteTextarea } from '../ui/AutocompleteTextarea'
import { CubeCard } from '../../types/cube'
import { Change, Comment, ChangeType } from '../../types/firestore'
import { computeChangeType } from '../../lib/changes'
import { UnresolvedCheckbox } from '../ui/UnresolvedCheckbox'
import { ChangeTypeBadge } from './ChangeTypeBadge'
import { CardSearch } from './CardSearch'

type WorkingChange = Change & { comments: Comment[] }

interface EditChangeModalProps {
  open: boolean
  onClose: () => void
  change: WorkingChange
  allCardsA: CubeCard[]
  allCardsB: CubeCard[]
  onSave: (changeId: string, updates: { initialComment: string; cardsOut: CubeCard[]; cardsIn: CubeCard[]; type: ChangeType; unresolved: boolean }) => void
  onDelete?: (changeId: string) => void
  onSplit?: () => void
  diffCards?: string[]
  reviewerNames?: string[]
}

export function EditChangeModal({ open, onClose, change, allCardsA, allCardsB, onSave, onDelete, onSplit, diffCards = [], reviewerNames = [] }: EditChangeModalProps) {
  const [comment, setComment] = useState(change.initialComment)
  const [cardsOut, setCardsOut] = useState<CubeCard[]>(change.cardsOut)
  const [cardsIn, setCardsIn] = useState<CubeCard[]>(change.cardsIn)
  const [unresolved, setUnresolved] = useState(change.unresolved ?? false)

  const computedType = computeChangeType(cardsOut, cardsIn, change.type)

  // Filter out already-added cards from candidates
  const outNames = new Set(cardsOut.map(c => c.name))
  const inNames = new Set(cardsIn.map(c => c.name))
  const availableA = allCardsA.filter(c => !outNames.has(c.name))
  const availableB = allCardsB.filter(c => !inNames.has(c.name))

  function handleSave() {
    onSave(change.id, { initialComment: comment, cardsOut, cardsIn, type: computedType, unresolved })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Change">
      <div className="space-y-4">
        {/* Dynamic type indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Type:</span>
          <ChangeTypeBadge type={computedType} />
        </div>

        {/* Cards Out (remove/keep side) */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            {change.type === 'keep' ? 'Keeping' : 'Removing'}
          </div>
          <div className="space-y-1">
            {cardsOut.map(c => (
              <div key={c.name} className="flex items-center justify-between bg-slate-700/40 rounded px-2 py-1">
                <span className={`text-xs ${change.type === 'keep' ? 'text-teal-400' : 'text-red-400'}`}>{c.name}</span>
                <button
                  onClick={() => setCardsOut(prev => prev.filter(x => x.name !== c.name))}
                  className="text-slate-500 hover:text-red-400 transition-colors text-xs ml-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <CardSearch label="removal" candidates={availableA} onAdd={c => setCardsOut(prev => [...prev, c])} />
        </div>

        {/* Cards In (add side) */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Adding</div>
          <div className="space-y-1">
            {cardsIn.map(c => (
              <div key={c.name} className="flex items-center justify-between bg-slate-700/40 rounded px-2 py-1">
                <span className="text-xs text-green-400">{c.name}</span>
                <button
                  onClick={() => setCardsIn(prev => prev.filter(x => x.name !== c.name))}
                  className="text-slate-500 hover:text-red-400 transition-colors text-xs ml-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <CardSearch label="addition" candidates={availableB} onAdd={c => setCardsIn(prev => [...prev, c])} />
        </div>

        <AutocompleteTextarea
          value={comment}
          onChange={setComment}
          diffCards={diffCards}
          reviewerNames={reviewerNames}
          rows={2}
        />

        <UnresolvedCheckbox checked={unresolved} onChange={setUnresolved} />

        {onSplit && (cardsOut.length + cardsIn.length >= 2) && (
          <div className="pt-1 border-t border-slate-700/60">
            <button
              onClick={() => { onClose(); onSplit() }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/40 hover:border-slate-500 text-sm text-slate-300 hover:text-white transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <svg className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h4m0 0V3m0 4l-4 4m8-4h-4m0 0V3m0 4l4 4M8 17H4m4 0v4m0-4l-4-4m12 4h4m-4 0v4m0-4l4-4" />
              </svg>
              <span>Split into two changes</span>
              <svg className="w-3.5 h-3.5 ml-auto text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex justify-between gap-2">
          {onDelete ? (
            <Button variant="danger" size="sm" onClick={() => { onDelete(change.id); onClose() }}>
              Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
