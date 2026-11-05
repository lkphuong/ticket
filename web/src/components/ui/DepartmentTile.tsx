import type { Department } from '../../domain/ticket.ts'
import { badgeStyleFor, departmentIcon } from './departmentBadges.ts'
import { Icon } from './Icon.tsx'

interface DepartmentTileProps {
  department: Department
  sizeClass?: string
}

// Decorative icon tile; the department name is always written next to it
export function DepartmentTile({ department, sizeClass = 'size-5' }: DepartmentTileProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-md ${sizeClass}`}
      style={badgeStyleFor(department)}
    >
      <Icon name={departmentIcon(department)} className="size-[65%]" />
    </span>
  )
}
