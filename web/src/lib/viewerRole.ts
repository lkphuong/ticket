import type { Viewer } from '../domain/ticket.ts'

export type ViewerRole = 'member' | 'head' | 'admin'

export const ROLE_LABELS: Record<ViewerRole, string> = {
  member: 'Nhân viên',
  head: 'Trưởng phòng',
  admin: 'Quản trị viên',
}

// Visual indicator stripe on the header reflects the active role lens
export const ROLE_STRIPE_CLASSES: Record<ViewerRole, string> = {
  member: 'bg-blue-700',
  head: 'bg-sea-700',
  admin: 'bg-ink',
}

export function getViewerRole(viewer: Viewer): ViewerRole {
  if (viewer.role === 'admin' || viewer.isAdmin || viewer.isExecutive) return 'admin'
  return viewer.isDepartmentHead ? 'head' : 'member'
}
