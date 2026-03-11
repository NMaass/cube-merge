import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { doc, setDoc, Timestamp } from 'firebase/firestore'
import { nanoid } from 'nanoid'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { parseCubeCobraId, parseCompareUrl, fetchCubeCobraList, computeDiff } from '../lib/cubecobra'
import { getKnownCubeIds } from '../lib/cubeCards'
import { db } from '../lib/firebase'
import { CubeCard } from '../types/cube'

type PageState = 'form' | 'loading' | 'cors_fallback' | 'creating'

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
  const [cubeAInput, setCubeAInput] = useState('')
  const [cubeBInput, setCubeBInput] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pageState, setPageState] = useState<PageState>('form')
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [corsIdA, setCorsIdA] = useState('')
  const [corsIdB, setCorsIdB] = useState('')
  const [manualJsonA, setManualJsonA] = useState('')
  const [manualJsonB, setManualJsonB] = useState('')
  const knownIds = getKnownCubeIds()

  function handleInputA(value: string) {
    setValidationError(null)
    setFetchError(null)
    const compare = parseCompareUrl(value)
    if (compare) { setCubeAInput(compare[0]); setCubeBInput(compare[1]); return }
    setCubeAInput(value)
  }

  function handleInputB(value: string) {
    setValidationError(null)
    setFetchError(null)
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
    const reviewId = nanoid(10)
    await setDoc(doc(db, 'reviews', reviewId), cleanForFirestore({
      id: reviewId,
      cubeAId: idA,
      cubeBId: idB,
      title: `${idA} vs ${idB}`,
      rawData: diff,
      createdAt: Timestamp.now(),
    }) as object)
    navigate(`/review/${reviewId}`)
  }

  async function handleStart() {
    const idA = parseCubeCobraId(cubeAInput.trim())
    const idB = parseCubeCobraId(cubeBInput.trim())
    if (!idA) { setValidationError('Cube A ID is required'); return }
    if (!idB) { setValidationError('Cube B ID is required'); return }
    if (idA === idB) { setValidationError('Cube A and Cube B must be different'); return }

    setPageState('loading')
    setFetchError(null)
    try {
      const [cardsA, cardsB] = await Promise.all([
        fetchCubeCobraList(idA),
        fetchCubeCobraList(idB),
      ])
      const diff = computeDiff(cardsA, cardsB)
      await createReviewAndRedirect(idA, idB, diff)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'CORS_BLOCKED') {
        setCorsIdA(idA)
        setCorsIdB(idB)
        setPageState('cors_fallback')
      } else if (msg === 'CUBE_NOT_FOUND') {
        setFetchError('Cube not found — check that both IDs are correct and public on CubeCobra.')
        setPageState('form')
      } else {
        setFetchError('Failed to load cube data. Please try again.')
        setPageState('form')
      }
    }
  }

  async function handleManualParse() {
    try {
      const cardsA = parseCardsFromJson(JSON.parse(manualJsonA))
      const cardsB = parseCardsFromJson(JSON.parse(manualJsonB))
      const diff = computeDiff(cardsA, cardsB)
      await createReviewAndRedirect(corsIdA, corsIdB, diff)
    } catch (e) {
      alert('Failed to parse JSON: ' + String(e))
    }
  }

  const canStart = cubeAInput.trim().length > 0 && cubeBInput.trim().length > 0

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
                  onClick={() => setPageState('form')}
                  className="text-slate-400 hover:text-slate-200 text-sm mb-3"
                >
                  ← Back
                </button>
                <p className="text-amber-400 font-medium">CubeCobra blocked the request</p>
                <p className="text-sm text-slate-400 mt-1">
                  Open each URL below, copy the full JSON, and paste it here.
                </p>
              </div>
              <div className="space-y-2">
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
                  value={manualJsonA}
                  onChange={e => setManualJsonA(e.target.value)}
                  className="w-full h-24 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
                  value={manualJsonB}
                  onChange={e => setManualJsonB(e.target.value)}
                  className="w-full h-24 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <Button
                  onClick={handleManualParse}
                  disabled={!manualJsonA.trim() || !manualJsonB.trim()}
                  className="w-full"
                >
                  Parse & Open Review
                </Button>
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
        <link rel="canonical" href="https://cubediff.app/" />
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
        <main id="main-content" className="flex-1 flex flex-col items-center justify-center px-4 py-12">
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

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 space-y-4 shadow-xl shadow-black/20">
              {knownIds.length > 0 && (
                <datalist id="known-cube-ids">
                  {knownIds.map(id => <option key={id} value={id} />)}
                </datalist>
              )}

              <div className="space-y-1.5">
                <label htmlFor="cube-a-input" className="block text-sm font-medium text-slate-300">
                  <span className="inline-block w-2 h-2 rounded-sm bg-red-400 mr-1.5 mb-0.5 align-middle" aria-hidden="true" />
                  Cube A <span className="text-slate-500 font-normal">(original)</span>
                </label>
                <input
                  id="cube-a-input"
                  type="text"
                  list="known-cube-ids"
                  placeholder="ID, URL, or compare URL"
                  value={cubeAInput}
                  onChange={e => handleInputA(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleStart()}
                  autoComplete="off"
                  className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="cube-b-input" className="block text-sm font-medium text-slate-300">
                  <span className="inline-block w-2 h-2 rounded-sm bg-green-400 mr-1.5 mb-0.5 align-middle" aria-hidden="true" />
                  Cube B <span className="text-slate-500 font-normal">(updated)</span>
                </label>
                <input
                  id="cube-b-input"
                  type="text"
                  list="known-cube-ids"
                  placeholder="ID, URL, or compare URL"
                  value={cubeBInput}
                  onChange={e => handleInputB(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleStart()}
                  autoComplete="off"
                  className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {(validationError || fetchError) && (
                <p role="alert" className="text-sm text-red-400">{validationError || fetchError}</p>
              )}

              <Button
                onClick={handleStart}
                disabled={!canStart}
                className="w-full"
                size="lg"
              >
                Start Review →
              </Button>
            </div>

            <div className="text-center text-sm text-slate-500 space-y-1">
              <p>Or open a published snapshot:</p>
              <p className="font-mono text-slate-400 text-xs">cubediff.app/<span className="text-slate-500">{'{snapshotId}'}</span></p>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
