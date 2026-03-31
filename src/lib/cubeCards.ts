const KNOWN_CUBES_KEY = 'cube-diff:known-cubes'
const LEGACY_KNOWN_IDS_KEY = 'cube-diff:known-cube-ids'

export interface KnownCubeEntry {
  canonicalRef: string
  id: string | null
  shortId: string | null
  name: string | null
  aliases: string[]
}

interface PersistKnownCubeInput {
  requestedRef?: string
  id?: string | null
  shortId?: string | null
  name?: string | null
}

const SEEDED_KNOWN_CUBES: PersistKnownCubeInput[] = [
  { id: '5d2cb3f44153591614458e5d', shortId: 'modovintage', name: 'MTGO Vintage Cube' },
  { id: '5d617ac6c2a85f3b75fe95a4', shortId: 'thepaupercube', name: 'The Pauper Cube' },
  { id: '5fab13510efe0d1071b87fae', shortId: 'synergy', name: "Caleb Gannon's Powered Synergy Cube" },
  { id: '5d39ce4b8472c42aab0b61c2', shortId: 'andymangold', name: 'Bun Magic Cube' },
  { id: '5d3f7245d1bbf667dd9d4286', shortId: 'thepeasantcube', name: 'The Peasant Cube 2026' },
  { id: '5d61aa23b8ec593ca4b76ca6', shortId: 'wtwlf123', name: "wtwlf123's Cube" },
  { id: 'aa4ef3f9-0b4f-4bf0-9fbc-5cc3d3ec5e37', shortId: '100-ornithopters', name: '100 Ornithopters' },
  { id: '786d3a10-43bd-438e-acf4-bb150b881254', shortId: 'PowerLSV', name: 'PowerLSV' },
  { id: 'a525ebe1-c9c0-471c-aca3-772f91bf4145', shortId: 'LSVCube', name: 'LSVCube' },
  { id: '5dc09316845516168633e492', shortId: 'regular', name: 'Regular Cube' },
  { id: '5ee1ac60516bcd40db036790', shortId: 'cmdr-cube', name: "Tom's Commander Cube" },
  { id: 'b4bd2b0e-1f9a-4b71-8a45-db39770b13a1', shortId: 'AlphaFrog', name: 'AlphaFrog Vintage Cube' },
  { id: '5d707d8cfcb84a5be6ced09f', shortId: 'thestartercube', name: 'The Starter Cube' },
  { id: '5f7365c9dc7295103b93a28b', shortId: 'n1m', name: 'The Original Recipe Twobert' },
  { id: '5d83674db656d33b0d4bcc29', shortId: 'dekkaru', name: 'Dekkaru Cube [Retired]' },
  { id: '5eac352663be2427d677d971', shortId: 'degenerate-micro-cube', name: 'Degenerate Micro-Cube' },
  { id: '5d8cdc9ddabc762f670c1d2a', shortId: 'spoopycube', name: 'The Innistrad Anthology Cube' },
  { id: '5d6c2b61de02de10673665f7', shortId: 'tabletop', name: 'The Tabletop Cube' },
  { id: '60f5fab79e954b050e0ae497', shortId: 'n6yy', name: 'Battle Box' },
  { id: '608a4a0131e4aa105f3292c7', shortId: '167l', name: 'Nitpicking Nerds Commander Cube' },
  { id: '6377de78946dbd0f6a6e8fff', shortId: 'emma-peasant-cube-2025', name: 'Peasant Cube (2026)' },
  { id: '5d5ef816726e4277c7bbc6be', shortId: 'cthulhu', name: 'The Cube of Cthulhu' },
  { id: '613d81be1de8d5027f16ba32', shortId: 'data', name: 'Data Generated Vintage Cube' },
  { id: '61454789685c83106293be3c', shortId: 'hgs', name: 'Bodleian Cube' },
  { id: '61d3ccc9c7d013102be68f4f', shortId: 'BarCube', name: 'Bar Cube' },
  { id: '5e8c9f60a0c28578ee03de2d', shortId: 'jdgp', name: 'Jank Diver Peasant Cube' },
  { id: '60886f462e6452103fa39792', shortId: 'tempocube', name: 'The Tempo Cube' },
  { id: '617b36e887d268103f4acd02', shortId: 'fairytale', name: "May's Fae Cube" },
  { id: '5d757b268f152803feb030f8', shortId: 'strongestcube', name: 'The Steve Cube (High Octane Unpowered)' },
  { id: '3c8379e4-dcf7-45da-9cd3-ad3e12592304', shortId: 'sacred-geometry', name: 'Sacred Geometry' },
  { id: '5b73c9bb-4928-4d6a-9580-30d5a718d925', name: 'Foundations Student Cube' },
  { id: '5d2cdf200442c316b0ef86c7', shortId: 'drruler', name: "DrRuler's 630 Card Unpowered Cube" },
  { id: '605df8591361d3104a896904', shortId: 'neoclassical', name: 'Neoclassical Cube' },
  { id: '60c7b3023b7623103ca84a22', shortId: '1jd3', name: 'Tempo Twobert' },
  { id: '5c340ee4-8896-4311-8ccb-ca811e347261', name: 'Kitchen Table All-Stars (Budget Synergy Cube)' },
  { id: '5f5d768ced6023105164a65f', shortId: 'turbo', name: 'Turbo Cube' },
  { id: '5ebdf42e7a821f0d637307f2', shortId: 'hc', name: 'Hypercube' },
  { id: '5d70f0322d52e15c2537f057', shortId: 'spooty', name: 'The Spooty Peasant Cube - 2026 Edition' },
  { id: '61d31f05be8c31103b575e0a', shortId: 'bolt', name: 'Bolt Cube' },
  { id: '5f175e2240729e103f75cc0f', shortId: 'highstakeschallenge', name: 'High Stakes Challenge (HSC) Vintage Cube' },
  { id: '5eb2416d33973f103cfd0a66', shortId: 'classicmoderncube', name: 'Classic Modern Cube' },
  { id: '5d4c6fcd97ca265764f29fa4', shortId: 'culticcube', name: 'Eleusis' },
  { id: '5ed29a43d44a3c102e14500a', shortId: 'amazp', name: "Amaz's Peasant+ Cube" },
  { id: '5e87870a40eaf0158ee1292f', shortId: 'mtgarena', name: 'Chromatic Cube Draft on MTG Arena, July 2025' },
  { id: '615afb91b9880d102e064867', shortId: 'mengucube', name: 'Vintage MenguCube' },
  { id: '5d3f1c6cd1bbf667dd9cdd1b', shortId: 'commandercube', name: 'Commander Cube' },
  { id: '3dc1e7ac-338c-4bec-939d-3c2217b5ae18', shortId: 'auto', name: 'Crucible' },
  { id: '6282adea6c523e100d69a4b4', shortId: '3jujr', name: 'Pauper Twobert' },
  { id: '5ea0960912bf071086e7c06a', shortId: 'amonkardesert', name: 'The Amonkar Desert' },
  { id: '60eb90e47bdeb510201cb11e', shortId: 'h996', name: 'Peasant Twobert' },
]

