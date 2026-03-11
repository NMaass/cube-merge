import React, { createContext, useContext, useState } from 'react'
import { nanoid } from 'nanoid'

export interface Identity {
  id: string
  displayName: string
  photoURL: string
}

interface AuthContextValue {
  identity: Identity
  setName: (name: string) => void
}

const ANON_KEY = 'cube-diff:anon-identity'

function getOrCreateIdentity(): Identity {
  try {
    const stored = localStorage.getItem(ANON_KEY)
    if (stored) return JSON.parse(stored) as Identity
  } catch { /* ignore */ }

  const identity: Identity = {
    id: nanoid(12),
    displayName: 'Reviewer',
    photoURL: '',
  }
  try { localStorage.setItem(ANON_KEY, JSON.stringify(identity)) } catch { /* ignore */ }
  return identity
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<Identity>(getOrCreateIdentity)

  function setName(name: string) {
    setIdentity(prev => {
      const updated = { ...prev, displayName: name }
      try { localStorage.setItem(ANON_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
      return updated
    })
  }

  return (
    <AuthContext.Provider value={{ identity, setName }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
