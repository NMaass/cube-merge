import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from '../lib/router'
import { BuildInfoDisplay } from '../components/ui/BuildInfoDisplay'
import { Helmet } from 'react-helmet-async'
import { nanoid } from 'nanoid'
import { Button } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { Spinner } from '../components/ui/Spinner'
import { parseCubeCobraId, parseCompareUrl, fetchCubeCobraCube, computeDiff } from '../lib/cubecobra'
import { getKnownCubeEntries, getLegacyKnownCubeRefs, KnownCubeEntry, persistKnownCube, resolveKnownCubeReference, seedKnownCubes } from '../lib/cubeCards'
import { CubeCard } from '../types/cube'

type PageState = 'form' | 'loading' | 'cors_fallback' | 'creating'
type ActiveField = 'a' | 'b' | null

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

function rankCubeEntry(entry: KnownCubeEntry, query: string): number | null {
  const q = normalizeSearch(query)
  if (!q) return null

  const aliases = [entry.name, entry.shortId, entry.id, entry.canonicalRef, ...entry.aliases]
    .filter((value): value is string => !!value)
    .map(value => value.trim())

  let best: number | null = null
  for (const alias of aliases) {
    const normalized = normalizeSearch(alias)
    if (normalized === q) best = best === null ? 0 : Math.min(best, 0)
    else if (normalized.startsWith(q)) best = best === null ? 1 : Math.min(best, 1)
    else if (normalized.includes(q)) best = best === null ? 2 : Math.min(best, 2)
  }

  return best
}

function formatCubeLabel(entry: KnownCubeEntry): string {
  return entry.name || entry.shortId || entry.canonicalRef
}

function formatCubeSecondary(entry: KnownCubeEntry): string {
  const secondary = [entry.shortId, entry.id].filter(Boolean)
  return secondary.join(' · ')
}

