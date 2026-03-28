import { getCachedImage } from '../../lib/imageCache'
import { CardHoverPortal } from '../cards/CardHoverPortal'
import { useCardHoverPreview } from '../../hooks/useCardHoverPreview'
import { CubeCard } from '../../types/cube'

export function PreviewableCardRow({ card, colorClass, prefix, onPreview }: {
  card: CubeCard
  colorClass: string
  prefix: string
  onPreview: (card: CubeCard) => void
}) {
  const { hoverPos, setPosition, close } = useCardHoverPreview()
  const imageUrl = getCachedImage(card.name)

  return (
    <>
      <button
        type="button"
        className={`w-full text-left text-sm py-1 select-none ${imageUrl ? 'cursor-pointer hover:opacity-80 active:opacity-60' : 'cursor-default'} ${colorClass} focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded`}
        onMouseMove={e => imageUrl && setPosition(e.clientX, e.clientY, false)}
        onMouseLeave={close}
        onClick={() => imageUrl && onPreview(card)}
        aria-label={imageUrl ? `Preview ${card.name}` : card.name}
      >
        {prefix} {card.name}
      </button>
      <CardHoverPortal hoverPos={hoverPos} imageUrl={imageUrl ?? undefined} cardName={card.name} />
    </>
  )
}
