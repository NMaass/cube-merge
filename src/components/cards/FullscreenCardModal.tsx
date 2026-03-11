import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { CubeCard } from '../../types/cube'

interface FullscreenCardModalProps {
  open: boolean
  onClose: () => void
  cardName: string
  card?: CubeCard
  imageUrl?: string
  backImageUrl?: string
  loading?: boolean
}

const COLOR_GRADIENTS: Record<string, string> = {
  W: 'from-slate-200 via-slate-100 to-amber-50',
  U: 'from-blue-900 via-blue-800 to-blue-700',
  B: 'from-slate-900 via-slate-800 to-slate-700',
  R: 'from-red-900 via-red-800 to-orange-800',
  G: 'from-green-900 via-green-800 to-emerald-800',
  M: 'from-yellow-800 via-amber-700 to-yellow-600',
  C: 'from-slate-700 via-slate-600 to-slate-500',
  L: 'from-amber-900 via-amber-800 to-stone-700',
}
const COLOR_BORDER: Record<string, string> = {
  W: 'border-amber-200/60', U: 'border-blue-400/60', B: 'border-slate-400/40',
  R: 'border-red-400/60', G: 'border-green-400/60', M: 'border-yellow-400/60',
  C: 'border-slate-400/40', L: 'border-amber-600/60',
}
const COLOR_TEXT: Record<string, string> = {
  W: 'text-slate-800', U: 'text-blue-100', B: 'text-slate-200',
  R: 'text-red-100', G: 'text-green-100', M: 'text-yellow-100',
  C: 'text-slate-200', L: 'text-amber-100',
}

/** Animated MTG-card-shaped placeholder shown while an image is loading or unavailable */
function CardPlaceholder({ card, cardName, loading }: { card?: CubeCard; cardName: string; loading?: boolean }) {
  const cc = card?.colorCategory ?? 'C'
  const gradient = COLOR_GRADIENTS[cc] ?? COLOR_GRADIENTS['C']
  const border = COLOR_BORDER[cc] ?? COLOR_BORDER['C']
  const text = COLOR_TEXT[cc] ?? COLOR_TEXT['C']

  return (
    <div
      className={`relative flex flex-col rounded-xl border-2 ${border} bg-gradient-to-b ${gradient} shadow-2xl overflow-hidden`}
      style={{ width: 240, aspectRatio: '63/88' }}
    >
      {/* Title bar */}
      <div className={`px-3 pt-2.5 pb-1 flex items-center justify-between ${text}`}>
        <span className="text-sm font-bold truncate leading-tight pr-1">{cardName}</span>
        {card?.manaCost && (
          <span className="text-xs font-mono opacity-70 shrink-0">{card.manaCost.replace(/[{}]/g, '')}</span>
        )}
      </div>

      {/* Art area */}
      <div className="mx-3 rounded-md overflow-hidden flex-1 flex items-center justify-center relative bg-black/20">
        {loading ? (
          // Shimmer animation
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_ease-in-out_infinite] -translate-x-full" />
        ) : null}
        <div className={`flex flex-col items-center gap-2 opacity-30 ${text}`}>
          {/* MTG card back symbol approximation */}
          <svg viewBox="0 0 48 48" className="w-16 h-16" fill="currentColor">
            <circle cx="24" cy="24" r="20" fillOpacity="0.3" />
            <path d="M24 8 L32 18 H27 V30 H21 V18 H16 Z" />
            <circle cx="24" cy="36" r="3" />
          </svg>
          <span className="text-xs font-medium">
            {loading ? 'Loading…' : 'No image'}
          </span>
        </div>
        {loading && (
          <div className="absolute inset-0 rounded-md border border-white/10 animate-pulse" />
        )}
      </div>

      {/* Type line */}
      <div className={`mx-3 mt-1 px-2 py-0.5 rounded bg-black/20 ${text}`}>
        <span className="text-[10px] font-medium opacity-60 truncate block">
          {card?.type || 'Card'}
        </span>
      </div>

      {/* Text box area */}
      <div className="mx-3 mt-1 mb-2.5 rounded bg-black/15 px-2 py-1.5 flex-none" style={{ height: '22%' }}>
        {loading && (
          <div className="space-y-1.5 mt-0.5">
            <div className="h-1.5 rounded-full bg-white/10 animate-pulse w-4/5" />
            <div className="h-1.5 rounded-full bg-white/10 animate-pulse w-3/5" />
            <div className="h-1.5 rounded-full bg-white/10 animate-pulse w-2/3" />
          </div>
        )}
      </div>
    </div>
  )
}

export function FullscreenCardModal({ open, onClose, cardName, card, imageUrl, backImageUrl, loading }: FullscreenCardModalProps) {
  const [showBack, setShowBack] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (open) setShowBack(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const showPlaceholder = !imageUrl

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none"
      >
        <h2 id={titleId} className="sr-only">{cardName}</h2>

        <button
          className="pointer-events-auto absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
          onClick={onClose}
          aria-label="Close card preview"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="pointer-events-auto flex flex-col items-center gap-3">
          {showPlaceholder ? (
            <div className={loading ? 'animate-pulse-subtle' : ''}>
              <CardPlaceholder card={card} cardName={cardName} loading={loading} />
            </div>
          ) : (
            <div className="relative">
              <img
                src={imageUrl}
                alt={cardName}
                className={`max-h-[80vh] w-auto rounded-xl shadow-2xl${showBack ? ' hidden' : ''}`}
                style={{ aspectRatio: '63/88' }}
              />
              {backImageUrl && (
                <img
                  src={backImageUrl}
                  alt={`${cardName} (back face)`}
                  className={`max-h-[80vh] w-auto rounded-xl shadow-2xl${!showBack ? ' hidden' : ''}`}
                  style={{ aspectRatio: '63/88' }}
                />
              )}
            </div>
          )}

          {backImageUrl && !showPlaceholder && (
            <button
              className="px-4 py-2 rounded-full bg-black/60 text-white text-sm hover:bg-black/80 transition-colors focus:outline-none ring-2 ring-white/40"
              style={{ touchAction: 'manipulation' }}
              onClick={e => { e.stopPropagation(); setShowBack(b => !b) }}
            >
              {showBack ? '← Front' : 'Flip →'}
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
