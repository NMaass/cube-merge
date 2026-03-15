export interface ScryfallCard {
  name: string
  layout?: string
  image_uris?: {
    normal?: string
    large?: string
    small?: string
    art_crop?: string
    png?: string
  }
  card_faces?: Array<{
    name: string
    image_uris?: {
      normal?: string
      large?: string
      small?: string
      png?: string
    }
  }>
  cmc: number
  colors?: string[]
  color_identity: string[]
  type_line: string
  oracle_id: string
  mana_cost?: string
}

export interface ScryfallCollectionResponse {
  data: ScryfallCard[]
  not_found: Array<{ name: string }>
}
