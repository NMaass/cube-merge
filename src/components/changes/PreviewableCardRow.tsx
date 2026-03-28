import { useState } from 'react'
import { createPortal } from 'react-dom'
import { getCachedImage } from '../../lib/imageCache'
import { CubeCard } from '../../types/cube'

export function PreviewableCardRow({ card, colorClass, prefix, onPreview }: {
  card: CubeCard
  colorClass: string
  prefix: string
  onPreview: (card: CubeCard) => void
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
        type="button"
        className={`w-full text-left text-sm py-1 select-none ${imageUrl ? 'cursor-pointer hover:opacity-80 active:opacity-60' : 'cursor-default'} ${colorClass} focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverPos(null)}
        onClick={() => imageUrl && onPreview(card)}
        aria-label={imageUrl ? `Preview ${card.name}` : card.name}
      >
        {prefix} {card.name}
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
