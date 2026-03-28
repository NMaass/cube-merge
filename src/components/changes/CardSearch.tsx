import { useState } from 'react'
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

  const matches = query.length >= 1
    ? candidates.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : []

  function select(card: CubeCard) {
    onAdd(card)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        placeholder={`Add ${label}...`}
        aria-label={`Search ${label}`}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), BLUR_DISMISS_DELAY_MS)}
        className="w-full bg-slate-700/60 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
      {open && matches.length > 0 && (
        <div role="listbox" aria-label={`${label} suggestions`} className="absolute z-50 w-full mt-0.5 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          {matches.map(card => (
            <button
              key={card.name}
              role="option"
              aria-selected={false}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
              onMouseDown={() => select(card)}
            >
              {card.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
