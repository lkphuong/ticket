import { isActiveTicket } from '../domain/ticket.ts'
import type { Ticket, Viewer } from '../domain/ticket.ts'

export type InboxReason = 'assign' | 'work' | 'reply' | 'confirm'

export interface InboxGroup {
  reason: InboxReason
  label: string
  tickets: Ticket[]
}

const INBOX_RULES: { reason: InboxReason; label: string; matches: (ticket: Ticket, viewer: Viewer) => boolean }[] = [
  {
    reason: 'confirm',
    label: 'Xác nhận kết quả',
    matches: (ticket, viewer) => ticket.requesterName === viewer.name && ticket.status === 'resolved',
  },
  {
    reason: 'reply',
    label: 'Cần bạn phản hồi',
    matches: (ticket, viewer) => ticket.requesterName === viewer.name && ticket.status === 'waiting',
  },
  {
    reason: 'assign',
    label: 'Chờ phân công',
    matches: (ticket, viewer) =>
      viewer.isDepartmentHead && ticket.toDepartment === viewer.department && ticket.status === 'open' && !ticket.assigneeName,
  },
  {
    reason: 'work',
    label: 'Đang giao cho bạn',
    matches: (ticket, viewer) => ticket.assigneeName === viewer.name && isActiveTicket(ticket) && ticket.status !== 'waiting',
  },
]

// Groups the tickets that currently wait on the viewer, skipping empty groups
export function buildInbox(tickets: Ticket[], viewer: Viewer): InboxGroup[] {
  return INBOX_RULES.map((rule) => ({
    reason: rule.reason,
    label: rule.label,
    tickets: tickets.filter((ticket) => rule.matches(ticket, viewer)),
  })).filter((group) => group.tickets.length > 0)
}

export function isWaitingOnViewer(ticket: Ticket, viewer: Viewer): boolean {
  return INBOX_RULES.some((rule) => rule.matches(ticket, viewer))
}
