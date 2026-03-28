import { useState } from 'react'
import { getCachedImage } from '../../lib/imageCache'
import { CardHoverPortal } from '../cards/CardHoverPortal'
import { FullscreenCardModal } from '../cards/FullscreenCardModal'
import { useCardHoverPreview } from '../../hooks/useCardHoverPreview'

/** Inline card mention — styled as underlined colored text.
 *  Desktop: hover shows floating card preview.
 *  Mobile: tap opens fullscreen card modal. */
function CardMention({ name, colorClass }: { name: string; colorClass: string }) {
  const { hoverPos, setPosition, close } = useCardHoverPreview()
  const [previewOpen, setPreviewOpen] = useState(false)
  const imageUrl = getCachedImage(name) ?? undefined

  return (
    <>
      <button
        type="button"
        className={`underline decoration-1 underline-offset-2 ${colorClass} hover:brightness-125 transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 focus-visible:rounded-sm`}
        onClick={() => setPreviewOpen(true)}
        onMouseMove={e => imageUrl && setPosition(e.clientX, e.clientY, false)}
        onMouseLeave={close}
        aria-label={`Preview ${name}`}
      >
        {name}
      </button>
      <CardHoverPortal hoverPos={hoverPos} imageUrl={imageUrl} cardName={name} />
      <FullscreenCardModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        cardName={name}
        imageUrl={imageUrl}
      />
    </>
  )
}

/** Renders text with [[Card Name]] patterns as interactive card mentions.
 *  @param cardColors Optional map of card name → Tailwind text color class.
 *    Falls back to text-amber-300 for unmatched cards. */
export function RichText({ body, className, cardColors }: {
  body: string
  className?: string
  cardColors?: Record<string, string>
}) {
  const segments: Array<{ text: string; isCard?: boolean }> = []
  const pattern = /\[\[([^\]]+)\]\]/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(body)) !== null) {
    if (match.index > last) segments.push({ text: body.slice(last, match.index) })
    segments.push({ text: match[1], isCard: true })
    last = match.index + match[0].length
  }
  if (last < body.length) segments.push({ text: body.slice(last) })

  return (
    <p className={className ?? 'text-sm text-slate-200 whitespace-pre-wrap leading-relaxed'}>
      {segments.map((seg, i) =>
        seg.isCard
          ? <CardMention key={i} name={seg.text} colorClass={cardColors?.[seg.text] ?? 'text-amber-300'} />
          : <span key={i}>{seg.text}</span>
      )}
    </p>
  )
}
