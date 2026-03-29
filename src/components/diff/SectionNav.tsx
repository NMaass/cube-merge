import { useEffect, useState } from 'react'

interface SectionNavProps {
  currentIndex: number
  total: number
  currentLabel: string
  onPrev: () => void
  onNext: () => void
  onGoTo: (index: number) => void
  findSection: (input: string) => number
  disabled?: boolean
  sectionComplete?: boolean
  /** When set, input also acts as card search. Called on every keystroke. */
  onCardSearch?: (query: string) => void
  /** e.g. "2/5" or "0/0" — shown when the user is typing a card search */
  searchMatchInfo?: string
  /** Placeholder for the input field */
  placeholder?: string
  /** When true, visually highlights the next button to draw attention */
  hasItemsAhead?: boolean
}

export function SectionNav({
  currentIndex, total, currentLabel,
  onPrev, onNext, onGoTo, findSection, disabled, sectionComplete,
  onCardSearch, searchMatchInfo, placeholder, hasItemsAhead,
}: SectionNavProps) {
  const [value, setValue] = useState(currentLabel)
  const [editing, setEditing] = useState(false)

  // Keep display in sync when navigating via buttons
  useEffect(() => {
    if (!editing) setValue(currentLabel)
  }, [currentLabel, editing])

  if (total === 0) return null

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setValue(v)
    // If card search is enabled, try section match first, else search cards
    if (onCardSearch) {
      const idx = findSection(v)
      if (idx >= 0) {
        onCardSearch('') // clear card search when navigating to a section
      } else {
        onCardSearch(v)
      }
    }
  }

  function handleBlur() {
    setEditing(false)
    const idx = findSection(value)
    if (idx >= 0) {
      onGoTo(idx)
      onCardSearch?.('')
    }
    setValue(currentLabel)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const idx = findSection(value)
      if (idx >= 0) {
        onGoTo(idx)
        onCardSearch?.('')
        ;(e.currentTarget as HTMLInputElement).blur()
      } else if (onCardSearch) {
        // Enter advances to next search match — handled by onNext
        onNext()
      }
    } else if (e.key === 'Escape') {
      setValue(currentLabel)
      onCardSearch?.('')
      ;(e.currentTarget as HTMLInputElement).blur()
    }
  }

  const isSearching = editing && onCardSearch && findSection(value) < 0 && value.trim().length > 0

  const btnClass = `touch-target flex items-center justify-center h-8 w-8 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50
    disabled:cursor-not-allowed text-slate-200 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500`

  return (
    <div className={`flex items-center justify-center gap-1 min-w-0 ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
      <button
        onClick={onPrev}
        disabled={disabled || currentIndex === 0}
        title={isSearching ? 'Previous match' : 'Previous section (P)'}
        aria-label={isSearching ? 'Previous match' : 'Previous section'}
        className={btnClass}
      >
        <span aria-hidden="true">←</span>
        <span className="sr-only">Previous</span>
      </button>

      <input
        type="text"
        role={isSearching ? 'searchbox' : undefined}
        value={value}
        onFocus={() => setEditing(true)}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onDoubleClick={e => (e.currentTarget as HTMLInputElement).select()}
        title={placeholder ?? "Type a section (e.g. 3G, C4, Land, 6+W)"}
        aria-label={isSearching ? 'Search cards' : 'Navigate to section'}
        aria-describedby="section-nav-instructions"
        placeholder={editing ? (placeholder ?? '') : undefined}
        className={`h-8 ${isSearching ? 'flex-1 min-w-0' : 'w-16 sm:w-20'} bg-slate-700 border rounded px-1.5 text-sm font-mono text-slate-200 text-center transition-all focus:outline-none focus:ring-1 focus:border-transparent ${sectionComplete ? 'border-green-500 ring-1 ring-green-500 text-green-300' : 'border-slate-600 focus:ring-amber-500 focus:border-amber-500'}`}
        spellCheck={false}
      />
      <div id="section-nav-instructions" className="sr-only">
        Type a section name like 3G, C4, Land, or 6+W to navigate directly to that section
      </div>

      {isSearching && searchMatchInfo && (
        <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap shrink-0">
          {searchMatchInfo}
        </span>
      )}

      <button
        onClick={onNext}
        disabled={disabled || currentIndex === total - 1}
        title={isSearching ? 'Next match' : 'Next section (N)'}
        aria-label={isSearching ? 'Next match' : 'Next section'}
        className={`${btnClass} relative`}
      >
        <span aria-hidden="true">→</span>
        <span className="sr-only">Next</span>
        {hasItemsAhead && !isSearching && !(disabled || currentIndex === total - 1) && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
        )}
      </button>
    </div>
  )
}
