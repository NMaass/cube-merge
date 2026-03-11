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

  const btnClass = `h-8 px-2.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40
    disabled:cursor-not-allowed text-slate-200 text-sm transition-colors`

  return (
    <div className={`flex items-center gap-1 shrink-0 ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
      <button onClick={onPrev} disabled={disabled || currentIndex === 0} title="Previous (P)" className={btnClass}>
        ←
      </button>

      <input
        type="text"
        value={value}
        onFocus={() => setEditing(true)}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        title="Type a section (e.g. 3G, C4, Land, 6+W)"
        className="h-8 w-14 bg-slate-700 border border-slate-600 rounded px-1.5 text-sm font-mono text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        spellCheck={false}
      />

      <button onClick={onNext} disabled={disabled || currentIndex === total - 1} title="Next (N)" className={btnClass}>
        →
      </button>
    </div>
  )
}
