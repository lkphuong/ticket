import { describe, expect, it } from 'vitest'
import { TICKET_STATUSES } from '../domain/ticket.ts'
import type { Ticket, TicketStatus, Viewer } from '../domain/ticket.ts'
import {
  canAssign,
  canCancel,
  canConfirmResult,
  canEditDueDate,
  canEditPriority,
  canReopen,
  canUpdateProgress,
} from './ticketPermissions.ts'

function makeTicket(status: TicketStatus, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'TCK-1',
    code: 'TCK-1',
    title: 'Mẫu',
    description: 'Mô tả mẫu cho ticket',
    priority: 'medium',
    status,
    requesterName: 'Bình',
    fromDepartment: 'Marketing',
    toDepartment: 'Kế toán',
    assigneeName: 'Hà',
    attachments: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    comments: [],
    ...overrides,
  }
}

const requester: Viewer = { name: 'Bình', department: 'Marketing', isDepartmentHead: false }
const assignee: Viewer = { name: 'Hà', department: 'Kế toán', isDepartmentHead: false }
const otherStaff: Viewer = { name: 'Lan', department: 'Kế toán', isDepartmentHead: false }
const receivingHead: Viewer = { name: 'Ngọc', department: 'Kế toán', isDepartmentHead: true }
const foreignHead: Viewer = { name: 'Khánh', department: 'Pháp chế', isDepartmentHead: true }
const executive: Viewer = { name: 'Đăng', department: 'Hành chính', isDepartmentHead: false, isExecutive: true }
const executiveRequester: Viewer = { ...executive, name: 'Bình' }
const executiveAssignee: Viewer = { ...executive, name: 'Hà' }

const ACTIVE: TicketStatus[] = ['open', 'in_progress', 'waiting']

describe('ticket permissions', () => {
  it.each(TICKET_STATUSES)('should_allow_only_receiving_head_to_assign_when_status_is_%s', (status) => {
    const expected = ACTIVE.includes(status)
    const ticket = makeTicket(status)
    expect(canAssign(ticket, receivingHead)).toBe(expected)
    for (const viewer of [requester, assignee, otherStaff, foreignHead, executive]) {
      expect(canAssign(ticket, viewer)).toBe(false)
    }
  })

  it.each(TICKET_STATUSES)('should_limit_progress_updates_to_assignee_and_head_when_status_is_%s', (status) => {
    const expected = ACTIVE.includes(status)
    const ticket = makeTicket(status)
    expect(canUpdateProgress(ticket, assignee)).toBe(expected)
    expect(canUpdateProgress(ticket, receivingHead)).toBe(expected)
    for (const viewer of [requester, otherStaff, foreignHead, executive, executiveAssignee]) {
      expect(canUpdateProgress(ticket, viewer)).toBe(false)
    }
  })

  it.each(TICKET_STATUSES)('should_allow_only_requester_to_confirm_when_status_is_%s', (status) => {
    const ticket = makeTicket(status)
    expect(canConfirmResult(ticket, requester)).toBe(status === 'resolved')
    for (const viewer of [assignee, receivingHead, otherStaff, executive, executiveRequester]) {
      expect(canConfirmResult(ticket, viewer)).toBe(false)
    }
  })

  it.each(TICKET_STATUSES)('should_allow_only_requester_to_rework_or_reopen_when_status_is_%s', (status) => {
    const ticket = makeTicket(status)
    expect(canReopen(ticket, requester)).toBe(status === 'resolved' || status === 'closed')
    for (const viewer of [assignee, receivingHead, otherStaff, executive, executiveRequester]) {
      expect(canReopen(ticket, viewer)).toBe(false)
    }
  })

  it.each(TICKET_STATUSES)('should_allow_requester_and_receiving_head_to_cancel_when_status_is_%s', (status) => {
    const ticket = makeTicket(status)
    const expected = ACTIVE.includes(status)
    expect(canCancel(ticket, requester)).toBe(expected)
    expect(canCancel(ticket, receivingHead)).toBe(expected)
    for (const viewer of [assignee, otherStaff, foreignHead, executive, executiveRequester]) {
      expect(canCancel(ticket, viewer)).toBe(false)
    }
  })

  it.each(TICKET_STATUSES)('should_allow_requester_and_receiving_head_to_edit_priority_when_status_is_%s', (status) => {
    const ticket = makeTicket(status)
    const expected = ACTIVE.includes(status)
    expect(canEditPriority(ticket, requester)).toBe(expected)
    expect(canEditPriority(ticket, receivingHead)).toBe(expected)
    for (const viewer of [assignee, otherStaff, foreignHead, executive, executiveRequester]) {
      expect(canEditPriority(ticket, viewer)).toBe(false)
    }
  })

  it.each(TICKET_STATUSES)('should_allow_assignee_and_receiving_head_to_edit_due_date_when_status_is_%s', (status) => {
    const ticket = makeTicket(status)
    const expected = ACTIVE.includes(status)
    expect(canEditDueDate(ticket, assignee)).toBe(expected)
    expect(canEditDueDate(ticket, receivingHead)).toBe(expected)
    for (const viewer of [requester, otherStaff, foreignHead, executive, executiveAssignee]) {
      expect(canEditDueDate(ticket, viewer)).toBe(false)
    }
  })

  it('should_not_allow_progress_update_when_ticket_is_unassigned_and_viewer_is_staff', () => {
    expect(canUpdateProgress(makeTicket('open', { assigneeName: undefined }), otherStaff)).toBe(false)
  })
})
