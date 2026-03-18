import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from '../lib/router'
import { getCachedReview, setCachedReview } from '../lib/reviewCache'
import { Helmet } from 'react-helmet-async'
import {
  doc, collection, getDoc, setDoc, updateDoc, onSnapshot,
  Timestamp, writeBatch,
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
import { ChangeModal } from '../components/diff/ChangeModal'
import { PassModal } from '../components/diff/PassModal'
import { EditChangeModal } from '../components/changes/EditChangeModal'
import { SplitChangeModal } from '../components/changes/SplitChangeModal'
import { ChangeCard } from '../components/changes/ChangeCard'
import { useCardImages } from '../hooks/useCardImages'
import { useSectionNav } from '../hooks/useSectionNav'
import { groupBySection, sectionLabel, parseSectionNotation } from '../lib/sorting'
import { computeChangeType } from '../lib/changes'
import { recordCubeCards } from '../lib/cubeCards'
import { CubeCard } from '../types/cube'
import {
  LiveChange, Review, Comment, ChangeType, CommentResolution,
} from '../types/firestore'
import { Modal } from '../components/ui/Modal'

const COPY_FEEDBACK_DURATION_MS = 2000

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
  const { identity, setName } = useAuth()
  const { selectedLeft, selectedRight, clearSelection } = useEditMode()
  const [searchParams] = useSearchParams()
  const [changes, setChanges] = useState<LiveChange[]>([])
  const [changesLoading, setChangesLoading] = useState(true)
  const [mode, setMode] = useState<'edit' | 'view'>(searchParams.get('mode') === 'view' ? 'view' : 'edit')
  const [modalOpen, setModalOpen] = useState(false)
  const [keepModalOpen, setKeepModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [passModalOpen, setPassModalOpen] = useState(false)
  const [editingChange, setEditingChange] = useState<LiveChange | null>(null)
  const [splittingChange, setSplittingChange] = useState<LiveChange | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [linkCopyPop, setLinkCopyPop] = useState(false)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copyTab, setCopyTab] = useState<'summary' | 'cubecobra'>('summary')
  const [copied, setCopied] = useState(false)
  const [copyPop, setCopyPop] = useState(false)
  const [nameInput, setNameInput] = useState(
    identity.displayName === 'Reviewer' ? '' : identity.displayName
  )
  const [editingName, setEditingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const shareMenuRef = useRef<HTMLDivElement>(null)

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
    })
    batch.set(doc(eventsRef()), {
      type: 'change_edited',
      changeId: originalId,
      authorId: identity.id,
      authorName: identity.displayName,
      createdAt: now,
      payload: { before: cleanForFirestore(original), after: cleanForFirestore(afterOriginal) },
    })

    // Create split-off change
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
      comments: [],
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
      })
      setActionError(null)
    } catch (e) {
      showActionError('The comment could not be updated. Please try again.', e)
    }
  }

  async function handleSetName() {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setName(trimmed)
    setEditingName(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 700)

    // Retroactively update attribution on this user's existing changes and comments.
    const updatedChanges = changes.map(change => ({
      ...change,
      authorName: change.authorId === identity.id ? trimmed : change.authorName,
      comments: change.comments.map(cm => (
        cm.authorId === identity.id ? { ...cm, authorName: trimmed } : cm
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
    const order: ChangeType[] = ['swap', 'add', 'remove', 'reject', 'keep']
    const labels: Record<ChangeType, string> = {
      swap: 'SWAPS', add: 'ADDITIONS', remove: 'REMOVALS', reject: 'REJECTS', keep: 'KEEPS',
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

  function handleCopyExport() {
    const text = copyTab === 'summary' ? buildSummaryText() : buildCubeCobraText()
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
    ...(identity.displayName !== 'Reviewer' ? [identity.displayName] : []),
  ])], [changes, identity.displayName])

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
          <SectionNav
            currentIndex={currentIndex}
            total={total}
            currentLabel={currentLabel}
            onPrev={goPrev}
            onNext={goNext}
            onGoTo={goTo}
            findSection={findSection}
            disabled={mode === 'view'}
            sectionComplete={isSectionComplete}
          />

          {/* Right column */}
          <div className="flex items-center justify-end gap-1.5 min-w-0">
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
                  <Button size="sm" variant="keep" onClick={() => setKeepModalOpen(true)}>
                    Keep
                  </Button>
                )}
                {hasRight && !hasLeft && (
                  <Button size="sm" variant="reject" onClick={() => setRejectModalOpen(true)}>
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
            {/* Avatar / name — opens modal with batch-update on save */}
            <button
              onClick={() => { setNameInput(identity.displayName === 'Reviewer' ? '' : identity.displayName); setEditingName(true) }}
              className={`h-auto min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 rounded-full flex items-center justify-center text-[11px] font-bold uppercase text-slate-200 transition-colors shrink-0 ${nameSaved ? 'avatar-saved' : ''} ${identity.displayName === 'Reviewer' ? 'bg-amber-700 hover:bg-amber-600 ring-2 ring-amber-500/50' : 'bg-slate-600 hover:bg-slate-500'}`}
              title={identity.displayName === 'Reviewer' ? 'Tap to set your name' : `Reviewing as ${identity.displayName} — tap to change`}
              aria-label={identity.displayName === 'Reviewer' ? 'Set your name' : `Your name: ${identity.displayName}. Tap to change.`}
            >
              {identity.displayName === 'Reviewer' ? '?' : identity.displayName.charAt(0)}
            </button>
            {/* Share button — mobile only (combines Export + Copy Link) */}
            <div ref={shareMenuRef} className="relative sm:hidden">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShareMenuOpen(v => !v)}
                aria-label="Share"
                className={`min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 px-3 ${linkCopyPop ? 'copy-pop' : ''}`}
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
          <div id="main-content" className="flex flex-col flex-1 min-h-0">
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
                  <Button size="sm" variant="keep" className="min-h-[44px]" onClick={() => setKeepModalOpen(true)}>Keep</Button>
                )}
                {hasRight && !hasLeft && (
                  <Button size="sm" variant="reject" className="min-h-[44px]" onClick={() => setRejectModalOpen(true)}>Reject</Button>
                )}
                {hasLeft && hasRight && (
                  <Button size="sm" variant="pass" className="min-h-[44px]" onClick={() => setPassModalOpen(true)} title="Keep left cards + reject right cards">Pass</Button>
                )}
                <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={clearSelection} aria-label="Clear selection">✕</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {changes.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="text-3xl mb-3 opacity-30">±</div>
                <p className="text-slate-400 font-medium">No changes yet</p>
                <p className="text-sm text-slate-600 mt-1">Select cards in Edit mode to start annotating</p>
              </div>
            ) : (() => {
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
              const myMention = `@${identity.displayName}`
              const hasMention = (c: LiveChange) =>
                identity.displayName !== 'Reviewer' &&
                c.comments.some(cm => cm.body.toLowerCase().includes(myMention.toLowerCase()))
              const sorted = [...changes].sort((a, b) => {
                const aM = hasMention(a), bM = hasMention(b)
                if (aM && !bM) return -1
                if (!aM && bM) return 1
                if (a.unresolved && !b.unresolved) return -1
                if (!a.unresolved && b.unresolved) return 1
                return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
              })
              return (
                <>
                  <div className="flex items-center gap-6 px-2 py-3 mb-1 border-b border-slate-700/60">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-400 leading-none">+{totalIn}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">in</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-400 leading-none">−{totalOut}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">out</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-xl font-bold leading-none ${net >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                        {net >= 0 ? '+' : ''}{net}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">net</div>
                    </div>
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
                  {sorted.map(change => (
                    <ChangeCard
                      key={change.id}
                      change={change}
                      onAddComment={(body, res) => handleAddComment(change.id, body, res)}
                      onSetCommentResolution={(commentId, res) => handleSetCommentResolution(change.id, commentId, res)}
                      onEditComment={(commentId, newBody) => handleEditComment(change.id, commentId, newBody)}
                      onEdit={() => setEditingChange(change)}
                      diffCards={allDiffCards}
                      reviewerNames={reviewerNames}
                    />
                  ))}
                </>
              )
            })()}
          </div>
        )}

        {/* Modals */}
        <ChangeModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          selectedLeftCards={selectedLeftCards}
          selectedRightCards={selectedRightCards}
          onSave={handleSaveChange}
          allDiffCards={allDiffCards}
          reviewerNames={reviewerNames}
        />
        <ChangeModal
          open={keepModalOpen}
          onClose={() => setKeepModalOpen(false)}
          selectedLeftCards={selectedLeftCards}
          selectedRightCards={selectedRightCards}
          onSave={handleSaveChange}
          forceType="keep"
          allDiffCards={allDiffCards}
          reviewerNames={reviewerNames}
        />
        <ChangeModal
          open={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          selectedLeftCards={selectedLeftCards}
          selectedRightCards={selectedRightCards}
          onSave={handleSaveChange}
          forceType="reject"
          allDiffCards={allDiffCards}
          reviewerNames={reviewerNames}
        />
        <PassModal
          open={passModalOpen}
          onClose={() => setPassModalOpen(false)}
          leftCards={selectedLeftCards}
          rightCards={selectedRightCards}
          onSave={handleSavePass}
        />

        {editingChange && (
          <EditChangeModal
            open={!!editingChange}
            onClose={() => setEditingChange(null)}
            change={editingChange}
            allCardsA={diffData.onlyA}
            allCardsB={diffData.onlyB}
            onSave={handleEditChange}
            onDelete={handleDeleteChange}
            onSplit={editingChange.cardsIn.length + editingChange.cardsOut.length > 1 ? () => {
              setSplittingChange(editingChange)
              setEditingChange(null)
            } : undefined}
          />
        )}

        {splittingChange && (
          <SplitChangeModal
            open={!!splittingChange}
            onClose={() => setSplittingChange(null)}
            change={splittingChange}
            onSplit={(orig, fresh) => handleSplitChange(splittingChange.id, orig, fresh)}
          />
        )}

        <Modal
          open={editingName}
          onClose={() => setEditingName(false)}
          title={identity.displayName === 'Reviewer' ? 'Set your name' : 'Your name'}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              {identity.displayName === 'Reviewer'
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
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditingName(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSetName} disabled={!nameInput.trim()}>Save</Button>
            </div>
          </div>
        </Modal>

        <Modal open={copyModalOpen} onClose={() => setCopyModalOpen(false)} title="Export Changes">
          <div className="space-y-3">
            <div className="flex gap-1 bg-slate-700/40 rounded-lg p-1">
              {(['summary', 'cubecobra'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setCopyTab(tab); setCopied(false) }}
                  className={`flex-1 text-sm py-1 rounded-md transition-colors ${copyTab === tab ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {tab === 'summary' ? 'Summary' : 'CubeCobra'}
                </button>
              ))}
            </div>
            <textarea
              readOnly
              value={copyTab === 'summary' ? buildSummaryText() : buildCubeCobraText()}
              className="w-full h-64 bg-slate-900 text-slate-200 text-xs font-mono rounded-lg p-3 resize-none border border-slate-700 focus:outline-none"
            />
            <div className="flex justify-end">
              <Button size="sm" variant="primary" onClick={handleCopyExport} className={copyPop ? 'copy-pop' : ''}>
                {copied ? '✓ Copied!' : 'Copy to clipboard'}
              </Button>
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
