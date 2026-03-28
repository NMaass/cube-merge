import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface FullscreenCardModalProps {
  open: boolean
  onClose: () => void
  cardName: string
  imageUrl?: string
  backImageUrl?: string
  loading?: boolean
}

export function FullscreenCardModal({ open, onClose, cardName, imageUrl, backImageUrl, loading }: FullscreenCardModalProps) {
  const [showBack, setShowBack] = useState(false)
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) setShowBack(false)
  }, [open])

  // Focus trap + Escape + restore focus on close
  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement | null
    // Focus first focusable element in dialog
    requestAnimationFrame(() => {
      const el = dialogRef.current
      if (!el) return
      const focusable = el.querySelector<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')
      focusable?.focus()
    })

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const el = dialogRef.current
      if (!el) return
      const focusables = el.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      previousFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const showPlaceholder = !imageUrl

  return createPortal(
    <>
      <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none"
      >
        <h2 id={titleId} className="sr-only">{cardName}</h2>

        <button
          className="pointer-events-auto absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          onClick={onClose}
          aria-label="Close card preview"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="pointer-events-auto flex flex-col items-center gap-3">
          {showPlaceholder ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              {loading ? (
                <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <span className="text-sm">No image available</span>
              )}
              <span className="text-sm font-medium text-slate-300">{cardName}</span>
            </div>
          ) : (
            <div className="relative">
              <img
                src={imageUrl}
                alt={cardName}
                className={`max-h-[80vh] w-auto rounded-xl shadow-2xl${showBack ? ' hidden' : ''}`}
                style={{ aspectRatio: '63/88' }}
                loading="eager"
                decoding="async"
              />
              {backImageUrl && (
                <img
                  src={backImageUrl}
                  alt={`${cardName} (back face)`}
                  className={`max-h-[80vh] w-auto rounded-xl shadow-2xl${!showBack ? ' hidden' : ''}`}
                  style={{ aspectRatio: '63/88' }}
                  loading="lazy"
                  decoding="async"
                />
              )}
            </div>
          )}

          {backImageUrl && !showPlaceholder && (
            <button
              className="px-4 py-2 rounded-full bg-black/60 text-white text-sm hover:bg-black/80 active:bg-black/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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
