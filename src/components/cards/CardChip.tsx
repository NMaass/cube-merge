import { CubeCard } from '../../types/cube'
import { ManaCostPips } from './ManaCostPips'
import { CardHoverPortal } from './CardHoverPortal'
import { useCardHoverPreview } from '../../hooks/useCardHoverPreview'

type CardState = 'normal' | 'selected' | 'accepted' | 'removed'

interface CardChipProps {
  card: CubeCard
  state: CardState
  imageUrl?: string
  onClick?: () => void
}

export function CardChip({ card, state, imageUrl, onClick }: CardChipProps) {
  const { hoverPos, setPosition, close } = useCardHoverPreview()

  const baseClass = 'inline-flex items-center px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all select-none'

  const stateClasses: Record<CardState, string> = {
    normal: 'bg-transparent border border-slate-500 text-slate-300 hover:border-slate-300 hover:text-white',
    selected: 'bg-amber-500 border border-amber-400 text-slate-900',
    accepted: 'bg-transparent border border-green-500 text-green-300 cursor-default',
    removed: 'bg-transparent border border-red-500 text-red-300 cursor-default',
  }

  const isLocked = state === 'accepted' || state === 'removed'

  return (
    <>
      <button
        type="button"
        className={`${baseClass} ${stateClasses[state]}`}
        onClick={isLocked ? undefined : onClick}
        onMouseMove={e => imageUrl && setPosition(e.clientX, e.clientY, false)}
        onMouseLeave={close}
        disabled={isLocked}
        aria-label={onClick ? `Select ${card.name}` : card.name}
      >
        {card.name}
        <ManaCostPips manaCost={card.manaCost} />
      </button>

      <CardHoverPortal
        hoverPos={hoverPos}
        imageUrl={imageUrl}
        cardName={card.name}
      />
    </>
  )
}
