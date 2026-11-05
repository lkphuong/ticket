import { DEPARTMENTS, isActiveTicket } from '../domain/ticket.ts'
import type { Department, Ticket } from '../domain/ticket.ts'
import { calculateAverageRating, calculateSlaComplianceRate, countOverdue } from './ticketStats.ts'

export interface DepartmentReportRow {
  department: Department
  // Tickets addressed to the department, regardless of status
  received: number
  active: number
  overdue: number
  onTimeRate: number
  averageRating: number | null
}

// One row per department so executives can compare volume, punctuality and satisfaction side by side
export function buildDepartmentReport(tickets: Ticket[], now: Date): DepartmentReportRow[] {
  return DEPARTMENTS.map((department) => {
    const received = tickets.filter((ticket) => ticket.toDepartment === department)
    return {
      department,
      received: received.length,
      active: received.filter(isActiveTicket).length,
      overdue: countOverdue(received, now),
      onTimeRate: calculateSlaComplianceRate(received, now),
      averageRating: calculateAverageRating(received),
    }
  })
}

// Executive department view: read-only lens on everything a department sends or receives
export function filterByDepartmentView(tickets: Ticket[], department: Department | 'all'): Ticket[] {
  if (department === 'all') return tickets
  return tickets.filter((ticket) => ticket.fromDepartment === department || ticket.toDepartment === department)
}
