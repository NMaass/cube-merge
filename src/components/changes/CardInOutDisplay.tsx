import { CubeCard } from '../../types/cube'
import { ManaCostPips } from '../cards/ManaCostPips'

interface CardInOutDisplayProps {
  cardsIn: CubeCard[]
  cardsOut: CubeCard[]
  type: 'add' | 'remove' | 'swap' | 'keep' | 'reject'
}

function CardRow({ card, symbol, nameClass, symbolClass }: {
  card: CubeCard
  symbol: string
  nameClass: string
  symbolClass: string
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold shrink-0 ${symbolClass}`}>
        {symbol}
      </span>
      <span className={`text-sm font-medium leading-snug truncate ${nameClass}`}>{card.name}</span>
      <ManaCostPips manaCost={card.manaCost} />
    </div>
  )
}

export function CardInOutDisplay({ cardsIn, cardsOut, type }: CardInOutDisplayProps) {
  if (type === 'keep') {
    return (
      <div className="space-y-0.5">
        {cardsOut.map(c => (
          <CardRow key={c.name} card={c}
            symbol="↺"
            nameClass="text-cyan-300"
            symbolClass="bg-cyan-900/60 text-cyan-400"
          />
        ))}
      </div>
    )
  }

  if (type === 'reject') {
    return (
      <div className="space-y-0.5">
        {cardsIn.map(c => (
          <CardRow key={c.name} card={c}
            symbol="×"
            nameClass="text-orange-300"
            symbolClass="bg-orange-900/60 text-orange-400"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {cardsIn.map(c => (
        <CardRow key={c.name} card={c}
          symbol="+"
          nameClass="text-green-300"
          symbolClass="bg-green-900/60 text-green-400"
        />
      ))}
      {cardsOut.map(c => (
        <CardRow key={c.name} card={c}
          symbol="−"
          nameClass="text-red-300"
          symbolClass="bg-red-900/60 text-red-400"
        />
      ))}
    </div>
  )
}
