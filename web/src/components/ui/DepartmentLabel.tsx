import type { Department } from '../../domain/ticket.ts'
import { DepartmentTile } from './DepartmentTile.tsx'

export function DepartmentLabel({ department }: { department: Department }) {
  return (
    <span className="inline-flex items-center gap-2">
      <DepartmentTile department={department} />
      <span>{department}</span>
    </span>
  )
}
