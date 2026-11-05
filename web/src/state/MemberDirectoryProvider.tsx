// Loads the active member directory once per session for assignee pickers and filters

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { apiClient } from '../lib/apiClient.ts'
import type { DirectoryMember } from '../lib/apiClient.ts'
import { MemberDirectoryContext } from './memberDirectoryContext.ts'
import type { MemberDirectoryValue } from './memberDirectoryContext.ts'

interface MemberDirectoryProviderProps {
  children: ReactNode
}

export function MemberDirectoryProvider({ children }: MemberDirectoryProviderProps) {
  const [members, setMembers] = useState<readonly DirectoryMember[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    apiClient.members
      .directory()
      .then((res) => {
        if (!ignore) setMembers(res.members)
      })
      .catch((error: unknown) => {
        // Pickers fall back to an empty list; the ticket data flow reports its own connectivity errors
        console.warn('Member directory could not be loaded', error)
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  const value = useMemo<MemberDirectoryValue>(() => ({ members, isLoading }), [members, isLoading])

  return <MemberDirectoryContext.Provider value={value}>{children}</MemberDirectoryContext.Provider>
}
