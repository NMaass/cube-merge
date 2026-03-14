import { useState } from 'react'
import { Session, ReviewEventType } from '../../types/firestore'
import { CubeCard } from '../../types/cube'
import { getCachedImage } from '../../lib/imageCache'
import { FullscreenCardModal } from '../cards/FullscreenCardModal'
import { CardHoverPortal } from '../cards/CardHoverPortal'
import { useCardHoverPreview } from '../../hooks/useCardHoverPreview'

const EVENT_LABELS: Record<ReviewEventType, string> = {
  change_created: 'Added',
  change_edited: 'Edited',
  change_deleted: 'Deleted',
}

const EVENT_COLORS: Record<ReviewEventType, string> = {
  change_created: 'text-green-400',
  change_edited: 'text-yellow-400',
  change_deleted: 'text-red-400',
}

function CardChip({ card, onPreview }: { card: CubeCard | { name: string }; onPreview: (name: string) => void }) {
  const { hoverPos, setPosition, close } = useCardHoverPreview()
  const imageUrl = getCachedImage(card.name) ?? undefined

  return (
    <>
      <button
        type="button"
        onClick={() => imageUrl && onPreview(card.name)}
        onMouseMove={e => imageUrl && setPosition(e.clientX, e.clientY, false)}
        onMouseLeave={close}
        className={`text-xs text-slate-300 ${imageUrl ? 'cursor-pointer hover:text-white underline decoration-slate-600 hover:decoration-slate-400 active:opacity-70' : 'cursor-default'}`}
        aria-label={imageUrl ? `Preview ${card.name}` : card.name}
      >
        {card.name}
      </button>

      <CardHoverPortal
        hoverPos={hoverPos}
        imageUrl={imageUrl}
        cardName={card.name}
      />
    </>
  )
}

function eventCards(type: ReviewEventType, payload: Session['events'][number]['payload']): Array<CubeCard | { name: string }> {
  if (type === 'change_deleted') return []
  const change = type === 'change_created' ? payload.change : payload.after
  if (!change) return []
  return [...change.cardsIn, ...change.cardsOut]
}

interface SessionCardProps {
  session: Session
  checked: boolean
  onToggle: () => void
  index: number
}

export function SessionCard({ session, checked, onToggle, index }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [previewName, setPreviewName] = useState<string | null>(null)
  const dateLabel = session.startTime.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const eventCount = session.events.length

  const previewImageUrl = previewName ? getCachedImage(previewName) ?? undefined : undefined

  return (
    <div className={`bg-slate-800 border rounded-xl overflow-hidden transition-colors ${checked ? 'border-slate-600' : 'border-slate-700/50 opacity-60'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
          aria-label={`Include session ${index + 1}`}
        />
        <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
          {session.authorName[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-200 truncate">{session.authorName}</div>
          <div className="text-xs text-slate-500">{dateLabel}</div>
        </div>
        <span className="text-xs text-slate-500 bg-slate-700/60 px-2 py-0.5 rounded-full shrink-0 hidden xs:inline">
          {eventCount} {eventCount === 1 ? 'event' : 'events'}
        </span>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition-colors shrink-0 p-2 rounded-lg min-h-[44px] sm:min-h-0 flex items-center"
          aria-label={expanded ? 'Collapse session' : `Expand session — ${eventCount} ${eventCount === 1 ? 'event' : 'events'}`}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded event list */}
      {expanded && (
        <div className="border-t border-slate-700/60 divide-y divide-slate-700/40 animate-expand-in">
          {session.events.map(event => {
            const cards = eventCards(event.type, event.payload)
            return (
              <div key={event.id} className="px-4 py-2.5 space-y-1.5">
                <span className={`text-xs font-semibold ${EVENT_COLORS[event.type]}`}>
                  {EVENT_LABELS[event.type]}
                </span>
                {event.type === 'change_deleted' && (
                  <span className="text-xs text-slate-500 italic ml-2">change removed</span>
                )}
                {cards.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {cards.map((card, i) => (
                      <span key={card.name} className="text-xs">
                        <CardChip card={card} onPreview={setPreviewName} />
                        {i < cards.length - 1 && <span className="text-slate-600 ml-1">,</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <FullscreenCardModal
        open={!!previewName}
        onClose={() => setPreviewName(null)}
        cardName={previewName ?? ''}
        imageUrl={previewImageUrl}
      />
    </div>
  )
}
