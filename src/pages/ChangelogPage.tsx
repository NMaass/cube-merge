import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from '../lib/router'
import { Helmet } from 'react-helmet-async'
import {
  doc, collection, getDoc, getDocs, setDoc, writeBatch,
  orderBy, query, Timestamp,
} from 'firebase/firestore/lite'
import { nanoid } from 'nanoid'
import { db } from '../lib/firebase-lite'
import { getCachedReview, setCachedReview } from '../lib/reviewCache'
import { Spinner } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { SessionCard } from '../components/changelog/SessionCard'
import { groupIntoSessions, computeBranchChanges } from '../lib/sessions'
import { Review, ReviewEvent, Session, LiveChange } from '../types/firestore'

function cleanForFirestore(obj: unknown): unknown {
  if (obj instanceof Timestamp) return obj
  if (obj === undefined || obj === null) return null
  if (Array.isArray(obj)) return obj.map(cleanForFirestore)
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v !== undefined) result[k] = cleanForFirestore(v)
    }
    return result
  }
  return obj
}

export default function ChangelogPage() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const navigate = useNavigate()
  const cached = reviewId ? getCachedReview(reviewId) : undefined
  const [review, setReview] = useState<Review | null>(cached ?? null)
  const [events, setEvents] = useState<ReviewEvent[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [branching, setBranching] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [branchError, setBranchError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!reviewId || fetchedRef.current) return
    fetchedRef.current = true

    async function load() {
      try {
        setLoadError(null)
        const [reviewSnap, eventsSnap] = await Promise.all([
          cached ? Promise.resolve(null) : getDoc(doc(db, 'reviews', reviewId!)),
          getDocs(query(
            collection(db, 'reviews', reviewId!, 'events'),
            orderBy('createdAt', 'asc')
          )),
        ])

        let reviewData: Review
        if (cached) {
          reviewData = cached
        } else if (reviewSnap && reviewSnap.exists()) {
          reviewData = { id: reviewSnap.id, ...reviewSnap.data() } as Review
          setCachedReview(reviewId!, reviewData)
        } else {
          setNotFound(true)
          setLoading(false)
          return
        }

        const eventsData = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ReviewEvent))
        const grouped = groupIntoSessions(eventsData)

        setReview(reviewData)
        setEvents(eventsData)
        setSessions(grouped)
        setSelectedSessions(new Set(grouped.map(s => s.key)))
      } catch (e) {
        console.error('Failed to load changelog:', e)
        setLoadError('The changelog could not be loaded right now. Please retry in a moment.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [reviewId])

  function toggleSession(key: string) {
    setSelectedSessions(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleCreateBranch() {
    if (!review || !reviewId) return
    setBranching(true)
    setBranchError(null)
    try {
      const branchChanges = computeBranchChanges(events, selectedSessions, sessions)
      const newReviewId = nanoid(10)
      const now = Timestamp.now()

      // Create the new review doc
      await setDoc(doc(db, 'reviews', newReviewId), cleanForFirestore({
        id: newReviewId,
        cubeAId: review.cubeAId,
        cubeBId: review.cubeBId,
        title: review.title,
        rawData: review.rawData,
        createdAt: now,
        parentReviewId: reviewId,
      }) as object)

      if (branchChanges.length > 0) {
        const batch = writeBatch(db)
        for (const change of branchChanges) {
          // Strip soft-delete fields — fresh start on branch
          const {
            deletedAt: _da, deletedBy: _db, deletedByName: _dbn,
            updatedAt: _ua, updatedBy: _ub, updatedByName: _ubn,
            ...cleanChange
          } = change
          const freshChange: LiveChange = {
            ...cleanChange,
            id: change.id,
            comments: [], // branches start with no comments
          }
          batch.set(
            doc(db, 'reviews', newReviewId, 'changes', freshChange.id),
            cleanForFirestore(freshChange) as object
          )
          batch.set(doc(collection(db, 'reviews', newReviewId, 'events')), {
            type: 'change_created',
            changeId: freshChange.id,
            authorId: 'branch',
            authorName: 'Branch',
            createdAt: now,
            payload: { change: cleanForFirestore(freshChange) },
          })
        }
        await batch.commit()
      }

      navigate(`/c/${newReviewId}`)
    } catch (e) {
      console.error('Failed to create branch:', e)
      setBranchError('The branch could not be created. Your selected sessions are still intact, so you can try again.')
      setBranching(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <span className="text-slate-500 text-sm">Loading changelog…</span>
        </div>
      </div>
    )
  }

  if (notFound || !review) {
    if (loadError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <Notice
              tone="error"
              title="Couldn&apos;t load changelog"
              action={(
                <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              )}
            >
              {loadError}
            </Notice>
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-slate-300 font-medium">Review not found</p>
          <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm">← Start a new review</Link>
        </div>
      </div>
    )
  }

  const allSelected = sessions.length > 0 && selectedSessions.size === sessions.length
  const noneSelected = selectedSessions.size === 0

  return (
    <>
      <Helmet>
        <title>Changelog — Cube Merge</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-slate-900 flex flex-col">
        {/* Header */}
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700">
          <Link
            to={`/c/${reviewId}`}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Back to review"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white">Changelog</h1>
            <p className="text-xs text-slate-500 truncate">{review.cubeAId} vs {review.cubeBId}</p>
          </div>
        </header>

        {/* Content */}
        <main id="main-content" className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-4">
          {branchError ? (
            <Notice
              tone="error"
              title="Branch creation failed"
              action={(
                <Button size="sm" variant="secondary" onClick={() => setBranchError(null)}>
                  Dismiss
                </Button>
              )}
            >
              {branchError}
            </Notice>
          ) : null}
          {sessions.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-3xl mb-3 opacity-30">◎</div>
              <p className="text-slate-400 font-medium">No events yet</p>
              <p className="text-sm text-slate-600 mt-1">Changes will appear here as they're made</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                  {' · '}
                  {events.length} event{events.length !== 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedSessions(new Set(sessions.map(s => s.key)))}
                    disabled={allSelected}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-default transition-colors"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setSelectedSessions(new Set())}
                    disabled={noneSelected}
                    className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40 disabled:cursor-default transition-colors"
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              {sessions.map((session, i) => (
                <SessionCard
                  key={session.key}
                  session={session}
                  checked={selectedSessions.has(session.key)}
                  onToggle={() => toggleSession(session.key)}
                  index={i}
                />
              ))}

              <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {selectedSessions.size} of {sessions.length} sessions selected
                </p>
                <Button
                  onClick={handleCreateBranch}
                  disabled={noneSelected || branching}
                  size="sm"
                  variant="primary"
                >
                  {branching ? 'Creating…' : 'Create Branch'}
                </Button>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}
