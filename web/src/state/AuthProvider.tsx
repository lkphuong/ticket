import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Viewer } from '../domain/ticket.ts'
import { authenticate, findViewerByName } from '../lib/auth.ts'
import { readStoredViewerName, writeStoredViewerName } from '../lib/sessionStorage.ts'
import { AuthContext } from './authContext.ts'
import type { AuthContextValue } from './authContext.ts'

interface AuthProviderProps {
  children: ReactNode
}

function restoreViewer(): Viewer | null {
  const storedName = readStoredViewerName()
  return storedName ? findViewerByName(storedName) : null
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [viewer, setViewer] = useState<Viewer | null>(restoreViewer)

  const login = useCallback((username: string, password: string) => {
    const authenticated = authenticate(username, password)
    if (!authenticated) return false
    writeStoredViewerName(authenticated.name)
    setViewer(authenticated)
    return true
  }, [])

  const logout = useCallback(() => {
    writeStoredViewerName(null)
    setViewer(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ viewer, login, logout }), [viewer, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
