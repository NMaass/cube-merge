import { createPortal } from 'react-dom'

interface CardHoverPortalProps {
  hoverPos: { top: number; left: number } | null
  imageUrl: string | undefined
  backImageUrl?: string
  cardName: string
  onError?: () => void
}

export function CardHoverPortal({ hoverPos, imageUrl, backImageUrl, cardName, onError }: CardHoverPortalProps) {
  if (!hoverPos || !imageUrl) return null

  return createPortal(
    <div
      className="hidden md:flex gap-2 pointer-events-none"
      style={{ position: 'fixed', top: hoverPos.top, left: hoverPos.left, zIndex: 100 }}
    >
      <img
        src={imageUrl}
        alt={cardName}
        className="rounded-lg shadow-2xl border border-slate-600/50"
        style={{ width: 360 }}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        onError={onError}
      />
      {backImageUrl && (
        <img
          src={backImageUrl}
          alt={`${cardName} (back)`}
          className="rounded-lg shadow-2xl border border-slate-600/50"
          style={{ width: 360 }}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
        />
      )}
    </div>,
    document.body
  )
}
