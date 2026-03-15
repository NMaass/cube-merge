import { createPortal } from 'react-dom'
import { Suggestion, CaretAnchor } from '../../hooks/useAutocomplete'

interface SuggestionMenuProps {
  suggestions: Suggestion[]
  anchor: CaretAnchor | null
  onSelect: (s: Suggestion) => void
}

const MENU_WIDTH = 220
const MIN_HEIGHT = 80

export function SuggestionMenu({ suggestions, anchor, onSelect }: SuggestionMenuProps) {
  if (!anchor || suggestions.length === 0) return null
  const vh = window.visualViewport?.height ?? window.innerHeight
  const vw = window.visualViewport?.width ?? window.innerWidth
  const caretBottom = anchor.top + anchor.lineHeight
  const left = Math.max(4, Math.min(anchor.left, vw - MENU_WIDTH - 4))
  const spaceBelow = vh - caretBottom - 8
  const flipAbove = spaceBelow < MIN_HEIGHT && anchor.top - 8 > spaceBelow
  const posStyle = flipAbove
    ? { bottom: vh - anchor.top + 4, maxHeight: Math.min(192, anchor.top - 8) }
    : { top: caretBottom + 4, maxHeight: Math.min(192, spaceBelow) }
  return createPortal(
    <div
      role="listbox"
      aria-label="Suggestions"
      style={{
        position: 'fixed',
        ...posStyle,
        left,
        width: MENU_WIDTH,
        zIndex: 9999,
      }}
      className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-y-auto"
    >
      {suggestions.map((s, i) => (
        <button
          key={i}
          role="option"
          aria-selected={false}
          className="w-full text-left px-3 py-2.5 sm:py-1.5 text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2 transition-colors"
          onMouseDown={e => { e.preventDefault(); onSelect(s) }}
        >
          {s.kind === 'card' ? (
            <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7l9-4 9 4M3 7v10l9 4 9-4V7" />
            </svg>
          ) : (
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
