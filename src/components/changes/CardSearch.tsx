import { useState, useRef } from 'react'
import { CubeCard } from '../../types/cube'

// Delay lets the onMouseDown on dropdown items fire before onBlur hides them
const BLUR_DISMISS_DELAY_MS = 150

export function CardSearch({ label, candidates, onAdd }: {
  label: string
  candidates: CubeCard[]
  onAdd: (card: CubeCard) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)

  const matches = query.length >= 1
    ? candidates.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : []

  function select(card: CubeCard) {
    onAdd(card)
    setQuery('')
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || matches.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => (prev + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => (prev <= 0 ? matches.length - 1 : prev - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < matches.length) {
      e.preventDefault()
      select(matches[activeIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const activeId = activeIndex >= 0 ? `card-option-${activeIndex}` : undefined

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        placeholder={`Add ${label}...`}
        aria-label={`Search ${label}`}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls="card-search-listbox"
        aria-activedescendant={activeId}
        onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => { setOpen(false); setActiveIndex(-1) }, BLUR_DISMISS_DELAY_MS)}
        onKeyDown={handleKeyDown}
        className="w-full bg-slate-700/60 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
      {open && matches.length > 0 && (
        <div ref={listRef} id="card-search-listbox" role="listbox" aria-label={`${label} suggestions`} className="absolute z-50 w-full mt-0.5 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          {matches.map((card, i) => (
            <button
              key={card.name}
              id={`card-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`w-full text-left px-3 py-1.5 text-xs text-slate-200 transition-colors ${i === activeIndex ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
              onMouseDown={() => select(card)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {card.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
