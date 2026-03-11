import { Section } from '../../types/cube'
import { SectionGroup } from './SectionGroup'
import { useEditMode } from '../../context/EditModeContext'

interface CardPanelProps {
  sections: Section[]
  currentIndex: number
  side: 'left' | 'right'
  imageMap: Map<string, string>
  changeMap: Map<string, 'accepted' | 'removed'>
  isMobile?: boolean
}

export function CardPanel({ sections, currentIndex, side, imageMap, changeMap, isMobile }: CardPanelProps) {
  const { selectedLeft, selectedRight, toggleLeft, toggleRight } = useEditMode()
  const selectedCards = side === 'left' ? selectedLeft : selectedRight
  const toggle = side === 'left' ? toggleLeft : toggleRight

  const currentSection = sections[currentIndex]
  if (!currentSection) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        No section selected
      </div>
    )
  }

  const cards = side === 'left' ? currentSection.cardsA : currentSection.cardsB

  function lockedCardState(name: string): 'accepted' | 'removed' | null {
    return changeMap.get(name) || null
  }

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-3">
      <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">
        {side === 'left' ? 'Removals (Cube A)' : 'Additions (Cube B)'}
      </div>
      <SectionGroup
        colorCategory={currentSection.colorCategory}
        cmc={currentSection.cmc}
        cards={cards}
        side={side}
        imageMap={imageMap}
        selectedCards={selectedCards}
        lockedCardIds={new Set(changeMap.keys())}
        lockedCardState={lockedCardState}
        onToggle={toggle}
        isMobile={isMobile}
      />
    </div>
  )
}