function normalizeAlias(value: string): string {
  return value.trim().toLowerCase()
}

function sanitizeAliases(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const aliases: string[] = []

  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const key = normalizeAlias(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    aliases.push(trimmed)
  }

  return aliases
}

function legacyEntries(): KnownCubeEntry[] {
  try {
    const legacyIds = JSON.parse(localStorage.getItem(LEGACY_KNOWN_IDS_KEY) || '[]') as unknown
    if (!Array.isArray(legacyIds)) return []
    return legacyIds
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map(value => ({
        canonicalRef: value,
        id: value,
        shortId: null,
        name: null,
        aliases: [value],
      }))
  } catch {
    return []
  }
}

export function getLegacyKnownCubeRefs(): string[] {
  return legacyEntries().map(entry => entry.canonicalRef)
}

export function getKnownCubeEntries(): KnownCubeEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KNOWN_CUBES_KEY) || 'null') as unknown
    if (!Array.isArray(raw)) return legacyEntries()

    return raw
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map(item => {
        const canonicalRef = typeof item.canonicalRef === 'string' ? item.canonicalRef : ''
        const id = typeof item.id === 'string' ? item.id : null
        const shortId = typeof item.shortId === 'string' ? item.shortId : null
        const name = typeof item.name === 'string' ? item.name : null
        const aliases = sanitizeAliases(
          Array.isArray(item.aliases) ? item.aliases.filter((value): value is string => typeof value === 'string') : [canonicalRef, id, shortId, name]
        )

        return {
          canonicalRef: canonicalRef || shortId || id || aliases[0] || '',
          id,
          shortId,
          name,
          aliases,
        }
      })
      .filter(entry => entry.canonicalRef.length > 0)
  } catch {
    return legacyEntries()
  }
}

