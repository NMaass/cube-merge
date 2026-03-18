import { memo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'

interface ReviewerNameBadgeProps {
  className?: string
}

export const ReviewerNameBadge = memo(function ReviewerNameBadge({ className = '' }: ReviewerNameBadgeProps) {
  const { identity, setName } = useAuth()
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  function startEditing() {
    setInput(identity.displayName === 'Reviewer' ? '' : identity.displayName)
    setEditing(true)
  }

  function handleSave(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = input.trim()
    if (trimmed) setName(trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <form className={`flex items-center gap-1 ${className}`} onSubmit={handleSave}>
        <input
          autoFocus
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
          placeholder="Your name"
          aria-label="Your display name"
          className="h-8 w-28 bg-slate-700 border border-slate-600 rounded px-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-2 py-1 text-xs text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancel name edit"
          className="px-2 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-500"
        >
          ✕
        </button>
      </form>
    )
  }

  const isDefault = identity.displayName === 'Reviewer'

  return (
    <button
      type="button"
      onClick={startEditing}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-all duration-150 active:scale-95 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 group ${
        isDefault
          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/70'
          : 'bg-slate-700/80 border-slate-500 text-slate-200 hover:border-amber-500/60 hover:text-white hover:bg-slate-600'
      } ${className}`}
      aria-label={`Posting as ${identity.displayName} — click to change name`}
    >
      <span className={`transition-colors ${isDefault ? 'text-amber-400/70' : 'text-slate-400 group-hover:text-amber-400'}`}>as</span>
      <strong className="font-medium">{identity.displayName}</strong>
      <svg
        className={`w-3 h-3 shrink-0 transition-colors ${isDefault ? 'text-amber-400/70' : 'text-amber-500/60 group-hover:text-amber-400'}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  )
})
