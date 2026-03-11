interface ModeToggleProps {
  mode: 'edit' | 'view'
  onChange: (mode: 'edit' | 'view') => void
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  const isEdit = mode === 'edit'
  return (
    <button
      onClick={() => onChange(isEdit ? 'view' : 'edit')}
      className="relative flex items-center h-8 rounded-full bg-slate-700 border border-slate-600 p-0.5 shrink-0"
      title={`Switch to ${isEdit ? 'view' : 'edit'} mode`}
    >
      {/* Sliding pill — left=Edit, right=View */}
      <span
        className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-slate-100 shadow-sm transition-all duration-200 ease-in-out`}
        style={{ left: isEdit ? '2px' : 'calc(50%)' }}
      />
      {/* Edit label (left) */}
      <span className={`relative z-10 px-3 h-full flex items-center text-[11px] font-semibold tracking-wide transition-colors duration-150 ${isEdit ? 'text-slate-800' : 'text-slate-400'}`}>
        Edit
      </span>
      {/* View label (right) */}
      <span className={`relative z-10 px-3 h-full flex items-center text-[11px] font-semibold tracking-wide transition-colors duration-150 ${!isEdit ? 'text-slate-800' : 'text-slate-400'}`}>
        View
      </span>
    </button>
  )
}
