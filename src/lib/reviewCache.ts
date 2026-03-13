import { Review } from '../types/firestore'

const cache = new Map<string, Review>()

export function getCachedReview(id: string): Review | undefined {
  return cache.get(id)
}

export function setCachedReview(id: string, review: Review): void {
  cache.set(id, review)
}
