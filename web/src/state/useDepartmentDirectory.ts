import { useContext } from 'react'
import { DepartmentDirectoryContext } from './departmentDirectoryContext.ts'
import type { DepartmentDirectoryValue } from './departmentDirectoryContext.ts'

export function useDepartmentDirectory(): DepartmentDirectoryValue {
  const context = useContext(DepartmentDirectoryContext)
  if (!context) throw new Error('useDepartmentDirectory must be used within a DepartmentDirectoryProvider')
  return context
}
