import { CubeCard, ColorCategory } from '../types/cube'
import { colorCategoryFrom } from './sorting'

interface CubeCobraCard {
  cardID?: string
  details?: {
    name: string
    cmc: number
    colors: string[]
    color_identity: string[]
    type: string
    oracle_id?: string
    mana_cost?: string
  }
  name?: string
  cmc?: number
  colors?: string[]
  color_identity?: string[]
  type?: string
  mana_cost?: string
}

function parseCubeCobraCard(card: CubeCobraCard): CubeCard | null {
  const details = card.details
  if (!details && !card.name) return null

  const name = details?.name || card.name || ''
  const cmc = details?.cmc ?? card.cmc ?? 0
  const colors = details?.colors || card.colors || []
  const colorIdentity = details?.color_identity || card.color_identity || []
  const type = details?.type || card.type || ''

  if (!name) return null

  const colorCategory = colorCategoryFrom({ colors, color_identity: colorIdentity, type_line: type })

  return {
    name,
    colorCategory,
    cmc: Math.floor(cmc),
    colors,
    manaCost: details?.mana_cost || card.mana_cost,
    type,
    oracleId: details?.oracle_id,
  }
}

// In dev, Vite proxies /cubecobra → https://cubecobra.com to avoid mixed-content issues.
// In production, CubeCobra serves Access-Control-Allow-Origin: * so direct fetch works fine.
const CUBECOBRA_BASE = import.meta.env.DEV ? '/cubecobra' : 'https://cubecobra.com'

// Extract a flat card array from whatever shape CubeCobra returns.
// Known shapes:
//   { cards: [...] }                       — flat array (older API)
//   { cards: { mainboard: [...], ... } }   — object with mainboard key (newer API)
//   [...]                                  — top-level array of strings (cardnames endpoint)
function extractCardArray(data: unknown): CubeCobraCard[] | string[] | null {
  if (Array.isArray(data)) return data as string[]

  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>

    if (Array.isArray(d.cards)) return d.cards as CubeCobraCard[]

    if (d.cards && typeof d.cards === 'object') {
      const cardObj = d.cards as Record<string, unknown>
      const mainboard = cardObj.mainboard ?? cardObj.Mainboard
      if (Array.isArray(mainboard)) return mainboard as CubeCobraCard[]
      // Flatten all array values (mainboard + maybeboard etc.)
      const all = Object.values(cardObj).filter(Array.isArray).flat()
      if (all.length > 0) return all as CubeCobraCard[]
    }
  }

  return null
}

/** Extract the cube ID slug from a full CubeCobra URL, or return the input unchanged. */
export function parseCubeCobraId(input: string): string {
  const trimmed = input.trim()
  // cubecobra.com/cube/{section}/{id}  (overview, list, playtest, etc.)
  const m = trimmed.match(/cubecobra\.com\/cube\/[^/\s?#]+\/([^/\s?#]+)/)
  return m ? m[1] : trimmed
}

/** If the input is a CubeCobra compare URL, return [idA, idB]. Otherwise null. */
export function parseCompareUrl(input: string): [string, string] | null {
  const m = input.match(/cubecobra\.com\/cube\/compare\/([^/\s?#]+)\/to\/([^/\s?#]+)/)
  return m ? [m[1], m[2]] : null
}

export async function fetchCubeCobraList(cubeId: string): Promise<CubeCard[]> {
  const endpoints = [
    `${CUBECOBRA_BASE}/cube/api/cubeJSON/${cubeId}`,
    `${CUBECOBRA_BASE}/cube/api/cardnames/${cubeId}`,
  ]

  let gotAnyResponse = false

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      })

      // In production we fetch cubecobra.com directly, so any HTTP response
      // (even a 404 HTML page for a missing cube) proves the server is reachable.
      // In dev we go through a Vite proxy; if the proxy isn't running Firebase's
      // SPA catch-all returns index.html — only trust JSON responses there.
      const contentType = response.headers.get('content-type') || ''
      const isRealServerResponse = !import.meta.env.DEV || contentType.includes('application/json')
      if (isRealServerResponse) gotAnyResponse = true
      if (import.meta.env.DEV) console.log(`[CubeCobra] ${url} → ${response.status} (${contentType})`)

      if (!response.ok) continue

      const data = await response.json()
      const raw = extractCardArray(data)

      if (!raw || raw.length === 0) {
        if (import.meta.env.DEV) console.warn('[CubeCobra] Unexpected response shape:', JSON.stringify(data).slice(0, 200))
        continue
      }

      // String array (cardnames endpoint)
      if (typeof raw[0] === 'string') {
        return (raw as string[]).map(name => ({
          name,
          colorCategory: 'C' as ColorCategory,
          cmc: 0,
          colors: [],
        }))
      }

      const cards = (raw as CubeCobraCard[])
        .map(parseCubeCobraCard)
        .filter((c): c is CubeCard => c !== null)

      if (cards.length > 0) return cards
    } catch (e) {
      if (import.meta.env.DEV) console.warn(`[CubeCobra] fetch failed for ${url}:`, e)
    }
  }

  // If we got any HTTP response at all, the server is reachable — the cube ID is bad.
  // Only throw CORS_BLOCKED when every request failed at the network level.
  throw new Error(gotAnyResponse ? 'CUBE_NOT_FOUND' : 'CORS_BLOCKED')
}

export function computeDiff(
  cardsA: CubeCard[],
  cardsB: CubeCard[]
): { onlyA: CubeCard[]; onlyB: CubeCard[] } {
  const namesA = new Set(cardsA.map(c => c.name.toLowerCase()))
  const namesB = new Set(cardsB.map(c => c.name.toLowerCase()))

  const onlyA = cardsA.filter(c => !namesB.has(c.name.toLowerCase()))
  const onlyB = cardsB.filter(c => !namesA.has(c.name.toLowerCase()))

  return { onlyA, onlyB }
}
