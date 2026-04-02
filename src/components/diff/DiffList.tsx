import { memo, useCallback, useMemo } from 'react'
import { Section } from '../../types/cube'
import { Change, Comment } from '../../types/firestore'
import { useEditMode } from '../../context/EditModeContext'
import { CardListItem, CardState } from '../cards/CardListItem'
import { COLOR_BG, sectionLabel } from '../../lib/sorting'

interface DiffListProps {
  sections: Section[]
  imageMap: Map<string, string>
  loadingSet: Set<string>
  changes: Array<Change & { comments: Comment[] }>
  selectable?: boolean
  onCardInChangeClick?: (change: Change & { comments: Comment[] }) => void
}

const SectionHeader = memo(function SectionHeader({ section, side }: { section: Section; side: 'left' | 'right' }) {
  const count = side === 'left' ? section.cardsA.length : section.cardsB.length
  const label = sectionLabel(section.colorCategory, section.cmc)

  return (
    <div
      className="sticky top-[40px] md:top-[33px] z-10 flex items-center justify-between px-2 sm:px-3 py-1"
      style={{ backgroundColor: COLOR_BG[section.colorCategory] + '28', borderBottom: `1px solid ${COLOR_BG[section.colorCategory]}40` }}
    >
      <span className="text-[11px] font-semibold font-mono tracking-wide text-slate-400">{label}</span>
      {count > 0 && (
        <span
          className={`text-[11px] font-mono ${side === 'left' ? 'text-red-600' : 'text-green-600'}`}
          aria-label={`${count} ${side === 'left' ? 'removed' : 'added'}`}
        >
          {side === 'left' ? '−' : '+'}{count}
        </span>
      )}
    </div>
  )
})

export const DiffList = memo(function DiffList({ sections, imageMap, loadingSet, changes, selectable = true, onCardInChangeClick }: DiffListProps) {
  const { selectedLeft, selectedRight, toggleLeft, toggleRight } = useEditMode()

  const changeMap = useMemo(() => {
    const map = new Map<string, CardState>()
    for (const change of changes) {
      const neg = change.type === 'keep' || change.type === 'reject' || change.type === 'decline'
      for (const c of change.cardsOut) {
        map.set(c.name, neg ? 'kept' : 'removed')
      }
      for (const c of change.cardsIn) {
        map.set(c.name, neg ? 'rejected' : 'accepted')
      }
    }
    return map
  }, [changes])

  const cardState = useCallback((name: string, side: 'left' | 'right'): CardState => {
    if ((side === 'left' ? selectedLeft : selectedRight).has(name)) return 'selected'
    return changeMap.get(name) ?? 'normal'
  }, [changeMap, selectedLeft, selectedRight])

  const handleCardClick = useCallback((name: string, side: 'left' | 'right') => {
    if (!selectable) return
    if (changeMap.has(name) && onCardInChangeClick) {
      const ch = changes.find(c =>
        c.cardsOut.some(x => x.name === name) || c.cardsIn.some(x => x.name === name)
      )
      if (ch) { onCardInChangeClick(ch); return }
    }
    if (side === 'left') toggleLeft(name)
    else toggleRight(name)
  }, [selectable, changeMap, changes, onCardInChangeClick, toggleLeft, toggleRight])

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-0">
      {/* Left panel — Removals */}
      <div className="flex-1 min-h-0 overflow-y-auto border-b md:border-b-0 md:border-r border-slate-700">
        <div className="sticky top-0 z-20 flex items-center gap-2 bg-red-950/70 backdrop-blur-md border-b border-red-900/60 px-3 py-2.5 md:py-2 shadow-sm">
          <span className="text-red-400 font-bold text-sm leading-none">−</span>
          <span className="text-xs font-semibold text-red-300 uppercase tracking-widest">Removals</span>
        </div>
        {sections.map(section => (
          <div key={section.key} id={`section-left-${section.key}`}>
            <SectionHeader section={section} side="left" />
            <div style={{ backgroundColor: `${COLOR_BG[section.colorCategory]}0e` }}>
              {section.cardsA.map(card => (
                <CardListItem
                  key={card.name}
                  card={card}
                  state={cardState(card.name, 'left')}
                  imageUrl={imageMap.get(card.name.toLowerCase())}
                  backImageUrl={imageMap.get(card.name.toLowerCase() + '__back')}
                  loading={loadingSet.has(card.name.toLowerCase())}
                  onClick={() => handleCardClick(card.name, 'left')}
                />
              ))}
              {section.cardsA.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-600 border-b border-slate-700/40 italic">None</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Right panel — Additions */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="sticky top-0 z-20 flex items-center gap-2 bg-green-950/70 backdrop-blur-md border-b border-green-900/60 px-3 py-2.5 md:py-2 shadow-sm">
          <span className="text-green-400 font-bold text-sm leading-none">+</span>
          <span className="text-xs font-semibold text-green-300 uppercase tracking-widest">Additions</span>
        </div>
        {sections.map(section => (
          <div key={section.key} id={`section-right-${section.key}`}>
            <SectionHeader section={section} side="right" />
            <div style={{ backgroundColor: `${COLOR_BG[section.colorCategory]}0e` }}>
              {section.cardsB.map(card => (
                <CardListItem
                  key={card.name}
                  card={card}
                  state={cardState(card.name, 'right')}
                  imageUrl={imageMap.get(card.name.toLowerCase())}
                  backImageUrl={imageMap.get(card.name.toLowerCase() + '__back')}
                  loading={loadingSet.has(card.name.toLowerCase())}
                  onClick={() => handleCardClick(card.name, 'right')}
                />
              ))}
              {section.cardsB.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-600 border-b border-slate-700/40 italic">None</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
