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
import { PreviewableCardRow } from './PreviewableCardRow'
import { CubeCard } from '../../types/cube'
import { Change, Comment, ChangeType } from '../../types/firestore'
import { computeChangeType } from '../../lib/changes'

type WorkingChange = Change & { comments: Comment[] }

/** Data emitted by the modal on save. */
export interface ChangeData {
  type: ChangeType
  cardsOut: CubeCard[]
  cardsIn: CubeCard[]
  comment: string
  unresolved: boolean
  /** Set when editing an existing change. */
  changeId?: string
}

// ── Inline sub-components ────────────────────────────────────────────────────

function EditableCardRow({ card, colorClass, onRemove }: {
  card: CubeCard
  colorClass: string
  onRemove: () => void
}) {
  return (
    <div className="flex items-center justify-between bg-slate-700/40 rounded px-2 py-1">
      <span className={`text-xs ${colorClass}`}>{card.name}</span>
      <button
        onClick={onRemove}
        className="text-slate-500 hover:text-red-400 transition-colors text-xs ml-2"
        aria-label={`Remove ${card.name}`}
      >
        ✕
      </button>
    </div>
  )
}

// ── Accent color map ──────────────────────────────────────────────────────────

const ACCENT_COLORS: Record<ChangeType, string> = {
  swap: 'border-l-amber-500',
  add: 'border-l-green-500',
  remove: 'border-l-red-500',
  keep: 'border-l-teal-500',
  reject: 'border-l-orange-500',
}

// ── Flip logic ────────────────────────────────────────────────────────────────

const FLIP_MAP: Record<ChangeType, ChangeType> = {
  remove: 'keep',
  keep: 'remove',
  add: 'reject',
  reject: 'add',
  swap: 'swap', // swap flips by swapping cardsIn/cardsOut
}

function flipLabel(type: ChangeType): string {
  if (type === 'swap') return 'Flip to Decline'
  if (type === 'remove') return 'Flip to Keep'
  if (type === 'keep') return 'Flip to Remove'
  if (type === 'add') return 'Flip to Reject'
  if (type === 'reject') return 'Flip to Add'
  return ''
}

// ── Main component ───────────────────────────────────────────────────────────

interface UnifiedChangeModalProps {
  open: boolean
  onClose: () => void
  /** Create mode: cards selected from left panel. */
  selectedLeftCards?: CubeCard[]
  /** Create mode: cards selected from right panel. */
  selectedRightCards?: CubeCard[]
  /** Force initial type (e.g., 'keep', 'reject'). */
  initialType?: ChangeType
  /** Edit mode: existing change to modify. */
  existingChange?: WorkingChange
  /** All available cards from cube A (for CardSearch). */
  allCardsA?: CubeCard[]
  /** All available cards from cube B (for CardSearch). */
  allCardsB?: CubeCard[]
  /** Callback for save — works for both create and edit. */
  onSave: (data: ChangeData) => void
  /** Delete handler (edit mode only). */
  onDelete?: (changeId: string) => void
  /** Split handler (edit mode only). */
  onSplit?: () => void
  /** Card names in the diff for autocomplete. */
  diffCards?: string[]
  /** Reviewer names for @mention autocomplete. */
  reviewerNames?: string[]
  /** Clear selection callback (create mode). */
  onClearSelection?: () => void
}

