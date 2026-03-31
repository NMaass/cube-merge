const CACHE_KEY = 'cube-diff:image-cache'
const MAX_SIZE_BYTES = 4 * 1024 * 1024 // 4MB
const FS_SESSION_KEY = 'cube-diff:fs-cache-loaded'

interface CacheEntry {
  url: string
  timestamp: number
}

type ImageCacheStore = Record<string, CacheEntry>

let memoryCache = new Map<string, string>()
let storageCache: ImageCacheStore | null = null

function loadFromStorage(): ImageCacheStore {
  if (storageCache !== null) return storageCache
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    storageCache = raw ? JSON.parse(raw) : {}
    for (const [key, entry] of Object.entries(storageCache!)) {
      memoryCache.set(key, entry.url)
    }
  } catch {
    storageCache = {}
  }
  return storageCache!
}

function saveToStorage(store: ImageCacheStore) {
  try {
    const json = JSON.stringify(store)
    if (json.length > MAX_SIZE_BYTES) {
      const entries = Object.entries(store).sort((a, b) => a[1].timestamp - b[1].timestamp)
      const evictCount = Math.floor(entries.length * 0.25)
      const trimmed: ImageCacheStore = {}
      for (const [k, v] of entries.slice(evictCount)) {
        trimmed[k] = v
      }
      storageCache = trimmed
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed))
    } else {
      localStorage.setItem(CACHE_KEY, json)
    }
  } catch {
    // Storage full or unavailable
  }
}

/** Scryfall CDN domains we trust. Anything else is considered invalid. */
const VALID_URL_PREFIX = ['https://cards.scryfall.io/', 'https://c1.scryfall.com/', 'https://c2.scryfall.com/']
function isValidScryfallUrl(url: string): boolean {
  return !!url && VALID_URL_PREFIX.some(p => url.startsWith(p))
}

export function getCachedImage(name: string): string | undefined {
  const key = name.toLowerCase()
  if (memoryCache.has(key)) return memoryCache.get(key)
  // Fallback: try just the front-face portion for "Front // Back" style names
  const slashIdx = key.indexOf(' // ')
  if (slashIdx !== -1) return memoryCache.get(key.slice(0, slashIdx))
  return undefined
}

export function getCachedBackImage(name: string): string | undefined {
  return memoryCache.get(name.toLowerCase() + '__back')
}

/** Remove a single entry from memory cache (and localStorage) so it can be re-fetched. */
export function clearCachedImage(name: string): void {
  const key = name.toLowerCase()
  memoryCache.delete(key)
  memoryCache.delete(key + '__back')
  const store = loadFromStorage()
  delete store[key]
  delete store[key + '__back']
  saveToStorage(store)
}

export function setCachedImages(imageMap: Map<string, string>) {
  const store = loadFromStorage()
  const now = Date.now()

  for (const [name, url] of imageMap) {
    if (!isValidScryfallUrl(url)) {
      if (import.meta.env.DEV) console.warn(`[imageCache] Rejecting invalid URL for "${name}":`, url)
      continue
    }
    const key = name.toLowerCase()
    memoryCache.set(key, url)
    store[key] = { url, timestamp: now }
  }

  saveToStorage(store)
}

/** Fetch card images from Scryfall, store in local + Firestore cache, return the map.
 *  Single entry point for all image fetching — avoids forgetting persist calls. */
export async function fetchAndCacheImages(names: string[]): Promise<Map<string, string>> {
  const { fetchCardCollection } = await import('./scryfall')
  const fresh = await fetchCardCollection(names)
  if (fresh.size > 0) {
    setCachedImages(fresh)
    persistImagesToFirestore(fresh)
  }
  return fresh
}

export function initImageCache() {
  setTimeout(() => loadFromStorage(), 0)
}

// ── Firestore shared cache ────────────────────────────────────────────────────
// /meta/imageCache  { urls: { [lowercasedCardName]: scryfallUrl } }
//
// Write uses updateDoc with dotted field paths ("urls.lightning bolt") so
// individual entries merge without overwriting unrelated cards. Falls back to
// setDoc on first write when the document doesn't exist yet.

