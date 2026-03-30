import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { AutocompleteTextarea } from '../ui/AutocompleteTextarea'
import { ReviewerNameBadge } from '../ui/ReviewerNameBadge'
import { UnresolvedCheckbox } from '../ui/UnresolvedCheckbox'
import { ChangeTypeBadge } from './ChangeTypeBadge'
import { useCardPreview } from '../../hooks/useCardPreview'
import { FullscreenCardModal } from '../cards/FullscreenCardModal'
import { CardSearch } from './CardSearch'
import { CubeCard } from '../../types/cube'
import { Change, Comment, ChangeType } from '../../types/firestore'
import { computeChangeType, isNegativePolarity } from '../../lib/changes'

type WorkingChange = Change & { comments: Comment[] }

/** Data emitted by the modal on save. */
export interface ChangeData {
  type: ChangeType
  cardsOut: CubeCard[]
  cardsIn: CubeCard[]
  comment: string
  unresolved: boolean
  changeId?: string
}

// ── Accent color map ──────────────────────────────────────────────────────────

const ACCENT_COLORS: Record<ChangeType, string> = {
  swap: 'border-l-amber-500',
  add: 'border-l-green-500',
  remove: 'border-l-red-500',
  keep: 'border-l-teal-500',
  reject: 'border-l-orange-500',
  decline: 'border-l-purple-500',
}

// ── Main component ───────────────────────────────────────────────────────────

interface UnifiedChangeModalProps {
  open: boolean
  onClose: () => void
  selectedLeftCards?: CubeCard[]
  selectedRightCards?: CubeCard[]
  initialType?: ChangeType
  existingChange?: WorkingChange
  allCardsA?: CubeCard[]
  allCardsB?: CubeCard[]
  onSave: (data: ChangeData) => void
  onDelete?: (changeId: string) => void
  onSplit?: () => void
  onApprove?: () => void
  onUnapprove?: () => void
  isApproved?: boolean
  diffCards?: string[]
  reviewerNames?: string[]
  onClearSelection?: () => void
}

