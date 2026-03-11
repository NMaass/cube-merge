const SYMBOL_COLORS: Record<string, string> = {
  W: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  U: 'bg-blue-200 text-blue-800 border-blue-300',
  B: 'bg-gray-700 text-gray-100 border-gray-500',
  R: 'bg-red-300 text-red-900 border-red-400',
  G: 'bg-green-300 text-green-900 border-green-400',
  C: 'bg-gray-300 text-gray-700 border-gray-400',
}

export function ManaCostPips({ manaCost }: { manaCost?: string }) {
  if (!manaCost) return null

  const symbols = manaCost.match(/\{([^}]+)\}/g) || []

  return (
    <span className="flex items-center gap-0.5 ml-1">
      {symbols.map((sym, i) => {
        const inner = sym.slice(1, -1)
        const colorClass = SYMBOL_COLORS[inner] || 'bg-gray-400 text-gray-800 border-gray-500'
        return (
          <span
            key={i}
            className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold border ${colorClass}`}
          >
            {inner}
          </span>
        )
      })}
    </span>
  )
}
