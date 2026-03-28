import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getCachedImage } from '../../lib/imageCache'

/** Renders text with [[Card Name]] patterns as hoverable card mention chips. */
export function RichText({ body, className }: { body: string; className?: string }) {
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null)
  const [hoverCard, setHoverCard] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const latestEvent = useRef<{ x: number; y: number; name: string } | null>(null)

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

  function handleCardMouseMove(e: React.MouseEvent, name: string) {
    latestEvent.current = { x: e.clientX, y: e.clientY, name }
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const { x, y, name: lName } = latestEvent.current!
      const imgW = 180
      const imgH = 252
      let left = x + 20
      let top = y - imgH / 2
      if (left + imgW > window.innerWidth - 8) left = x - imgW - 20
      if (top < 8) top = 8
      if (top + imgH > window.innerHeight - 8) top = window.innerHeight - imgH - 8
      setHoverPos({ top, left })
      setHoverCard(lName)
    })
  }

  return (
    <>
      <p className={className ?? 'text-sm text-slate-200 whitespace-pre-wrap leading-relaxed'}>
        {segments.map((seg, i) => {
          if (!seg.isCard) return <span key={i}>{seg.text}</span>
          return (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-700 text-amber-300 text-xs font-medium cursor-default hover:bg-slate-600 transition-colors"
              onMouseMove={e => handleCardMouseMove(e, seg.text)}
              onMouseLeave={() => {
                if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
                setHoverPos(null)
                setHoverCard(null)
              }}
            >
              <svg className="w-2.5 h-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="4" y="2" width="16" height="20" rx="2" strokeWidth={2} /><circle cx="12" cy="12" r="3" strokeWidth={2} /></svg>
              {seg.text}
            </span>
          )
        })}
      </p>
      {hoverPos && hoverCard && getCachedImage(hoverCard) && createPortal(
        <div
          className="hidden md:block pointer-events-none"
          style={{ position: 'fixed', top: hoverPos.top, left: hoverPos.left, zIndex: 9999 }}
        >
          <img
            src={getCachedImage(hoverCard)}
            alt={hoverCard}
            className="rounded-lg shadow-2xl border border-slate-600/50"
            style={{ width: 180 }}
          />
        </div>,
        document.body
      )}
    </>
  )
}
