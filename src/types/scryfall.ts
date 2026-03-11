export interface ScryfallCard {
  name: string
  image_uris?: {
    normal: string
    small: string
    art_crop: string
  }
  card_faces?: Array<{
    name: string
    image_uris?: {
      normal: string
      small: string
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
