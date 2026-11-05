import { createContext } from 'react'
import type { Viewer } from '../domain/ticket.ts'

export interface AuthContextValue {
  viewer: Viewer | null
  // Returns false when the credentials do not match any account
  login: (username: string, password: string) => boolean
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
