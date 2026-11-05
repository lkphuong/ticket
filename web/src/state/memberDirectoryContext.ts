import { createContext } from 'react'
import type { DirectoryMember } from '../lib/apiClient.ts'

export interface MemberDirectoryValue {
  members: readonly DirectoryMember[]
  isLoading: boolean
}

export const MemberDirectoryContext = createContext<MemberDirectoryValue | null>(null)
