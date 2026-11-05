import { describe, expect, it } from 'vitest'
import type { Ticket, Viewer } from './ticket.ts'
import { canViewTicket, filterVisibleTickets } from './ticketVisibility.ts'

function makeTicket(overrides: Partial<Ticket>): Ticket {
  return {
    id: 'TCK-1',
    code: 'TCK-1',
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

const requester: Viewer = { name: 'Bình', department: 'Marketing', isDepartmentHead: false }
const handler: Viewer = { name: 'Chi', department: 'Kế toán', isDepartmentHead: false }
const accountingHead: Viewer = { name: 'Hà', department: 'Kế toán', isDepartmentHead: true }
const unrelatedHead: Viewer = { name: 'Nam', department: 'Pháp chế', isDepartmentHead: true }
const executive: Viewer = { name: 'Đăng', department: 'Hành chính', isDepartmentHead: false, isExecutive: true }

describe('canViewTicket', () => {
  it('should_allow_staff_to_view_when_they_raised_the_ticket', () => {
    expect(canViewTicket(makeTicket({}), requester)).toBe(true)
  })

  it('should_allow_staff_to_view_when_they_are_the_assignee', () => {
    expect(canViewTicket(makeTicket({ assigneeName: 'Chi' }), handler)).toBe(true)
  })

  it('should_hide_ticket_from_staff_when_only_their_department_is_involved', () => {
    expect(canViewTicket(makeTicket({}), handler)).toBe(false)
  })

  it('should_allow_head_to_view_when_ticket_is_received_by_their_department', () => {
    expect(canViewTicket(makeTicket({}), accountingHead)).toBe(true)
  })

  it('should_allow_head_to_view_when_ticket_is_sent_by_their_department', () => {
    const marketingHead: Viewer = { name: 'Linh', department: 'Marketing', isDepartmentHead: true }
    expect(canViewTicket(makeTicket({}), marketingHead)).toBe(true)
  })

  it('should_hide_ticket_from_head_when_their_department_is_not_involved', () => {
    expect(canViewTicket(makeTicket({}), unrelatedHead)).toBe(false)
  })

  it('should_allow_executive_to_view_any_ticket', () => {
    expect(canViewTicket(makeTicket({}), executive)).toBe(true)
  })
})

describe('filterVisibleTickets', () => {
  it('should_keep_only_viewable_tickets_when_viewer_is_staff', () => {
    const mine = makeTicket({ id: 'TCK-1' })
    const others = makeTicket({ id: 'TCK-2', requesterName: 'Khác' })
    expect(filterVisibleTickets([mine, others], requester)).toEqual([mine])
  })
})
