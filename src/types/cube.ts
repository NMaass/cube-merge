export interface CubeCard {
  name: string
  colorCategory: ColorCategory
  cmc: number
  colors: string[]
  manaCost?: string
  type?: string
  oracleId?: string
}

export type ColorCategory = 'W' | 'U' | 'B' | 'R' | 'G' | 'M' | 'C' | 'L'

export interface CubeDiff {
  onlyA: CubeCard[]
  onlyB: CubeCard[]
}

export interface SectionKey {
  colorCategory: ColorCategory
  cmc: number
}

export interface Section {
  key: string
  colorCategory: ColorCategory
  cmc: number
  cardsA: CubeCard[]
  cardsB: CubeCard[]
}
