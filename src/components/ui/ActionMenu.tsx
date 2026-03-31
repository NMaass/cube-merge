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
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
        Actions
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
