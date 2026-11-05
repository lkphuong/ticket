import { isActiveTicket } from '../domain/ticket.ts'
import type { Ticket } from '../domain/ticket.ts'

export type SlaUrgency = 'overdue' | 'due_today' | 'due_soon' | 'on_track' | 'none' | 'completed'

export interface TicketSlaInfo {
  urgency: SlaUrgency
  label: string
  daysDiff: number
  isOverdue: boolean
  // Set for resolved or closed tickets whose completion came after the due date
  finishedLate: boolean
  toneClass: string
}

const MILLISECONDS_IN_DAY = 86400000

// A ticket is on time until the end of its due date (UTC, matching the day arithmetic below)
function endOfDueDate(dueDate: string): number {
  return new Date(`${dueDate}T23:59:59.999Z`).getTime()
}

// Work is complete when it was resolved; tickets closed without a recorded resolution use the closing moment
export function getCompletedAt(ticket: Ticket): string | undefined {
  const history = ticket.statusHistory ?? []
  const resolved = history.findLast((change) => change.status === 'resolved')
  const closed = history.findLast((change) => change.status === 'closed')
  const recorded = resolved ?? closed
  if (recorded) return recorded.at
  return ticket.status === 'resolved' || ticket.status === 'closed' ? ticket.updatedAt : undefined
}

function isFinishedLate(ticket: Ticket): boolean {
  if (!ticket.dueDate) return false
  const completedAt = getCompletedAt(ticket)
  return completedAt !== undefined && new Date(completedAt).getTime() > endOfDueDate(ticket.dueDate)
}

// Whether the ticket broke its deadline: still open past due, or finished after it. Cancelled tickets deliver nothing.
export function hasMissedSla(ticket: Ticket, now: Date): boolean {
  if (ticket.cancelReason) return false
  if (ticket.status === 'closed' || ticket.status === 'resolved') return isFinishedLate(ticket)
  return calculateTicketSla(ticket, now).isOverdue
}

// Compares calendar date boundaries to determine remaining business days and overdue status
export function calculateTicketSla(ticket: Ticket, now: Date): TicketSlaInfo {
  if (ticket.cancelReason) {
    return {
      urgency: 'completed',
      label: 'Đã hủy',
      daysDiff: 0,
      isOverdue: false,
      finishedLate: false,
      toneClass: 'bg-ash-200 text-ash-700',
    }
  }

  if (ticket.status === 'closed' || ticket.status === 'resolved') {
    return {
      urgency: 'completed',
      label: isFinishedLate(ticket) ? 'Hoàn tất trễ hạn' : 'Đã hoàn tất',
      daysDiff: 0,
      isOverdue: false,
      finishedLate: isFinishedLate(ticket),
      toneClass: 'bg-moss-100 text-moss-700 border border-moss-700/20',
    }
  }

  if (!ticket.dueDate || !isActiveTicket(ticket)) {
    return {
      urgency: 'none',
      label: 'Không có hạn',
      daysDiff: 0,
      isOverdue: false,
      finishedLate: false,
      toneClass: 'bg-ash-200 text-ash-700',
    }
  }

  // Uses UTC midnight normalization to eliminate timezone offset inconsistencies
  const nowIsoDate = now.toISOString().slice(0, 10)
  const nowDateOnly = new Date(`${nowIsoDate}T00:00:00.000Z`).getTime()
  const targetDateOnly = new Date(`${ticket.dueDate}T00:00:00.000Z`).getTime()
  const diffDays = Math.round((targetDateOnly - nowDateOnly) / MILLISECONDS_IN_DAY)

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays)
    return {
      urgency: 'overdue',
      label: `Quá hạn ${overdueDays} ngày`,
      daysDiff: diffDays,
      isOverdue: true,
      finishedLate: false,
      toneClass: 'bg-brick-100 text-brick-700 border border-brick-500/30 font-semibold',
    }
  }

  if (diffDays === 0) {
    return {
      urgency: 'due_today',
      label: 'Hạn chót hôm nay',
      daysDiff: 0,
      isOverdue: false,
      finishedLate: false,
      toneClass: 'bg-ochre-100 text-ochre-800 border border-ochre-500/30 font-semibold',
    }
  }

  if (diffDays <= 2) {
    return {
      urgency: 'due_soon',
      label: `Còn ${diffDays} ngày`,
      daysDiff: diffDays,
      isOverdue: false,
      finishedLate: false,
      toneClass: 'bg-accent-100 text-accent-800 border border-accent-600/30',
    }
  }

  return {
    urgency: 'on_track',
    label: `Còn ${diffDays} ngày`,
    daysDiff: diffDays,
    isOverdue: false,
    finishedLate: false,
    toneClass: 'bg-surface text-ink-muted border border-line-strong',
  }
}