// Characters invalid in Firestore field path segments
const FS_INVALID = /[~/\*\[\]]/

function isSafeForFs(name: string) { return !FS_INVALID.test(name) }

async function getFirestoreDeps() {
  const [{ db, FIREBASE_CONFIGURED }, firestore] = await Promise.all([
    import('./firebase'),
    import('firebase/firestore'),
  ])

  return {
    db,
    FIREBASE_CONFIGURED,
    doc: firestore.doc,
    getDoc: firestore.getDoc,
    setDoc: firestore.setDoc,
    updateDoc: firestore.updateDoc,
  }
}

// Singleton promise — resolves once the Firestore cache has been loaded (or skipped).
// Callers can await this to ensure cached data is in memory before fetching from Scryfall.
let _fsReadyPromise: Promise<void> | null = null

export function waitForFirestoreCache(): Promise<void> {
  return _fsReadyPromise ?? loadFirestoreImageCache()
}

/** Load the shared Firestore image cache once per browser session.
 *  Returns a singleton promise so it is safe to call multiple times. */
export function loadFirestoreImageCache(): Promise<void> {
  if (_fsReadyPromise) return _fsReadyPromise
  _fsReadyPromise = _doLoadFirestoreCache()
  return _fsReadyPromise
}

async function _doLoadFirestoreCache(): Promise<void> {
  const { db, FIREBASE_CONFIGURED, doc, getDoc } = await getFirestoreDeps()
  if (!FIREBASE_CONFIGURED) return
  if (sessionStorage.getItem(FS_SESSION_KEY)) return
  try {
    const snap = await getDoc(doc(db, 'meta', 'imageCache'))
    if (snap.exists()) {
      const data = snap.data() as { urls?: Record<string, string> }
      const raw = data.urls ?? {}
      // Filter out any junk entries before they reach the local cache
      const valid = new Map(
        Object.entries(raw).filter(([, url]) => isValidScryfallUrl(url))
      )
      const invalid = Object.keys(raw).length - valid.size
      if (invalid > 0 && import.meta.env.DEV)
        console.warn(`[imageCache] Firestore: dropped ${invalid} entries with invalid URLs`)
      if (valid.size > 0) setCachedImages(valid)
    }
    sessionStorage.setItem(FS_SESSION_KEY, '1')
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[imageCache] Firestore load failed:', e)
  }
}

// Accumulate images across rapid consecutive fetches and flush once
let _pendingImages = new Map<string, string>()
let _persistTimer: ReturnType<typeof setTimeout> | null = null

async function _flushPersist() {
  if (_pendingImages.size === 0) return
  const { db, FIREBASE_CONFIGURED, doc, updateDoc, setDoc } = await getFirestoreDeps()
  if (!FIREBASE_CONFIGURED) {
    _pendingImages = new Map()
    return
  }
  const toWrite = _pendingImages
  _pendingImages = new Map()

  const updates: Record<string, string> = {}
  for (const [name, url] of toWrite) {
    if (isSafeForFs(name)) updates[`urls.${name}`] = url
  }
  if (Object.keys(updates).length === 0) return

  try {
    await updateDoc(doc(db, 'meta', 'imageCache'), updates)
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === 'not-found') {
      const urlObj: Record<string, string> = {}
      for (const [name, url] of toWrite) {
        if (isSafeForFs(name)) urlObj[name] = url
      }
      await setDoc(doc(db, 'meta', 'imageCache'), { urls: urlObj })
    } else {
      if (import.meta.env.DEV) console.warn('[imageCache] Firestore persist failed:', e)
    }
  }
}

/** Persist newly fetched Scryfall URLs to Firestore so all users benefit.
 *  Debounced — batches rapid successive calls into a single Firestore write. */
export function persistImagesToFirestore(newImages: Map<string, string>): void {
  if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) return
  if (newImages.size === 0) return
  for (const [k, v] of newImages) _pendingImages.set(k, v)
  if (_persistTimer) clearTimeout(_persistTimer)
  _persistTimer = setTimeout(_flushPersist, 2000)
}