export function UnifiedChangeModal({
  open, onClose,
  selectedLeftCards = [], selectedRightCards = [],
  initialType,
  existingChange,
  allCardsA = [], allCardsB = [],
  onSave, onDelete, onSplit,
  onApprove, onUnapprove, isApproved,
  diffCards = [], reviewerNames = [],
  onClearSelection,
}: UnifiedChangeModalProps) {
  const isEditing = !!existingChange

  const [cardsOut, setCardsOut] = useState<CubeCard[]>([])
  const [cardsIn, setCardsIn] = useState<CubeCard[]>([])
  const [baseType, setBaseType] = useState<ChangeType>('add')
  const [comment, setComment] = useState('')
  const [unresolved, setUnresolved] = useState(false)
  const { previewModalProps } = useCardPreview()

  // Reset on open
  useEffect(() => {
    if (!open) { previewModalProps.onClose(); return }
    if (existingChange) {
      setCardsOut(existingChange.cardsOut)
      setCardsIn(existingChange.cardsIn)
      setBaseType(existingChange.type)
      setComment(existingChange.initialComment)
      setUnresolved(existingChange.unresolved ?? false)
    } else {
      if (initialType === 'keep') {
        setCardsOut(selectedLeftCards); setCardsIn([]); setBaseType('keep')
      } else if (initialType === 'reject') {
        setCardsOut([]); setCardsIn(selectedRightCards); setBaseType('reject')
      } else {
        setCardsOut(selectedLeftCards)
        setCardsIn(selectedRightCards)
        if (selectedLeftCards.length > 0 && selectedRightCards.length > 0) setBaseType('swap')
        else if (selectedLeftCards.length > 0) setBaseType('remove')
        else setBaseType('add')
      }
      setComment('')
      setUnresolved(false)
    }
  }, [open])

  // Derived
  const computedType = computeChangeType(cardsOut, cardsIn, baseType)
  const negative = isNegativePolarity(computedType)

  const outNames = new Set(cardsOut.map(c => c.name))
  const inNames = new Set(cardsIn.map(c => c.name))
  const availableA = allCardsA.filter(c => !outNames.has(c.name))
  const availableB = allCardsB.filter(c => !inNames.has(c.name))

  // Colors driven by polarity
  const outColor = negative ? 'text-teal-400' : 'text-red-400'
  const outLabel = negative ? 'Keeping' : 'Removing'
  const inColor = negative ? 'text-orange-400' : 'text-green-400'
  const inLabel = negative ? 'Rejecting' : 'Adding'

  function handleFlip() {
    if (negative) {
      if (baseType === 'keep') setBaseType('remove')
      else if (baseType === 'reject') setBaseType('add')
      else setBaseType('swap')
    } else {
      if (baseType === 'remove') setBaseType('keep')
      else if (baseType === 'add') setBaseType('reject')
      else setBaseType('decline')
    }
  }

  function handleSave() {
    onSave({ type: computedType, cardsOut, cardsIn, comment, unresolved, changeId: existingChange?.id })
    onClearSelection?.()
    onClose()
  }

  const titleMap: Record<ChangeType, string> = {
    add: 'Add', remove: 'Remove', swap: 'Swap',
    keep: 'Keep', reject: 'Reject', decline: 'Decline',
  }
  const title = isEditing ? 'Edit Change' : titleMap[computedType]

  const showOut = isEditing || cardsOut.length > 0
  const showIn = isEditing || cardsIn.length > 0

  return (
    <Modal open={open} onClose={onClose} title={title} accentColor={ACCENT_COLORS[computedType]}>
      <div className="space-y-3">
        {/* Type badge + flip */}
        <div className="flex items-center gap-2">
          <ChangeTypeBadge type={computedType} />
          <button
            type="button"
            onClick={handleFlip}
            className="inline-flex items-center gap-1 px-1.5 h-6 rounded text-[11px] text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors"
            title={negative ? 'Flip to positive' : 'Flip to negative'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Flip
          </button>
          {!isEditing && <span className="ml-auto"><ReviewerNameBadge /></span>}
        </div>

        {/* Cards Out */}
        {showOut && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1">{outLabel}</div>
            <div className="space-y-0.5">
              {cardsOut.map(c => (
                <div key={c.name} className="flex items-center justify-between px-2 py-1 rounded bg-slate-700/30">
                  <span className={`text-sm ${outColor}`}>{c.name}</span>
                  {isEditing && (
                    <button onClick={() => setCardsOut(prev => prev.filter(x => x.name !== c.name))}
                      className="text-slate-600 hover:text-red-400 text-xs ml-2" aria-label={`Remove ${c.name}`}>✕</button>
                  )}
                </div>
              ))}
            </div>
            {(isEditing || allCardsA.length > 0) && (
              <div className="mt-1">
                <CardSearch label="removal" candidates={availableA} onAdd={c => setCardsOut(prev => [...prev, c])} />
              </div>
            )}
          </div>
        )}

        {/* Cards In */}
        {showIn && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1">{inLabel}</div>
            <div className="space-y-0.5">
              {cardsIn.map(c => (
                <div key={c.name} className="flex items-center justify-between px-2 py-1 rounded bg-slate-700/30">
                  <span className={`text-sm ${inColor}`}>{c.name}</span>
                  {isEditing && (
                    <button onClick={() => setCardsIn(prev => prev.filter(x => x.name !== c.name))}
                      className="text-slate-600 hover:text-red-400 text-xs ml-2" aria-label={`Remove ${c.name}`}>✕</button>
                  )}
                </div>
              ))}
            </div>
            {(isEditing || allCardsB.length > 0) && (
              <div className="mt-1">
                <CardSearch label="addition" candidates={availableB} onAdd={c => setCardsIn(prev => [...prev, c])} />
              </div>
            )}
          </div>
        )}

        {/* Comment */}
        <AutocompleteTextarea
          value={comment}
          onChange={setComment}
          diffCards={diffCards}
          reviewerNames={reviewerNames}
          rows={2}
        />

        {/* Unresolved */}
        <UnresolvedCheckbox checked={unresolved} onChange={setUnresolved} />

        {/* Split (edit mode, 2+ cards) */}
        {isEditing && onSplit && (cardsOut.length + cardsIn.length >= 2) && (
          <button
            onClick={() => { onClose(); onSplit() }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/40 hover:bg-slate-700 border border-slate-600/30 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h4m0 0V3m0 4l-4 4m8-4h-4m0 0V3m0 4l4 4M8 17H4m4 0v4m0-4l-4-4m12 4h4m-4 0v4m0-4l4-4" />
            </svg>
            Split into two changes
          </button>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-700/40">
          {isEditing && onDelete && (
            <Button variant="danger" size="sm" onClick={() => { onDelete(existingChange!.id); onClose() }}>
              Delete
            </Button>
          )}

          {/* Approve/unapprove toggle (edit mode only) */}
          {isEditing && onApprove && (
            <button
              onClick={() => { isApproved ? onUnapprove?.() : onApprove(); onClose() }}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                isApproved
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-slate-700 text-slate-400 hover:text-green-400 hover:bg-slate-700/80'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {isApproved ? 'Approved' : 'Approve'}
            </button>
          )}

          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </div>
        </div>
      </div>

      <FullscreenCardModal {...previewModalProps} />
    </Modal>
  )
}
