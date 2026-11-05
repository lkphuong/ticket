import { describe, expect, it } from 'vitest'
import type { Ticket, Viewer } from '../domain/ticket.ts'
import { DEFAULT_TICKET_FILTERS, filterTickets } from './ticketFilters.ts'

const viewer: Viewer = { name: 'An', department: 'Kinh doanh', isDepartmentHead: false }

function makeTicket(overrides: Partial<Ticket>): Ticket {
  return {
    id: 'TCK-1',
    title: 'Mẫu',
    description: 'Mô tả mẫu cho ticket',
    priority: 'medium',
    status: 'open',
    requesterName: 'Bình',
    fromDepartment: 'Marketing',
    toDepartment: 'Kế toán',
    attachments: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    comments: [],
    ...overrides,
  }
}

describe('filterTickets', () => {
  it('should_return_only_tickets_sent_by_viewer_when_scope_is_sent', () => {
    const mine = makeTicket({ id: 'TCK-1', requesterName: 'An' })
    const other = makeTicket({ id: 'TCK-2' })
    const result = filterTickets([mine, other], { ...DEFAULT_TICKET_FILTERS, scope: 'sent' }, viewer)
    expect(result.map((ticket) => ticket.id)).toEqual(['TCK-1'])
  })

  it('should_return_tickets_for_viewer_department_when_scope_is_received', () => {
    const received = makeTicket({ id: 'TCK-1', toDepartment: 'Kinh doanh' })
    const other = makeTicket({ id: 'TCK-2' })
    const result = filterTickets([received, other], { ...DEFAULT_TICKET_FILTERS, scope: 'received' }, viewer)
    expect(result.map((ticket) => ticket.id)).toEqual(['TCK-1'])
  })

  it('should_return_tickets_assigned_to_viewer_when_scope_is_assigned', () => {
    const assigned = makeTicket({ id: 'TCK-1', assigneeName: 'An' })
    const other = makeTicket({ id: 'TCK-2', assigneeName: 'Khác' })
    const result = filterTickets([assigned, other], { ...DEFAULT_TICKET_FILTERS, scope: 'assigned' }, viewer)
    expect(result.map((ticket) => ticket.id)).toEqual(['TCK-1'])
  })

  it('should_match_query_case_insensitively_on_id_title_and_requester', () => {
    const ticket = makeTicket({ title: 'Cấp Email mới' })
    expect(filterTickets([ticket], { ...DEFAULT_TICKET_FILTERS, query: 'email' }, viewer)).toHaveLength(1)
    expect(filterTickets([ticket], { ...DEFAULT_TICKET_FILTERS, query: 'tck-1' }, viewer)).toHaveLength(1)
    expect(filterTickets([ticket], { ...DEFAULT_TICKET_FILTERS, query: 'bình' }, viewer)).toHaveLength(1)
    expect(filterTickets([ticket], { ...DEFAULT_TICKET_FILTERS, query: 'khác' }, viewer)).toHaveLength(0)
  })

  it('should_sort_by_latest_activity_when_multiple_tickets_match', () => {
    const older = makeTicket({ id: 'TCK-1', updatedAt: '2026-01-01T00:00:00.000Z' })
    const newer = makeTicket({ id: 'TCK-2', updatedAt: '2026-02-01T00:00:00.000Z' })
    const result = filterTickets([older, newer], DEFAULT_TICKET_FILTERS, viewer)
    expect(result.map((ticket) => ticket.id)).toEqual(['TCK-2', 'TCK-1'])
  })

  it('should_filter_by_overdue_when_due_filter_is_overdue', () => {
    const now = new Date('2026-03-10T00:00:00.000Z')
    const overdue = makeTicket({ id: 'TCK-1', dueDate: '2026-03-05', status: 'in_progress' })
    const onTime = makeTicket({ id: 'TCK-2', dueDate: '2026-03-15', status: 'in_progress' })
    const result = filterTickets([overdue, onTime], { ...DEFAULT_TICKET_FILTERS, due: 'overdue' }, viewer, now)
    expect(result.map((ticket) => ticket.id)).toEqual(['TCK-1'])
  })

  it('should_filter_by_unassigned_when_assignment_filter_is_unassigned', () => {
    const unassigned = makeTicket({ id: 'TCK-1', assigneeName: undefined })
    const assigned = makeTicket({ id: 'TCK-2', assigneeName: 'Nam' })
    const result = filterTickets([unassigned, assigned], { ...DEFAULT_TICKET_FILTERS, assignment: 'unassigned' }, viewer)
    expect(result.map((ticket) => ticket.id)).toEqual(['TCK-1'])
  })

  it('should_sort_by_priority_descending_when_requested', () => {
    const low = makeTicket({ id: 'TCK-1', priority: 'low' })
    const urgent = makeTicket({ id: 'TCK-2', priority: 'urgent' })
    const result = filterTickets([low, urgent], { ...DEFAULT_TICKET_FILTERS, sort: 'priority_desc' }, viewer)
    expect(result.map((ticket) => ticket.id)).toEqual(['TCK-2', 'TCK-1'])
  })

  it('should_match_query_on_assignee_and_department_names', () => {
    const ticket = makeTicket({ assigneeName: 'Gia Huy' })
    expect(filterTickets([ticket], { ...DEFAULT_TICKET_FILTERS, query: 'gia huy' }, viewer)).toHaveLength(1)
    expect(filterTickets([ticket], { ...DEFAULT_TICKET_FILTERS, query: 'kế toán' }, viewer)).toHaveLength(1)
  })

  it('should_return_only_tickets_from_department_when_from_department_is_set', () => {
    const fromMarketing = makeTicket({ id: 'TCK-1' })
    const fromSales = makeTicket({ id: 'TCK-2', fromDepartment: 'Kinh doanh' })
    const result = filterTickets(
      [fromMarketing, fromSales],
      { ...DEFAULT_TICKET_FILTERS, fromDepartment: 'Kinh doanh' },
      viewer,
    )
    expect(result.map((ticket) => ticket.id)).toEqual(['TCK-2'])
  })

  it('should_include_bounds_when_created_range_is_set', () => {
    const early = makeTicket({ id: 'TCK-1', createdAt: '2026-01-01T08:00:00.000Z' })
    const middle = makeTicket({ id: 'TCK-2', createdAt: '2026-01-10T08:00:00.000Z' })
    const late = makeTicket({ id: 'TCK-3', createdAt: '2026-01-20T08:00:00.000Z' })
    const filters = { ...DEFAULT_TICKET_FILTERS, createdFrom: '2026-01-10', createdTo: '2026-01-10' }
    expect(filterTickets([early, middle, late], filters, viewer).map((ticket) => ticket.id)).toEqual(['TCK-2'])
  })
})
