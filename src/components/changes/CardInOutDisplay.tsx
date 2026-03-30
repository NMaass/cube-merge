import { CubeCard } from '../../types/cube'
import { ManaCostPips } from '../cards/ManaCostPips'
import { FullscreenCardModal } from '../cards/FullscreenCardModal'
import { CardHoverPortal } from '../cards/CardHoverPortal'
import { useCardHoverPreview } from '../../hooks/useCardHoverPreview'
import { useCardPreview } from '../../hooks/useCardPreview'
import { getCachedImage } from '../../lib/imageCache'

interface CardInOutDisplayProps {
  cardsIn: CubeCard[]
  cardsOut: CubeCard[]
  type: 'add' | 'remove' | 'swap' | 'keep' | 'reject' | 'decline'
}

function CardRow({ card, symbol, nameClass, symbolClass, onPreview }: {
  card: CubeCard
  symbol: string
  nameClass: string
  symbolClass: string
  onPreview: () => void
}) {
  const { hoverPos, setPosition, close } = useCardHoverPreview()
  const imageUrl = getCachedImage(card.name) ?? undefined

  return (
    <>
      <button
        className="w-full flex items-center gap-2 px-1.5 py-1 text-left cursor-pointer hover:bg-slate-700/40 active:bg-slate-700/60 rounded-md transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
        onClick={onPreview}
        onMouseMove={e => imageUrl && setPosition(e.clientX, e.clientY, false)}
        onMouseLeave={close}
        aria-label={`Preview ${card.name}`}
      >
        <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold shrink-0 ${symbolClass}`}>
          {symbol}
        </span>
        <span className={`text-sm font-medium leading-snug truncate ${nameClass}`}>{card.name}</span>
        <ManaCostPips manaCost={card.manaCost} />
      </button>
      <CardHoverPortal hoverPos={hoverPos} imageUrl={imageUrl} cardName={card.name} />
    </>
  )
}

export function CardInOutDisplay({ cardsIn, cardsOut, type }: CardInOutDisplayProps) {
  const { setPreviewCard, previewModalProps } = useCardPreview()

  const preview = (card: CubeCard) => () => setPreviewCard(card)

  const negative = type === 'keep' || type === 'reject' || type === 'decline'

  const rows = [
    ...cardsOut.map(c => (
      <CardRow key={`out-${c.name}`} card={c}
        symbol={negative ? '↺' : '−'}
        nameClass={negative ? 'text-teal-300' : 'text-red-300'}
        symbolClass={negative ? 'bg-teal-900/60 text-teal-400' : 'bg-red-900/60 text-red-400'}
        onPreview={preview(c)}
      />
    )),
    ...cardsIn.map(c => (
      <CardRow key={`in-${c.name}`} card={c}
        symbol={negative ? '×' : '+'}
        nameClass={negative ? 'text-orange-300' : 'text-green-300'}
        symbolClass={negative ? 'bg-orange-900/60 text-orange-400' : 'bg-green-900/60 text-green-400'}
        onPreview={preview(c)}
      />
    )),
  ]

  return (
    <>
      <div className="space-y-0.5">{rows}</div>
      <FullscreenCardModal {...previewModalProps} />
    </>
  )
}
