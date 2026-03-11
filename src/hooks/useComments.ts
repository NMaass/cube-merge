import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Comment } from '../types/firestore'

export function useComments(draftId: string, changeId: string) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!draftId || !changeId) return
    const q = query(
      collection(db, 'drafts', draftId, 'changes', changeId, 'comments'),
      orderBy('createdAt', 'asc')
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Comment))
      setLoading(false)
    })
    return unsubscribe
  }, [draftId, changeId])

  return { comments, loading }
}
