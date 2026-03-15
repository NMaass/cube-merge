import { Timestamp } from 'firebase/firestore'
import { ReviewEvent, Session, LiveChange } from '../types/firestore'

const SESSION_GAP_MS = 30 * 60 * 1000

/**
 * Groups a chronologically sorted list of events into sessions.
 * A new session starts when the author changes or there's a gap > 30 minutes.
 */
export function groupIntoSessions(events: ReviewEvent[]): Session[] {
  if (events.length === 0) return []

  const sorted = [...events].sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())
  const sessions: Session[] = []

  let current: Session | null = null

  for (const event of sorted) {
    const ms = event.createdAt.toMillis()
    const isGap = current && ms - current.endTime.toMillis() > SESSION_GAP_MS

    if (!current || isGap || current.authorId !== event.authorId) {
      current = {
        key: `${event.authorId}-${ms}`,
        authorId: event.authorId,
        authorName: event.authorName,
        startTime: event.createdAt,
        endTime: event.createdAt,
        events: [event],
      }
      sessions.push(current)
    } else {
      current.events.push(event)
      current.endTime = event.createdAt
    }
  }

  return sessions
}

/**
 * Replays events from the included sessions (in chronological order)
 * to compute the resulting set of LiveChanges for a branch.
 */
export function computeBranchChanges(
  events: ReviewEvent[],
  includedSessionKeys: Set<string>,
  sessions: Session[]
): LiveChange[] {
  // Build event → session key map
  const eventToSession = new Map<string, string>()
  for (const session of sessions) {
    for (const event of session.events) {
      eventToSession.set(event.id, session.key)
    }
  }

  const changeMap = new Map<string, LiveChange>()
  const sorted = [...events].sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())

  for (const event of sorted) {
    const sessionKey = eventToSession.get(event.id)
    if (!sessionKey || !includedSessionKeys.has(sessionKey)) continue

    if (event.type === 'change_created' && event.payload.change) {
      changeMap.set(event.changeId, event.payload.change)
    } else if (event.type === 'change_edited' && event.payload.after) {
      if (changeMap.has(event.changeId)) {
        changeMap.set(event.changeId, event.payload.after)
      }
    } else if (event.type === 'change_deleted') {
      changeMap.delete(event.changeId)
    }
  }

  return Array.from(changeMap.values())
}

export function formatTimeRange(start: Timestamp, end: Timestamp): string {
  const startDate = start.toDate()
  const endDate = end.toDate()
  const dateStr = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const startTime = startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const endTime = endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (startTime === endTime) return `${dateStr} · ${startTime}`
  return `${dateStr} · ${startTime}–${endTime}`
}
