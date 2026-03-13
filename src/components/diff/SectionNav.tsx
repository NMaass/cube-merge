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
}

export function SectionNav({
  currentIndex, total, currentLabel,
  onPrev, onNext, onGoTo, findSection, disabled,
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

  const btnClass = `h-auto min-h-[44px] sm:h-8 sm:min-h-0 px-2.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40
    disabled:cursor-not-allowed text-slate-200 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`

  return (
    <div className={`flex items-center gap-1 shrink-0 ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
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
        title="Type a section (e.g. 3G, C4, Land, 6+W)"
        aria-label="Navigate to section"
        aria-describedby="section-nav-instructions"
        className="h-auto min-h-[44px] sm:h-8 sm:min-h-0 w-16 sm:w-20 bg-slate-700 border border-slate-600 rounded px-1.5 text-sm font-mono text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
