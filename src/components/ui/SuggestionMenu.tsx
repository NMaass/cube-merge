import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useFloating, autoUpdate, flip, shift, offset, size } from '@floating-ui/react'
import { Suggestion, CaretAnchor } from '../../hooks/useAutocomplete'

interface SuggestionMenuProps {
  suggestions: Suggestion[]
  activeIndex?: number
  menuId?: string
  anchor: CaretAnchor | null
  onSelect: (s: Suggestion) => void
}

const MENU_WIDTH = 220

function useIsMobile() {
  // Treat narrow viewports as mobile (virtual keyboard likely present)
  return typeof window !== 'undefined' && window.innerWidth < 768
}

export function SuggestionMenu({ suggestions, activeIndex = -1, menuId, anchor, onSelect }: SuggestionMenuProps) {
  const isOpen = !!anchor && suggestions.length > 0
  const isMobile = useIsMobile()

  // Virtual reference element positioned at the caret
  const virtualRef = useRef<{ getBoundingClientRect: () => DOMRect }>({
    getBoundingClientRect: () => new DOMRect(),
  })

  // Update virtual ref when anchor changes
  useEffect(() => {
    virtualRef.current = {
      getBoundingClientRect: () => {
        if (!anchor) return new DOMRect()
        return new DOMRect(anchor.left, anchor.top, 0, anchor.lineHeight)
      },
    }
  }, [anchor])

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement: isMobile ? 'top-start' : 'bottom-start',
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.min(192, Math.max(80, availableHeight))}px`
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  })

  // Sync virtual ref to floating-ui's reference
  useEffect(() => {
    refs.setReference(virtualRef.current as unknown as HTMLElement)
  }, [refs, anchor])

  // Scroll active item into view when navigating with keyboard
  useEffect(() => {
    if (activeIndex >= 0 && menuId) {
      document.getElementById(`${menuId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, menuId])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={refs.setFloating}
      id={menuId}
      role="listbox"
      aria-label="Suggestions"
      style={{
        ...floatingStyles,
        width: MENU_WIDTH,
        zIndex: 95,
      }}
      className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-y-auto"
    >
      {suggestions.map((s, i) => (
        <button
          key={i}
          id={menuId ? `${menuId}-${i}` : undefined}
          role="option"
          aria-selected={i === activeIndex}
          className={`w-full text-left px-3 py-2.5 sm:py-1.5 text-xs text-slate-200 hover:bg-slate-700/70 flex items-center gap-2 transition-colors ${i === activeIndex ? 'bg-amber-500/15 text-amber-200' : ''}`}
          onMouseDown={e => { e.preventDefault(); onSelect(s) }}
        >
          {s.kind === 'reviewer' && (
            <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
          <span className="truncate">{s.value}</span>
        </button>
      ))}
    </div>,
    document.body
  )
}
