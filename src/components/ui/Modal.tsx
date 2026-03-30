import React, { useEffect, useId, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  /** Optional accent color shown as a left border on the modal panel. */
  accentColor?: string
}

export function Modal({ open, onClose, title, children, accentColor }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const prevOpenRef = useRef(false)

  // Lock body scroll while open — prevents iOS scroll-through on the backdrop
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Focus the panel only when transitioning from closed → open.
  // Kept separate from the key-handler effect so that a changing onClose
  // reference (e.g. an inline arrow function in the parent) does NOT re-run
  // this effect and steal focus away from inputs inside the modal.
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      panelRef.current?.focus()
    }
    prevOpenRef.current = open
  }, [open])

  // Key handler — allowed to re-register when onClose changes.
  // This does NOT touch focus, so it is safe to re-run.
  useEffect(() => {
    if (!open) return

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }

      // Focus trap
      if (e.key === 'Tab') {
        const panel = panelRef.current
        if (!panel) return
        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => !el.hasAttribute('disabled'))
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last?.focus() }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first?.focus() }
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[calc(100dvh-2rem)] focus:outline-none ${accentColor ? `border-l-[3px] ${accentColor}` : ''}`}
      >
        <div className="flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6 mb-4 shrink-0">
          <h2 id={titleId} className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="touch-target text-slate-400 hover:text-white transition-colors p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}
