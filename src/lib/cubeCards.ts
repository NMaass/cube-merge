const KNOWN_IDS_KEY = 'cube-diff:known-cube-ids'

export function getKnownCubeIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KNOWN_IDS_KEY) || '[]')
  } catch { return [] }
}

function persistKnownCubeId(cubeId: string) {
  try {
    const ids = getKnownCubeIds()
    if (!ids.includes(cubeId)) {
      ids.push(cubeId)
      localStorage.setItem(KNOWN_IDS_KEY, JSON.stringify(ids))
    }
  } catch { /* storage unavailable */ }
}

/**
 * Records card names seen for a cube using array union so entries are purely additive.
 * Also saves the cube ID to localStorage for landing page autocomplete.
 * Called on diff load, not on export.
 */
export async function recordCubeCards(cubeId: string, cardNames: string[]): Promise<void> {
  // Always track the ID locally regardless of Firebase state
  persistKnownCubeId(cubeId)

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
