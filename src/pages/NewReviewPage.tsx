import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useLocation } from '../lib/router'
import { Helmet } from 'react-helmet-async'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore/lite'
import { nanoid } from 'nanoid'
import { db, FIREBASE_CONFIGURED } from '../lib/firebase-lite'
import { useAuth } from '../context/AuthContext'
import { EditModeProvider, useEditMode } from '../context/EditModeContext'
import { Spinner } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'
import { SectionNav } from '../components/diff/SectionNav'
import { DiffList } from '../components/diff/DiffList'
import { ModeToggle } from '../components/diff/ModeToggle'
import { ChangeModal } from '../components/diff/ChangeModal'
import { EditChangeModal } from '../components/changes/EditChangeModal'
import { SplitChangeModal } from '../components/changes/SplitChangeModal'
import { ChangeCard } from '../components/changes/ChangeCard'
import { useCubeCobraData } from '../hooks/useCubeCobraData'
import { useCardImages } from '../hooks/useCardImages'
import { useSectionNav } from '../hooks/useSectionNav'
import { groupBySection, sectionLabel, parseSectionNotation } from '../lib/sorting'
import { computeDiff } from '../lib/cubecobra'
import { computeChangeType } from '../lib/changes'
import { recordCubeCards } from '../lib/cubeCards'
import { CubeCard } from '../types/cube'
import { Change, Comment, ChangeType, CommentResolution } from '../types/firestore'
import { Modal } from '../components/ui/Modal'

const COPY_FEEDBACK_DURATION_MS = 2000

type WorkingChange = Change & { comments: Comment[] }

function cleanForFirestore(obj: unknown): unknown {
  if (obj instanceof Timestamp) return obj
  if (obj === undefined || obj === null) return null
  if (Array.isArray(obj)) return obj.map(cleanForFirestore)
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = cleanForFirestore(v)
    }
    return result
  }
  return obj
}

