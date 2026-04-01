import { useCallback, useRef, useState } from 'react'
import { CardHoverPortal } from './CardHoverPortal'
import { FullscreenCardModal } from './FullscreenCardModal'
import { useCardHoverPreview } from '../../hooks/useCardHoverPreview'
import { getCachedImage, getCachedBackImage, fetchAndCacheImages, clearCachedImage } from '../../lib/imageCache'

interface PreviewableCardNameProps {
  cardName: string
  className?: string
  /** When provided, renders children instead of the plain card name text.
   *  Use this for custom layouts (icons, mana pips, etc.) inside the button. */
  children?: React.ReactNode
}

export function PreviewableCardName({ cardName, className = '', children }: PreviewableCardNameProps) {
  const { hoverPos, setPosition, close } = useCardHoverPreview()
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState(() => getCachedImage(cardName))
  const [backImageUrl, setBackImageUrl] = useState(() => getCachedBackImage(cardName))
  const [loading, setLoading] = useState(false)
  const fetchedRef = useRef(false)

  const ensureImage = useCallback(async () => {
    const cached = getCachedImage(cardName)
    if (cached) {
      setImageUrl(cached)
      setBackImageUrl(getCachedBackImage(cardName))
      return cached
    }
    if (fetchedRef.current) return undefined
    fetchedRef.current = true
    setLoading(true)
    try {
      await fetchAndCacheImages([cardName])
      const url = getCachedImage(cardName)
      const backUrl = getCachedBackImage(cardName)
      setImageUrl(url)
      setBackImageUrl(backUrl)
      return url
    } finally {
      setLoading(false)
    }
  }, [cardName])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const url = getCachedImage(cardName)
    if (url) {
      const backUrl = getCachedBackImage(cardName)
      if (!imageUrl) { setImageUrl(url); setBackImageUrl(backUrl) }
      setPosition(e.clientX, e.clientY, !!backUrl)
    }
  }, [cardName, imageUrl, setPosition])

  const handleClick = useCallback(() => {
    close()
    setFullscreenOpen(true)
    ensureImage()
  }, [close, ensureImage])

  const handleHoverError = useCallback(() => {
    clearCachedImage(cardName)
    fetchedRef.current = false
    setImageUrl(undefined)
    close()
  }, [cardName, close])

  return (
    <>
      <button
        type="button"
        className={`text-left cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded ${className}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={close}
        onClick={handleClick}
        aria-label={`Preview ${cardName}`}
      >
        {children ?? cardName}
      </button>
      <CardHoverPortal
        hoverPos={hoverPos}
        imageUrl={imageUrl}
        backImageUrl={backImageUrl}
        cardName={cardName}
        onError={handleHoverError}
      />
      <FullscreenCardModal
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        cardName={cardName}
        imageUrl={imageUrl}
        backImageUrl={backImageUrl}
        loading={loading}
      />
    </>
  )
}
