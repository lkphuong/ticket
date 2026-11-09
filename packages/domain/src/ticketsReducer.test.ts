import { describe, expect, it } from 'vitest'
import type { Ticket } from './ticket.ts'
import { ticketsReducer } from './ticketsReducer.ts'

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

const changedAt = '2026-03-01T00:00:00.000Z'

describe('ticketsReducer', () => {
  it('should_start_work_when_open_ticket_is_assigned', () => {
    const [ticket] = ticketsReducer([makeTicket({})], {
      type: 'assignee_set',
      ticketId: 'TCK-1',
      assigneeName: 'Hà',
      changedAt,
    })
    expect(ticket.status).toBe('in_progress')
    expect(ticket.assigneeName).toBe('Hà')
  })

  it('should_record_status_history_when_status_changes', () => {
    const [ticket] = ticketsReducer([makeTicket({ status: 'in_progress', statusHistory: [{ status: 'open', at: '2026-01-01T00:00:00.000Z' }] })], {
      type: 'status_changed',
      ticketId: 'TCK-1',
      status: 'waiting',
      changedAt,
    })
    expect(ticket.statusHistory).toEqual([
      { status: 'open', at: '2026-01-01T00:00:00.000Z' },
      { status: 'waiting', at: changedAt },
    ])
  })

  it('should_keep_status_when_waiting_ticket_is_reassigned', () => {
    const [ticket] = ticketsReducer([makeTicket({ status: 'waiting' })], {
      type: 'assignee_set',
      ticketId: 'TCK-1',
      assigneeName: 'Hà',
      changedAt,
    })
    expect(ticket.status).toBe('waiting')
  })

  it('should_move_to_pending_approval_and_store_rating_when_result_is_confirmed', () => {
    const [ticket] = ticketsReducer([makeTicket({ status: 'resolved' })], {
      type: 'result_confirmed',
      ticketId: 'TCK-1',
      rating: 4,
      feedback: 'Rất hài lòng với kết quả',
      changedAt,
    })
    expect(ticket.status).toBe('pending_approval')
    expect(ticket.rating).toBe(4)
    expect(ticket.feedback).toBe('Rất hài lòng với kết quả')
  })

  it('should_close_ticket_when_pending_approval_is_approved', () => {
    const [ticket] = ticketsReducer([makeTicket({ status: 'pending_approval', rating: 4 })], {
      type: 'result_approved',
      ticketId: 'TCK-1',
      changedAt,
    })
    expect(ticket.status).toBe('closed')
    expect(ticket.rating).toBe(4)
  })

  it('should_return_to_in_progress_and_clear_rating_when_approval_is_rejected', () => {
    const [ticket] = ticketsReducer([makeTicket({ status: 'pending_approval', rating: 4, feedback: 'ok' })], {
      type: 'approval_rejected',
      ticketId: 'TCK-1',
      reason: 'Chưa đủ chứng từ',
      changedAt,
    })
    expect(ticket.status).toBe('in_progress')
    expect(ticket.rating).toBeUndefined()
    expect(ticket.feedback).toBeUndefined()
    expect(ticket.statusHistory?.at(-1)?.reason).toBe('Chưa đủ chứng từ')
  })

  it('should_reject_approval_when_ticket_is_not_pending_approval', () => {
    const original = makeTicket({ status: 'resolved' })
    expect(ticketsReducer([original], { type: 'result_approved', ticketId: 'TCK-1', changedAt })).toEqual([original])
  })

  it('should_reject_approval_rejection_when_reason_is_blank', () => {
    const original = makeTicket({ status: 'pending_approval' })
    const action = { type: 'approval_rejected', ticketId: 'TCK-1', reason: '  ', changedAt } as const
    expect(ticketsReducer([original], action)).toEqual([original])
  })

  it('should_only_touch_target_ticket_when_status_changes', () => {
    const result = ticketsReducer([makeTicket({ id: 'TCK-1' }), makeTicket({ id: 'TCK-2', status: 'in_progress' })], {
      type: 'status_changed',
      ticketId: 'TCK-2',
      status: 'waiting',
      changedAt,
    })
    expect(result.map((ticket) => ticket.status)).toEqual(['open', 'waiting'])
  })

  it('should_update_priority_when_priority_changed_action_is_dispatched', () => {
    const [ticket] = ticketsReducer([makeTicket({ priority: 'low' })], {
      type: 'priority_changed',
      ticketId: 'TCK-1',
      priority: 'urgent',
      changedAt,
    })
    expect(ticket.priority).toBe('urgent')
    expect(ticket.updatedAt).toBe(changedAt)
  })

  it('should_update_due_date_when_due_date_changed_action_is_dispatched', () => {
    const [ticket] = ticketsReducer([makeTicket({ dueDate: '2026-03-10' })], {
      type: 'due_date_changed',
      ticketId: 'TCK-1',
      dueDate: '2026-03-25',
      changedAt,
    })
    expect(ticket.dueDate).toBe('2026-03-25')
    expect(ticket.updatedAt).toBe(changedAt)
  })

  it('should_close_ticket_and_store_reason_when_ticket_cancelled', () => {
    const [ticket] = ticketsReducer([makeTicket({ status: 'open' })], {
      type: 'ticket_cancelled',
      ticketId: 'TCK-1',
      reason: 'Yêu cầu trùng lặp',
      changedAt,
    })
    expect(ticket.status).toBe('closed')
    expect(ticket.cancelReason).toBe('Yêu cầu trùng lặp')
  })
})