function persistKnownCubeEntries(entries: KnownCubeEntry[]) {
  try {
    localStorage.setItem(KNOWN_CUBES_KEY, JSON.stringify(entries))
  } catch {
    /* storage unavailable */
  }
}

export function getKnownCubeIds(): string[] {
  return getKnownCubeEntries()
    .flatMap(entry => entry.aliases)
    .filter((value, index, all) => all.findIndex(candidate => normalizeAlias(candidate) === normalizeAlias(value)) === index)
}

export function resolveKnownCubeReference(input: string): string | null {
  const normalized = normalizeAlias(input)
  if (!normalized) return null

  for (const entry of getKnownCubeEntries()) {
    if (entry.aliases.some(alias => normalizeAlias(alias) === normalized)) {
      return entry.canonicalRef
    }
  }

  return null
}

export function persistKnownCube(input: PersistKnownCubeInput): void {
  const requestedRef = input.requestedRef?.trim() || ''
  const id = input.id?.trim() || null
  const shortId = input.shortId?.trim() || null
  const name = input.name?.trim() || null
  const canonicalRef = shortId || id || requestedRef

  if (!canonicalRef) return

  const aliases = sanitizeAliases([name, shortId, id, canonicalRef, requestedRef])
  const aliasKeys = new Set(aliases.map(normalizeAlias))
  const entries = getKnownCubeEntries()

  const matchIndex = entries.findIndex(entry =>
    normalizeAlias(entry.canonicalRef) === normalizeAlias(canonicalRef) ||
    entry.aliases.some(alias => aliasKeys.has(normalizeAlias(alias)))
  )

  if (matchIndex === -1) {
    persistKnownCubeEntries([...entries, { canonicalRef, id, shortId, name, aliases }])
    return
  }

  const existing = entries[matchIndex]
  const merged: KnownCubeEntry = {
    canonicalRef,
    id: id || existing.id,
    shortId: shortId || existing.shortId,
    name: name || existing.name,
    aliases: sanitizeAliases([...existing.aliases, ...aliases, existing.name, existing.shortId, existing.id]),
  }

  const nextEntries = [...entries]
  nextEntries[matchIndex] = merged
  persistKnownCubeEntries(nextEntries)
}

export function seedKnownCubes(): void {
  for (const cube of SEEDED_KNOWN_CUBES) {
    persistKnownCube(cube)
  }
}

/**
 * Records card names seen for a cube using array union so entries are purely additive.
 * Also saves the cube ID to localStorage for landing page autocomplete.
 * Called on diff load, not on export.
 */
export async function recordCubeCards(cubeId: string, cardNames: string[]): Promise<void> {
  persistKnownCube({ requestedRef: cubeId })

  const [{ db, FIREBASE_CONFIGURED }, { doc, setDoc, updateDoc, arrayUnion }] = await Promise.all([
    import('./firebase'),
    import('firebase/firestore'),
  ])

  if (!FIREBASE_CONFIGURED || cardNames.length === 0) return
  const cubeRef = doc(db, 'cubeCards', cubeId)
  try {
    await updateDoc(cubeRef, { names: arrayUnion(...cardNames) })
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'not-found') {
      await setDoc(cubeRef, { names: cardNames })
    } else {
      console.warn('recordCubeCards failed:', e)
    }
  }
}
