import { useRef, useCallback, useState, type ReactNode } from 'react'

interface SwipeableCardProps {
  children: ReactNode
  onSwipeRight?: () => void
  isActive?: boolean
  /** Label shown on the backdrop when swiping */
  actionLabel?: string
}

const THRESHOLD = 80
const MAX_TRANSLATE = 120

export function SwipeableCard({ children, onSwipeRight, isActive, actionLabel = 'Approve' }: SwipeableCardProps) {
  const startX = useRef(0)
  const startY = useRef(0)
  const currentX = useRef(0)
  const swiping = useRef(false)
  const locked = useRef(false)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [dragOffset, setDragOffset] = useState(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!onSwipeRight) return
    const touch = e.touches[0]
    startX.current = touch.clientX
    startY.current = touch.clientY
    currentX.current = 0
    swiping.current = false
    locked.current = false
  }, [onSwipeRight])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!onSwipeRight || locked.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - startX.current
    const dy = touch.clientY - startY.current

    // Lock direction after 10px of movement
    if (!swiping.current && !locked.current) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        // Vertical scroll — bail out
        locked.current = true
        return
      }
      if (Math.abs(dx) > 10) {
        swiping.current = true
      }
    }

    if (!swiping.current) return

    // Only allow right swipe
    const clamped = Math.max(0, Math.min(dx, MAX_TRANSLATE))
    currentX.current = clamped
    setDragOffset(clamped)

    if (clamped > 0) {
      e.preventDefault()
    }
  }, [onSwipeRight])

  const onTouchEnd = useCallback(() => {
    if (!swiping.current) return
    swiping.current = false

    if (currentX.current >= THRESHOLD && onSwipeRight) {
      onSwipeRight()
    }

    currentX.current = 0
    setDragOffset(0)
  }, [onSwipeRight])

  const progress = Math.min(dragOffset / THRESHOLD, 1)
  const showBackdrop = dragOffset > 0

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Backdrop revealed behind the card */}
      {showBackdrop && (
        <div
          className={`absolute inset-0 flex items-center pl-4 rounded-lg transition-colors ${
            isActive
              ? 'bg-amber-500/20'
              : progress >= 1
                ? 'bg-green-500/30'
                : 'bg-green-500/15'
          }`}
        >
          <div
            className={`flex items-center gap-2 transition-opacity ${progress >= 0.3 ? 'opacity-100' : 'opacity-0'}`}
          >
            <svg
              className={`w-5 h-5 transition-transform ${progress >= 1 ? 'text-green-400 scale-110' : 'text-green-500/70'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className={`text-xs font-medium ${progress >= 1 ? 'text-green-300' : 'text-green-500/70'}`}>
              {isActive ? 'Unapprove' : actionLabel}
            </span>
          </div>
        </div>
      )}

      {/* Card surface that slides */}
      <div
        ref={surfaceRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: dragOffset > 0 ? `translateX(${dragOffset}px)` : undefined,
          transition: dragOffset === 0 ? 'transform 0.2s ease-out' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
