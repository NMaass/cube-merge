interface UnresolvedCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

export function UnresolvedCheckbox({ checked, onChange }: UnresolvedCheckboxProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded accent-yellow-500"
      />
      <span className="text-sm text-slate-300">Mark as unresolved</span>
    </label>
  )
}
