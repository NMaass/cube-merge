import { CubeCard } from '../../types/cube'
import { CardState } from '../../types/cardState'
import { SectionHeader } from './SectionHeader'
import { ColorCategory } from '../../types/cube'
import { CardChip } from '../cards/CardChip'
import { CardBlock } from '../cards/CardBlock'

interface SectionGroupProps {
  colorCategory: ColorCategory
  cmc: number
  cards: CubeCard[]
  side: 'left' | 'right'
  imageMap: Map<string, string>
  selectedCards: Set<string>
  lockedCardIds: Set<string>
  lockedCardState: (name: string) => 'accepted' | 'removed' | null
  onToggle: (name: string) => void
  isMobile?: boolean
}

export function SectionGroup({
  colorCategory, cmc, cards, side,
  imageMap, selectedCards, lockedCardIds: _lockedCardIds, lockedCardState,
  onToggle, isMobile = false,
}: SectionGroupProps) {
  return (
    <div className="mb-3">
      <SectionHeader
        colorCategory={colorCategory}
        cmc={cmc}
        countA={side === 'left' ? cards.length : 0}
        countB={side === 'right' ? cards.length : 0}
      />
      <div className="bg-slate-800/50 rounded-b-lg p-2 flex flex-wrap gap-1.5 min-h-[2.5rem]">
        {cards.map(card => {
          const locked = lockedCardState(card.name)
          const state: CardState = locked
            ? locked
            : selectedCards.has(card.name)
            ? 'selected'
            : 'normal'
          const imageUrl = imageMap.get(card.name.toLowerCase())

          if (isMobile) {
            return (
              <CardBlock
                key={card.name}
                card={card}
                state={state}
                imageUrl={imageUrl}
                onToggle={() => onToggle(card.name)}
              />
            )
          }

          return (
            <CardChip
              key={card.name}
              card={card}
              state={state}
              imageUrl={imageUrl}
              onClick={() => onToggle(card.name)}
            />
          )
        })}
        {cards.length === 0 && (
          <span className="text-slate-500 text-xs italic">No cards</span>
        )}
      </div>
    </div>
  )
}
