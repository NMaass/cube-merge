import { memo } from 'react'
import type { ColorCategory } from '../../types/cube'

const SYMBOL_COLORS: Record<string, string> = {
  W: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  U: 'bg-blue-200 text-blue-800 border-blue-300',
  B: 'bg-gray-700 text-gray-100 border-gray-500',
  R: 'bg-red-300 text-red-900 border-red-400',
  G: 'bg-green-300 text-green-900 border-green-400',
  C: 'bg-gray-300 text-gray-700 border-gray-400',
  M: 'bg-amber-300 text-amber-900 border-amber-400',
  L: 'bg-orange-200 text-orange-800 border-orange-300',
}

const SYMBOL_LABELS: Record<string, string> = {
  W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green',
  C: 'Colorless', M: 'Multicolor', L: 'Land',
}

/** A single mana pip circle. */
export const ManaSymbol = memo(function ManaSymbol({
  symbol,
  size = 'sm',
}: {
  symbol: string
  size?: 'sm' | 'md'
}) {
  const colorClass = SYMBOL_COLORS[symbol] || 'bg-gray-400 text-gray-800 border-gray-500'
  const sizeClass = size === 'md' ? 'w-5 h-5 text-xs' : 'w-4 h-4 text-[10px]'
  const label = SYMBOL_LABELS[symbol] ?? symbol

  return (
    <span
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-full font-bold border shrink-0 ${sizeClass} ${colorClass}`}
    >
      {symbol}
    </span>
  )
})

/** Render multiple pips side-by-side (e.g. for a multicolor pair like "WU"). */
export const ManaSymbols = memo(function ManaSymbols({
  symbols,
  size = 'sm',
}: {
  symbols: string | ColorCategory[]
  size?: 'sm' | 'md'
}) {
  const chars = typeof symbols === 'string' ? symbols.split('') : symbols
  return (
    <span className="inline-flex items-center gap-0.5">
      {chars.map((s, i) => (
        <ManaSymbol key={i} symbol={s} size={size} />
      ))}
    </span>
  )
})
