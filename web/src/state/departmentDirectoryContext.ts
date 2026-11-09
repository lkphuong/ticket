import { createContext } from 'react'
import type { Department } from '../domain/ticket.ts'

export interface DepartmentDirectoryValue {
  departments: readonly Department[]
  isLoading: boolean
}

export const DepartmentDirectoryContext = createContext<DepartmentDirectoryValue | null>(null)
