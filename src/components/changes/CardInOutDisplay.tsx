import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CubeCard } from '../../types/cube'
import { ManaCostPips } from '../cards/ManaCostPips'
import { FullscreenCardModal } from '../cards/FullscreenCardModal'
import { getCachedImage } from '../../lib/imageCache'

interface CardInOutDisplayProps {
  cardsIn: CubeCard[]
  cardsOut: CubeCard[]
  type: 'add' | 'remove' | 'swap' | 'keep' | 'reject'
}

function CardRow({ card, symbol, nameClass, symbolClass, onPreview }: {
  card: CubeCard
  symbol: string
  nameClass: string
  symbolClass: string
  onPreview: () => void
}) {
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null)
  const imageUrl = getCachedImage(card.name)

  function handleMouseMove(e: React.MouseEvent) {
    if (!imageUrl) return
    const imgW = 180, imgH = 252
    let left = e.clientX + 20
    let top = e.clientY - imgH / 2
    if (left + imgW > window.innerWidth - 8) left = e.clientX - imgW - 20
    if (top < 8) top = 8
    if (top + imgH > window.innerHeight - 8) top = window.innerHeight - imgH - 8
    setHoverPos({ top, left })
  }

  return (
    <>
      <button
        className={`w-full flex items-center gap-2 px-1.5 py-1 text-left cursor-pointer hover:bg-slate-700/40 active:bg-slate-700/60 rounded-md transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500`}
        onClick={onPreview}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverPos(null)}
        aria-label={`Preview ${card.name}`}
      >
        <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold shrink-0 ${symbolClass}`}>
          {symbol}
        </span>
        <span className={`text-sm font-medium leading-snug truncate ${nameClass}`}>{card.name}</span>
        <ManaCostPips manaCost={card.manaCost} />
      </button>
      {hoverPos && imageUrl && createPortal(
        <div
          className="hidden md:block pointer-events-none"
          style={{ position: 'fixed', top: hoverPos.top, left: hoverPos.left, zIndex: 9999 }}
        >
          <img
            src={imageUrl}
            alt={card.name}
            className="rounded-lg shadow-2xl border border-slate-600/50"
            style={{ width: 180 }}
          />
        </div>,
        document.body
      )}
    </>
  )
}

export function CardInOutDisplay({ cardsIn, cardsOut, type }: CardInOutDisplayProps) {
  const [previewCard, setPreviewCard] = useState<CubeCard | null>(null)

  const preview = (card: CubeCard) => () => setPreviewCard(card)

  const rows = type === 'keep'
    ? cardsOut.map(c => (
        <CardRow key={c.name} card={c}
          symbol="↺" nameClass="text-teal-300" symbolClass="bg-teal-900/60 text-teal-400"
          onPreview={preview(c)}
        />
      ))
    : type === 'reject'
    ? cardsIn.map(c => (
        <CardRow key={c.name} card={c}
          symbol="×" nameClass="text-orange-300" symbolClass="bg-orange-900/60 text-orange-400"
          onPreview={preview(c)}
        />
      ))
    : [
        ...cardsIn.map(c => (
          <CardRow key={`in-${c.name}`} card={c}
            symbol="+" nameClass="text-green-300" symbolClass="bg-green-900/60 text-green-400"
            onPreview={preview(c)}
          />
        )),
        ...cardsOut.map(c => (
          <CardRow key={`out-${c.name}`} card={c}
            symbol="−" nameClass="text-red-300" symbolClass="bg-red-900/60 text-red-400"
            onPreview={preview(c)}
          />
        )),
      ]

  return (
    <>
      <div className="space-y-0.5">{rows}</div>
      <FullscreenCardModal
        open={!!previewCard}
        onClose={() => setPreviewCard(null)}
        cardName={previewCard?.name ?? ''}
        imageUrl={previewCard ? getCachedImage(previewCard.name) ?? undefined : undefined}
      />
    </>
  )
}
