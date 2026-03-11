import React, { createContext, useContext, useState, useMemo, useCallback } from 'react'

export type ActionType = 'add' | 'remove' | 'swap' | null

interface EditModeContextValue {
  selectedLeft: Set<string>
  selectedRight: Set<string>
  lockedCardIds: Set<string>
  actionType: ActionType
  toggleLeft: (name: string) => void
  toggleRight: (name: string) => void
  clearSelection: () => void
  setLockedCards: (ids: Set<string>) => void
}

const EditModeContext = createContext<EditModeContextValue | null>(null)

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [selectedLeft, setSelectedLeft] = useState<Set<string>>(new Set())
  const [selectedRight, setSelectedRight] = useState<Set<string>>(new Set())
  const [lockedCardIds, setLockedCardIds] = useState<Set<string>>(new Set())

  const actionType: ActionType = useMemo(() => {
    const hasLeft = selectedLeft.size > 0
    const hasRight = selectedRight.size > 0
    if (hasLeft && hasRight) return 'swap'
    if (hasLeft) return 'remove'
    if (hasRight) return 'add'
    return null
  }, [selectedLeft, selectedRight])

  const toggleLeft = useCallback((name: string) => {
    if (lockedCardIds.has(name)) return
    setSelectedLeft(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [lockedCardIds])

  const toggleRight = useCallback((name: string) => {
    if (lockedCardIds.has(name)) return
    setSelectedRight(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [lockedCardIds])

  const clearSelection = useCallback(() => {
    setSelectedLeft(new Set())
    setSelectedRight(new Set())
  }, [])

  const setLockedCards = useCallback((ids: Set<string>) => {
    setLockedCardIds(ids)
  }, [])

  return (
    <EditModeContext.Provider value={{
      selectedLeft, selectedRight, lockedCardIds,
      actionType, toggleLeft, toggleRight, clearSelection, setLockedCards,
    }}>
      {children}
    </EditModeContext.Provider>
  )
}

export function useEditMode() {
  const ctx = useContext(EditModeContext)
  if (!ctx) throw new Error('useEditMode must be used within EditModeProvider')
  return ctx
}
