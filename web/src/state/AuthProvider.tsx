// Authentication context provider backed by persistent session storage and the backend API

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Department, Viewer } from '../domain/ticket.ts'
import { ApiError, apiClient, getStoredSessionToken, setSessionExpiredHandler, setStoredSessionToken } from '../lib/apiClient.ts'
import type { UserSessionProfile } from '../lib/apiClient.ts'
import { AuthContext } from './authContext.ts'
import type { AuthContextValue } from './authContext.ts'

interface AuthProviderProps {
  children: ReactNode
}

// Maps user profile received from API into domain Viewer
function toViewer(user: UserSessionProfile): Viewer {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    department: user.department as Department,
    role: user.role,
    isDepartmentHead: user.isDepartmentHead,
    isAdmin: user.role === 'admin',
    isExecutive: user.role === 'admin',
    requiresPasswordChange: user.requiresPasswordChange,
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(getStoredSessionToken()))
  const [sessionExpired, setSessionExpired] = useState(false)

  // Returns the viewer to the login page when the API rejects the session mid-use
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setStoredSessionToken(null)
      setViewer(null)
      setSessionExpired(true)
    })
    return () => setSessionExpiredHandler(null)
  }, [])

  // Restores authenticated session on initial page load
  useEffect(() => {
    const token = getStoredSessionToken()
    if (!token) return

    let isMounted = true
    apiClient.auth
      .me()
      .then((res) => {
        if (isMounted) {
          setViewer(toViewer(res.user))
        }
      })
      .catch(() => {
        if (isMounted) {
          setStoredSessionToken(null)
          setViewer(null)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const login = useCallback(async (usernameRaw: string, passwordRaw: string): Promise<boolean> => {
    const res = await apiClient.auth.login(usernameRaw, passwordRaw)
    setSessionExpired(false)
    setViewer(toViewer(res.user))
    return true
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient.auth.logout()
    } finally {
      setViewer(null)
    }
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<string | null> => {
    try {
      await apiClient.auth.changePassword(currentPassword, newPassword)
      setViewer((current) => (current ? { ...current, requiresPasswordChange: false } : null))
      return null
    } catch (err: any) {
      if (err instanceof ApiError) {
        return err.message
      }
      return 'Không thể thay đổi mật khẩu. Vui lòng kiểm tra lại.'
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ viewer, isLoading, sessionExpired, login, logout, changePassword }),
    [viewer, isLoading, sessionExpired, login, logout, changePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
