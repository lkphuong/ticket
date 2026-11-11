import { createContext } from 'react'
import type { Viewer } from '../domain/ticket.ts'

export interface AuthContextValue {
  viewer: Viewer | null
  isLoading: boolean
  sessionExpired: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  // Re-reads the signed-in profile, for example after a department transfer was approved
  refreshViewer: () => Promise<void>
  // Sets the profile picture to an uploaded image, or removes it when null
  updateAvatar: (avatarAttachmentId: string | null) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
