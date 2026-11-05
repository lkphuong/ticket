import { isActiveTicket } from './ticket.ts'
import type { Ticket, TicketStatus, Viewer } from './ticket.ts'

export const HANDLER_STATUSES: readonly TicketStatus[] = ['in_progress', 'waiting', 'resolved']

function isReceivingHead(ticket: Ticket, viewer: Viewer): boolean {
  return viewer.isDepartmentHead && viewer.department === ticket.toDepartment
}

function isRequester(ticket: Ticket, viewer: Viewer): boolean {
  return ticket.requesterName === viewer.name
}

// Administrative and executive supervisors possess read-only permissions across all tickets
function withoutExecutive(viewer: Viewer, rule: () => boolean): boolean {
  return !viewer.isExecutive && !viewer.isAdmin && viewer.role !== 'admin' && rule()
}

export function canAssign(ticket: Ticket, viewer: Viewer): boolean {
  return withoutExecutive(viewer, () => isReceivingHead(ticket, viewer) && isActiveTicket(ticket))
}

export function canUpdateProgress(ticket: Ticket, viewer: Viewer): boolean {
  return withoutExecutive(
    viewer,
    () => isActiveTicket(ticket) && (ticket.assigneeName === viewer.name || isReceivingHead(ticket, viewer)),
  )
}

export function canConfirmResult(ticket: Ticket, viewer: Viewer): boolean {
  return withoutExecutive(viewer, () => isRequester(ticket, viewer) && ticket.status === 'resolved')
}

// Covers both rework from "resolved" and reopening a closed ticket
export function canReopen(ticket: Ticket, viewer: Viewer): boolean {
  return withoutExecutive(
    viewer,
    () =>
      isRequester(ticket, viewer) &&
      (ticket.status === 'resolved' || (ticket.status === 'closed' && !ticket.cancelReason)),
  )
}

export function canCancel(ticket: Ticket, viewer: Viewer): boolean {
  return withoutExecutive(
    viewer,
    () => isActiveTicket(ticket) && (isRequester(ticket, viewer) || isReceivingHead(ticket, viewer)),
  )
}

export function canEditPriority(ticket: Ticket, viewer: Viewer): boolean {
  return canCancel(ticket, viewer)
}

export function canEditDueDate(ticket: Ticket, viewer: Viewer): boolean {
  return withoutExecutive(
    viewer,
    () => isActiveTicket(ticket) && (isReceivingHead(ticket, viewer) || ticket.assigneeName === viewer.name),
  )
}

export interface TicketPermissions {
  canAssign: boolean
  canUpdateProgress: boolean
  canConfirmResult: boolean
  canReopen: boolean
  canCancel: boolean
  canEditPriority: boolean
  canEditDueDate: boolean
}

// Aggregates authorization capabilities for the active viewer against a specific ticket
export function getTicketPermissions(ticket: Ticket, viewer: Viewer): TicketPermissions {
  return {
    canAssign: canAssign(ticket, viewer),
    canUpdateProgress: canUpdateProgress(ticket, viewer),
    canConfirmResult: canConfirmResult(ticket, viewer),
    canReopen: canReopen(ticket, viewer),
    canCancel: canCancel(ticket, viewer),
    canEditPriority: canEditPriority(ticket, viewer),
    canEditDueDate: canEditDueDate(ticket, viewer),
  }
}
