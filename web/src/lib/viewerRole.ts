import type { Viewer } from '../domain/ticket.ts'

export type ViewerRole = 'member' | 'head' | 'executive'

export const ROLE_LABELS: Record<ViewerRole, string> = {
  member: 'Nhân viên',
  head: 'Trưởng phòng',
  executive: 'Lãnh đạo',
}

// Each role gets its own colour on the header stripe so the viewer always knows which lens is active
export const ROLE_STRIPE_CLASSES: Record<ViewerRole, string> = {
  member: 'bg-blue-700',
  head: 'bg-sea-700',
  executive: 'bg-ink',
}

export function getViewerRole(viewer: Viewer): ViewerRole {
  if (viewer.isExecutive) return 'executive'
  return viewer.isDepartmentHead ? 'head' : 'member'
}
