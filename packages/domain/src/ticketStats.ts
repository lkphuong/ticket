import { DEPARTMENTS, TICKET_STATUSES, isActiveTicket, isTicketOverdue } from './ticket.ts'
import { hasMissedSla } from './ticketSla.ts'
import type { Department, Ticket, TicketStatus } from './ticket.ts'

export interface DepartmentWorkload {
  department: Department
  tickets: Ticket[]
}

export function countByStatus(tickets: Ticket[]): Record<TicketStatus, number> {
  const counts = Object.fromEntries(TICKET_STATUSES.map((status) => [status, 0])) as Record<TicketStatus, number>
  for (const ticket of tickets) counts[ticket.status] += 1
  return counts
}

export function countOverdue(tickets: Ticket[], now: Date): number {
  return tickets.filter((ticket) => isTicketOverdue(ticket, now)).length
}

// Calculates percentage of tickets delivered or on-track within defined SLA
export function calculateSlaComplianceRate(tickets: Ticket[], now: Date): number {
  const delivered = tickets.filter((ticket) => !ticket.cancelReason)
  if (delivered.length === 0) return 100
  const missedCount = delivered.filter((ticket) => hasMissedSla(ticket, now)).length
  const rate = Math.round(((delivered.length - missedCount) / delivered.length) * 100)
  return Math.max(0, Math.min(100, rate))
}

// Calculates mean requester satisfaction score from closed tickets
export function calculateAverageRating(tickets: Ticket[]): number | null {
  const rated = tickets.filter((ticket) => typeof ticket.rating === 'number' && ticket.rating > 0)
  if (rated.length === 0) return null
  const sum = rated.reduce((total, ticket) => total + (ticket.rating ?? 0), 0)
  return Math.round((sum / rated.length) * 10) / 10
}

// Collects unfinished tickets per receiving department, busiest first
export function workloadByDepartment(
  tickets: Ticket[],
  departments: readonly Department[] = DEPARTMENTS,
): DepartmentWorkload[] {
  return departments.map((department) => ({
    department,
    tickets: tickets.filter((ticket) => isActiveTicket(ticket) && ticket.toDepartment === department),
  }))
    .filter((entry) => entry.tickets.length > 0)
    .sort((a, b) => b.tickets.length - a.tickets.length)
}
