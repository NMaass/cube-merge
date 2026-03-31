import { useEffect, useRef, useState } from 'react'

export interface ActionMenuItem {
  label: string
  icon: React.ReactNode
  onClick: () => void
  destructive?: boolean
  separated?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
}

export function ActionMenu({ items }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey, true)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-slate-500"
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="4" cy="10" r="2" />
          <circle cx="10" cy="10" r="2" />
          <circle cx="16" cy="10" r="2" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-1 w-52 py-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50"
        >
          {items.map((item, i) => (
            <div key={i}>
              {item.separated && <div className="my-1 border-t border-slate-700/60" />}
              <button
                role="menuitem"
                onClick={() => { setOpen(false); item.onClick() }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  item.destructive
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-slate-300 hover:bg-slate-700/80'
                }`}
              >
                <span className="w-4 h-4 shrink-0">{item.icon}</span>
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
