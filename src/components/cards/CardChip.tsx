import { useState } from 'react'
import { CubeCard } from '../../types/cube'
import { ManaCostPips } from './ManaCostPips'
import { HoverCardPreview } from './HoverCardPreview'

type CardState = 'normal' | 'selected' | 'accepted' | 'removed'

interface CardChipProps {
  card: CubeCard
  state: CardState
  imageUrl?: string
  onClick?: () => void
}

export function CardChip({ card, state, imageUrl, onClick }: CardChipProps) {
  const [hovered, setHovered] = useState(false)

  const baseClass = 'relative inline-flex items-center px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all select-none'

  const stateClasses: Record<CardState, string> = {
    normal: 'bg-transparent border border-slate-500 text-slate-300 hover:border-slate-300 hover:text-white',
    selected: 'bg-blue-600 border border-blue-500 text-white',
    accepted: 'bg-transparent border border-green-500 text-green-300 cursor-default',
    removed: 'bg-transparent border border-red-500 text-red-300 cursor-default',
  }

  const isLocked = state === 'accepted' || state === 'removed'

  return (
    <span
      className={`${baseClass} ${stateClasses[state]}`}
      onClick={isLocked ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {card.name}
      <ManaCostPips manaCost={card.manaCost} />
      <HoverCardPreview imageUrl={imageUrl} visible={hovered} />
    </span>
  )
}
