import { getCachedImage } from '../../lib/imageCache'
import { CardHoverPortal } from '../cards/CardHoverPortal'
import { useCardHoverPreview } from '../../hooks/useCardHoverPreview'

/** Inline card mention chip with hover preview. */
function CardMention({ name }: { name: string }) {
  const { hoverPos, setPosition, close } = useCardHoverPreview()
  const imageUrl = getCachedImage(name) ?? undefined

  return (
    <>
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-700 text-amber-300 text-xs font-medium cursor-default hover:bg-slate-600 transition-colors"
        onMouseMove={e => imageUrl && setPosition(e.clientX, e.clientY, false)}
        onMouseLeave={close}
      >
        <svg className="w-2.5 h-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="4" y="2" width="16" height="20" rx="2" strokeWidth={2} /><circle cx="12" cy="12" r="3" strokeWidth={2} /></svg>
        {name}
      </span>
      <CardHoverPortal hoverPos={hoverPos} imageUrl={imageUrl} cardName={name} />
    </>
  )
}

/** Renders text with [[Card Name]] patterns as hoverable card mention chips. */
export function RichText({ body, className }: { body: string; className?: string }) {
  // Parse [[Card Name]] mentions
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
          ? <CardMention key={i} name={seg.text} />
          : <span key={i}>{seg.text}</span>
      )}
    </p>
  )
}
