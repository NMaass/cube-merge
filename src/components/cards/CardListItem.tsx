import { memo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CubeCard } from '../../types/cube'
import { ManaCostPips } from './ManaCostPips'
import { FullscreenCardModal } from './FullscreenCardModal'
import { clearCachedImage, setCachedImages } from '../../lib/imageCache'
import { fetchSingleCardImage } from '../../lib/scryfall'

export type CardState = 'normal' | 'selected' | 'accepted' | 'removed' | 'kept' | 'rejected'

interface CardListItemProps {
  card: CubeCard
  state: CardState
  imageUrl?: string
  backImageUrl?: string
  loading?: boolean
  onClick?: () => void
}

const ROW_CLASS: Record<CardState, string> = {
  normal: 'border-l-2 border-transparent hover:bg-slate-700/30 cursor-pointer',
  selected: 'border-l-2 border-blue-400 bg-blue-900/20 cursor-pointer',
  accepted: 'border-l-2 border-green-500 bg-green-900/10 cursor-pointer opacity-80',
  removed: 'border-l-2 border-red-500 bg-red-900/10 cursor-pointer opacity-80',
  kept: 'border-l-2 border-cyan-500 bg-cyan-900/10 cursor-pointer opacity-80',
  rejected: 'border-l-2 border-orange-500 bg-orange-900/10 cursor-pointer opacity-80',
}

const NAME_CLASS: Record<CardState, string> = {
  normal: 'text-slate-200',
  selected: 'text-blue-200 font-semibold',
  accepted: 'text-green-300',
  removed: 'text-red-300',
  kept: 'text-cyan-300',
  rejected: 'text-orange-300',
}

export const CardListItem = memo(function CardListItem({ card, state, imageUrl, backImageUrl, loading, onClick }: CardListItemProps) {
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [recoveredUrl, setRecoveredUrl] = useState<string | undefined>(undefined)
  const [recoveredBack, setRecoveredBack] = useState<string | undefined>(undefined)
  const [recovering, setRecovering] = useState(false)

  const effectiveUrl = recoveredUrl ?? imageUrl
  const effectiveBack = recoveredBack ?? backImageUrl

  function handleMouseMove(e: React.MouseEvent) {
    if (!effectiveUrl) return
    const imgW = 180
    const totalW = effectiveBack ? imgW * 2 + 8 : imgW
    const imgH = 252
    let left = e.clientX + 20
    let top = e.clientY - imgH / 2
    if (left + totalW > window.innerWidth - 8) left = e.clientX - totalW - 20
    if (top < 8) top = 8
    if (top + imgH > window.innerHeight - 8) top = window.innerHeight - imgH - 8
    setHoverPos({ top, left })
  }

  async function handleImageError(failedUrl: string) {
    if (recovering) return
    setRecovering(true)
    setHoverPos(null)
    console.warn(`[image] Load failed for "${card.name}" — URL: ${failedUrl}`)
    clearCachedImage(card.name)
    try {
      const fresh = await fetchSingleCardImage(card.name)
      const freshUrl = fresh.get(card.name.toLowerCase())
      const freshBack = fresh.get(card.name.toLowerCase() + '__back')
      if (freshUrl && freshUrl !== failedUrl) {
        console.log(`[image] "${card.name}": stale/junk URL in cache — recovered from Scryfall`)
        setCachedImages(fresh)
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
        className={`flex items-center gap-2 px-3 py-2.5 border-b border-slate-700/40 select-none transition-colors ${ROW_CLASS[state]}`}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverPos(null)}
      >
        <span className={`text-sm font-medium flex-1 truncate ${NAME_CLASS[state]}`}>{card.name}</span>
        <ManaCostPips manaCost={card.manaCost} />
        {/* Mobile preview button — pulsing indicator when loading */}
        <button
          className="md:hidden ml-1 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-slate-300 focus:outline-none focus:text-slate-200 relative"
          onClick={e => { e.stopPropagation(); setPreviewOpen(true) }}
          aria-label={`Preview ${card.name}`}
        >
          {loading ? (
            // Animated ring while image is loading
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

      {hoverPos && effectiveUrl && createPortal(
        <div
          className="hidden md:flex gap-2 pointer-events-none"
          style={{ position: 'fixed', top: hoverPos.top, left: hoverPos.left, zIndex: 9999 }}
        >
          <img
            src={effectiveUrl}
            alt={card.name}
            className="rounded-lg shadow-2xl border border-slate-600/50"
            style={{ width: 180 }}
            onError={() => handleImageError(effectiveUrl)}
          />
          {effectiveBack && (
            <img
              src={effectiveBack}
              alt={`${card.name} (back)`}
              className="rounded-lg shadow-2xl border border-slate-600/50"
              style={{ width: 180 }}
            />
          )}
        </div>,
        document.body
      )}

      <FullscreenCardModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        cardName={card.name}
        card={card}
        imageUrl={effectiveUrl}
        backImageUrl={effectiveBack}
        loading={loading}
      />
    </>
  )
})
