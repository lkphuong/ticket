import type { Department } from '../../domain/ticket.ts'
import { badgeStyleFor } from './departmentBadges.ts'
import { Icon } from './Icon.tsx'

interface AvatarProps {
  department: Department
  sizeClass?: string
}

// Decorative person glyph tinted with the department colour; the person's name is always written beside it
export function Avatar({ department, sizeClass = 'size-7' }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${sizeClass}`}
      style={badgeStyleFor(department)}
    >
      <Icon name="user" className="size-[60%]" />
    </span>
  )
}
