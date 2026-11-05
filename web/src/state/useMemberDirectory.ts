import { useContext } from 'react'
import { MemberDirectoryContext } from './memberDirectoryContext.ts'
import type { MemberDirectoryValue } from './memberDirectoryContext.ts'

export function useMemberDirectory(): MemberDirectoryValue {
  const context = useContext(MemberDirectoryContext)
  if (!context) throw new Error('useMemberDirectory must be used within a MemberDirectoryProvider')
  return context
}
