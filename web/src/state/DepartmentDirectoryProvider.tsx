// Loads the department list from the API once per session for pickers, filters and workload views

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Department } from '../domain/ticket.ts'
import { apiClient } from '../lib/apiClient.ts'
import { DepartmentDirectoryContext } from './departmentDirectoryContext.ts'
import type { DepartmentDirectoryValue } from './departmentDirectoryContext.ts'

interface DepartmentDirectoryProviderProps {
  children: ReactNode
}

export function DepartmentDirectoryProvider({ children }: DepartmentDirectoryProviderProps) {
  const [departments, setDepartments] = useState<readonly Department[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    apiClient.auth
      .getDepartments()
      .then((res) => {
        // The API owns the catalog, so its names are trusted as department values
        if (!ignore) setDepartments(res.departments as Department[])
      })
      .catch((error: unknown) => {
        // Pickers fall back to an empty list; the ticket data flow reports its own connectivity errors
        console.warn('Department directory could not be loaded', error)
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  const value = useMemo<DepartmentDirectoryValue>(() => ({ departments, isLoading }), [departments, isLoading])

  return <DepartmentDirectoryContext.Provider value={value}>{children}</DepartmentDirectoryContext.Provider>
}
