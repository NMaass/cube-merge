import { useState } from 'react'
import { CubeCard } from '../types/cube'
import { fetchCubeCobraList, computeDiff } from '../lib/cubecobra'

export type FetchErrorKind = 'CUBE_NOT_FOUND' | 'CORS_BLOCKED' | 'UNKNOWN'

interface UseCubeCobraDataResult {
  loading: boolean
  errorKind: FetchErrorKind | null
  fetchDiff: (cubeAId: string, cubeBId: string) => Promise<{ onlyA: CubeCard[]; onlyB: CubeCard[] } | null>
}

export function useCubeCobraData(): UseCubeCobraDataResult {
  const [loading, setLoading] = useState(false)
  const [errorKind, setErrorKind] = useState<FetchErrorKind | null>(null)

  async function fetchDiff(cubeAId: string, cubeBId: string) {
    setLoading(true)
    setErrorKind(null)

    try {
      const [cardsA, cardsB] = await Promise.all([
        fetchCubeCobraList(cubeAId),
        fetchCubeCobraList(cubeBId),
      ])
      return computeDiff(cardsA, cardsB)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'CUBE_NOT_FOUND') setErrorKind('CUBE_NOT_FOUND')
      else if (msg === 'CORS_BLOCKED') setErrorKind('CORS_BLOCKED')
      else setErrorKind('UNKNOWN')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { loading, errorKind, fetchDiff }
}
