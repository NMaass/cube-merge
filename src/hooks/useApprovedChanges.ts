import { useCallback, useState } from 'react'

interface ApprovalRecord {
  approvedAt: number
  lastSeenUpdatedAt: number
  approverAuthorId: string
}

type ApprovalMap = Record<string, ApprovalRecord>

function storageKey(reviewId: string) {
  return `cube-diff:approved-changes:${reviewId}`
}

function loadFromStorage(reviewId: string): ApprovalMap {
  try {
    return JSON.parse(localStorage.getItem(storageKey(reviewId)) || '{}')
  } catch {
    return {}
  }
}

function saveToStorage(reviewId: string, map: ApprovalMap) {
  localStorage.setItem(storageKey(reviewId), JSON.stringify(map))
}

export function useApprovedChanges(reviewId: string) {
  const [approvals, setApprovals] = useState<ApprovalMap>(() => loadFromStorage(reviewId))

  const approve = useCallback((changeId: string, updatedAt: number, myAuthorId: string) => {
    setApprovals(prev => {
      const next = {
        ...prev,
        [changeId]: {
          approvedAt: Date.now(),
          lastSeenUpdatedAt: updatedAt,
          approverAuthorId: myAuthorId,
        },
      }
      saveToStorage(reviewId, next)
      return next
    })
  }, [reviewId])

  const unapprove = useCallback((changeId: string) => {
    setApprovals(prev => {
      const next = { ...prev }
      delete next[changeId]
      saveToStorage(reviewId, next)
      return next
    })
  }, [reviewId])

  const isApproved = useCallback((changeId: string) => {
    return changeId in approvals
  }, [approvals])

  /** Returns true if the change has been modified by another user since approval. */
  const isStale = useCallback((
    changeId: string,
    currentUpdatedAt: number,
    lastModifiedByAuthorId?: string,
  ) => {
    const rec = approvals[changeId]
    if (!rec) return false
    // Only stale if someone else made the modification
    if (lastModifiedByAuthorId && lastModifiedByAuthorId === rec.approverAuthorId) return false
    return currentUpdatedAt > rec.lastSeenUpdatedAt
  }, [approvals])

  const approvedCount = Object.keys(approvals).length

  return { approve, unapprove, isApproved, isStale, approvedCount }
}
