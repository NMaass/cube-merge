import { memo, useState } from 'react'
import { CubeCard } from '../../types/cube'
import { ManaCostPips } from './ManaCostPips'
import { FullscreenCardModal } from './FullscreenCardModal'

type CardState = 'normal' | 'selected' | 'accepted' | 'removed'

interface CardBlockProps {
  card: CubeCard
  state: CardState
  imageUrl?: string
  onToggle?: () => void
}

export const CardBlock = memo(function CardBlock({ card, state, imageUrl, onToggle }: CardBlockProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const isLocked = state === 'accepted' || state === 'removed'

  const stateClasses: Record<CardState, string> = {
    normal: 'border-slate-600 text-slate-300',
    selected: 'border-blue-500 bg-blue-900/30 text-white',
    accepted: 'border-green-600 text-green-300',
    removed: 'border-red-600 text-red-300',
  }

  return (
    <>
      <div className={`flex items-center gap-2 p-2 rounded-lg border ${stateClasses[state]} mb-1`}>
        <button
          className="flex-1 text-left text-sm flex items-center gap-1"
          onClick={isLocked ? undefined : onToggle}
        >
          {card.name}
          <ManaCostPips manaCost={card.manaCost} />
        </button>
        <button
          onClick={() => setPreviewOpen(true)}
          className="text-slate-400 hover:text-white p-1"
          aria-label="Preview card"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </div>
      <FullscreenCardModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        cardName={card.name}
        imageUrl={imageUrl}
      />
    </>
  )
})
