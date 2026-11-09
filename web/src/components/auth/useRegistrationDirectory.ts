import { useEffect, useState } from 'react'
import { apiClient } from '../../lib/apiClient.ts'

export interface RegistrationDirectory {
  readonly departments: readonly string[]
  readonly occupiedHeads: Record<string, string>
}

// Loads the department list and which departments already have a head
export function useRegistrationDirectory(): RegistrationDirectory {
  const [departments, setDepartments] = useState<readonly string[]>([])
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
        console.warn('Department directory could not be loaded', error)
      })
    return () => {
      isActive = false
    }
  }, [])

  return { departments, occupiedHeads }
}
