import { describe, expect, it } from 'vitest'
import type { Ticket, Viewer } from '../domain/ticket.ts'
import { buildInbox, isWaitingOnViewer } from './ticketInbox.ts'

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

const head: Viewer = { name: 'Hà', department: 'Kế toán', isDepartmentHead: true }
const staff: Viewer = { name: 'Bình', department: 'Marketing', isDepartmentHead: false }

describe('buildInbox', () => {
  it('should_ask_head_to_assign_when_ticket_for_their_department_has_no_assignee', () => {
    const groups = buildInbox([makeTicket({})], head)
    expect(groups.map((group) => group.reason)).toEqual(['assign'])
  })

  it('should_not_ask_staff_to_assign_when_viewer_is_not_a_head', () => {
    const staffInAccounting: Viewer = { ...head, isDepartmentHead: false }
    expect(buildInbox([makeTicket({})], staffInAccounting)).toEqual([])
  })

  it('should_ask_requester_to_confirm_when_ticket_is_resolved', () => {
    const groups = buildInbox([makeTicket({ status: 'resolved' })], staff)
    expect(groups.map((group) => group.reason)).toEqual(['confirm'])
  })

  it('should_ask_requester_to_reply_when_ticket_is_waiting', () => {
    const groups = buildInbox([makeTicket({ status: 'waiting', assigneeName: 'Hà' })], staff)
    expect(groups.map((group) => group.reason)).toEqual(['reply'])
  })

  it('should_list_active_assigned_tickets_when_viewer_is_assignee', () => {
    const ticket = makeTicket({ status: 'in_progress', assigneeName: 'Hà' })
    expect(buildInbox([ticket], head).map((group) => group.reason)).toEqual(['work'])
    expect(isWaitingOnViewer(ticket, staff)).toBe(false)
  })
})
