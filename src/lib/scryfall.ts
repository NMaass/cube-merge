import { ScryfallCard, ScryfallCollectionResponse } from '../types/scryfall'
import { CubeCard } from '../types/cube'
import { colorCategoryFrom } from './sorting'

const SCRYFALL_API = 'https://api.scryfall.com'

/** Store a Scryfall card's image URL(s) into imageMap.
 *  queriedName: the name we looked up (may differ from card.name for IP-renamed/arena cards). */
function storeCard(imageMap: Map<string, string>, card: ScryfallCard, queriedName?: string) {
  const face0 = card.card_faces?.[0]
  const face1 = card.card_faces?.[1]
  // Some DFCs have front image at card level (not face level) — handle both layouts
  const frontUrl = face0?.image_uris?.normal || card.image_uris?.normal || ''
  const backUrl = face1?.image_uris?.normal || ''
  const isTrueDfc = !!(frontUrl && backUrl)

  if (isTrueDfc) {
    const face0name = face0?.name?.toLowerCase() || ''
    const face1name = face1?.name?.toLowerCase() || ''
    const fullname = card.name.toLowerCase()

    // Combined name and front-face name → standard front-first orientation
    for (const n of [fullname, face0name].filter(Boolean)) {
      imageMap.set(n, frontUrl)
      imageMap.set(n + '__back', backUrl)
    }
    // Back-face name (e.g. "Cren, Undercity Dreamer") → back image shown first
    if (face1name) {
      imageMap.set(face1name, backUrl)
      imageMap.set(face1name + '__back', frontUrl)
    }
    // If we got here via a queried name (fuzzy fallback), store it too, oriented to the right face
    if (queriedName) {
      const qn = queriedName.toLowerCase()
      const isBackFace = qn === face1name
      imageMap.set(qn, isBackFace ? backUrl : frontUrl)
      imageMap.set(qn + '__back', isBackFace ? frontUrl : backUrl)
    }
  } else {
    const imageUri = card.image_uris?.normal || face0?.image_uris?.normal || ''
    if (imageUri) {
      imageMap.set(card.name.toLowerCase(), imageUri)
      if (queriedName) imageMap.set(queriedName.toLowerCase(), imageUri)
      // Adventure/split: Scryfall returns "Front // Back" but CubeCobra may store
      // just the front face name — index by front-face name so either lookup hits
      if (face0?.name) imageMap.set(face0.name.toLowerCase(), imageUri)
    }
  }
}

export async function fetchCardCollection(names: string[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>()

  // Batch in chunks of 75
  for (let i = 0; i < names.length; i += 75) {
    const batch = names.slice(i, i + 75)
    const identifiers = batch.map(name => ({ name }))

    try {
      const response = await fetch(`${SCRYFALL_API}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers }),
      })

      if (!response.ok) continue

      const data: ScryfallCollectionResponse = await response.json()

      for (const card of data.data) {
        storeCard(imageMap, card)
      }

      // Fuzzy fallback for any card the batch endpoint couldn't match.
      // This covers arena-only cards, IP-renamed cards, slight name variations, etc.
      if (data.not_found.length > 0) {
        if (import.meta.env.DEV) console.warn('[Scryfall] not_found in batch — trying fuzzy fallback:', data.not_found.map(c => c.name))
        for (const { name } of data.not_found) {
          try {
            await new Promise(resolve => setTimeout(resolve, 100))
            const r = await fetch(`${SCRYFALL_API}/cards/named?fuzzy=${encodeURIComponent(name)}`)
            if (!r.ok) { if (import.meta.env.DEV) console.warn(`[Scryfall] fuzzy miss for "${name}": ${r.status}`); continue }
            const card = await r.json() as ScryfallCard
            storeCard(imageMap, card, name)
          } catch (e) {
            if (import.meta.env.DEV) console.warn(`[Scryfall] fuzzy lookup failed for "${name}":`, e)
          }
        }
      }

      // Rate limit: 100ms between batches
      if (i + 75 < names.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('Scryfall batch fetch failed:', e)
    }
  }

  return imageMap
}

/** Fetch a fresh image URL for a single card by name — used to recover from stale/bad cache entries.
 *  Returns a map with the results (empty if Scryfall can't find it). */
export async function fetchSingleCardImage(name: string): Promise<Map<string, string>> {
  return fetchCardCollection([name])
}

export function scryfallCardToCubeCard(card: ScryfallCard): CubeCard {
  const colorCategory = colorCategoryFrom({
    colors: card.colors,
    color_identity: card.color_identity,
    type_line: card.type_line,
  })

  return {
    name: card.name,
    colorCategory,
    cmc: Math.floor(card.cmc),
    colors: card.colors || card.color_identity || [],
    manaCost: card.mana_cost,
    type: card.type_line,
    oracleId: card.oracle_id,
  }
}
