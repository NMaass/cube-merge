import { useState } from 'react'
import { Session, ReviewEventType } from '../../types/firestore'
import { formatTimeRange } from '../../lib/sessions'

const EVENT_ICONS: Record<ReviewEventType, string> = {
  change_created: '+',
  change_edited: '~',
  change_deleted: '−',
}

const EVENT_COLORS: Record<ReviewEventType, string> = {
  change_created: 'text-green-400',
  change_edited: 'text-yellow-400',
  change_deleted: 'text-red-400',
}

function eventSummary(type: ReviewEventType, payload: Session['events'][number]['payload']): string {
  if (type === 'change_created' && payload.change) {
    const cardNames = [
      ...payload.change.cardsIn.map(c => c.name),
      ...payload.change.cardsOut.map(c => c.name),
    ]
    return cardNames.slice(0, 3).join(', ') + (cardNames.length > 3 ? '…' : '')
  }
  if (type === 'change_edited' && payload.after) {
    const cardNames = [
      ...payload.after.cardsIn.map(c => c.name),
      ...payload.after.cardsOut.map(c => c.name),
    ]
    return cardNames.slice(0, 3).join(', ') + (cardNames.length > 3 ? '…' : '')
  }
  if (type === 'change_deleted') {
    return 'change deleted'
  }
  return ''
}

interface SessionCardProps {
  session: Session
  checked: boolean
  onToggle: () => void
  index: number
}

export function SessionCard({ session, checked, onToggle, index }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const timeRange = formatTimeRange(session.startTime, session.endTime)
  const eventCount = session.events.length

  return (
    <div className={`bg-slate-800 border rounded-xl overflow-hidden transition-colors ${checked ? 'border-slate-600' : 'border-slate-700/50 opacity-60'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 rounded accent-blue-500 cursor-pointer shrink-0"
          aria-label={`Include session ${index + 1}`}
        />
        <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
          {session.authorName[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-200">{session.authorName}</div>
          <div className="text-xs text-slate-500">{timeRange}</div>
        </div>
        <span className="text-xs text-slate-500 bg-slate-700/60 px-2 py-0.5 rounded-full shrink-0">
          {eventCount} {eventCount === 1 ? 'event' : 'events'}
        </span>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded event list */}
      {expanded && (
        <div className="border-t border-slate-700/60 px-4 py-2 space-y-1.5">
          {session.events.map(event => (
            <div key={event.id} className="flex items-start gap-2 text-xs">
              <span className={`font-mono font-bold shrink-0 ${EVENT_COLORS[event.type]}`}>
                {EVENT_ICONS[event.type]}
              </span>
              <span className="text-slate-400 capitalize">{event.type.replace('_', ' ')}</span>
              <span className="text-slate-500 truncate min-w-0">
                {eventSummary(event.type, event.payload)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
