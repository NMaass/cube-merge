import { useEffect, useId, useRef, useState } from 'react'

const IMG_W = 360
const IMG_H = 504 // IMG_W * 88/63

export function useCardHoverPreview() {
  const previewId = useId()
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null)
  const activeRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const latestPos = useRef<{ x: number; y: number; hasBack: boolean } | null>(null)

  useEffect(() => {
    function handleOtherPreview(e: Event) {
      const ce = e as CustomEvent<{ id?: string }>
      if (ce.detail?.id !== previewId) {
        setHoverPos(null)
        activeRef.current = false
      }
    }
    function handleViewportChange() {
      setHoverPos(null)
      activeRef.current = false
    }

    window.addEventListener('cube-diff:hover-preview-open', handleOtherPreview as EventListener)
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('blur', handleViewportChange)
    return () => {
      window.removeEventListener('cube-diff:hover-preview-open', handleOtherPreview as EventListener)
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('blur', handleViewportChange)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [previewId])

  function setPosition(x: number, y: number, hasBack: boolean) {
    // Always store the latest coords so the RAF callback uses them
    latestPos.current = { x, y, hasBack }
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const { x: lx, y: ly, hasBack: lHasBack } = latestPos.current!
      const totalW = lHasBack ? IMG_W * 2 + 8 : IMG_W
      let left = lx + 20
      let top = ly - IMG_H / 2
      if (left + totalW > window.innerWidth - 8) left = lx - totalW - 20
      if (top < 8) top = 8
      if (top + IMG_H > window.innerHeight - 8) top = window.innerHeight - IMG_H - 8
      window.dispatchEvent(new CustomEvent('cube-diff:hover-preview-open', { detail: { id: previewId } }))
      setHoverPos({ top, left })
    })
  }

  function close() {
    activeRef.current = false
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    setHoverPos(null)
  }

  return { hoverPos, setPosition, close, activeRef }
}
