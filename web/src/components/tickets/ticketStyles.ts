import type { TicketPriority, TicketStatus } from '../../domain/ticket.ts'

export const STATUS_TONE_CLASSES: Record<TicketStatus, string> = {
  open: 'bg-sea-100 text-sea-700',
  in_progress: 'bg-blue-100 text-blue-700',
  waiting: 'bg-ochre-100 text-ochre-800',
  resolved: 'bg-moss-100 text-moss-700',
  closed: 'bg-ash-200 text-ash-700',
}

// Solid fills used where a status is drawn as a tile rather than written
export const STATUS_MARK_CLASSES: Record<TicketStatus, string> = {
  open: 'bg-sea-700',
  in_progress: 'bg-blue-700',
  waiting: 'bg-ochre-500',
  resolved: 'bg-moss-700',
  closed: 'bg-ash-700',
}

// Priority is drawn as an outline so it never reads as a second status fill
export const PRIORITY_TONE_CLASSES: Record<TicketPriority, string> = {
  low: 'text-ash-700 ring-1 ring-line-strong ring-inset',
  medium: 'text-ink ring-1 ring-line-strong ring-inset',
  high: 'text-ochre-800 ring-2 ring-ochre-500 ring-inset',
  urgent: 'text-brick-700 ring-2 ring-brick-500 ring-inset',
}

// Frames that carry status on a department tile
export const STATUS_RING_CLASSES: Record<TicketStatus, string> = {
  open: 'ring-sea-700',
  in_progress: 'ring-blue-700',
  waiting: 'ring-ochre-500',
  resolved: 'ring-moss-700',
  closed: 'ring-ash-700',
}

export const OVERDUE_RING_CLASS = 'ring-brick-500'

export const OVERDUE_MARK_CLASS = 'bg-brick-500'
