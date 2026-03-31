import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { AutocompleteTextarea } from '../ui/AutocompleteTextarea'
import { ReviewerNameBadge } from '../ui/ReviewerNameBadge'
import { UnresolvedCheckbox } from '../ui/UnresolvedCheckbox'
import { ChangeTypeBadge } from './ChangeTypeBadge'
import { useCardPreview } from '../../hooks/useCardPreview'
import { FullscreenCardModal } from '../cards/FullscreenCardModal'
import { CardSearch } from './CardSearch'
import { CheckIcon } from '../ui/Icons'
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

// ── Flip target labels ───────────────────────────────────────────────────────

const FLIP_TARGET: Record<ChangeType, string> = {
  remove: 'Keep', add: 'Reject', swap: 'Decline',
  keep: 'Remove', reject: 'Add', decline: 'Swap',
}

// ── Title labels ─────────────────────────────────────────────────────────────

const TITLE_MAP: Record<ChangeType, string> = {
  add: 'Add Cards', remove: 'Remove Cards', swap: 'Swap Cards',
  keep: 'Keep Cards', reject: 'Reject Cards', decline: 'Decline Cards',
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const availableA = useMemo(() => {
    const outNames = new Set(cardsOut.map(c => c.name))
    return allCardsA.filter(c => !outNames.has(c.name))
  }, [cardsOut, allCardsA])
  const availableB = useMemo(() => {
    const inNames = new Set(cardsIn.map(c => c.name))
    return allCardsB.filter(c => !inNames.has(c.name))
  }, [cardsIn, allCardsB])

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

  function buildSaveData(): ChangeData {
    return { type: computedType, cardsOut, cardsIn, comment, unresolved, changeId: existingChange?.id }
  }

  function handleSave() {
    onSave(buildSaveData())
    onClearSelection?.()
    onClose()
  }

  function handleApprove() {
    // Auto-save pending edits before approving
    onSave(buildSaveData())
    if (isApproved) {
      onUnapprove?.()
    } else {
      onApprove?.()
    }
    onClearSelection?.()
    onClose()
  }

  const hasCards = cardsOut.length + cardsIn.length > 0
  const title = isEditing ? 'Edit Change' : TITLE_MAP[computedType]

  const showOut = isEditing || cardsOut.length > 0
  const showIn = isEditing || cardsIn.length > 0
  const showEmptyState = !isEditing && !showOut && !showIn

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
            title={`Flip to ${FLIP_TARGET[computedType]}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Flip to {FLIP_TARGET[computedType]}
          </button>
          {!isEditing && <span className="ml-auto"><ReviewerNameBadge /></span>}
        </div>

        {/* Empty state helper */}
        {showEmptyState && (
          <div className="text-center py-4 text-xs text-slate-500">
            Search below to add cards to this change.
          </div>
        )}

        {/* Cards Out */}
        {showOut && (
          <div>
            <div className={`text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 transition-colors duration-200 ${negative ? 'text-teal-500/70' : 'text-red-500/70'}`}>{outLabel}</div>
            <div className="space-y-0.5">
              {cardsOut.map(c => (
                <div key={c.name} className="flex items-center justify-between px-2 py-1 rounded bg-slate-700/30">
                  <span className={`text-sm ${outColor}`}>{c.name}</span>
                  {isEditing && (
                    <button onClick={() => setCardsOut(prev => prev.filter(x => x.name !== c.name))}
                      className="p-1 text-slate-600 hover:text-red-400 text-xs ml-2 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                      aria-label={`Remove ${c.name}`}>✕</button>
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
            <div className={`text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 transition-colors duration-200 ${negative ? 'text-orange-500/70' : 'text-green-500/70'}`}>{inLabel}</div>
            <div className="space-y-0.5">
              {cardsIn.map(c => (
                <div key={c.name} className="flex items-center justify-between px-2 py-1 rounded bg-slate-700/30">
                  <span className={`text-sm ${inColor}`}>{c.name}</span>
                  {isEditing && (
                    <button onClick={() => setCardsIn(prev => prev.filter(x => x.name !== c.name))}
                      className="p-1 text-slate-600 hover:text-red-400 text-xs ml-2 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                      aria-label={`Remove ${c.name}`}>✕</button>
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
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h4m0 0V3m0 4l-4 4m8-4h-4m0 0V3m0 4l4 4M8 17H4m4 0v4m0-4l-4-4m12 4h4m-4 0v4m0-4l4-4" />
            </svg>
            Split into two changes
          </button>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-700/40">
          {isEditing && onDelete && (
            <>
              <Button variant="danger" size="sm" onClick={() => { onDelete(existingChange!.id); onClose() }}>
                Delete
              </Button>
              <div className="w-px h-5 bg-slate-700/60" />
            </>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {isEditing && onApprove && (
              <Button
                variant={isApproved ? 'approved' : 'approve'}
                size="sm"
                onClick={handleApprove}
              >
                <CheckIcon className="w-3.5 h-3.5 mr-1.5" />
                {isApproved ? 'Approved' : 'Approve'}
              </Button>
            )}

            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!hasCards}>Save</Button>
          </div>
        </div>
      </div>

      <FullscreenCardModal {...previewModalProps} />
    </Modal>
  )
}
