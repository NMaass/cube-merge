import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Textarea'
import { SuggestionMenu } from '../ui/SuggestionMenu'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { ReviewerNameBadge } from '../ui/ReviewerNameBadge'
import { ChangeTypeBadge } from './ChangeTypeBadge'
import { getCachedImage } from '../../lib/imageCache'
import { FullscreenCardModal } from '../cards/FullscreenCardModal'
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

// Delay lets the onMouseDown on dropdown items fire before onBlur hides them
const BLUR_DISMISS_DELAY_MS = 150

// ── Inline sub-components ────────────────────────────────────────────────────

function CardSearch({ label, candidates, onAdd }: {
  label: string
  candidates: CubeCard[]
  onAdd: (card: CubeCard) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const matches = query.length >= 1
    ? candidates.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : []

  function select(card: CubeCard) {
    onAdd(card)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        placeholder={`Add ${label}...`}
        aria-label={`Search ${label}`}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), BLUR_DISMISS_DELAY_MS)}
        className="w-full bg-slate-700/60 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
      {open && matches.length > 0 && (
        <div role="listbox" aria-label={`${label} suggestions`} className="absolute z-50 w-full mt-0.5 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          {matches.map(card => (
            <button
              key={card.name}
              role="option"
              aria-selected={false}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
              onMouseDown={() => select(card)}
            >
              {card.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PreviewableCardRow({ card, colorClass, prefix, onPreview }: {
  card: CubeCard
  colorClass: string
  prefix: string
  onPreview: (card: CubeCard) => void
}) {
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
      <button
        type="button"
        className={`w-full text-left text-sm py-1 select-none ${imageUrl ? 'cursor-pointer hover:opacity-80 active:opacity-60' : 'cursor-default'} ${colorClass} focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverPos(null)}
        onClick={() => imageUrl && onPreview(card)}
        aria-label={imageUrl ? `Preview ${card.name}` : card.name}
      >
        {prefix} {card.name}
      </button>
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

// ── Swap icon ────────────────────────────────────────────────────────────────

function SwapButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-700/60 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
      aria-label={label ?? 'Swap sides'}
      title={label ?? 'Swap sides'}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    </button>
  )
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
  /** All available cards from cube A (for CardSearch in edit mode). */
  allCardsA?: CubeCard[]
  /** All available cards from cube B (for CardSearch in edit mode). */
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
  const [previewCard, setPreviewCard] = useState<CubeCard | null>(null)

  // Autocomplete
  const { textareaRef, suggestions, anchor, onTextareaChange, applySuggestion, dismiss } =
    useAutocomplete({ diffCards, reviewerNames })

  // ── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setPreviewCard(null)
      dismiss()
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
        // Derive type from selection
        if (selectedLeftCards.length > 0 && selectedRightCards.length > 0) setBaseType('swap')
        else if (selectedLeftCards.length > 0) setBaseType('remove')
        else setBaseType('add')
      }
      setComment('')
      setUnresolved(false)
    }
  }, [open])

  // ── Derived state ────────────────────────────────────────────────────────
  const isAnchored = baseType === 'keep' || baseType === 'reject'
  const computedType = computeChangeType(cardsOut, cardsIn, baseType)

  // Filter out already-added cards from candidates (edit mode)
  const outNames = new Set(cardsOut.map(c => c.name))
  const inNames = new Set(cardsIn.map(c => c.name))
  const availableA = allCardsA.filter(c => !outNames.has(c.name))
  const availableB = allCardsB.filter(c => !inNames.has(c.name))

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleSwapSides() {
    const newOut = [...cardsIn]
    const newIn = [...cardsOut]
    setCardsOut(newOut)
    setCardsIn(newIn)
    if (baseType === 'keep') setBaseType('reject')
    else if (baseType === 'reject') setBaseType('keep')
    // Standard types: just swap arrays, computedType handles the rest
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

  // Border accent for anchored types
  const accentBorder = baseType === 'keep'
    ? 'border-l-2 border-l-teal-500'
    : baseType === 'reject'
    ? 'border-l-2 border-l-orange-500'
    : ''

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className={`space-y-4 ${accentBorder ? `pl-3 ${accentBorder}` : ''}`}>
        {/* Type indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Type:</span>
          <ChangeTypeBadge type={computedType} />
          {isAnchored && (
            <SwapButton
              onClick={handleSwapSides}
              label={baseType === 'keep' ? 'Switch to Reject' : 'Switch to Keep'}
            />
          )}
        </div>

        {/* ── Card lists ──────────────────────────────────────────────────── */}
        {isAnchored ? (
          // Keep or Reject: show only the relevant list
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              {baseType === 'keep' ? 'Keep' : 'Reject'}
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 space-y-0.5">
              {baseType === 'keep'
                ? cardsOut.map(c =>
                    isEditing ? (
                      <EditableCardRow key={c.name} card={c} colorClass="text-teal-400"
                        onRemove={() => setCardsOut(prev => prev.filter(x => x.name !== c.name))} />
                    ) : (
                      <PreviewableCardRow key={c.name} card={c} colorClass="text-teal-300" prefix="↺" onPreview={setPreviewCard} />
                    )
                  )
                : cardsIn.map(c =>
                    isEditing ? (
                      <EditableCardRow key={c.name} card={c} colorClass="text-orange-400"
                        onRemove={() => setCardsIn(prev => prev.filter(x => x.name !== c.name))} />
                    ) : (
                      <PreviewableCardRow key={c.name} card={c} colorClass="text-orange-300" prefix="×" onPreview={setPreviewCard} />
                    )
                  )
              }
            </div>
            {/* CardSearch for adding more (edit mode only) */}
            {isEditing && (
              <CardSearch
                label={baseType === 'keep' ? 'card to keep' : 'card to reject'}
                candidates={baseType === 'keep' ? availableA : availableB}
                onAdd={c => baseType === 'keep'
                  ? setCardsOut(prev => [...prev, c])
                  : setCardsIn(prev => [...prev, c])
                }
              />
            )}
          </div>
        ) : (
          // Standard types: show both sides
          <>
            {/* Cards Out (removing side) */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Removing
              </div>
              {isEditing ? (
                <>
                  <div className="space-y-1">
                    {cardsOut.map(c => (
                      <EditableCardRow key={c.name} card={c} colorClass="text-red-400"
                        onRemove={() => setCardsOut(prev => prev.filter(x => x.name !== c.name))} />
                    ))}
                  </div>
                  <CardSearch label="removal" candidates={availableA} onAdd={c => setCardsOut(prev => [...prev, c])} />
                </>
              ) : (
                <div className="bg-slate-700/50 rounded-lg p-3 space-y-0.5">
                  {cardsOut.map(c => (
                    <PreviewableCardRow key={c.name} card={c} colorClass="text-red-300" prefix="−" onPreview={setPreviewCard} />
                  ))}
                  {cardsOut.length === 0 && <p className="text-xs text-slate-500 italic">None</p>}
                </div>
              )}
            </div>

            {/* Swap button between sections */}
            {(cardsOut.length > 0 || cardsIn.length > 0) && (
              <div className="flex justify-center">
                <SwapButton onClick={handleSwapSides} />
              </div>
            )}

            {/* Cards In (adding side) */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Adding
              </div>
              {isEditing ? (
                <>
                  <div className="space-y-1">
                    {cardsIn.map(c => (
                      <EditableCardRow key={c.name} card={c} colorClass="text-green-400"
                        onRemove={() => setCardsIn(prev => prev.filter(x => x.name !== c.name))} />
                    ))}
                  </div>
                  <CardSearch label="addition" candidates={availableB} onAdd={c => setCardsIn(prev => [...prev, c])} />
                </>
              ) : (
                <div className="bg-slate-700/50 rounded-lg p-3 space-y-0.5">
                  {cardsIn.map(c => (
                    <PreviewableCardRow key={c.name} card={c} colorClass="text-green-300" prefix="+" onPreview={setPreviewCard} />
                  ))}
                  {cardsIn.length === 0 && <p className="text-xs text-slate-500 italic">None</p>}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Comment ─────────────────────────────────────────────────────── */}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="Add a note… type / to search cards"
            value={comment}
            onChange={e => {
              setComment(e.target.value)
              onTextareaChange(e.target.value, e.target.selectionStart ?? e.target.value.length)
            }}
            onKeyDown={e => { if (e.key === 'Escape' && suggestions.length > 0) { e.stopPropagation(); dismiss() } }}
            rows={3}
          />
          <SuggestionMenu
            suggestions={suggestions}
            anchor={anchor}
            onSelect={s => applySuggestion(s, comment, setComment)}
          />
        </div>

        {/* ── Unresolved checkbox ─────────────────────────────────────────── */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unresolved}
            onChange={e => setUnresolved(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-yellow-500"
          />
          <span className="text-sm text-slate-300">Mark as unresolved</span>
        </label>

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

      <FullscreenCardModal
        open={!!previewCard}
        onClose={() => setPreviewCard(null)}
        cardName={previewCard?.name ?? ''}
        imageUrl={previewCard ? getCachedImage(previewCard.name) ?? undefined : undefined}
      />
    </Modal>
  )
}
