import { memo, useEffect, useRef, useState } from 'react'
import { CubeCard } from '../../types/cube'
import { ManaCostPips } from './ManaCostPips'
import { FullscreenCardModal } from './FullscreenCardModal'
import { CardHoverPortal } from './CardHoverPortal'
import { clearCachedImage, fetchAndCacheImages } from '../../lib/imageCache'
import { useCardHoverPreview } from '../../hooks/useCardHoverPreview'

export type { CardState } from '../../types/cardState'
import type { CardState } from '../../types/cardState'

interface CardListItemProps {
  card: CubeCard
  state: CardState
  imageUrl?: string
  backImageUrl?: string
  loading?: boolean
  onClick?: () => void
}

const ROW_CLASS: Record<CardState, string> = {
  normal: 'hover:bg-slate-700/30 cursor-pointer transition-colors',
  selected: 'bg-amber-900/20 cursor-pointer',
  accepted: 'bg-green-900/10 cursor-pointer opacity-80',
  removed: 'bg-red-900/10 cursor-pointer opacity-80',
  kept: 'bg-teal-900/10 cursor-pointer opacity-80',
  rejected: 'bg-orange-900/10 cursor-pointer opacity-80',
}

const NAME_CLASS: Record<CardState, string> = {
  normal: 'text-slate-200',
  selected: 'text-amber-300 font-semibold',
  accepted: 'text-green-300',
  removed: 'text-red-300',
  kept: 'text-teal-300',
  rejected: 'text-orange-300',
}

export const CardListItem = memo(function CardListItem({ card, state, imageUrl, backImageUrl, loading, onClick }: CardListItemProps) {
  const { hoverPos, setPosition, close, activeRef } = useCardHoverPreview()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [recoveredUrl, setRecoveredUrl] = useState<string | undefined>(undefined)
  const [recoveredBack, setRecoveredBack] = useState<string | undefined>(undefined)
  const [recovering, setRecovering] = useState(false)
  const [selectPop, setSelectPop] = useState(false)
  const prevStateRef = useRef(state)

  useEffect(() => {
    if (state === 'selected' && prevStateRef.current !== 'selected') {
      setSelectPop(true)
      const t = setTimeout(() => setSelectPop(false), 250)
      return () => clearTimeout(t)
    }
    prevStateRef.current = state
  }, [state])

  const effectiveUrl = recoveredUrl ?? imageUrl
  const effectiveBack = recoveredBack ?? backImageUrl

  async function ensureImageLoaded(coords?: { x: number; y: number }) {
    if (effectiveUrl || recovering) {
      if (coords && effectiveUrl && activeRef.current) {
        setPosition(coords.x, coords.y, !!effectiveBack)
      }
      return
    }

    setRecovering(true)
    try {
      const fresh = await fetchAndCacheImages([card.name])
      const freshUrl = fresh.get(card.name.toLowerCase())
      const freshBack = fresh.get(card.name.toLowerCase() + '__back')
      if (!freshUrl) {
        console.warn(`[image] "${card.name}": no image returned — card missing from Scryfall or Scryfall unreachable`)
        return
      }

      setRecoveredUrl(freshUrl)
      setRecoveredBack(freshBack)
      if (coords && activeRef.current) {
        setPosition(coords.x, coords.y, !!freshBack)
      }
    } catch {
      console.warn(`[image] "${card.name}": preview fetch threw — Scryfall unreachable`)
    } finally {
      setRecovering(false)
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!effectiveUrl) {
      void ensureImageLoaded({ x: e.clientX, y: e.clientY })
      return
    }
    setPosition(e.clientX, e.clientY, !!effectiveBack)
  }

  async function handleImageError(failedUrl: string) {
    if (recovering) return
    setRecovering(true)
    close()
    console.warn(`[image] Load failed for "${card.name}" — URL: ${failedUrl}`)
    clearCachedImage(card.name)
    try {
      const fresh = await fetchAndCacheImages([card.name])
      const freshUrl = fresh.get(card.name.toLowerCase())
      const freshBack = fresh.get(card.name.toLowerCase() + '__back')
      if (freshUrl && freshUrl !== failedUrl) {
        if (import.meta.env.DEV) console.log(`[image] "${card.name}": stale/junk URL in cache — recovered from Scryfall`)
        setRecoveredUrl(freshUrl)
        if (freshBack) setRecoveredBack(freshBack)
      } else if (freshUrl === failedUrl) {
        console.warn(`[image] "${card.name}": Scryfall returned same URL — CDN may be temporarily down`)
      } else {
        console.warn(`[image] "${card.name}": no image returned — card missing from Scryfall or Scryfall unreachable`)
      }
    } catch {
      console.warn(`[image] "${card.name}": re-fetch threw — Scryfall unreachable`)
    } finally {
      setRecovering(false)
    }
  }

  return (
    <>
      <div
        className={`flex items-center gap-2 px-3 py-2.5 border-b border-slate-700/40 select-none transition-colors ${ROW_CLASS[state]} ${selectPop ? 'card-select-pop' : ''}`}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={e => {
          activeRef.current = true
          if (!effectiveUrl) {
            void ensureImageLoaded({ x: e.clientX, y: e.clientY })
          }
        }}
        onMouseLeave={close}
      >
        <span className={`text-sm font-medium flex-1 truncate ${NAME_CLASS[state]}`}>{card.name}</span>
        <ManaCostPips manaCost={card.manaCost} />
        {/* Mobile preview button — pulsing indicator when loading */}
        <button
          className="md:hidden ml-1 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded relative"
          onClick={e => {
            e.stopPropagation()
            setPreviewOpen(true)
            void ensureImageLoaded()
          }}
          aria-label={`Preview ${card.name}`}
        >
          {loading || recovering ? (
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-500 opacity-50" />
              <span className="relative inline-flex rounded-full h-4 w-4 border border-slate-500" />
            </span>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>

      <CardHoverPortal
        hoverPos={hoverPos}
        imageUrl={effectiveUrl}
        backImageUrl={effectiveBack}
        cardName={card.name}
        onError={() => effectiveUrl && handleImageError(effectiveUrl)}
      />

      <FullscreenCardModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        cardName={card.name}
        imageUrl={effectiveUrl}
        backImageUrl={effectiveBack}
        loading={loading || recovering}
      />
    </>
  )
})