export function UnifiedChangeModal({
  open, onClose,
  selectedLeftCards = [], selectedRightCards = [],
  initialType,
  existingChange,
  allCardsA = [], allCardsB = [],
  onSave, onDelete, onSplit,
  diffCards = [], reviewerNames = [],
  onClearSelection,
}: UnifiedChangeModalProps) {
  const isEditing = !!existingChange

  // ── State ────────────────────────────────────────────────────────────────
  const [cardsOut, setCardsOut] = useState<CubeCard[]>([])
  const [cardsIn, setCardsIn] = useState<CubeCard[]>([])
  const [baseType, setBaseType] = useState<ChangeType>('add')
  const [comment, setComment] = useState('')
  const [unresolved, setUnresolved] = useState(false)
  const { setPreviewCard, previewModalProps } = useCardPreview()

  // ── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      previewModalProps.onClose()
      return
    }
    if (existingChange) {
      setCardsOut(existingChange.cardsOut)
      setCardsIn(existingChange.cardsIn)
      setBaseType(existingChange.type)
      setComment(existingChange.initialComment)
      setUnresolved(existingChange.unresolved ?? false)
    } else {
      // Create mode
      const forceType = initialType
      if (forceType === 'keep') {
        setCardsOut(selectedLeftCards)
        setCardsIn([])
        setBaseType('keep')
      } else if (forceType === 'reject') {
        setCardsOut([])
        setCardsIn(selectedRightCards)
        setBaseType('reject')
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

  // ── Derived state ────────────────────────────────────────────────────────
  const computedType = computeChangeType(cardsOut, cardsIn, baseType)

  // Filter out already-added cards from candidates
  const outNames = new Set(cardsOut.map(c => c.name))
  const inNames = new Set(cardsIn.map(c => c.name))
  const availableA = allCardsA.filter(c => !outNames.has(c.name))
  const availableB = allCardsB.filter(c => !inNames.has(c.name))

  // ── Color helpers ───────────────────────────────────────────────────────
  const outColor = (computedType === 'keep') ? 'text-teal-400' : 'text-red-400'
  const outColorPreview = (computedType === 'keep') ? 'text-teal-300' : 'text-red-300'
  const outPrefix = (computedType === 'keep') ? '↺' : '−'
  const outLabel = (computedType === 'keep') ? 'Keeping' : 'Removing'

  const inColor = (computedType === 'reject') ? 'text-orange-400' : 'text-green-400'
  const inColorPreview = (computedType === 'reject') ? 'text-orange-300' : 'text-green-300'
  const inPrefix = (computedType === 'reject') ? '×' : '+'
  const inLabel = (computedType === 'reject') ? 'Rejecting' : 'Adding'

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleFlip() {
    if (computedType === 'swap') {
      // Swap polarity: swap the two sides — becomes a "decline" (opposite swap)
      const prevOut = cardsOut
      const prevIn = cardsIn
      setCardsOut(prevIn)
      setCardsIn(prevOut)
    } else {
      const next = FLIP_MAP[baseType]
      if (next !== baseType) setBaseType(next)
    }
  }

  function handleSave() {
    onSave({
      type: computedType,
      cardsOut,
      cardsIn,
      comment,
      unresolved,
      changeId: existingChange?.id,
    })
    onClearSelection?.()
    onClose()
  }

  // Title
  const titleMap: Record<ChangeType, string> = {
    add: 'Add Cards',
    remove: 'Remove Cards',
    swap: 'Swap Cards',
    keep: 'Keep Cards',
    reject: 'Reject Cards',
  }
  const title = isEditing ? 'Edit Change' : titleMap[computedType]

  // Whether to show each card section
  const showCardsOut = isEditing || cardsOut.length > 0 || computedType === 'swap' || computedType === 'remove' || computedType === 'keep'
  const showCardsIn = isEditing || cardsIn.length > 0 || computedType === 'swap' || computedType === 'add' || computedType === 'reject'

  return (
    <Modal open={open} onClose={onClose} title={title} accentColor={ACCENT_COLORS[computedType]}>
      <div className="space-y-4">
        {/* Type indicator + flip button */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Type:</span>
          <ChangeTypeBadge type={computedType} />
          <button
            type="button"
            onClick={handleFlip}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-700/60 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
            aria-label={flipLabel(computedType)}
            title={flipLabel(computedType)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* ── Cards Out (removing / keeping) ─────────────────────────────── */}
        {showCardsOut && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">{outLabel}</div>
            {isEditing ? (
              <>
                <div className="space-y-1">
                  {cardsOut.map(c => (
                    <EditableCardRow key={c.name} card={c} colorClass={outColor}
                      onRemove={() => setCardsOut(prev => prev.filter(x => x.name !== c.name))} />
                  ))}
                </div>
                <CardSearch label="removal" candidates={availableA} onAdd={c => setCardsOut(prev => [...prev, c])} />
              </>
            ) : (
              <>
                <div className="bg-slate-700/50 rounded-lg p-3 space-y-0.5">
                  {cardsOut.map(c => (
                    <PreviewableCardRow key={c.name} card={c} colorClass={outColorPreview} prefix={outPrefix} onPreview={setPreviewCard} />
                  ))}
                  {cardsOut.length === 0 && <p className="text-xs text-slate-500 italic">None</p>}
                </div>
                {allCardsA.length > 0 && (
                  <CardSearch label="removal" candidates={availableA} onAdd={c => setCardsOut(prev => [...prev, c])} />
                )}
              </>
            )}
          </div>
        )}

        {/* ── Cards In (adding / rejecting) ──────────────────────────────── */}
        {showCardsIn && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">{inLabel}</div>
            {isEditing ? (
              <>
                <div className="space-y-1">
                  {cardsIn.map(c => (
                    <EditableCardRow key={c.name} card={c} colorClass={inColor}
                      onRemove={() => setCardsIn(prev => prev.filter(x => x.name !== c.name))} />
                  ))}
                </div>
                <CardSearch label="addition" candidates={availableB} onAdd={c => setCardsIn(prev => [...prev, c])} />
              </>
            ) : (
              <>
                <div className="bg-slate-700/50 rounded-lg p-3 space-y-0.5">
                  {cardsIn.map(c => (
                    <PreviewableCardRow key={c.name} card={c} colorClass={inColorPreview} prefix={inPrefix} onPreview={setPreviewCard} />
                  ))}
                  {cardsIn.length === 0 && <p className="text-xs text-slate-500 italic">None</p>}
                </div>
                {allCardsB.length > 0 && (
                  <CardSearch label="addition" candidates={availableB} onAdd={c => setCardsIn(prev => [...prev, c])} />
                )}
              </>
            )}
          </div>
        )}

        {/* ── Comment ─────────────────────────────────────────────────────── */}
        <AutocompleteTextarea
          value={comment}
          onChange={setComment}
          diffCards={diffCards}
          reviewerNames={reviewerNames}
          rows={3}
        />

        {/* ── Unresolved checkbox ─────────────────────────────────────────── */}
        <UnresolvedCheckbox checked={unresolved} onChange={setUnresolved} />

        {/* ── Split button (edit mode) ────────────────────────────────────── */}
        {isEditing && onSplit && (cardsOut.length + cardsIn.length >= 2) && (
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

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          {isEditing ? (
            <>
              {onDelete ? (
                <Button variant="danger" size="sm" onClick={() => { onDelete(existingChange!.id); onClose() }}>
                  Delete
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" onClick={handleSave}>Save</Button>
              </div>
            </>
          ) : (
            <>
              <ReviewerNameBadge />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} size="sm">Save</Button>
              </div>
            </>
          )}
        </div>
      </div>

      <FullscreenCardModal {...previewModalProps} />
    </Modal>
  )
}
