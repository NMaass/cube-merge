import { memo } from 'react'
import { ManaSymbol } from './ManaSymbol'

export const ManaCostPips = memo(function ManaCostPips({ manaCost }: { manaCost?: string }) {
  if (!manaCost) return null

  const symbols = manaCost.match(/\{([^}]+)\}/g) || []

  return (
    <span className="flex items-center gap-0.5 ml-1" role="img" aria-label={`Mana cost: ${manaCost}`}>
      {symbols.map((sym, i) => {
        const inner = sym.slice(1, -1)
        return <ManaSymbol key={i} symbol={inner} />
      })}
    </span>
  )
})
