import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { AutocompleteTextarea } from '../ui/AutocompleteTextarea'
import { ReviewerNameBadge } from '../ui/ReviewerNameBadge'
import { UnresolvedCheckbox } from '../ui/UnresolvedCheckbox'
import { ChangeTypeBadge } from './ChangeTypeBadge'
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu'
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

  // ── Action menu items ──────────────────────────────────────────────────────
  const actionMenuItems = useMemo(() => {
    const items: ActionMenuItem[] = []

    // Approve / Unapprove (edit mode only)
    if (isEditing && onApprove) {
      items.push({
        label: isApproved ? 'Undo approval' : 'Approve change',
        icon: <CheckIcon className="w-4 h-4" />,
        onClick: handleApprove,
      })
    }

    // Flip polarity
    items.push({
      label: `Change to ${FLIP_TARGET[computedType]}`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      ),
      onClick: handleFlip,
    })

    // Split (edit mode, 2+ cards)
    if (isEditing && onSplit && (cardsOut.length + cardsIn.length >= 2)) {
      items.push({
        label: 'Split into two',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h4m0 0V3m0 4l-4 4m8-4h-4m0 0V3m0 4l4 4M8 17H4m4 0v4m0-4l-4-4m12 4h4m-4 0v4m0-4l4-4" />
          </svg>
        ),
        onClick: () => { onClose(); onSplit() },
      })
    }

    // Delete (always last, destructive)
    if (isEditing && onDelete) {
      items.push({
        label: 'Delete change',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        ),
        onClick: () => { onDelete(existingChange!.id); onClose() },
        destructive: true,
        separated: true,
      })
    }

    return items
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, isApproved, computedType, cardsOut.length, cardsIn.length])

  return (
    <Modal open={open} onClose={onClose} title={title} accentColor={ACCENT_COLORS[computedType]}>
      <div className="space-y-3">
        {/* Type badge */}
        <div className="flex items-center gap-2">
          <ChangeTypeBadge type={computedType} />
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
            <div className={`text-[11px] font-medium uppercase tracking-wider mb-1 ${negative ? 'text-teal-500/70' : 'text-red-500/70'}`}>{outLabel}</div>
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
            <div className={`text-[11px] font-medium uppercase tracking-wider mb-1 ${negative ? 'text-orange-500/70' : 'text-green-500/70'}`}>{inLabel}</div>
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

        {/* Comment + unresolved */}
        <div className="space-y-1.5">
          <AutocompleteTextarea
            value={comment}
            onChange={setComment}
            diffCards={diffCards}
            reviewerNames={reviewerNames}
            rows={2}
          />
          <UnresolvedCheckbox checked={unresolved} onChange={setUnresolved} />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-700/40">
          <ActionMenu items={actionMenuItems} />
          <div className="ml-auto">
            <Button size="sm" onClick={handleSave} disabled={!hasCards}>Save</Button>
          </div>
        </div>
      </div>

      <FullscreenCardModal {...previewModalProps} />
    </Modal>
  )
}