function CubeInput({
  id,
  label,
  accentClass,
  helper,
  value,
  onChange,
  suggestions,
  activeIndex,
  onActivate,
  onSelect,
  onMove,
  onSubmit,
}: {
  id: string
  label: string
  accentClass: string
  helper: string
  value: string
  onChange: (value: string) => void
  suggestions: KnownCubeEntry[]
  activeIndex: number
  onActivate: () => void
  onSelect: (entry: KnownCubeEntry) => void
  onMove: (delta: number) => void
  onSubmit: () => void
}) {
  const menuId = `${id}-suggestions`
  const showSuggestions = suggestions.length > 0
  const blurTimeoutRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (blurTimeoutRef.current !== null) window.clearTimeout(blurTimeoutRef.current)
  }, [])

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-300">
        <span className={`inline-block w-2 h-2 rounded-sm ${accentClass} mr-1.5 mb-0.5 align-middle`} aria-hidden="true" />
        {label} <span className="text-slate-500 font-normal">({helper})</span>
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          placeholder="Cube name, ID, URL, or compare URL"
          value={value}
          onFocus={onActivate}
          onBlur={() => {
            blurTimeoutRef.current = window.setTimeout(() => onMove(-999), 120)
          }}
          onChange={e => {
            if (blurTimeoutRef.current !== null) {
              window.clearTimeout(blurTimeoutRef.current)
              blurTimeoutRef.current = null
            }
            onChange(e.target.value)
            onActivate()
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' && showSuggestions) { e.preventDefault(); onMove(1); return }
            if (e.key === 'ArrowUp' && showSuggestions) { e.preventDefault(); onMove(-1); return }
            if (e.key === 'Enter' && showSuggestions && activeIndex >= 0) {
              e.preventDefault()
              onSelect(suggestions[activeIndex])
              return
            }
            if (e.key === 'Escape') { onMove(-999); return }
            if (e.key === 'Enter') onSubmit()
          }}
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? menuId : undefined}
          aria-activedescendant={showSuggestions && activeIndex >= 0 ? `${menuId}-${activeIndex}` : undefined}
          aria-autocomplete="list"
          className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        />
        {showSuggestions && (
          <div
            id={menuId}
            role="listbox"
            className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-600 bg-slate-850 shadow-2xl shadow-black/35"
          >
            <div className="max-h-72 overflow-y-auto py-1">
              {suggestions.map((entry, index) => {
                const primary = formatCubeLabel(entry)
                const secondary = formatCubeSecondary(entry)

                return (
                  <button
                    key={`${entry.canonicalRef}-${index}`}
                    id={`${menuId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`w-full px-3 py-2 text-left transition-colors ${index === activeIndex ? 'bg-amber-500/15' : 'hover:bg-slate-700/70'}`}
                    onMouseDown={e => {
                      e.preventDefault()
                      if (blurTimeoutRef.current !== null) {
                        window.clearTimeout(blurTimeoutRef.current)
                        blurTimeoutRef.current = null
                      }
                      onSelect(entry)
                    }}
                  >
                    <div className="truncate text-sm font-medium text-slate-100">{primary}</div>
                    {secondary && (
                      <div className="truncate text-xs text-slate-400">{secondary}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function cleanForFirestore(obj: unknown): unknown {
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

export default function LandingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [cubeAInput, setCubeAInput] = useState(searchParams.get('a') || '')
  const [cubeBInput, setCubeBInput] = useState(searchParams.get('b') || '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pageState, setPageState] = useState<PageState>('form')
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [manualError, setManualError] = useState<string | null>(null)
  const [corsIdA, setCorsIdA] = useState('')
  const [corsIdB, setCorsIdB] = useState('')
  const [manualJsonA, setManualJsonA] = useState('')
  const [manualJsonB, setManualJsonB] = useState('')
  const [knownEntries, setKnownEntries] = useState<KnownCubeEntry[]>(() => getKnownCubeEntries())
  const [activeField, setActiveField] = useState<ActiveField>(null)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)

  useEffect(() => {
    let cancelled = false

    seedKnownCubes()
    setKnownEntries(getKnownCubeEntries())

    ;(async () => {
      const legacyRefs = getLegacyKnownCubeRefs()
      if (legacyRefs.length === 0) return

      await Promise.all(legacyRefs.map(async ref => {
        try {
          const cube = await fetchCubeCobraCube(ref)
          persistKnownCube(cube.meta)
        } catch {
          // Leave legacy refs as-is if CubeCobra lookup fails.
        }
      }))

      if (!cancelled) setKnownEntries(getKnownCubeEntries())
    })()

    return () => {
      cancelled = true
    }
  }, [])

  function handleInputA(value: string) {
    setValidationError(null)
    setFetchError(null)
    setManualError(null)
    const compare = parseCompareUrl(value)
    if (compare) { setCubeAInput(compare[0]); setCubeBInput(compare[1]); return }
    setCubeAInput(value)
  }

  function handleInputB(value: string) {
    setValidationError(null)
    setFetchError(null)
    setManualError(null)
    const compare = parseCompareUrl(value)
    if (compare) { setCubeAInput(compare[0]); setCubeBInput(compare[1]); return }
    setCubeBInput(value)
  }

  async function createReviewAndRedirect(
    idA: string,
    idB: string,
    diff: { onlyA: CubeCard[]; onlyB: CubeCard[] }
  ) {
    setPageState('creating')
    const [{ db }, { doc, setDoc, serverTimestamp }] = await Promise.all([
      import('../lib/firebase-lite'),
      import('firebase/firestore/lite'),
    ])
    const reviewId = nanoid(10)
    await setDoc(doc(db, 'reviews', reviewId), {
      ...(cleanForFirestore({
        id: reviewId,
        cubeAId: idA,
        cubeBId: idB,
        title: `${idA} vs ${idB}`,
        rawData: diff,
      }) as object),
      createdAt: serverTimestamp(),
    })
    navigate(`/c/${reviewId}`)
  }

  async function handleStart(overrideA?: string, overrideB?: string) {
    const rawA = parseCubeCobraId((overrideA ?? cubeAInput).trim())
    const rawB = parseCubeCobraId((overrideB ?? cubeBInput).trim())
    const idA = resolveKnownCubeReference(rawA) || rawA
    const idB = resolveKnownCubeReference(rawB) || rawB
    if (!idA) { setValidationError('Cube A ID is required'); return }
    if (!idB) { setValidationError('Cube B ID is required'); return }
    if (idA === idB) { setValidationError('Cube A and Cube B must be different'); return }

    setPageState('loading')
    setFetchError(null)
    setManualError(null)

    let diff: { onlyA: CubeCard[]; onlyB: CubeCard[] }
    try {
      const [cubeA, cubeB] = await Promise.all([
        fetchCubeCobraCube(idA),
        fetchCubeCobraCube(idB),
      ])
      persistKnownCube(cubeA.meta)
      persistKnownCube(cubeB.meta)
      setKnownEntries(getKnownCubeEntries())
      diff = computeDiff(cubeA.cards, cubeB.cards)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'CORS_BLOCKED') {
        setCorsIdA(idA)
        setCorsIdB(idB)
        setPageState('cors_fallback')
      } else if (msg === 'CUBE_NOT_FOUND') {
        setFetchError("Cube not found — IDs are case-sensitive, so double-check for typos. Make sure both cubes are public on CubeCobra.")
        setPageState('form')
      } else {
        setFetchError('Failed to load cube data. Please try again.')
        setPageState('form')
      }
      return
    }

    try {
      await createReviewAndRedirect(idA, idB, diff)
    } catch (e) {
      setFetchError('Failed to create review. Please try again.')
      setPageState('form')
    }
  }

  async function handleManualParse() {
    setFetchError(null)
    setManualError(null)
    try {
      if (!manualJsonA.trim() || !manualJsonB.trim()) {
        setManualError('Paste both cube JSON payloads before creating the review.')
        return
      }

      let cardsA: CubeCard[]
      let cardsB: CubeCard[]

      try {
        cardsA = parseCardsFromJson(JSON.parse(manualJsonA))
      } catch (error) {
        setManualError(`Cube A JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`)
        return
      }

      try {
        cardsB = parseCardsFromJson(JSON.parse(manualJsonB))
      } catch (error) {
        setManualError(`Cube B JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`)
        return
      }

      const diff = computeDiff(cardsA, cardsB)
      await createReviewAndRedirect(corsIdA, corsIdB, diff)
    } catch (e) {
      setManualError(
        e instanceof Error
          ? `The review could not be created: ${e.message}`
          : `The review could not be created: ${String(e)}`
      )
    }
  }

  const [showBuildDetails, setShowBuildDetails] = useState(false)
  const canStart = cubeAInput.trim().length > 0 && cubeBInput.trim().length > 0
  const activeQuery = activeField === 'a' ? cubeAInput : activeField === 'b' ? cubeBInput : ''
  const suggestions = useMemo(() => {
    const query = activeQuery.trim()
    if (query.length < 1) return []

    return knownEntries
      .map(entry => ({ entry, rank: rankCubeEntry(entry, query) }))
      .filter((item): item is { entry: KnownCubeEntry; rank: number } => item.rank !== null)
      .sort((a, b) =>
        a.rank - b.rank ||
        formatCubeLabel(a.entry).localeCompare(formatCubeLabel(b.entry))
      )
      .slice(0, 6)
      .map(item => item.entry)
  }, [activeQuery, knownEntries])

  useEffect(() => {
    setActiveSuggestionIndex(suggestions.length > 0 ? 0 : -1)
  }, [activeField, activeQuery, suggestions.length])

  function dismissSuggestions() {
    setActiveField(null)
    setActiveSuggestionIndex(-1)
  }

  function moveSuggestion(delta: number) {
    if (delta === -999) {
      dismissSuggestions()
      return
    }
    if (suggestions.length === 0) return
    setActiveSuggestionIndex(current => {
      const base = current < 0 ? 0 : current
      return (base + delta + suggestions.length) % suggestions.length
    })
  }

  function selectSuggestion(entry: KnownCubeEntry) {
    const label = formatCubeLabel(entry)
    if (activeField === 'a') setCubeAInput(label)
    if (activeField === 'b') setCubeBInput(label)
    dismissSuggestions()
  }

  // ── CORS fallback ──────────────────────────────────────────────────────────
  if (pageState === 'cors_fallback' || pageState === 'creating') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
        <div className="max-w-lg w-full space-y-4">
          {pageState === 'creating' ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner />
              <p className="text-slate-400 text-sm">Creating review…</p>
            </div>
          ) : (
            <>
              <div>
                <button
                  onClick={() => {
                    setPageState('form')
                    setManualError(null)
                  }}
                  className="text-slate-400 hover:text-slate-200 text-sm mb-3"
                >
                  ← Back
                </button>
                <p className="text-amber-400 font-medium">Couldn't import automatically</p>
                <p className="text-sm text-slate-400 mt-1">
                  Your browser couldn't reach CubeCobra directly. You can still create the review manually in three quick steps.
                </p>
              </div>
              <Notice tone="info" title="Manual import steps">
                <ol className="space-y-1 pl-5 list-decimal text-sm">
                  <li>Open each CubeCobra API link in a new tab.</li>
                  <li>Copy the full JSON response for each cube.</li>
                  <li>Paste both payloads below and create the review.</li>
                </ol>
              </Notice>
              <div className="space-y-3">
                <a
                  href={`https://cubecobra.com/cube/api/cubeJSON/${corsIdA}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-blue-400 hover:underline font-mono"
                >
                  /cube/api/cubeJSON/{corsIdA} ↗
                </a>
                <textarea
                  placeholder="Paste Cube A JSON here…"
                  aria-label="Cube A JSON"
                  value={manualJsonA}
                  onChange={e => setManualJsonA(e.target.value)}
                  className="w-full h-24 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
                <a
                  href={`https://cubecobra.com/cube/api/cubeJSON/${corsIdB}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-blue-400 hover:underline font-mono"
                >
                  /cube/api/cubeJSON/{corsIdB} ↗
                </a>
                <textarea
                  placeholder="Paste Cube B JSON here…"
                  aria-label="Cube B JSON"
                  value={manualJsonB}
                  onChange={e => setManualJsonB(e.target.value)}
                  className="w-full h-24 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
                {manualError ? (
                  <Notice tone="error" title="Import problem">
                    {manualError}
                  </Notice>
                ) : null}
                {fetchError ? (
                  <Notice tone="error" title="Automatic import failed">
                    {fetchError}
                  </Notice>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={handleManualParse}
                    disabled={!manualJsonA.trim() || !manualJsonB.trim()}
                    className="w-full"
                  >
                    Create Review From JSON
                  </Button>
                  <Button
                    onClick={() => handleStart()}
                    variant="secondary"
                    className="w-full sm:w-auto"
                  >
                    Retry automatic import
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  If parsing fails, make sure you copied the raw JSON response and not the formatted page chrome from your browser.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-slate-400 text-sm">Fetching cube data…</p>
        </div>
      </div>
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <>
      <Helmet>
        <title>Cube Merge — MTG Cube Comparison Tool</title>
        <meta name="description" content="Compare two MTG cube lists side by side, annotate card changes, and collaborate in real time with your playgroup." />
        <meta name="keywords" content="MTG cube, cube merge, cube comparison, magic the gathering, cube list, cubecobra" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Cube Merge — MTG Cube Comparison Tool" />
        <meta property="og:description" content="Compare two MTG cube lists side by side, annotate card changes, and collaborate in real time." />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Cube Merge — MTG Cube Comparison Tool" />
        <meta name="twitter:description" content="Compare two MTG cube lists, annotate changes, and collaborate in real time." />
        <link rel="canonical" href="https://cube-merge.pages.dev/" />
      </Helmet>

      <div className="min-h-screen bg-slate-900 flex flex-col" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(51 65 85 / 0.4) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}>
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
              <rect x="2" y="4" width="12" height="24" rx="2.5" fill="#ef4444"/>
              <rect x="18" y="4" width="12" height="24" rx="2.5" fill="#22c55e"/>
              <rect x="13" y="4" width="6" height="24" fill="#0f172a"/>
              <rect x="4.5" y="15.5" width="7" height="1.5" rx="0.75" fill="white"/>
              <rect x="20" y="15.5" width="7" height="1.5" rx="0.75" fill="white"/>
              <rect x="22.75" y="12" width="1.5" height="8" rx="0.75" fill="white"/>
            </svg>
            <span className="text-lg font-semibold text-white tracking-tight">Cube Merge</span>
          </div>
        </nav>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="max-w-lg w-full space-y-8">

            <div className="text-center space-y-3">
              <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
                Merge<br className="sm:hidden" />{' '}
                <span className="text-red-400">Cube</span>
                {' '}
                <span className="text-green-400">Lists</span>
              </h1>
              <p className="text-slate-400 text-base sm:text-lg max-w-sm mx-auto">
                Compare two CubeCobra lists, annotate card changes, and collaborate in real time with your playgroup.
              </p>
            </div>

            <form
              className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 space-y-4 shadow-xl shadow-black/20"
              onSubmit={e => { e.preventDefault(); handleStart() }}
            >
              <CubeInput
                id="cube-a-input"
                label="Cube A"
                accentClass="bg-red-400"
                helper="original"
                value={cubeAInput}
                onChange={handleInputA}
                suggestions={activeField === 'a' ? suggestions : []}
                activeIndex={activeField === 'a' ? activeSuggestionIndex : -1}
                onActivate={() => setActiveField('a')}
                onSelect={selectSuggestion}
                onMove={moveSuggestion}
                onSubmit={() => handleStart()}
              />

              <CubeInput
                id="cube-b-input"
                label="Cube B"
                accentClass="bg-green-400"
                helper="updated"
                value={cubeBInput}
                onChange={handleInputB}
                suggestions={activeField === 'b' ? suggestions : []}
                activeIndex={activeField === 'b' ? activeSuggestionIndex : -1}
                onActivate={() => setActiveField('b')}
                onSelect={selectSuggestion}
                onMove={moveSuggestion}
                onSubmit={() => handleStart()}
              />

              {(validationError || fetchError) && (
                <p role="alert" className="text-sm text-red-400">{validationError || fetchError}</p>
              )}

              <Button
                type="submit"
                disabled={!canStart}
                className={`w-full ${canStart ? 'btn-glow' : ''}`}
                size="lg"
              >
                Start Review →
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => handleStart('LSVCube', 'modovintage')}
                className="text-sm text-slate-400 hover:text-amber-400 transition-colors underline underline-offset-2"
              >
                Try it with LSV Vintage Cube vs Modo Vintage →
              </button>
            </div>

            <div className="text-center text-sm text-slate-500 space-y-1">
              <p>Or open a published snapshot:</p>
              <p className="font-mono text-slate-400 text-xs">cube-merge.pages.dev/<span className="text-slate-500">{'{snapshotId}'}</span></p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-slate-800/80 text-sm text-slate-500">
          <div className="flex items-center justify-center gap-6">
            <a
              href="https://github.com/NMaass/cube-merge"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-slate-300 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
            <a
              href="https://ko-fi.com/pogatog"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-slate-300 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/>
              </svg>
              Support
            </a>
            <a
              href="mailto:nicholasfmaassen@gmail.com"
              className="flex items-center gap-1.5 hover:text-slate-300 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              Contact
            </a>
            <button
              type="button"
              onClick={() => setShowBuildDetails(v => !v)}
              className="hover:text-slate-300 transition-colors"
            >
              Build Details
            </button>
          </div>
          <BuildInfoDisplay isOpen={showBuildDetails} />
        </footer>
      </div>
    </>
  )
}
