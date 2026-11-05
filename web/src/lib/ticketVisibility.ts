import type { Ticket, Viewer } from '../domain/ticket.ts'

function isInvolved(ticket: Ticket, viewer: Viewer): boolean {
  return ticket.requesterName === viewer.name || ticket.assigneeName === viewer.name
}

function belongsToDepartment(ticket: Ticket, viewer: Viewer): boolean {
  return ticket.fromDepartment === viewer.department || ticket.toDepartment === viewer.department
}

// Staff see tickets they raised or handle; heads add every ticket sent or received by their department
export function canViewTicket(ticket: Ticket, viewer: Viewer): boolean {
  if (viewer.isExecutive) return true
  if (isInvolved(ticket, viewer)) return true
  return viewer.isDepartmentHead && belongsToDepartment(ticket, viewer)
}

export function filterVisibleTickets(tickets: Ticket[], viewer: Viewer): Ticket[] {
  return tickets.filter((ticket) => canViewTicket(ticket, viewer))
}
