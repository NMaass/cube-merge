interface ModeToggleProps {
  mode: 'edit' | 'view'
  onChange: (mode: 'edit' | 'view') => void
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  const isEdit = mode === 'edit'
  return (
    <button
      onClick={() => onChange(isEdit ? 'view' : 'edit')}
      className="relative flex items-center h-auto min-h-[44px] sm:h-8 sm:min-h-0 rounded-full bg-slate-700 border border-slate-600 p-0.5 shrink-0"
      title={`Switch to ${isEdit ? 'view' : 'edit'} mode`}
      aria-label={`${isEdit ? 'Edit' : 'View'} mode — click to switch`}
      aria-pressed={isEdit}
    >
      {/* Sliding pill — left=Edit, right=View */}
      <span
        className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-slate-100 shadow-sm transition-all duration-200 ease-in-out`}
        style={{ left: isEdit ? '2px' : 'calc(50%)' }}
      />
      {/* Edit label (left) */}
      <span className={`relative z-10 px-2 sm:px-3 h-full flex items-center gap-1 text-[11px] font-semibold tracking-wide transition-colors duration-150 ${isEdit ? 'text-slate-800' : 'text-slate-400'}`}>
        {/* Pencil icon */}
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span className="hidden sm:inline">Edit</span>
      </span>
      {/* View label (right) */}
      <span className={`relative z-10 px-2 sm:px-3 h-full flex items-center gap-1 text-[11px] font-semibold tracking-wide transition-colors duration-150 ${!isEdit ? 'text-slate-800' : 'text-slate-400'}`}>
        {/* Eye icon */}
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span className="hidden sm:inline">View</span>
      </span>
    </button>
  )
}
