import React, { createContext, useContext, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Draft } from '../types/firestore'
import { Section } from '../types/cube'
import { groupBySection } from '../lib/sorting'

interface ReviewContextValue {
  draft: Draft | null
  sections: Section[]
  loading: boolean
}

const ReviewContext = createContext<ReviewContextValue | null>(null)

export function ReviewProvider({ draftId, children }: { draftId: string; children: React.ReactNode }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'drafts', draftId), (snap) => {
      if (snap.exists()) {
        setDraft({ id: snap.id, ...snap.data() } as Draft)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [draftId])

  const sections = draft ? groupBySection(draft.rawData.onlyA, draft.rawData.onlyB) : []

  return (
    <ReviewContext.Provider value={{ draft, sections, loading }}>
      {children}
    </ReviewContext.Provider>
  )
}

export function useReview() {
  const ctx = useContext(ReviewContext)
  if (!ctx) throw new Error('useReview must be used within ReviewProvider')
  return ctx
}
