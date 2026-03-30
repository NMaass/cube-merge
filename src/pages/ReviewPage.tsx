import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from '../lib/router'
import { getCachedReview, setCachedReview } from '../lib/reviewCache'
import { Helmet } from 'react-helmet-async'
import {
  doc, collection, getDoc, setDoc, updateDoc, onSnapshot,
  Timestamp, writeBatch, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { nanoid } from 'nanoid'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { EditModeProvider, useEditMode } from '../context/EditModeContext'
import { Spinner } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { SectionNav } from '../components/diff/SectionNav'
import { DiffList } from '../components/diff/DiffList'
import { ModeToggle } from '../components/diff/ModeToggle'
import { UnifiedChangeModal, ChangeData } from '../components/changes/UnifiedChangeModal'
import { PassModal } from '../components/diff/PassModal'
import { SplitChangeModal } from '../components/changes/SplitChangeModal'
import { ChangeCard } from '../components/changes/ChangeCard'
import { SwipeableCard } from '../components/changes/SwipeableCard'
import { useCardImages } from '../hooks/useCardImages'
import { useSectionNav } from '../hooks/useSectionNav'
import { groupBySection, sectionLabel, parseSectionNotation, COLOR_ORDER, COLOR_NAMES, COLOR_BG } from '../lib/sorting'
import { ColorCategory } from '../types/cube'
import { computeChangeType } from '../lib/changes'
import { recordCubeCards } from '../lib/cubeCards'
import { CubeCard } from '../types/cube'
import {
  LiveChange, Review, Comment, ChangeType, CommentResolution,
} from '../types/firestore'
import { Modal } from '../components/ui/Modal'

const COPY_FEEDBACK_DURATION_MS = 2000

// ── Type filter tabs for view mode ───────────────────────────────────────────

const TYPE_ORDER: ChangeType[] = ['swap', 'add', 'remove', 'decline', 'keep', 'reject']
const TYPE_LABELS: Record<ChangeType, string> = {
  swap: 'Swaps', add: 'Adds', remove: 'Removes', decline: 'Declines', keep: 'Keeps', reject: 'Rejects',
}
// ── View mode panel ──────────────────────────────────────────────────────────

function ViewModePanel({
  changes, identity, reviewId,
  highlightedChangeId,
  approvedSectionOpen, setApprovedSectionOpen,
  onApprove, onUnapprove,
  onAddComment, onSetCommentResolution, onEditComment, onEdit,
  allDiffCards, reviewerNames,
  onOpenColorBreakdown,
}: {
  changes: LiveChange[]
  identity: { id: string; displayName: string }
  reviewId: string
  highlightedChangeId: string | null
  approvedSectionOpen: boolean
  setApprovedSectionOpen: (open: boolean) => void
  onApprove: (ch: LiveChange) => void
  onUnapprove: (ch: LiveChange) => void
  onAddComment: (changeId: string, body: string, res: CommentResolution) => void
  onSetCommentResolution: (changeId: string, commentId: string, res: CommentResolution) => void
  onEditComment: (changeId: string, commentId: string, newBody: string) => void
  onEdit: (ch: LiveChange) => void
  allDiffCards: string[]
  reviewerNames: string[]
  onOpenColorBreakdown: () => void
}) {
  if (changes.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-center py-16 px-4">
          <div className="text-3xl mb-3 opacity-30">±</div>
          <p className="text-slate-400 font-medium">No changes yet</p>
          <p className="text-sm text-slate-600 mt-1">Select cards in Edit mode to start annotating</p>
        </div>
      </div>
    )
  }

  // Stats
  const addedNames = new Set<string>()
  const removedNames = new Set<string>()
  for (const ch of changes) {
    const dt = computeChangeType(ch.cardsOut, ch.cardsIn, ch.type)
    if (dt === 'add' || dt === 'swap') ch.cardsIn.forEach(c => addedNames.add(c.name))
    if (dt === 'remove' || dt === 'swap') ch.cardsOut.forEach(c => removedNames.add(c.name))
  }
  const totalIn = addedNames.size
  const totalOut = removedNames.size
  const net = totalIn - totalOut

  // Sort within-group: unseen first, then unresolved, then mentions, then recency
  const myMention = `@${identity.displayName}`
  const hasMention = (c: LiveChange) =>
    !/^Reviewer\d*$/.test(identity.displayName) &&
    c.comments.some(cm => cm.body.toLowerCase().includes(myMention.toLowerCase()))
  const isSeen = (c: LiveChange) => c.seenBy?.includes(identity.id) ?? false

  function withinGroupSort(a: LiveChange, b: LiveChange) {
    const aS = isSeen(a), bS = isSeen(b)
    if (!aS && bS) return -1
    if (aS && !bS) return 1
    if (a.unresolved && !b.unresolved) return -1
    if (!a.unresolved && b.unresolved) return 1
    const aM = hasMention(a), bM = hasMention(b)
    if (aM && !bM) return -1
    if (!aM && bM) return 1
    return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
  }

  // Split into active vs approved
  const effectivelyApproved = (ch: LiveChange) =>
    (ch.approvedBy?.includes(identity.id) ?? false) && isSeen(ch)

  // Group active changes by type, in TYPE_ORDER
  const grouped: { type: ChangeType; label: string; changes: LiveChange[] }[] = []
  const byType = new Map<ChangeType, LiveChange[]>()
  for (const ch of changes) {
    if (effectivelyApproved(ch)) continue
    const dt = computeChangeType(ch.cardsOut, ch.cardsIn, ch.type)
    if (!byType.has(dt)) byType.set(dt, [])
    byType.get(dt)!.push(ch)
  }
  for (const t of TYPE_ORDER) {
    const group = byType.get(t)
    if (group && group.length > 0) {
      grouped.push({ type: t, label: TYPE_LABELS[t], changes: group.sort(withinGroupSort) })
    }
  }
  const approvedChanges = changes.filter(ch => effectivelyApproved(ch)).sort(withinGroupSort)

  function renderChangeCard(change: LiveChange, approved: boolean) {
    return (
      <SwipeableCard
        key={change.id}
        onSwipeRight={() => approved ? onUnapprove(change) : onApprove(change)}
        isActive={approved}
      >
        <ChangeCard
          change={change}
          onAddComment={(body, res) => onAddComment(change.id, body, res)}
          onSetCommentResolution={(commentId, res) => onSetCommentResolution(change.id, commentId, res)}
          onEditComment={(commentId, newBody) => onEditComment(change.id, commentId, newBody)}
          onEdit={() => onEdit(change)}
          isSeen={isSeen(change)}
          currentUserName={identity.displayName}
          diffCards={allDiffCards}
          reviewerNames={reviewerNames}
          highlighted={highlightedChangeId === change.id}
        />
      </SwipeableCard>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
      {/* Stats bar */}
      <div className="flex items-center gap-4 sm:gap-6 px-1 sm:px-2 py-2 sm:py-3 mb-1 border-b border-slate-700/60">
        <button
          onClick={onOpenColorBreakdown}
          className="flex items-center gap-6 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-slate-700/40 transition-colors"
          title="View color breakdown"
        >
          <div className="text-center">
            <div className="text-lg sm:text-xl font-bold text-green-400 leading-none">+{totalIn}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">in</div>
          </div>
          <div className="text-center">
            <div className="text-lg sm:text-xl font-bold text-red-400 leading-none">−{totalOut}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">out</div>
          </div>
          <div className="text-center">
            <div className={`text-lg sm:text-xl font-bold leading-none ${net >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {net >= 0 ? '+' : ''}{net}
            </div>
            <div className="text-[10px] text-slate-500 group-hover:text-slate-400 uppercase tracking-wider mt-0.5 transition-colors flex items-center justify-center gap-0.5">
              net
              <svg className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </button>
        <Link
          to={`/c/${reviewId}/changelog`}
          className="text-center ml-auto group"
          title="View changelog"
        >
          <div className="text-xl font-bold text-slate-400 group-hover:text-amber-400 transition-colors leading-none">{changes.length}</div>
          <div className="text-[10px] text-slate-500 group-hover:text-amber-400 uppercase tracking-wider mt-0.5 transition-colors flex items-center justify-center gap-0.5">
            changes
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Changes grouped by type (scroll targets for nav, no visible headers) */}
      {grouped.map(g => (
          <div key={g.type} id={`view-section-${g.type}`} className="space-y-2">
            {g.changes.map(ch => renderChangeCard(ch, false))}
          </div>
      ))}

      {/* Approved disclosure group */}
      {approvedChanges.length > 0 && (
        <div id="view-section-approved" className="mt-4 border-t border-slate-700/60 pt-3">
          <button
            onClick={() => setApprovedSectionOpen(!approvedSectionOpen)}
            className="flex items-center gap-2 w-full text-left px-2 py-2 rounded-lg hover:bg-slate-700/40 transition-colors"
          >
            <svg
              className={`w-4 h-4 text-green-400 transition-transform ${approvedSectionOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span className="text-sm font-medium text-green-400">
              Approved ({approvedChanges.length})
            </span>
          </button>
          {approvedSectionOpen && (
            <div className="space-y-3 mt-3">
              {approvedChanges.map(ch => renderChangeCard(ch, true))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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

// ── Inner workspace — rendered once review is loaded ─────────────────────────

function ReviewWorkspace({
  reviewId,
  review,
}: {
  reviewId: string
  review: Review
}) {
  const { identity, setName, claimIdentity } = useAuth()
  const { selectedLeft, selectedRight, clearSelection } = useEditMode()
  const [searchParams] = useSearchParams()
  const [changes, setChanges] = useState<LiveChange[]>([])
  const [changesLoading, setChangesLoading] = useState(true)
  const [mode, setMode] = useState<'edit' | 'view'>(searchParams.get('mode') === 'view' ? 'view' : 'edit')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalForceType, setModalForceType] = useState<ChangeType | undefined>()
  const [passModalOpen, setPassModalOpen] = useState(false)
  const [editingChange, setEditingChange] = useState<LiveChange | null>(null)
  const [splittingChange, setSplittingChange] = useState<LiveChange | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [linkCopyPop, setLinkCopyPop] = useState(false)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copyTab, setCopyTab] = useState<'summary' | 'cubecobra' | 'proxxied'>('summary')
  const [colorBreakdownOpen, setColorBreakdownOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyPop, setCopyPop] = useState(false)
  const [nameInput, setNameInput] = useState(
    /^Reviewer\d*$/.test(identity.displayName) ? '' : identity.displayName
  )
  const [editingName, setEditingName] = useState(false)

  const [actionError, setActionError] = useState<string | null>(null)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const shareMenuRef = useRef<HTMLDivElement>(null)

  // View mode: type filter, card search, approval
  const [viewCardSearch, setViewCardSearch] = useState('')
  const [highlightedChangeId, setHighlightedChangeId] = useState<string | null>(null)
  const [approvedSectionOpen, setApprovedSectionOpen] = useState(false)
  const [resolveConfirmChange, setResolveConfirmChange] = useState<LiveChange | null>(null)
  const [identityMap, setIdentityMap] = useState<Record<string, { name: string; lastSeen?: Timestamp }>>({})


  const diffData = review.rawData
  const cubeAId = review.cubeAId
  const cubeBId = review.cubeBId

  const sections = useMemo(() => groupBySection(diffData.onlyA, diffData.onlyB), [diffData])
  const { currentIndex, goNext, goPrev, goTo, total } = useSectionNav(sections)

  useEffect(() => {
    recordCubeCards(cubeAId, diffData.onlyA.map(c => c.name))
    recordCubeCards(cubeBId, diffData.onlyB.map(c => c.name))
  }, [cubeAId, cubeBId])

  useEffect(() => {
    if (mode === 'view') clearSelection()
  }, [mode])

  useEffect(() => {
    if (!shareMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShareMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [shareMenuOpen])

  const { imageMap, loadingSet } = useCardImages(sections, currentIndex)
  const currentLabel = sections[currentIndex]
    ? sectionLabel(sections[currentIndex].colorCategory, sections[currentIndex].cmc)
    : ''
  const findSection = (input: string) => parseSectionNotation(input, sections)

  // ── Approval helpers (Firestore-backed) ───────────────────────────────────
  const isApproved = useCallback((ch: LiveChange) =>
    ch.approvedBy?.includes(identity.id) ?? false,
    [identity.id])

  async function handleApprove(ch: LiveChange) {
    if (ch.unresolved) {
      setResolveConfirmChange(ch)
      return
    }
    try {
      await updateDoc(changeDocRef(ch.id), {
        approvedBy: arrayUnion(identity.id),
        seenBy: [identity.id],
      })
    } catch (e) {
      showActionError('Could not approve. Please try again.', e)
    }
  }

  async function handleUnapprove(ch: LiveChange) {
    try {
      await updateDoc(changeDocRef(ch.id), {
        approvedBy: arrayRemove(identity.id),
        seenBy: [identity.id],
      })
    } catch (e) {
      showActionError('Could not unapprove. Please try again.', e)
    }
  }

  // ── View-mode section nav ─────────────────────────────────────────────────
  // Sections: type groups that exist → Approved (if any)
  const effectivelyApprovedFn = useCallback((ch: LiveChange) =>
    isApproved(ch) && (ch.seenBy?.includes(identity.id) ?? false),
    [isApproved, identity.id])

  const viewSections = useMemo(() => {
    const secs: { key: string; label: string }[] = []
    const byType = new Map<ChangeType, number>()
    for (const ch of changes) {
      if (effectivelyApprovedFn(ch)) continue
      const dt = computeChangeType(ch.cardsOut, ch.cardsIn, ch.type)
      byType.set(dt, (byType.get(dt) ?? 0) + 1)
    }
    for (const t of TYPE_ORDER) {
      if ((byType.get(t) ?? 0) > 0) secs.push({ key: t, label: TYPE_LABELS[t] })
    }
    const approvedCount = changes.filter(c => effectivelyApprovedFn(c)).length
    if (approvedCount > 0) secs.push({ key: 'approved', label: 'Approved' })
    return secs
  }, [changes, effectivelyApprovedFn])

  const [viewSectionIndex, setViewSectionIndex] = useState(0)
  const [viewSearchMatches, setViewSearchMatches] = useState<string[]>([])
  const [viewSearchMatchIndex, setViewSearchMatchIndex] = useState(0)

  const viewSectionLabel = viewSections[viewSectionIndex]?.label ?? ''

  function scrollToViewEl(selector: string) {
    const el = document.querySelector(selector)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function scrollToViewChange(id: string) {
    setHighlightedChangeId(id)
    const el = document.querySelector(`[data-change-id="${id}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function viewGoTo(index: number) {
    const clamped = Math.max(0, Math.min(index, viewSections.length - 1))
    setViewSectionIndex(clamped)
    setHighlightedChangeId(null)
    const sec = viewSections[clamped]
    if (!sec) return
    if (sec.key === 'approved') {
      setApprovedSectionOpen(true)
      scrollToViewEl('#view-section-approved')
    } else {
      scrollToViewEl(`#view-section-${sec.key}`)
    }
  }

  function viewGoNext() {
    if (viewSearchMatches.length > 0) {
      const idx = (viewSearchMatchIndex + 1) % viewSearchMatches.length
      setViewSearchMatchIndex(idx)
      scrollToViewChange(viewSearchMatches[idx])
      return
    }
    if (viewSectionIndex < viewSections.length - 1) viewGoTo(viewSectionIndex + 1)
  }

  function viewGoPrev() {
    if (viewSearchMatches.length > 0) {
      const idx = (viewSearchMatchIndex - 1 + viewSearchMatches.length) % viewSearchMatches.length
      setViewSearchMatchIndex(idx)
      scrollToViewChange(viewSearchMatches[idx])
      return
    }
    if (viewSectionIndex > 0) {
      viewGoTo(viewSectionIndex - 1)
    } else {
      // Already at first section — scroll to top of page
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function findViewSection(input: string): number {
    const q = input.trim().toLowerCase()
    if (!q) return -1
    // Match section labels: "unresolved", "swaps", "adds", etc.
    return viewSections.findIndex(s =>
      s.label.toLowerCase().startsWith(q) || s.key.startsWith(q)
    )
  }

  function handleViewCardSearch(query: string) {
    setViewCardSearch(query)
    if (!query.trim()) {
      setViewSearchMatches([])
      setViewSearchMatchIndex(0)
      setHighlightedChangeId(null)
      return
    }
    const q = query.toLowerCase()
    const matches = changes
      .filter(ch =>
        ch.cardsIn.some(c => c.name.toLowerCase().includes(q)) ||
        ch.cardsOut.some(c => c.name.toLowerCase().includes(q))
      )
      .map(ch => ch.id)
    setViewSearchMatches(matches)
    if (matches.length > 0) {
      setViewSearchMatchIndex(0)
      scrollToViewChange(matches[0])
    } else {
      setHighlightedChangeId(null)
    }
  }

  const viewSearchMatchInfo = viewSearchMatches.length > 0
    ? `${viewSearchMatchIndex + 1}/${viewSearchMatches.length}`
    : viewCardSearch.trim() ? '0/0' : undefined

  // Check if sections ahead of the current one have unseen or unresolved changes
  const viewHasItemsAhead = useMemo(() => {
    if (viewSections.length === 0 || viewSectionIndex >= viewSections.length - 1) return false
    for (let i = viewSectionIndex + 1; i < viewSections.length; i++) {
      const sectionKey = viewSections[i].key
      if (sectionKey === 'approved') continue
      const sectionChanges = changes.filter(ch => {
        const dt = computeChangeType(ch.cardsOut, ch.cardsIn, ch.type)
        return dt === sectionKey
      })
      if (sectionChanges.some(ch => ch.unresolved || !(ch.seenBy?.includes(identity.id)))) return true
    }
    return false
  }, [viewSections, viewSectionIndex, changes, identity.id])

  // Subscribe to changes subcollection
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'reviews', reviewId, 'changes'),
      (snapshot) => {
        const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LiveChange))
        setChanges(all.filter(c => !c.deletedAt))
        setChangesLoading(false)
      }
    )
    return unsubscribe
  }, [reviewId])

  // Subscribe to identity map + register current user
  useEffect(() => {
    const metaRef = doc(db, 'reviews', reviewId, 'meta', 'identities')
    const unsubscribe = onSnapshot(metaRef, (snap) => {
      if (snap.exists()) {
        setIdentityMap(snap.data() as Record<string, { name: string; lastSeen?: Timestamp }>)
      }
    })
    // Register current user
    setDoc(metaRef, {
      [identity.id]: { name: identity.displayName, lastSeen: Timestamp.now() },
    }, { merge: true }).catch(() => { /* ignore write errors */ })
    return unsubscribe
  }, [reviewId, identity.id, identity.displayName])

  const selectedLeftCards = sections.flatMap(s => s.cardsA).filter(c => selectedLeft.has(c.name))
  const selectedRightCards = sections.flatMap(s => s.cardsB).filter(c => selectedRight.has(c.name))
  const hasSelection = selectedLeft.size > 0 || selectedRight.size > 0
  const hasLeft = selectedLeft.size > 0
  const hasRight = selectedRight.size > 0

  const actionLabel = hasLeft && hasRight
    ? `Swap ${selectedLeft.size} ↔ ${selectedRight.size}`
    : hasLeft ? `Remove ${selectedLeft.size}`
    : hasRight ? `Add ${selectedRight.size}`
    : null

  // ── Firestore write helpers ─────────────────────────────────────────────────

  function eventsRef() {
    return collection(db, 'reviews', reviewId, 'events')
  }

  function changeDocRef(changeId: string) {
    return doc(db, 'reviews', reviewId, 'changes', changeId)
  }

  function showActionError(message: string, error: unknown) {
    console.error(message, error)
    setActionError(message)
  }

  async function handleSaveChange(
    type: ChangeType,
    cardsOut: CubeCard[],
    cardsIn: CubeCard[],
    comment: string,
    unresolved: boolean
  ) {
    clearSelection()
    const now = Timestamp.now()
    const outNames = new Set(cardsOut.map(c => c.name))
    const inNames = new Set(cardsIn.map(c => c.name))
    const batch = writeBatch(db)

    // Strip overlapping cards from existing changes
    for (const c of changes) {
      const strippedOut = c.cardsOut.filter(card => !outNames.has(card.name))
      const strippedIn = c.cardsIn.filter(card => !inNames.has(card.name))
      const wasStripped =
        strippedOut.length !== c.cardsOut.length || strippedIn.length !== c.cardsIn.length
      if (!wasStripped) continue

      const ref = changeDocRef(c.id)
      if (strippedOut.length === 0 && strippedIn.length === 0) {
        batch.update(ref, {
          deletedAt: now,
          deletedBy: identity.id,
          deletedByName: identity.displayName,
        })
        batch.set(doc(eventsRef()), {
          type: 'change_deleted',
          changeId: c.id,
          authorId: identity.id,
          authorName: identity.displayName,
          createdAt: now,
          payload: {},
        })
      } else {
        const strippedType = computeChangeType(strippedOut, strippedIn, c.type)
        const after: LiveChange = { ...c, cardsOut: strippedOut, cardsIn: strippedIn, type: strippedType, updatedAt: now, updatedBy: identity.id, updatedByName: identity.displayName }
        batch.update(ref, {
          cardsOut: cleanForFirestore(strippedOut),
          cardsIn: cleanForFirestore(strippedIn),
          type: strippedType,
          updatedAt: now,
          updatedBy: identity.id,
          updatedByName: identity.displayName,
          seenBy: [identity.id],
        })
        batch.set(doc(eventsRef()), {
          type: 'change_edited',
          changeId: c.id,
          authorId: identity.id,
          authorName: identity.displayName,
          createdAt: now,
          payload: { before: cleanForFirestore(c), after: cleanForFirestore(after) },
        })
      }
    }

    // Create the new change
    const newChangeId = nanoid(8)
    const newChange: LiveChange = {
      id: newChangeId,
      type,
      cardsOut,
      cardsIn,
      initialComment: comment,
      authorId: identity.id,
      authorName: identity.displayName,
      authorPhotoURL: identity.photoURL,
      unresolved,
      createdAt: now,
      comments: [],
      seenBy: [identity.id],
    }
    batch.set(
      doc(db, 'reviews', reviewId, 'changes', newChangeId),
      cleanForFirestore(newChange) as object
    )
    batch.set(doc(eventsRef()), {
      type: 'change_created',
      changeId: newChangeId,
      authorId: identity.id,
      authorName: identity.displayName,
      createdAt: now,
      payload: { change: cleanForFirestore(newChange) },
    })

    try {
      await batch.commit()
      setActionError(null)
    } catch (e) {
      showActionError('Your change was not saved. Check your connection and try again.', e)
    }
  }

  async function handleEditChange(
    changeId: string,
    updates: { initialComment: string; cardsOut: CubeCard[]; cardsIn: CubeCard[]; type: ChangeType; unresolved: boolean }
  ) {
    const c = changes.find(ch => ch.id === changeId)
    if (!c) return
    const now = Timestamp.now()
    const after: LiveChange = {
      ...c,
      ...updates,
      updatedAt: now,
      updatedBy: identity.id,
      updatedByName: identity.displayName,
    }
    try {
      await updateDoc(changeDocRef(changeId), {
        ...updates,
        cardsOut: cleanForFirestore(updates.cardsOut),
        cardsIn: cleanForFirestore(updates.cardsIn),
        updatedAt: now,
        updatedBy: identity.id,
        updatedByName: identity.displayName,
        seenBy: [identity.id],
      })
      await setDoc(doc(eventsRef()), {
        type: 'change_edited',
        changeId,
        authorId: identity.id,
        authorName: identity.displayName,
        createdAt: now,
        payload: { before: cleanForFirestore(c), after: cleanForFirestore(after) },
      })
      setActionError(null)
    } catch (e) {
      showActionError('That edit did not go through. Please try again.', e)
    }
  }

  async function handleDeleteChange(changeId: string) {
    const c = changes.find(ch => ch.id === changeId)
    if (!c) return
    const now = Timestamp.now()
    try {
      await updateDoc(changeDocRef(changeId), {
        deletedAt: now,
        deletedBy: identity.id,
        deletedByName: identity.displayName,
      })
      await setDoc(doc(eventsRef()), {
        type: 'change_deleted',
        changeId,
        authorId: identity.id,
        authorName: identity.displayName,
        createdAt: now,
        payload: {},
      })
      setActionError(null)
    } catch (e) {
      showActionError('The change could not be deleted. Please try again.', e)
    }
  }

  async function handleSplitChange(
    originalId: string,
    originalUpdates: { cardsOut: CubeCard[]; cardsIn: CubeCard[]; type: ChangeType },
    newChange: { cardsOut: CubeCard[]; cardsIn: CubeCard[]; type: ChangeType; comment: string }
  ) {
    const original = changes.find(c => c.id === originalId)
    if (!original) return
    const now = Timestamp.now()
    const batch = writeBatch(db)

    // Update original
    const afterOriginal: LiveChange = {
      ...original,
      ...originalUpdates,
      updatedAt: now,
      updatedBy: identity.id,
      updatedByName: identity.displayName,
    }
    batch.update(changeDocRef(originalId), {
      ...originalUpdates,
      cardsOut: cleanForFirestore(originalUpdates.cardsOut),
      cardsIn: cleanForFirestore(originalUpdates.cardsIn),
      updatedAt: now,
      updatedBy: identity.id,
      updatedByName: identity.displayName,
      seenBy: [identity.id],
    })
    batch.set(doc(eventsRef()), {
      type: 'change_edited',
      changeId: originalId,
      authorId: identity.id,
      authorName: identity.displayName,
      createdAt: now,
      payload: { before: cleanForFirestore(original), after: cleanForFirestore(afterOriginal) },
    })

    // Create split-off change (fork comment history from parent)
    const newId = nanoid(8)
    const freshChange: LiveChange = {
      id: newId,
      type: newChange.type,
      cardsOut: newChange.cardsOut,
      cardsIn: newChange.cardsIn,
      initialComment: newChange.comment,
      authorId: identity.id,
      authorName: identity.displayName,
      authorPhotoURL: identity.photoURL,
      unresolved: false,
      createdAt: now,
      seenBy: [identity.id],
      comments: original.comments.map(c => ({ ...c })),
    }
    batch.set(
      doc(db, 'reviews', reviewId, 'changes', newId),
      cleanForFirestore(freshChange) as object
    )
    batch.set(doc(eventsRef()), {
      type: 'change_created',
      changeId: newId,
      authorId: identity.id,
      authorName: identity.displayName,
      createdAt: now,
      payload: { change: cleanForFirestore(freshChange) },
    })

    try {
      await batch.commit()
      setActionError(null)
      setSplittingChange(null)
      setEditingChange(freshChange)
    } catch (e) {
      showActionError('The split could not be saved. Please try again.', e)
    }
  }

  async function handleAddComment(changeId: string, body: string, _resolution: CommentResolution) {
    const c = changes.find(ch => ch.id === changeId)
    if (!c) return
    const newComment: Comment = {
      id: nanoid(8),
      body,
      authorId: identity.id,
      authorName: identity.displayName,
      authorPhotoURL: identity.photoURL,
      resolution: 'none',
      createdAt: Timestamp.now(),
    }
    try {
      await updateDoc(changeDocRef(changeId), {
        comments: cleanForFirestore([...c.comments, newComment]),
        seenBy: [identity.id],
      })
      setActionError(null)
    } catch (e) {
      showActionError('Your comment was not saved. Please try again.', e)
    }
  }

  async function handleSetCommentResolution(
    changeId: string,
    commentId: string,
    resolution: CommentResolution
  ) {
    const c = changes.find(ch => ch.id === changeId)
    if (!c) return
    const updated = c.comments.map(cm => cm.id === commentId ? { ...cm, resolution } : cm)
    try {
      await updateDoc(changeDocRef(changeId), {
        comments: cleanForFirestore(updated),
        seenBy: [identity.id],
      })
      setActionError(null)
    } catch (e) {
      showActionError('The comment status could not be updated. Please try again.', e)
    }
  }

  async function handleEditComment(changeId: string, commentId: string, newBody: string) {
    const c = changes.find(ch => ch.id === changeId)
    if (!c) return
    const updated = c.comments.map(cm =>
      cm.id === commentId ? { ...cm, body: newBody, updatedAt: Timestamp.now() } : cm
    )
    try {
      await updateDoc(changeDocRef(changeId), {
        comments: cleanForFirestore(updated),
        seenBy: [identity.id],
      })
      setActionError(null)
    } catch (e) {
      showActionError('The comment could not be updated. Please try again.', e)
    }
  }

  async function handleSetName() {
    const trimmed = nameInput.trim()
    if (!trimmed) return

    // Check if the user is claiming an existing identity
    const existingEntry = Object.entries(identityMap).find(
      ([id, entry]) => entry.name === trimmed && id !== identity.id
    )
    const oldId = identity.id

    if (existingEntry) {
      // Claim existing identity — swap nanoid
      const [claimedId] = existingEntry
      claimIdentity(claimedId, trimmed)
      // Remove old identity from map, update claimed entry
      const metaRef = doc(db, 'reviews', reviewId, 'meta', 'identities')
      const updates: Record<string, unknown> = {
        [claimedId]: { name: trimmed, lastSeen: Timestamp.now() },
      }
      // Only delete old entry if it was a different id
      if (oldId !== claimedId) {
        // Firestore doesn't support deleting a field in setDoc with merge,
        // so we use updateDoc with deleteField — but for simplicity, just overwrite
        // the old entry with a marker or let it stay (it's harmless)
      }
      setDoc(metaRef, updates, { merge: true }).catch(() => { /* ignore */ })
    } else {
      // Regular name change
      setName(trimmed)
      // Update identity map
      const metaRef = doc(db, 'reviews', reviewId, 'meta', 'identities')
      setDoc(metaRef, {
        [identity.id]: { name: trimmed, lastSeen: Timestamp.now() },
      }, { merge: true }).catch(() => { /* ignore */ })
    }

    setEditingName(false)

    // Retroactively update attribution on this user's existing changes and comments.
    const authorId = existingEntry ? existingEntry[0] : identity.id
    const updatedChanges = changes.map(change => ({
      ...change,
      authorName: change.authorId === authorId ? trimmed : change.authorName,
      comments: change.comments.map(cm => (
        cm.authorId === authorId ? { ...cm, authorName: trimmed } : cm
      )),
    }))
    const touchedChanges = updatedChanges.filter((change, index) => {
      const original = changes[index]
      return change.authorName !== original.authorName
        || change.comments.some((comment, commentIndex) => (
          comment.authorName !== original.comments[commentIndex]?.authorName
        ))
    })
    setChanges(updatedChanges)
    if (touchedChanges.length === 0) return

    const batch = writeBatch(db)
    for (const change of touchedChanges) {
      batch.update(changeDocRef(change.id), {
        authorName: change.authorName,
        comments: cleanForFirestore(
          change.comments
        ),
      })
    }
    try {
      await batch.commit()
      setActionError(null)
    } catch (e) {
      showActionError('Your display name changed locally, but older attributions could not be updated yet.', e)
    }
  }

  function openModalWithType(type?: ChangeType) {
    setModalForceType(type)
    setModalOpen(true)
  }

  /** Unified handler for both create and edit from UnifiedChangeModal. */
  async function handleUnifiedSave(data: ChangeData) {
    if (data.changeId) {
      // Edit mode
      await handleEditChange(data.changeId, {
        initialComment: data.comment,
        cardsOut: data.cardsOut,
        cardsIn: data.cardsIn,
        type: data.type,
        unresolved: data.unresolved,
      })
    } else {
      // Create mode
      await handleSaveChange(data.type, data.cardsOut, data.cardsIn, data.comment, data.unresolved)
    }
  }

  async function handleSavePass(comment: string, unresolved: boolean) {
    clearSelection()
    const now = Timestamp.now()
    const batch = writeBatch(db)

    // Keep: left cards stay in the cube
    const keepId = nanoid(8)
    const keepChange: LiveChange = {
      id: keepId, type: 'keep', cardsOut: selectedLeftCards, cardsIn: [],
      initialComment: comment, authorId: identity.id, authorName: identity.displayName,
      authorPhotoURL: identity.photoURL, unresolved, createdAt: now, comments: [],
    }
    batch.set(doc(db, 'reviews', reviewId, 'changes', keepId), cleanForFirestore(keepChange) as object)
    batch.set(doc(eventsRef()), {
      type: 'change_created', changeId: keepId,
      authorId: identity.id, authorName: identity.displayName, createdAt: now,
      payload: { change: cleanForFirestore(keepChange) },
    })

    // Reject: right cards are turned down
    const rejectId = nanoid(8)
    const rejectChange: LiveChange = {
      id: rejectId, type: 'reject', cardsOut: [], cardsIn: selectedRightCards,
      initialComment: comment, authorId: identity.id, authorName: identity.displayName,
      authorPhotoURL: identity.photoURL, unresolved, createdAt: now, comments: [],
    }
    batch.set(doc(db, 'reviews', reviewId, 'changes', rejectId), cleanForFirestore(rejectChange) as object)
    batch.set(doc(eventsRef()), {
      type: 'change_created', changeId: rejectId,
      authorId: identity.id, authorName: identity.displayName, createdAt: now,
      payload: { change: cleanForFirestore(rejectChange) },
    })

    try {
      await batch.commit()
      setActionError(null)
    } catch (e) {
      showActionError('The pass could not be saved. Please try again.', e)
    }
  }

  // ── Copy helpers ─────────────────────────────────────────────────────────────

  function triggerCopyPop(setter: (v: boolean) => void, popSetter: (v: boolean) => void) {
    setter(true)
    popSetter(true)
    setTimeout(() => popSetter(false), 400)
    setTimeout(() => setter(false), COPY_FEEDBACK_DURATION_MS)
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() =>
      triggerCopyPop(setLinkCopied, setLinkCopyPop)
    )
  }

  function buildSummaryText(): string {
    const lines: string[] = []
    lines.push(`${cubeAId} vs ${cubeBId}`)
    lines.push(new Date().toLocaleDateString())
    lines.push('')
    const byType: Record<string, LiveChange[]> = {}
    for (const ch of changes) {
      const t = computeChangeType(ch.cardsOut, ch.cardsIn, ch.type)
      ;(byType[t] ??= []).push(ch)
    }
    const order: ChangeType[] = ['swap', 'add', 'remove', 'decline', 'reject', 'keep']
    const labels: Record<ChangeType, string> = {
      swap: 'SWAPS', add: 'ADDITIONS', remove: 'REMOVALS', decline: 'DECLINES', reject: 'REJECTS', keep: 'KEEPS',
    }
    for (const t of order) {
      const group = byType[t]
      if (!group?.length) continue
      lines.push(`── ${labels[t]} (${group.length}) ──`)
      for (const ch of group) {
        const prefix = ch.unresolved ? '⚠ UNRESOLVED  ' : ''
        if (t === 'keep') {
          lines.push(`${prefix}↺ ${ch.cardsOut.map(c => c.name).join(', ')}`)
        } else if (t === 'reject') {
          lines.push(`${prefix}✗ ${ch.cardsIn.map(c => c.name).join(', ')}`)
        } else {
          const ins = ch.cardsIn.map(c => `+ ${c.name}`).join(', ')
          const outs = ch.cardsOut.map(c => `− ${c.name}`).join(', ')
          lines.push(`${prefix}${[ins, outs].filter(Boolean).join('  /  ')}`)
        }
        if (ch.comments?.length) {
          for (const c of ch.comments) lines.push(`  "${c.body}"`)
        }
      }
      lines.push('')
    }
    const addedNames = new Set<string>()
    const removedNames = new Set<string>()
    for (const ch of changes) {
      const dt = computeChangeType(ch.cardsOut, ch.cardsIn, ch.type)
      if (dt === 'add' || dt === 'swap') ch.cardsIn.forEach(c => addedNames.add(c.name))
      if (dt === 'remove' || dt === 'swap') ch.cardsOut.forEach(c => removedNames.add(c.name))
    }
    const net = addedNames.size - removedNames.size
    lines.push(
      `+${addedNames.size} in / −${removedNames.size} out / net ${net >= 0 ? '+' : ''}${net}  (${changes.length} changes)`
    )
    return lines.join('\n')
  }

  function buildCubeCobraText(): string {
    const toAdd: string[] = []
    const toRemove: string[] = []
    for (const ch of changes) {
      const dt = computeChangeType(ch.cardsOut, ch.cardsIn, ch.type)
      if (dt === 'add' || dt === 'swap') ch.cardsIn.forEach(c => toAdd.push(c.name))
      if (dt === 'remove' || dt === 'swap') ch.cardsOut.forEach(c => toRemove.push(c.name))
    }
    const parts: string[] = []
    if (toAdd.length) parts.push(`── CARDS TO ADD ──\n${toAdd.join('\n')}`)
    if (toRemove.length) parts.push(`── CARDS TO REMOVE ──\n${toRemove.join('\n')}`)
    return parts.join('\n\n')
  }

  function buildProxxiedText(): string {
    const cards: string[] = []
    for (const ch of changes) {
      const dt = computeChangeType(ch.cardsOut, ch.cardsIn, ch.type)
      if (dt === 'add' || dt === 'swap') ch.cardsIn.forEach(c => cards.push(`1 ${c.name}`))
    }
    return cards.join('\n')
  }

  // Color breakdown: count cards in/out by color category, with multicolor sub-groups
  type ColorRow = { key: string; name: string; bg: string; added: string[]; removed: string[]; net: number; indent?: boolean }
  const colorBreakdown = useMemo((): ColorRow[] => {
    const inByColor = new Map<string, string[]>()
    const outByColor = new Map<string, string[]>()

    function colorKey(card: CubeCard): string {
      if (card.colorCategory === 'M' && card.colors.length > 1) {
        return 'M:' + [...card.colors].sort().join('')
      }
      return card.colorCategory
    }

    for (const ch of changes) {
      const dt = computeChangeType(ch.cardsOut, ch.cardsIn, ch.type)
      if (dt === 'add' || dt === 'swap') {
        for (const c of ch.cardsIn) {
          const k = colorKey(c)
          if (!inByColor.has(k)) inByColor.set(k, [])
          inByColor.get(k)!.push(c.name)
        }
      }
      if (dt === 'remove' || dt === 'swap') {
        for (const c of ch.cardsOut) {
          const k = colorKey(c)
          if (!outByColor.has(k)) outByColor.set(k, [])
          outByColor.get(k)!.push(c.name)
        }
      }
    }

    const rows: ColorRow[] = []
    for (const color of COLOR_ORDER) {
      if (color === 'M') {
        // Collect all multi-color sub-groups
        const multiKeys = new Set<string>()
        for (const k of [...inByColor.keys(), ...outByColor.keys()]) {
          if (k.startsWith('M:')) multiKeys.add(k)
        }
        // Also check for generic 'M' entries
        const genericIn = inByColor.get('M') ?? []
        const genericOut = outByColor.get('M') ?? []
        const allMultiIn = [...genericIn]
        const allMultiOut = [...genericOut]
        const subRows: ColorRow[] = []

        const sorted = [...multiKeys].sort()
        for (const k of sorted) {
          const pair = k.slice(2) // e.g. "WU"
          const added = inByColor.get(k) ?? []
          const removed = outByColor.get(k) ?? []
          allMultiIn.push(...added)
          allMultiOut.push(...removed)
          const pairName = pair.split('').map(c => COLOR_NAMES[c as ColorCategory]?.[0] ?? c).join('')
          subRows.push({ key: k, name: pairName, bg: COLOR_BG.M, added, removed, net: added.length - removed.length, indent: true })
        }

        if (allMultiIn.length > 0 || allMultiOut.length > 0) {
          rows.push({ key: 'M', name: COLOR_NAMES.M, bg: COLOR_BG.M, added: allMultiIn, removed: allMultiOut, net: allMultiIn.length - allMultiOut.length })
          rows.push(...subRows)
        }
      } else {
        const added = inByColor.get(color) ?? []
        const removed = outByColor.get(color) ?? []
        if (added.length > 0 || removed.length > 0) {
          rows.push({ key: color, name: COLOR_NAMES[color], bg: COLOR_BG[color], added, removed, net: added.length - removed.length })
        }
      }
    }
    return rows
  }, [changes])

  function handleCopyExport() {
    const text = copyTab === 'summary' ? buildSummaryText() : copyTab === 'cubecobra' ? buildCubeCobraText() : buildProxxiedText()
    navigator.clipboard.writeText(text).then(() => triggerCopyPop(setCopied, setCopyPop))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const resolvedCount = changes.filter(c => !c.unresolved).length

  const allDiffCards = useMemo(() => [
    ...diffData.onlyA.map(c => c.name),
    ...diffData.onlyB.map(c => c.name),
  ], [diffData])

  const reviewerNames = useMemo(() => [...new Set([
    ...changes.map(c => c.authorName).filter(Boolean),
    ...changes.flatMap(c => c.comments.map(cm => cm.authorName)).filter(Boolean),
    ...(identity.displayName ? [identity.displayName] : []),
  ])].filter(name => !/^Reviewer\d*$/.test(name)), [changes, identity.displayName])

  const cardInChanges = useMemo(() => {
    const s = new Set<string>()
    for (const ch of changes) {
      ch.cardsOut.forEach(c => s.add(c.name))
      ch.cardsIn.forEach(c => s.add(c.name))
    }
    return s
  }, [changes])

  const isSectionComplete = useMemo(() => {
    const sec = sections[currentIndex]
    if (!sec) return false
    const allCards = [...sec.cardsA, ...sec.cardsB]
    if (allCards.length === 0) return false
    return allCards.every(c => cardInChanges.has(c.name))
  }, [sections, currentIndex, cardInChanges])

  // Auto-scroll to first incomplete section on initial load (or first switch to edit mode)
  const didInitialScroll = useRef(false)
  const scrollToFirstIncomplete = useCallback(() => {
    if (changes.length === 0) return
    const firstIncomplete = sections.findIndex(sec => {
      const allCards = [...sec.cardsA, ...sec.cardsB]
      return allCards.length > 0 && !allCards.every(c => cardInChanges.has(c.name))
    })
    if (firstIncomplete > 0) {
      setTimeout(() => goTo(firstIncomplete), 150)
    }
  }, [changes, sections, cardInChanges, goTo])

  useEffect(() => {
    if (changesLoading || didInitialScroll.current) return
    if (mode !== 'edit') return          // defer until edit mode is active
    didInitialScroll.current = true
    scrollToFirstIncomplete()
  }, [changesLoading, mode, scrollToFirstIncomplete])

  return (
    <>
      <Helmet>
        <title>Cube Merge</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="h-dvh bg-slate-900 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center px-2 py-2 bg-slate-800 border-b border-slate-700 relative z-20">
          {/* Left column */}
          <div className="flex items-center gap-1.5">
            <ModeToggle mode={mode} onChange={(newMode) => { setMode(newMode); setEditingChange(null) }} />
            {changes.length > 0 && (
              <span className="hidden sm:inline text-xs text-slate-500 shrink-0 tabular-nums">
                {resolvedCount}/{changes.length}
              </span>
            )}
          </div>

          {/* Center column — always truly centered over the column join */}
          {mode === 'edit' ? (
            <SectionNav
              currentIndex={currentIndex}
              total={total}
              currentLabel={currentLabel}
              onPrev={goPrev}
              onNext={goNext}
              onGoTo={goTo}
              findSection={findSection}
              sectionComplete={isSectionComplete}
            />
          ) : (
            <SectionNav
              currentIndex={viewSectionIndex}
              total={viewSections.length}
              currentLabel={viewSectionLabel}
              onPrev={viewGoPrev}
              onNext={viewGoNext}
              onGoTo={viewGoTo}
              findSection={findViewSection}
              onCardSearch={handleViewCardSearch}
              searchMatchInfo={viewSearchMatchInfo}
              placeholder="Type or search cards…"
              hasItemsAhead={viewHasItemsAhead}
            />
          )}

          {/* Right column */}
          <div className="flex items-center justify-end gap-1 min-w-0">
            {mode === 'edit' && hasSelection && (
              <div className="hidden lg:flex items-center gap-1.5 shrink-0">
                <Button
                  onClick={() => setModalOpen(true)}
                  size="sm"
                  variant={hasLeft && !hasRight ? 'danger' : 'primary'}
                >
                  {actionLabel}
                </Button>
                {hasLeft && !hasRight && (
                  <Button size="sm" variant="keep" onClick={() => openModalWithType('keep')}>
                    Keep
                  </Button>
                )}
                {hasRight && !hasLeft && (
                  <Button size="sm" variant="reject" onClick={() => openModalWithType('reject')}>
                    Reject
                  </Button>
                )}
                {hasLeft && hasRight && (
                  <Button size="sm" variant="pass" onClick={() => setPassModalOpen(true)} title="Keep left cards + reject right cards">
                    Pass
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={clearSelection} aria-label="Clear selection">✕</Button>
              </div>
            )}
            {/* Changelog link */}
            <Link
              to={`/c/${reviewId}/changelog`}
              className="hidden sm:inline-flex items-center gap-1 h-8 px-2 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Changelog
            </Link>
            {/* Export — desktop only */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setCopyTab('summary'); setCopyModalOpen(true) }}
              aria-label="Export changes"
              className="hidden sm:inline-flex"
            >
              Export
            </Button>
            {/* Copy Link — desktop only */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleCopyLink}
              aria-label="Copy link"
              className={`hidden sm:inline-flex ${linkCopyPop ? 'copy-pop' : ''}`}
            >
              {linkCopied
                ? <><svg className="w-3.5 h-3.5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="ml-1">Copied!</span></>
                : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span className="ml-1">Copy Link</span></>
              }
            </Button>
            {/* Share button — mobile only (combines Export + Copy Link) */}
            <div ref={shareMenuRef} className="relative sm:hidden">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShareMenuOpen(v => !v)}
                aria-label="Share"
                className={`touch-target !w-8 !px-0 ${linkCopyPop ? 'copy-pop' : ''}`}
              >
                {linkCopied
                  ? <svg className="w-3.5 h-3.5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                }
              </Button>
              {shareMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2 transition-colors"
                    onClick={() => { handleCopyLink(); setShareMenuOpen(false) }}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Copy Link
                  </button>
                  <button
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2 transition-colors border-t border-slate-700"
                    onClick={() => { setCopyTab('summary'); setCopyModalOpen(true); setShareMenuOpen(false) }}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {actionError ? (
          <div className="border-b border-red-500/20 bg-slate-900 px-3 py-3">
            <Notice
              tone="error"
              title="Sync problem"
              action={(
                <Button size="sm" variant="secondary" onClick={() => setActionError(null)}>
                  Dismiss
                </Button>
              )}
            >
              {actionError}
            </Notice>
          </div>
        ) : null}

        {/* Content */}
        {changesLoading && mode === 'view' ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner />
          </div>
        ) : mode === 'edit' ? (
          <div className="flex flex-col flex-1 min-h-0">
            <DiffList sections={sections} imageMap={imageMap} loadingSet={loadingSet} changes={changes} selectable={mode === 'edit'} onCardInChangeClick={(ch) => setEditingChange(ch)} />
            {hasSelection && (
              <div className="lg:hidden sticky bottom-0 z-10 shrink-0 bg-slate-800 border-t border-slate-700 px-3 py-2 pb-safe flex items-center gap-2">
                <Button
                  onClick={() => setModalOpen(true)}
                  size="sm"
                  className="flex-1 min-h-[44px]"
                  variant={hasLeft && !hasRight ? 'danger' : 'primary'}
                >
                  {actionLabel}
                </Button>
                {hasLeft && !hasRight && (
                  <Button size="sm" variant="keep" className="min-h-[44px]" onClick={() => openModalWithType('keep')}>Keep</Button>
                )}
                {hasRight && !hasLeft && (
                  <Button size="sm" variant="reject" className="min-h-[44px]" onClick={() => openModalWithType('reject')}>Reject</Button>
                )}
                {hasLeft && hasRight && (
                  <Button size="sm" variant="pass" className="min-h-[44px]" onClick={() => setPassModalOpen(true)} title="Keep left cards + reject right cards">Pass</Button>
                )}
                <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={clearSelection} aria-label="Clear selection">✕</Button>
              </div>
            )}
          </div>
        ) : (
          <ViewModePanel
            changes={changes}
            identity={identity}
            reviewId={reviewId!}
            highlightedChangeId={highlightedChangeId}
            approvedSectionOpen={approvedSectionOpen}
            setApprovedSectionOpen={setApprovedSectionOpen}
            onApprove={handleApprove}
            onUnapprove={handleUnapprove}
            onAddComment={(changeId, body, res) => handleAddComment(changeId, body, res)}
            onSetCommentResolution={(changeId, commentId, res) => handleSetCommentResolution(changeId, commentId, res)}
            onEditComment={(changeId, commentId, newBody) => handleEditComment(changeId, commentId, newBody)}
            onEdit={(ch) => setEditingChange(ch)}
            allDiffCards={allDiffCards}
            reviewerNames={reviewerNames}
            onOpenColorBreakdown={() => setColorBreakdownOpen(true)}
          />
        )}

        {/* Unified change modal — create or edit */}
        <UnifiedChangeModal
          open={modalOpen || !!editingChange}
          onClose={() => { setModalOpen(false); setEditingChange(null); setModalForceType(undefined) }}
          selectedLeftCards={selectedLeftCards}
          selectedRightCards={selectedRightCards}
          initialType={modalForceType}
          existingChange={editingChange ?? undefined}
          allCardsA={diffData.onlyA}
          allCardsB={diffData.onlyB}
          onSave={handleUnifiedSave}
          onDelete={editingChange ? handleDeleteChange : undefined}
          onSplit={editingChange && (editingChange.cardsIn.length + editingChange.cardsOut.length > 1) ? () => {
            setSplittingChange(editingChange)
            setEditingChange(null)
          } : undefined}
          diffCards={allDiffCards}
          reviewerNames={reviewerNames}
          onClearSelection={clearSelection}
        />
        <PassModal
          open={passModalOpen}
          onClose={() => setPassModalOpen(false)}
          leftCards={selectedLeftCards}
          rightCards={selectedRightCards}
          onSave={handleSavePass}
          diffCards={allDiffCards}
          reviewerNames={reviewerNames}
        />

        {splittingChange && (
          <SplitChangeModal
            open={!!splittingChange}
            onClose={() => setSplittingChange(null)}
            change={splittingChange}
            onSplit={(orig, fresh) => handleSplitChange(splittingChange.id, orig, fresh)}
            diffCards={allDiffCards}
            reviewerNames={reviewerNames}
          />
        )}

        <Modal
          open={editingName}
          onClose={() => setEditingName(false)}
          title={/^Reviewer\d*$/.test(identity.displayName) ? 'Set your name' : 'Your name'}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              {/^Reviewer\d*$/.test(identity.displayName)
                ? 'Your name lets others know who\'s making changes. It\'ll appear on your annotations and comments.'
                : 'This is how you appear on changes and comments. Saving will update your existing annotations too.'}
            </p>
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSetName()
                if (e.key === 'Escape') setEditingName(false)
              }}
              placeholder="e.g. Alex, TheMagicPlayer…"
              aria-label="Your display name"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            {/* Existing participant suggestions */}
            {(() => {
              const existingNames = [...new Set(Object.values(identityMap).map(e => e.name))]
                .filter(n => !/^Reviewer\d*$/.test(n) && n !== identity.displayName)
              if (existingNames.length === 0) return null
              return (
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-500">Pick your name to continue from another device</p>
                  <div className="flex flex-wrap gap-1.5">
                    {existingNames.map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setNameInput(name)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          nameInput === name
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-slate-700/60 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditingName(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSetName} disabled={!nameInput.trim()}>Save</Button>
            </div>
          </div>
        </Modal>

        <Modal open={copyModalOpen} onClose={() => setCopyModalOpen(false)} title="Export Changes">
          <div className="space-y-3">
            <div className="flex gap-1 bg-slate-700/40 rounded-lg p-1">
              {(['summary', 'cubecobra', 'proxxied'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setCopyTab(tab); setCopied(false) }}
                  className={`flex-1 text-sm py-1 rounded-md transition-colors ${copyTab === tab ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {tab === 'summary' ? 'Summary' : tab === 'cubecobra' ? 'CubeCobra' : 'Proxxied'}
                </button>
              ))}
            </div>
            {copyTab === 'proxxied' && (
              <p className="text-xs text-slate-500">
                Copy this list and paste it into{' '}
                <a href="https://proxxied.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors">
                  proxxied.com
                </a>
                {' '}to print proxies of new cards.
              </p>
            )}
            <textarea
              readOnly
              aria-label={`${copyTab === 'summary' ? 'Summary' : copyTab === 'cubecobra' ? 'CubeCobra' : 'Proxxied'} export text`}
              value={copyTab === 'summary' ? buildSummaryText() : copyTab === 'cubecobra' ? buildCubeCobraText() : buildProxxiedText()}
              className="w-full h-64 bg-slate-900 text-slate-200 text-xs font-mono rounded-lg p-3 resize-none border border-slate-700 focus:outline-none"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setCopyModalOpen(false); setColorBreakdownOpen(true) }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
              >
                View color breakdown
              </button>
              <Button size="sm" variant="primary" onClick={handleCopyExport} className={copyPop ? 'copy-pop' : ''}>
                {copied ? '✓ Copied!' : 'Copy to clipboard'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Color breakdown modal */}
        <Modal open={colorBreakdownOpen} onClose={() => setColorBreakdownOpen(false)} title="Color Breakdown">
          <div className="space-y-2">
            {colorBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No card changes to break down</p>
            ) : (
              <>
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 gap-y-1.5 text-sm items-center">
                  {/* Header */}
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider col-span-2" />
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider text-right">In</div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider text-right">Out</div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider text-right">Net</div>
                  {colorBreakdown.map(row => (
                    <Fragment key={row.key}>
                      {row.indent ? (
                        <div className="w-3 h-3 shrink-0" />
                      ) : (
                        <div
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: row.bg }}
                          title={row.name}
                        />
                      )}
                      <div className={`${row.indent ? 'text-slate-500 text-xs pl-1' : 'text-slate-300 font-medium'}`}>{row.name}</div>
                      <div className="text-green-400 text-right tabular-nums font-mono text-xs">
                        {row.added.length > 0 ? `+${row.added.length}` : ''}
                      </div>
                      <div className="text-red-400 text-right tabular-nums font-mono text-xs">
                        {row.removed.length > 0 ? `−${row.removed.length}` : ''}
                      </div>
                      <div className={`text-right tabular-nums font-mono text-xs font-semibold ${row.net > 0 ? 'text-green-300' : row.net < 0 ? 'text-red-300' : 'text-slate-600'}`}>
                        {row.net !== 0 ? (row.net > 0 ? `+${row.net}` : `${row.net}`) : '—'}
                      </div>
                    </Fragment>
                  ))}
                </div>
                {/* Card names detail */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 transition-colors">
                    Show card names
                  </summary>
                  <div className="mt-2 space-y-2 text-xs">
                    {colorBreakdown.filter(r => !r.indent).map(row => (
                      <div key={row.key}>
                        <div className="font-medium text-slate-400 mb-0.5" style={{ color: row.bg }}>{row.name}</div>
                        {row.added.length > 0 && (
                          <div className="text-green-400/80 ml-2">{row.added.map(n => `+ ${n}`).join(', ')}</div>
                        )}
                        {row.removed.length > 0 && (
                          <div className="text-red-400/80 ml-2">{row.removed.map(n => `− ${n}`).join(', ')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </>
            )}
          </div>
        </Modal>

        {/* Resolve confirmation dialog */}
        <Modal
          open={!!resolveConfirmChange}
          onClose={() => setResolveConfirmChange(null)}
          title="Resolve before approving?"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              This change is marked as unresolved. Would you like to mark it as resolved?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={async () => {
                if (resolveConfirmChange) {
                  try {
                    await updateDoc(changeDocRef(resolveConfirmChange.id), {
                      approvedBy: arrayUnion(identity.id),
                      seenBy: [identity.id],
                    })
                  } catch (e) {
                    showActionError('Could not approve. Please try again.', e)
                  }
                }
                setResolveConfirmChange(null)
              }}>No, keep unresolved</Button>
              <Button size="sm" onClick={async () => {
                if (resolveConfirmChange) {
                  try {
                    await updateDoc(changeDocRef(resolveConfirmChange.id), {
                      unresolved: false,
                      approvedBy: arrayUnion(identity.id),
                      seenBy: [identity.id],
                    })
                  } catch (e) {
                    showActionError('Could not resolve and approve. Please try again.', e)
                  }
                }
                setResolveConfirmChange(null)
              }}>Yes, resolve</Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  )
}

// ── Page wrapper — loads review doc, then renders workspace ──────────────────

export default function ReviewPage() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const cached = reviewId ? getCachedReview(reviewId) : undefined
  const [review, setReview] = useState<Review | null>(cached ?? null)
  const [loading, setLoading] = useState(!cached)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const fetchedRef = useRef(!!cached)

  useEffect(() => {
    if (!reviewId || fetchedRef.current) return
    fetchedRef.current = true
    setLoadError(null)
    getDoc(doc(db, 'reviews', reviewId!)).then(snap => {
      if (snap.exists()) {
        const r = { id: snap.id, ...snap.data() } as Review
        setCachedReview(reviewId!, r)
        setReview(r)
      } else {
        setNotFound(true)
      }
      setLoading(false)
    }).catch(() => {
      setLoadError('The review could not be loaded right now. Check your connection and try again.')
      setLoading(false)
    })
  }, [reviewId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <span className="text-slate-500 text-sm">Loading review…</span>
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
              title="Couldn&apos;t load review"
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
          <p className="text-sm text-slate-500">This review may have been deleted or the link is invalid.</p>
          <Link to="/" className="text-amber-400 hover:text-amber-300 text-sm">← Start a new review</Link>
        </div>
      </div>
    )
  }

  return (
    <EditModeProvider>
      <ReviewWorkspace reviewId={reviewId!} review={review} />
    </EditModeProvider>
  )
}
