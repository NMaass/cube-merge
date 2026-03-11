import { CubeCard, ColorCategory, Section } from '../types/cube'

export const COLOR_ORDER: ColorCategory[] = ['W', 'U', 'B', 'R', 'G', 'M', 'C', 'L']

export const COLOR_NAMES: Record<ColorCategory, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  M: 'Multicolor',
  C: 'Colorless',
  L: 'Land',
}

export const COLOR_BG: Record<ColorCategory, string> = {
  W: '#f9f6ee',
  U: '#c1d7e9',
  B: '#c2bfba',
  R: '#f4a27a',
  G: '#9fd198',
  M: '#f5e17a',
  C: '#d0d0d0',
  L: '#d3b48c',
}

/** CMC values >= this are all bucketed together */
export const CMC_MAX = 6

/** MTG-style section label.
 *  Colored mono: {mv}{COLOR}  → "1W", "3G", "6+U"
 *  Colorless:    {mv}C        → "1C", "4C", "6+C"
 *  Multicolor:   {mv}M        → "2M", "6+M"
 *  Land:         "Land"
 */
export function sectionLabel(colorCategory: ColorCategory, cmc: number): string {
  if (colorCategory === 'L') return 'Land'
  const mv = cmc >= CMC_MAX ? '6+' : String(cmc)
  if (colorCategory === 'C') return `${mv}C`
  if (colorCategory === 'M') return `${mv}M`
  return `${mv}${colorCategory}`
}

/** Fuzzy parse a typed notation string into a section index.
 *  Returns -1 if no match.
 *
 *  Handles:
 *  - "1W", "6+G", "5C", "6+C", "3M"          (canonical labels)
 *  - Legacy colorless order: "C5", "C6+"
 *  - Case-insensitive: "1w", "6+g", "5c"
 *  - Shift-number aliases: "%G" → "5G", "^C" → "6C"
 *  - Color words: "blue" → U, "green" → G, etc.
 *  - "land" / "l"
 *  - {n}C where n≥6 → 6+C  (e.g. "15C" → 6+C)
 *  - Just a color letter: "W" → first W section
 *  - Just a number: "3" → first section with cmc=3
 */
export function parseSectionNotation(input: string, sections: Section[]): number {
  const raw = input.trim().toLowerCase().replace(/\s+/g, '')
  if (!raw) return -1

  // Map shift-number characters to their base digits
  const shiftNums: Record<string, string> = {
    '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
    '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
  }

  const colorWords: Record<string, ColorCategory> = {
    white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G',
    gold: 'M', multi: 'M', multicolor: 'M', colorless: 'C',
    land: 'L', lands: 'L',
  }
  const numWords: Record<string, string> = {
    zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
  }

  // Normalize shift-number characters first
  let s = raw.replace(/[!@#$%^&*()]/g, c => shiftNums[c] ?? c)

  // Replace number words
  for (const [word, num] of Object.entries(numWords)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, 'g'), num)
  }

  // Land
  if (s === 'land' || s === 'lands' || s === 'l') {
    return sections.findIndex(sec => sec.colorCategory === 'L')
  }

  // Full color word
  if (colorWords[s]) {
    const cc = colorWords[s]
    return sections.findIndex(sec => sec.colorCategory === cc)
  }

  // Colorless: accept both {n}[+]C and C{n}[+] (legacy order)
  const cNewMatch = s.match(/^(\d+)(\+)?c$/)
  const cOldMatch = s.match(/^c(\d+)(\+)?$/)
  const cMatch = cNewMatch ?? cOldMatch
  if (cMatch) {
    const n = parseInt(cMatch[1])
    const hasPlus = !!cMatch[2]
    const cmc = (n >= CMC_MAX || hasPlus) ? CMC_MAX : n
    return sections.findIndex(sec => sec.colorCategory === 'C' && sec.cmc === cmc)
  }

  // {n}[+]{colorLetter} — e.g. "3G", "6+W", "2M"
  const coloredMatch = s.match(/^(\d+)(\+)?([wubrgm])$/)
  if (coloredMatch) {
    const n = parseInt(coloredMatch[1])
    const cmc = (n >= CMC_MAX || !!coloredMatch[2]) ? CMC_MAX : n
    const cc = coloredMatch[3].toUpperCase() as ColorCategory
    return sections.findIndex(sec => sec.colorCategory === cc && sec.cmc === cmc)
  }

  // Just a single color letter
  if (/^[wubrg]$/.test(s)) {
    const cc = s.toUpperCase() as ColorCategory
    return sections.findIndex(sec => sec.colorCategory === cc)
  }

  // Just a number — first section with that CMC across any color
  const numOnly = s.match(/^(\d+)(\+)?$/)
  if (numOnly) {
    const n = parseInt(numOnly[1])
    const cmc = (n >= CMC_MAX || !!numOnly[2]) ? CMC_MAX : n
    return sections.findIndex(sec => sec.cmc === cmc)
  }

  return -1
}

export function colorCategoryFrom(card: {
  colors?: string[]
  color_identity?: string[]
  type_line?: string
  type?: string
}): ColorCategory {
  const typeLine = card.type_line || card.type || ''
  if (typeLine.toLowerCase().includes('land')) return 'L'

  const colors = card.colors || card.color_identity || []
  if (colors.length === 0) return 'C'
  if (colors.length > 1) return 'M'
  return colors[0] as ColorCategory
}

export function sectionKey(colorCategory: ColorCategory, cmc: number): string {
  return `${colorCategory}-${cmc}`
}

export function groupBySection(onlyA: CubeCard[], onlyB: CubeCard[]): Section[] {
  const sectionMap = new Map<string, Section>()

  const addCard = (card: CubeCard, side: 'A' | 'B') => {
    const clampedCmc = Math.min(card.cmc, CMC_MAX)
    const key = sectionKey(card.colorCategory, clampedCmc)
    if (!sectionMap.has(key)) {
      sectionMap.set(key, {
        key,
        colorCategory: card.colorCategory,
        cmc: clampedCmc,
        cardsA: [],
        cardsB: [],
      })
    }
    const section = sectionMap.get(key)!
    if (side === 'A') section.cardsA.push(card)
    else section.cardsB.push(card)
  }

  onlyA.forEach(c => addCard(c, 'A'))
  onlyB.forEach(c => addCard(c, 'B'))

  const sections = Array.from(sectionMap.values())

  sections.sort((a, b) => {
    const colorDiff = COLOR_ORDER.indexOf(a.colorCategory) - COLOR_ORDER.indexOf(b.colorCategory)
    if (colorDiff !== 0) return colorDiff
    return a.cmc - b.cmc
  })

  sections.forEach(section => {
    section.cardsA.sort((a, b) => a.name.localeCompare(b.name))
    section.cardsB.sort((a, b) => a.name.localeCompare(b.name))
  })

  return sections
}
