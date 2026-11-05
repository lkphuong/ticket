import { createContext } from 'react'
import type { Viewer } from '../domain/ticket.ts'

export interface AuthContextValue {
  viewer: Viewer | null
  isLoading: boolean
  sessionExpired: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
