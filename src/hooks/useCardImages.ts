import { useCallback, useEffect, useRef, useState } from 'react'
import { Section } from '../types/cube'
import { getCachedImage, getCachedBackImage, fetchAndCacheImages, waitForFirestoreCache } from '../lib/imageCache'

export function useCardImages(sections: Section[], currentIndex: number) {
  const [imageMap, setImageMap] = useState<Map<string, string>>(new Map())
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set())

  // Keys currently in-flight — prevents duplicate concurrent fetches but DOES allow
  // retries once the fetch resolves (success or failure). Separate from fetchedRef.
  const pendingRef = useRef(new Set<string>())
  // Keys we already have a result for — no need to ever re-fetch these.
  const fetchedRef = useRef(new Set<string>())

  const fetchSections = useCallback(async (indices: number[]) => {
    const toFetch: string[] = []
    const fromCache = new Map<string, string>()

    for (const i of indices) {
      const s = sections[i]
      const cards = s ? [...s.cardsA, ...s.cardsB] : []
      for (const card of cards) {
        const key = card.name.toLowerCase()
        // Skip if we already have a result or a fetch is currently in-flight
        if (fetchedRef.current.has(key) || pendingRef.current.has(key)) continue
        pendingRef.current.add(key)

        const cached = getCachedImage(card.name)
        if (cached) {
          fromCache.set(key, cached)
          const cachedBack = getCachedBackImage(card.name)
          if (cachedBack) fromCache.set(key + '__back', cachedBack)
          fetchedRef.current.add(key)
          pendingRef.current.delete(key)
        } else {
          toFetch.push(card.name)
        }
      }
    }

    if (fromCache.size > 0) {
      setImageMap(prev => {
        const next = new Map(prev)
        for (const [k, v] of fromCache) next.set(k, v)
        return next
      })
    }

    if (toFetch.length === 0) return

    const fetchKeys = toFetch.map(n => n.toLowerCase())
    setLoadingSet(prev => new Set([...prev, ...fetchKeys]))

    try {
      const newImages = await fetchAndCacheImages(toFetch)

      // Cards that came back with no image — warn always, not just in dev
      for (const name of toFetch) {
        const key = name.toLowerCase()
        if (!newImages.has(key)) {
          console.warn(`[images] No image found for "${name}" — card may not exist in Scryfall`)
        }
      }

      // Only mark as fetched for cards that actually got images;
      // others stay out of fetchedRef so they can be retried next navigation
      for (const name of toFetch) {
        const key = name.toLowerCase()
        if (newImages.has(key)) fetchedRef.current.add(key)
        pendingRef.current.delete(key)
      }

      setImageMap(prev => {
        const next = new Map(prev)
        for (const [k, v] of newImages) next.set(k, v)
        return next
      })
    } catch (e) {
      // On network failure, remove from pendingRef so the next navigation retries
      console.warn('[images] Scryfall fetch failed — will retry on next navigation:', e)
      for (const key of fetchKeys) pendingRef.current.delete(key)
    } finally {
      setLoadingSet(prev => {
        const next = new Set(prev)
        for (const k of fetchKeys) next.delete(k)
        return next
      })
    }
  }, [sections])

  // On mount / sections change: wait for the Firestore cache to be ready so that
  // previously-fetched images are served from cache instead of hitting Scryfall again.
  useEffect(() => {
    let cancelled = false
    pendingRef.current = new Set()
    fetchedRef.current = new Set()
    setImageMap(new Map())
    setLoadingSet(new Set())
    waitForFirestoreCache().then(() => {
      if (!cancelled) fetchSections([0, 1, 2])
    })
    return () => { cancelled = true }
  }, [fetchSections])

  // On navigation: always include the current section itself + 2 ahead
  useEffect(() => {
    if (sections.length === 0) return
    fetchSections([currentIndex, currentIndex + 1, currentIndex + 2])
  }, [currentIndex, fetchSections, sections.length])

  return { imageMap, loadingSet }
}
