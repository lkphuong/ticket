import { isActiveTicket, isTicketOverdue } from '../domain/ticket.ts'
import type { Department, Ticket, TicketPriority, TicketStatus, Viewer } from '../domain/ticket.ts'

export type TicketScope = 'all' | 'sent' | 'received' | 'assigned'
export type DueFilter = 'all' | 'overdue' | 'due_today' | 'on_track'
export type AssignmentFilter = 'all' | 'unassigned' | 'assigned'
export type TicketSort = 'updated_desc' | 'due_asc' | 'priority_desc' | 'created_desc'

export interface TicketFilters {
  scope: TicketScope
  query: string
  status: TicketStatus | 'all'
  priority: TicketPriority | 'all'
  department: Department | 'all'
  fromDepartment?: Department | 'all'
  // Inclusive calendar dates in YYYY-MM-DD form; empty string means unbounded
  createdFrom?: string
  createdTo?: string
  due?: DueFilter
  assignment?: AssignmentFilter
  // Exact name of the handler; empty or absent means any
  assigneeName?: string
  sort?: TicketSort
}

export const DEFAULT_TICKET_FILTERS: TicketFilters = {
  scope: 'all',
  query: '',
  status: 'all',
  priority: 'all',
  department: 'all',
  fromDepartment: 'all',
  createdFrom: '',
  createdTo: '',
  due: 'all',
  assignment: 'all',
  assigneeName: '',
  sort: 'updated_desc',
}

const PRIORITY_SCORES: Record<TicketPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
}

function matchesScope(ticket: Ticket, scope: TicketScope, viewer: Viewer): boolean {
  if (scope === 'sent') return ticket.requesterName === viewer.name
  if (scope === 'received') return ticket.toDepartment === viewer.department
  if (scope === 'assigned') return ticket.assigneeName === viewer.name
  return true
}

function matchesQuery(ticket: Ticket, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const fields = [
    ticket.id,
    ticket.title,
    ticket.requesterName,
    ticket.description,
    ticket.assigneeName ?? '',
    ticket.fromDepartment,
    ticket.toDepartment,
  ]
  return fields.some((field) => field.toLowerCase().includes(needle))
}

// Compares the calendar date of creation so the range bounds are inclusive
function matchesCreatedRange(ticket: Ticket, from: string, to: string): boolean {
  const createdDate = ticket.createdAt.slice(0, 10)
  if (from && createdDate < from) return false
  if (to && createdDate > to) return false
  return true
}

function matchesDueFilter(ticket: Ticket, due: DueFilter, now: Date): boolean {
  if (due === 'all') return true
  const isOverdue = isTicketOverdue(ticket, now)
  if (due === 'overdue') return isOverdue
  if (due === 'due_today') {
    if (!ticket.dueDate || !isActiveTicket(ticket)) return false
    const nowIso = now.toISOString().slice(0, 10)
    return ticket.dueDate === nowIso
  }
  if (due === 'on_track') {
    return !isOverdue && isActiveTicket(ticket)
  }
  return true
}

function matchesAssignmentFilter(ticket: Ticket, assignment: AssignmentFilter): boolean {
  if (assignment === 'all') return true
  if (assignment === 'unassigned') return !ticket.assigneeName
  if (assignment === 'assigned') return Boolean(ticket.assigneeName)
  return true
}

// Sorts tickets according to selected sorting strategy
function sortTickets(tickets: Ticket[], sort: TicketSort): Ticket[] {
  const cloned = [...tickets]
  switch (sort) {
    case 'due_asc':
      // Sorts tickets with earlier due dates first; tickets without due date appear at the end
      return cloned.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return b.updatedAt.localeCompare(a.updatedAt)
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      })
    case 'priority_desc':
      return cloned.sort((a, b) => PRIORITY_SCORES[b.priority] - PRIORITY_SCORES[a.priority])
    case 'created_desc':
      return cloned.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'updated_desc':
    default:
      return cloned.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
}

// Applies comprehensive multi-dimensional filters and orders tickets by specified sort order
export function filterTickets(
  tickets: Ticket[],
  filters: TicketFilters,
  viewer: Viewer,
  now: Date = new Date(),
): Ticket[] {
  const filtered = tickets
    .filter((ticket) => matchesScope(ticket, filters.scope, viewer))
    .filter((ticket) => matchesQuery(ticket, filters.query))
    .filter((ticket) => filters.status === 'all' || ticket.status === filters.status)
    .filter((ticket) => filters.priority === 'all' || ticket.priority === filters.priority)
    .filter((ticket) => filters.department === 'all' || ticket.toDepartment === filters.department)
    .filter((ticket) => !filters.fromDepartment || filters.fromDepartment === 'all' || ticket.fromDepartment === filters.fromDepartment)
    .filter((ticket) => matchesCreatedRange(ticket, filters.createdFrom ?? '', filters.createdTo ?? ''))
    .filter((ticket) => matchesDueFilter(ticket, filters.due ?? 'all', now))
    .filter((ticket) => matchesAssignmentFilter(ticket, filters.assignment ?? 'all'))
    .filter((ticket) => !filters.assigneeName || ticket.assigneeName === filters.assigneeName)

  return sortTickets(filtered, filters.sort ?? 'updated_desc')
}
