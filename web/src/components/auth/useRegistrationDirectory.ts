import { useEffect, useState } from 'react'
import { DEPARTMENTS } from '../../domain/ticket.ts'
import { apiClient } from '../../lib/apiClient.ts'

export interface RegistrationDirectory {
  readonly departments: readonly string[]
  readonly occupiedHeads: Record<string, string>
}

// Loads the department list and which departments already have a head; falls back to the static catalog offline
export function useRegistrationDirectory(): RegistrationDirectory {
  const [departments, setDepartments] = useState<readonly string[]>(DEPARTMENTS)
  const [occupiedHeads, setOccupiedHeads] = useState<Record<string, string>>({})

  useEffect(() => {
    let isActive = true
    apiClient.auth
      .getDepartments()
      .then((response) => {
        if (!isActive) return
        if (response.departments?.length > 0) setDepartments(response.departments)
        if (response.occupiedDepartmentHeads) setOccupiedHeads(response.occupiedDepartmentHeads)
      })
      .catch((error: unknown) => {
        console.warn('Department directory unavailable, using the built-in catalog', error)
      })
    return () => {
      isActive = false
    }
  }, [])

  return { departments, occupiedHeads }
}
