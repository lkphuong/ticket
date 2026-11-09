import type { CSSProperties } from 'react'
import type { Department } from '../../domain/ticket.ts'
import type { IconName } from './Icon.tsx'

interface DepartmentBadge {
  code: string
  icon: IconName
  ground: string
  ink: string
}

// Each department is an icon on a solid colour; the full name is always written beside it
const DEPARTMENT_BADGES: Record<Department, DepartmentBadge> = {
  'Công nghệ thông tin': { code: 'CNTT', icon: 'monitor', ground: '#1d4ea0', ink: '#ffffff' },
  'Nhân sự': { code: 'NS', icon: 'users', ground: '#a3263f', ink: '#ffffff' },
  'Kế toán': { code: 'KT', icon: 'calculator', ground: '#0b6b63', ink: '#ffffff' },
  Marketing: { code: 'MKT', icon: 'megaphone', ground: '#e0a416', ink: '#16202e' },
  'Kinh doanh': { code: 'KD', icon: 'briefcase', ground: '#d4501a', ink: '#ffffff' },
  'Vận hành': { code: 'VH', icon: 'cog', ground: '#16202e', ink: '#ffffff' },
  'Pháp chế': { code: 'PC', icon: 'scale', ground: '#5b3a8f', ink: '#ffffff' },
  'Hành chính': { code: 'HC', icon: 'building', ground: '#556073', ink: '#ffffff' },
}

const DEFAULT_BADGE: DepartmentBadge = { code: 'PB', icon: 'building', ground: '#556073', ink: '#ffffff' }

export function departmentCode(department: Department): string {
  return DEPARTMENT_BADGES[department]?.code ?? DEFAULT_BADGE.code
}

export function departmentIcon(department: Department): IconName {
  return DEPARTMENT_BADGES[department]?.icon ?? DEFAULT_BADGE.icon
}

export function badgeStyleFor(department: Department): CSSProperties {
  const badge = DEPARTMENT_BADGES[department] ?? DEFAULT_BADGE
  return { backgroundColor: badge.ground, color: badge.ink }
}
