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
}

export function SectionNav({
  currentIndex, total, currentLabel,
  onPrev, onNext, onGoTo, findSection, disabled, sectionComplete,
}: SectionNavProps) {
  const [value, setValue] = useState(currentLabel)
  const [editing, setEditing] = useState(false)

  // Keep display in sync when navigating via buttons
  useEffect(() => {
    if (!editing) setValue(currentLabel)
  }, [currentLabel, editing])

  if (total === 0) return null

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value)
  }

  function handleBlur() {
    setEditing(false)
    const idx = findSection(value)
    if (idx >= 0) onGoTo(idx)
    setValue(currentLabel)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const idx = findSection(value)
      if (idx >= 0) onGoTo(idx)
      ;(e.currentTarget as HTMLInputElement).blur()
    } else if (e.key === 'Escape') {
      setValue(currentLabel)
      ;(e.currentTarget as HTMLInputElement).blur()
    }
  }

  const btnClass = `touch-target flex items-center justify-center h-8 w-8 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40
    disabled:cursor-not-allowed text-slate-200 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500`

  return (
    <div className={`flex items-center justify-center gap-1 min-w-0 ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
      <button 
        onClick={onPrev} 
        disabled={disabled || currentIndex === 0} 
        title="Previous section (P)" 
        aria-label="Previous section"
        className={btnClass}
      >
        <span aria-hidden="true">←</span>
        <span className="sr-only">Previous</span>
      </button>

      <input
        type="text"
        value={value}
        onFocus={() => setEditing(true)}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onDoubleClick={e => (e.currentTarget as HTMLInputElement).select()}
        title="Type a section (e.g. 3G, C4, Land, 6+W)"
        aria-label="Navigate to section"
        aria-describedby="section-nav-instructions"
        className={`h-8 w-16 sm:w-20 bg-slate-700 border rounded px-1.5 text-sm font-mono text-slate-200 text-center focus:outline-none focus:ring-1 focus:border-transparent ${sectionComplete ? 'border-green-500 ring-1 ring-green-500 text-green-300' : 'border-slate-600 focus:ring-amber-500 focus:border-amber-500'}`}
        spellCheck={false}
      />
      <div id="section-nav-instructions" className="sr-only">
        Type a section name like 3G, C4, Land, or 6+W to navigate directly to that section
      </div>

      <button 
        onClick={onNext} 
        disabled={disabled || currentIndex === total - 1} 
        title="Next section (N)" 
        aria-label="Next section"
        className={btnClass}
      >
        <span aria-hidden="true">→</span>
        <span className="sr-only">Next</span>
      </button>
    </div>
  )
}
