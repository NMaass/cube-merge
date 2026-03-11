import { ColorCategory } from '../../types/cube'
import { COLOR_BG, COLOR_NAMES } from '../../lib/sorting'

interface SectionHeaderProps {
  colorCategory: ColorCategory
  cmc: number
  countA: number
  countB: number
}

export function SectionHeader({ colorCategory, cmc, countA, countB }: SectionHeaderProps) {
  const bg = COLOR_BG[colorCategory]
  const isLand = colorCategory === 'L'

  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 rounded-t-lg text-sm font-semibold sticky top-0 z-10"
      style={{ backgroundColor: bg, color: '#1e293b', minHeight: 32 }}
    >
      <span>
        {COLOR_NAMES[colorCategory]}{!isLand && ` — ${cmc} CMC`}
      </span>
      <span className="text-xs opacity-70">
        {countA > 0 && <span className="text-red-700 mr-2">-{countA}</span>}
        {countB > 0 && <span className="text-green-700">+{countB}</span>}
      </span>
    </div>
  )
}