export function ReviewWorkspace({
  cubeAId,
  cubeBId,
  diffData,
  initialChanges,
  parentSnapshotId,
}: {
  cubeAId: string
  cubeBId: string
  diffData: { onlyA: CubeCard[]; onlyB: CubeCard[] }
  initialChanges?: WorkingChange[]
  parentSnapshotId?: string | null
}) {
  const { identity, setName } = useAuth()
  const { selectedLeft, selectedRight, clearSelection } = useEditMode()
  const [changes, setChanges] = useState<WorkingChange[]>(initialChanges ?? [])
  const [mode, setMode] = useState<'edit' | 'view'>('edit')
  const [modalOpen, setModalOpen] = useState(false)
  const [keepModalOpen, setKeepModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [editingChange, setEditingChange] = useState<WorkingChange | null>(null)
  const [splittingChange, setSplittingChange] = useState<WorkingChange | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [urlCopied, setUrlCopied] = useState(false)
  const [urlCopyPop, setUrlCopyPop] = useState(false)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copyTab, setCopyTab] = useState<'summary' | 'cubecobra'>('summary')
  const [copied, setCopied] = useState(false)
  const [nameInput, setNameInput] = useState(identity.displayName === 'Reviewer' ? '' : identity.displayName)
  const [editingName, setEditingName] = useState(false)

  const sections = useMemo(() => groupBySection(diffData.onlyA, diffData.onlyB), [diffData])
  const { currentIndex, goNext, goPrev, goTo, total } = useSectionNav(sections)

  useEffect(() => {
    recordCubeCards(cubeAId, diffData.onlyA.map(c => c.name))
    recordCubeCards(cubeBId, diffData.onlyB.map(c => c.name))
  }, [cubeAId, cubeBId])
  const { imageMap, loadingSet } = useCardImages(sections, currentIndex)
  const currentLabel = sections[currentIndex] ? sectionLabel(sections[currentIndex].colorCategory, sections[currentIndex].cmc) : ''
  const findSection = (input: string) => parseSectionNotation(input, sections)

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

  function makeChange(type: ChangeType, cardsOut: CubeCard[], cardsIn: CubeCard[], comment = '', unresolved = false): WorkingChange {
    return {
      id: nanoid(8),
      type,
      cardsOut,
      cardsIn,
      initialComment: comment,
      authorId: identity.id,
      authorName: identity.displayName,
      authorPhotoURL: identity.photoURL,
      unresolved,
      createdAt: Timestamp.now(),
      comments: [],
    }
  }

  function handleSaveChange(type: ChangeType, cardsOut: CubeCard[], cardsIn: CubeCard[], comment: string, unresolved: boolean) {
    const outNames = new Set(cardsOut.map(c => c.name))
    const inNames = new Set(cardsIn.map(c => c.name))
    setChanges(prev => {
      // Strip re-used cards from existing changes; remove any change that becomes empty
      const stripped = prev
        .map(c => ({
          ...c,
          cardsOut: c.cardsOut.filter(card => !outNames.has(card.name)),
          cardsIn: c.cardsIn.filter(card => !inNames.has(card.name)),
        }))
        .filter(c => c.cardsOut.length > 0 || c.cardsIn.length > 0)
      return [makeChange(type, cardsOut, cardsIn, comment, unresolved), ...stripped]
    })
  }

  function handleKeepCards() {
    if (selectedLeftCards.length === 0) return
    setKeepModalOpen(true)
  }

  function handleRejectCards() {
    if (selectedRightCards.length === 0) return
    setRejectModalOpen(true)
  }

  function handleAddComment(changeId: string, body: string, _resolution: CommentResolution) {
    setChanges(prev => prev.map(c =>
      c.id === changeId
        ? {
            ...c,
            comments: [...c.comments, {
              id: nanoid(8),
              body,
              authorId: identity.id,
              authorName: identity.displayName,
              authorPhotoURL: identity.photoURL,
              resolution: 'none' as const,
              createdAt: Timestamp.now(),
            }],
          }
        : c
    ))
  }

  function handleSetCommentResolution(changeId: string, commentId: string, resolution: CommentResolution) {
    setChanges(prev => prev.map(c =>
      c.id === changeId
        ? { ...c, comments: c.comments.map(cm => cm.id === commentId ? { ...cm, resolution } : cm) }
        : c
    ))
  }

  function handleEditChange(changeId: string, updates: { initialComment: string; cardsOut: CubeCard[]; cardsIn: CubeCard[]; type: ChangeType; unresolved: boolean }) {
    setChanges(prev => prev.map(c => c.id === changeId ? { ...c, ...updates } : c))
  }

  function handleSplitChange(
    originalId: string,
    originalUpdates: { cardsOut: CubeCard[]; cardsIn: CubeCard[]; type: ChangeType },
    newChange: { cardsOut: CubeCard[]; cardsIn: CubeCard[]; type: ChangeType; comment: string }
  ) {
    setChanges(prev => {
      const original = prev.find(c => c.id === originalId)
      if (!original) return prev
      const updated = prev.map(c => c.id === originalId ? { ...c, ...originalUpdates } : c)
      const fresh = makeChange(newChange.type, newChange.cardsOut, newChange.cardsIn, newChange.comment)
      return [fresh, ...updated]
    })
  }

  function handleSetName() {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setName(trimmed)
    setEditingName(false)
    setChanges(prev => prev.map(c => ({
      ...c,
      authorName: c.authorId === identity.id ? trimmed : c.authorName,
      comments: c.comments.map(cm => ({
        ...cm,
        authorName: cm.authorId === identity.id ? trimmed : cm.authorName,
      })),
    })))
  }

  function buildSummaryText(): string {
    const lines: string[] = []
    lines.push(`${cubeAId} vs ${cubeBId}`)
    lines.push(new Date().toLocaleDateString())
    lines.push('')
    const byType: Record<string, WorkingChange[]> = {}
    for (const ch of changes) {
      const t = computeChangeType(ch.cardsOut, ch.cardsIn, ch.type)
      ;(byType[t] ??= []).push(ch)
    }
    const order: ChangeType[] = ['swap', 'add', 'remove', 'reject', 'keep']
    const labels: Record<ChangeType, string> = { swap: 'SWAPS', add: 'ADDITIONS', remove: 'REMOVALS', reject: 'REJECTS', keep: 'KEEPS' }
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
    // stats
    const addedNames = new Set<string>()
    const removedNames = new Set<string>()
    for (const ch of changes) {
      const dt = computeChangeType(ch.cardsOut, ch.cardsIn, ch.type)
      if (dt === 'add' || dt === 'swap') ch.cardsIn.forEach(c => addedNames.add(c.name))
      if (dt === 'remove' || dt === 'swap') ch.cardsOut.forEach(c => removedNames.add(c.name))
    }
    const net = addedNames.size - removedNames.size
    lines.push(`+${addedNames.size} in / −${removedNames.size} out / net ${net >= 0 ? '+' : ''}${net}  (${changes.length} changes)`)
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

  const [copyPop, setCopyPop] = useState(false)

  function triggerCopyPop(setter: (v: boolean) => void, popSetter: (v: boolean) => void) {
    setter(true)
    popSetter(true)
    setTimeout(() => popSetter(false), 400)
    setTimeout(() => setter(false), COPY_FEEDBACK_DURATION_MS)
  }

  function handleCopy() {
    const text = copyTab === 'summary' ? buildSummaryText() : buildCubeCobraText()
    navigator.clipboard.writeText(text).then(() => triggerCopyPop(setCopied, setCopyPop))
  }

  function handleCopyShareUrl() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => triggerCopyPop(setUrlCopied, setUrlCopyPop))
  }

  async function handleExport() {
    if (!FIREBASE_CONFIGURED) {
      setExportError('Firebase not configured — add VITE_FIREBASE_* variables to .env')
      return
    }
    setExporting(true)
    setExportError(null)

    // Quick connectivity check — if this times out, Firestore likely hasn't been
    // created yet in the Firebase Console (Build → Firestore Database → Create database).
    try {
      await Promise.race([
        getDoc(doc(db, 'meta', 'ping')),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('__connect_timeout')), 4000)
        ),
      ])
    } catch (e) {
      if (e instanceof Error && e.message === '__connect_timeout') {
        setExportError(
          'Cannot reach Firestore. In Firebase Console → Build → Firestore Database, make sure the database has been created.'
        )
        setExporting(false)
        return
      }
      // A Firestore error (e.g. permission-denied on /meta/ping) is fine —
      // it means Firestore IS reachable, just that doc doesn't exist or isn't readable.
    }

    try {
      const id = nanoid(10)
      const writePromise = setDoc(doc(db, 'snapshots', id), cleanForFirestore({
        sourceReviewId: id,
        parentSnapshotId: parentSnapshotId ?? null,
        ownerId: identity.id,
        ownerName: identity.displayName,
        ownerPhotoURL: identity.photoURL,
        frozenAt: Timestamp.now(),
        cubeAId,
        cubeBId,
        title: `${cubeAId} vs ${cubeBId}`,
        rawData: diffData,
        changes,
      }) as object)
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore write timed out — check Firebase config')), 10_000)
      )
      await Promise.race([writePromise, timeout])
      setShareUrl(`${window.location.origin}/${id}`)
    } catch (e) {
      console.error('Export failed:', e)
      setExportError(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Cube Diff</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="h-dvh bg-slate-900 flex flex-col overflow-hidden">
        {/* Unified sticky header — single row on all screen sizes */}
        <header className="shrink-0 flex items-center gap-1.5 px-2 py-2 bg-slate-800 border-b border-slate-700 overflow-x-hidden">
          <ModeToggle mode={mode} onChange={setMode} />
          <SectionNav
            currentIndex={currentIndex}
            total={total}
            currentLabel={currentLabel}
            onPrev={goPrev}
            onNext={goNext}
            onGoTo={goTo}
            findSection={findSection}
            disabled={mode === 'view'}
          />

          {/* Action buttons — desktop only, edit mode */}
          {mode === 'edit' && hasSelection && (
            <div className="hidden md:flex items-center gap-1.5">
              <Button
                onClick={() => setModalOpen(true)}
                size="sm"
                variant={hasLeft && !hasRight ? 'danger' : 'primary'}
              >
                {actionLabel}
              </Button>
              {hasLeft && !hasRight && (
                <Button size="sm" variant="keep" onClick={handleKeepCards}>
                  Keep
                </Button>
              )}
              {hasRight && !hasLeft && (
                <Button size="sm" variant="reject" onClick={handleRejectCards}>
                  Reject
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                ✕
              </Button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5 min-w-0">
            {exportError && (
              <span className="hidden sm:inline text-xs text-red-400 max-w-[140px] truncate" title={exportError}>
                Share failed
              </span>
            )}
            {/* Share URL — desktop only */}
            {shareUrl && (
              <div className="hidden md:flex items-center gap-1.5 bg-slate-700/60 border border-slate-600 rounded-lg px-2 h-8">
                <span className="text-xs font-mono text-slate-300 max-w-[140px] truncate">{shareUrl}</span>
                <button
                  onClick={handleCopyShareUrl}
                  className={`text-slate-400 hover:text-white transition-colors ${urlCopyPop ? 'copy-pop' : ''}`}
                  aria-label="Copy share link"
                >
                  {urlCopied
                    ? <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  }
                </button>
              </div>
            )}
            {/* Copy link on mobile when URL ready */}
            {shareUrl && (
              <button
                className={`md:hidden h-9 w-9 min-h-9 min-w-9 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors ${urlCopyPop ? 'copy-pop' : ''}`}
                onClick={handleCopyShareUrl}
                aria-label="Copy share link"
              >
                {urlCopied
                  ? <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                }
              </button>
            )}
            {/* Export: text on sm+, icon on mobile */}
            <Button variant="secondary" size="sm" onClick={() => { setCopyTab('summary'); setCopyModalOpen(true) }} aria-label="Export changes">
              <svg className="w-3.5 h-3.5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              <span className="hidden sm:inline">Export</span>
            </Button>
            {/* Share / Re-snap */}
            <Button variant="primary" size="sm" onClick={handleExport} disabled={exporting} aria-label={shareUrl ? 'Re-snap review' : 'Share review'}>
              {exporting
                ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                : shareUrl
                  ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  : <><svg className="w-3.5 h-3.5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg><span className="hidden sm:inline">Share</span></>
              }
            </Button>
            {/* Name / avatar */}
            {editingName ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSetName(); if (e.key === 'Escape') setEditingName(false) }}
                  placeholder="Your name"
                  aria-label="Your display name"
                  className="h-9 w-24 bg-slate-700 border border-slate-600 rounded px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Button size="sm" onClick={handleSetName} aria-label="Confirm name">✓</Button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="h-9 min-h-9 min-w-9 flex items-center gap-1.5 px-2 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition-colors"
                title="Set your name"
              >
                <span className="w-5 h-5 rounded-full bg-slate-500 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                  {identity.displayName[0]}
                </span>
                <span className="hidden sm:inline">{identity.displayName}</span>
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        {mode === 'edit' ? (
          <div id="main-content" className="flex flex-col flex-1 min-h-0">
            <DiffList sections={sections} imageMap={imageMap} loadingSet={loadingSet} changes={changes} />
            {/* Mobile-only sticky action bar */}
            {hasSelection && (
              <div className="md:hidden shrink-0 bg-slate-800 border-t border-slate-700 px-3 py-2 flex items-center gap-2">
                <Button
                  onClick={() => setModalOpen(true)}
                  size="sm"
                  className="flex-1"
                  variant={hasLeft && !hasRight ? 'danger' : 'primary'}
                >
                  {actionLabel}
                </Button>
                {hasLeft && !hasRight && (
                  <Button size="sm" variant="keep" onClick={handleKeepCards}>
                    Keep
                  </Button>
                )}
                {hasRight && !hasLeft && (
                  <Button size="sm" variant="reject" onClick={handleRejectCards}>
                    Reject
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={clearSelection} aria-label="Clear selection">
                  ✕
                </Button>
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
              // Compute stats
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
              const hasMention = (c: WorkingChange) =>
                identity.displayName !== 'Reviewer' &&
                c.comments.some(cm => cm.body.includes(myMention))
              const sorted = [...changes].sort((a, b) => {
                const aM = hasMention(a), bM = hasMention(b)
                if (aM && !bM) return -1
                if (!aM && bM) return 1
                if (a.unresolved && !b.unresolved) return -1
                if (!a.unresolved && b.unresolved) return 1
                return 0
              })
              const diffCards = [
                ...diffData.onlyA.map(c => c.name),
                ...diffData.onlyB.map(c => c.name),
              ]
              const reviewerNames = [...new Set(changes.map(c => c.authorName).filter(Boolean))]
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
                    <div className="text-center ml-auto">
                      <div className="text-xl font-bold text-slate-400 leading-none">{changes.length}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">changes</div>
                    </div>
                  </div>
                  {sorted.map(change => (
                    <ChangeCard
                      key={change.id}
                      change={change}
                      onAddComment={(body, res) => handleAddComment(change.id, body, res)}
                      onSetCommentResolution={(commentId, res) => handleSetCommentResolution(change.id, commentId, res)}
                      onEdit={() => setEditingChange(change)}
                      diffCards={diffCards}
                      reviewerNames={reviewerNames}
                    />
                  ))}
                </>
              )
            })()}
          </div>
        )}

        <ChangeModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          selectedLeftCards={selectedLeftCards}
          selectedRightCards={selectedRightCards}
          onSave={handleSaveChange}
        />

        <ChangeModal
          open={keepModalOpen}
          onClose={() => setKeepModalOpen(false)}
          selectedLeftCards={selectedLeftCards}
          selectedRightCards={selectedRightCards}
          onSave={handleSaveChange}
          forceType="keep"
        />

        <ChangeModal
          open={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          selectedLeftCards={selectedLeftCards}
          selectedRightCards={selectedRightCards}
          onSave={handleSaveChange}
          forceType="reject"
        />

        {editingChange && (
          <EditChangeModal
            open={!!editingChange}
            onClose={() => setEditingChange(null)}
            change={editingChange}
            allCardsA={diffData.onlyA}
            allCardsB={diffData.onlyB}
            onSave={handleEditChange}
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
              <Button size="sm" variant="primary" onClick={handleCopy} className={copyPop ? 'copy-pop' : ''}>
                {copied ? '✓ Copied!' : 'Copy to clipboard'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  )
}

// ── Manual entry fallback when CubeCobra is CORS-blocked ──────────────────────

function parseCardsFromJson(raw: unknown): CubeCard[] {
  let items: unknown[] = []
  if (Array.isArray(raw)) {
    items = raw
  } else if (raw && typeof raw === 'object') {
    const d = raw as Record<string, unknown>
    if (Array.isArray(d.cards)) {
      items = d.cards
    } else if (d.cards && typeof d.cards === 'object') {
      const cardObj = d.cards as Record<string, unknown>
      const mainboard = cardObj.mainboard ?? cardObj.Mainboard
      items = Array.isArray(mainboard)
        ? mainboard
        : Object.values(cardObj).filter(Array.isArray).flat()
    }
  }
  if (items.length === 0) throw new Error('Could not find card list in JSON')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return items.map((c: any) => ({
    name: c.details?.name || c.name || String(c),
    colorCategory: 'C' as const,
    cmc: c.details?.cmc ?? c.cmc ?? 0,
    colors: c.details?.colors || c.colors || [],
  })).filter((c: CubeCard) => c.name)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewReviewPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const cubeAId = params.get('a') || ''
  const cubeBId = params.get('b') || ''
  const { errorKind, fetchDiff } = useCubeCobraData()
  const [diffData, setDiffData] = useState<{ onlyA: CubeCard[]; onlyB: CubeCard[] } | null>(
    (location.state as { diffData?: { onlyA: CubeCard[]; onlyB: CubeCard[] } } | null)?.diffData ?? null
  )
  const [fetching, setFetching] = useState(false)
  const [manualJsonA, setManualJsonA] = useState('')
  const [manualJsonB, setManualJsonB] = useState('')
  const fetchedRef = useRef(false)

  useEffect(() => {
    // Skip fetch if rawData was passed directly (e.g. forked from a snapshot)
    if (diffData || !cubeAId || !cubeBId || fetchedRef.current) return
    fetchedRef.current = true
    setFetching(true)
    fetchDiff(cubeAId, cubeBId)
      .then(diff => { if (diff) setDiffData(diff) })
      .finally(() => setFetching(false))
  }, [cubeAId, cubeBId])

  function handleManualParse() {
    try {
      const cardsA = parseCardsFromJson(JSON.parse(manualJsonA))
      const cardsB = parseCardsFromJson(JSON.parse(manualJsonB))
      setDiffData(computeDiff(cardsA, cardsB))
    } catch (e) {
      alert('Failed to parse JSON: ' + String(e))
    }
  }

  if (diffData) {
    return (
      <EditModeProvider>
        <ReviewWorkspace cubeAId={cubeAId} cubeBId={cubeBId} diffData={diffData} />
      </EditModeProvider>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full space-y-4">
        {fetching ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner />
            <p className="text-slate-400 text-sm">Fetching cube data…</p>
          </div>
        ) : errorKind === 'CUBE_NOT_FOUND' ? (
          <div className="space-y-3">
            <p className="text-red-400 font-medium">Cube not found</p>
            <p className="text-sm text-slate-400">
              Check that both IDs are correct and the cubes are public on CubeCobra.
            </p>
            <a href="/" className="text-blue-400 hover:text-blue-300 text-sm">← Go back</a>
          </div>
        ) : errorKind === 'CORS_BLOCKED' ? (
          <div className="space-y-4">
            <div>
              <p className="text-amber-400 font-medium">CubeCobra blocked the request</p>
              <p className="text-sm text-slate-400 mt-1">
                Open each URL below, copy the full JSON, and paste it here.
              </p>
            </div>
            <div className="space-y-2">
              <a href={`https://cubecobra.com/cube/api/cubeJSON/${cubeAId}`} target="_blank" rel="noreferrer"
                className="block text-xs text-blue-400 hover:underline font-mono">
                /cube/api/cubeJSON/{cubeAId} ↗
              </a>
              <textarea
                placeholder="Paste Cube A JSON here…"
                value={manualJsonA}
                onChange={e => setManualJsonA(e.target.value)}
                className="w-full h-24 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <a href={`https://cubecobra.com/cube/api/cubeJSON/${cubeBId}`} target="_blank" rel="noreferrer"
                className="block text-xs text-blue-400 hover:underline font-mono">
                /cube/api/cubeJSON/{cubeBId} ↗
              </a>
              <textarea
                placeholder="Paste Cube B JSON here…"
                value={manualJsonB}
                onChange={e => setManualJsonB(e.target.value)}
                className="w-full h-24 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <Button onClick={handleManualParse} className="w-full">Parse & Open Review</Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
