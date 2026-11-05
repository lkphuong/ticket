import type { TicketStatus } from './ticket.ts'

// Single source of truth for the lifecycle; the reducer and permission checks both read it.
// Closing happens only through confirmation or cancellation, never a plain status change.
export const STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['waiting', 'resolved', 'closed'],
  waiting: ['in_progress', 'resolved', 'closed'],
  resolved: ['in_progress', 'closed'],
  closed: ['in_progress'],
}

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to)
}
