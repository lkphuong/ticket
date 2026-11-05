import { describe, expect, it } from 'vitest'
import type { Ticket, TicketComment } from './ticket.ts'
import { ticketsReducer, validateTicketAction } from './ticketsReducer.ts'
import type { TicketsAction } from './ticketsReducer.ts'

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
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
    statusHistory: [{ status: 'open', at: '2026-01-01T00:00:00.000Z' }],
    ...overrides,
  }
}

const at = '2026-03-01T00:00:00.000Z'

function run(ticket: Ticket, ...actions: TicketsAction[]): Ticket {
  return actions.reduce((state, action) => ticketsReducer(state, action), [ticket])[0]
}

function comment(author: string): TicketComment {
  return { id: 'c1', author, department: 'Marketing', body: 'Trả lời', createdAt: at }
}

describe('ticket lifecycle', () => {
  it('should_close_ticket_when_happy_path_runs_from_creation_to_confirmation', () => {
    const ticket = run(
      makeTicket(),
      { type: 'assignee_set', ticketId: 'TCK-1', assigneeName: 'Hà', changedAt: at },
      { type: 'status_changed', ticketId: 'TCK-1', status: 'resolved', changedAt: at },
      { type: 'result_confirmed', ticketId: 'TCK-1', rating: 5, changedAt: at },
    )
    expect(ticket.status).toBe('closed')
    expect(ticket.rating).toBe(5)
  })

  it.each([
    ['open', 'waiting'],
    ['open', 'resolved'],
    ['open', 'closed'],
    ['waiting', 'open'],
    ['resolved', 'waiting'],
    ['closed', 'resolved'],
    ['closed', 'waiting'],
    ['in_progress', 'open'],
  ] as const)('should_keep_state_when_status_moves_from_%s_to_%s', (from, to) => {
    const original = makeTicket({ status: from })
    const result = ticketsReducer([original], { type: 'status_changed', ticketId: 'TCK-1', status: to, changedAt: at })
    expect(result).toEqual([original])
  })

  it('should_explain_in_vietnamese_when_transition_is_not_allowed', () => {
    const error = validateTicketAction([makeTicket({ status: 'open' })], {
      type: 'status_changed',
      ticketId: 'TCK-1',
      status: 'resolved',
      changedAt: at,
    })
    expect(error).toContain('Mới')
    expect(error).toContain('Đã xử lý')
  })

  it('should_reject_cancel_when_reason_is_blank', () => {
    const original = makeTicket()
    const action: TicketsAction = { type: 'ticket_cancelled', ticketId: 'TCK-1', reason: '   ', changedAt: at }
    expect(ticketsReducer([original], action)).toEqual([original])
    expect(validateTicketAction([original], action)).toContain('lý do')
  })

  it('should_reject_cancel_when_ticket_is_already_closed', () => {
    const original = makeTicket({ status: 'closed' })
    const result = ticketsReducer([original], { type: 'ticket_cancelled', ticketId: 'TCK-1', reason: 'Trùng', changedAt: at })
    expect(result).toEqual([original])
  })

  it.each([0, 6, 3.5, -1])('should_reject_confirmation_when_rating_is_%s', (rating) => {
    const original = makeTicket({ status: 'resolved' })
    const action: TicketsAction = { type: 'result_confirmed', ticketId: 'TCK-1', rating, changedAt: at }
    expect(ticketsReducer([original], action)).toEqual([original])
    expect(validateTicketAction([original], action)).toContain('1 đến 5')
  })

  it('should_reject_confirmation_when_ticket_is_not_resolved', () => {
    const original = makeTicket({ status: 'in_progress' })
    const result = ticketsReducer([original], { type: 'result_confirmed', ticketId: 'TCK-1', rating: 4, changedAt: at })
    expect(result).toEqual([original])
  })

  it('should_reject_assignment_when_ticket_is_closed', () => {
    const original = makeTicket({ status: 'closed' })
    const result = ticketsReducer([original], { type: 'assignee_set', ticketId: 'TCK-1', assigneeName: 'Hà', changedAt: at })
    expect(result).toEqual([original])
  })
})

describe('rework and reopen', () => {
  it('should_return_to_in_progress_with_reason_when_rework_is_requested_on_resolved_ticket', () => {
    const ticket = run(makeTicket({ status: 'resolved' }), {
      type: 'ticket_reopened',
      ticketId: 'TCK-1',
      reason: 'Thiếu số liệu quý 2',
      changedAt: at,
    })
    expect(ticket.status).toBe('in_progress')
    expect(ticket.statusHistory?.at(-1)).toEqual({ status: 'in_progress', at, reason: 'Thiếu số liệu quý 2' })
  })

  it('should_clear_rating_and_feedback_when_closed_ticket_is_reopened', () => {
    const ticket = run(makeTicket({ status: 'closed', rating: 4, feedback: 'Ổn' }), {
      type: 'ticket_reopened',
      ticketId: 'TCK-1',
      reason: 'Phát sinh sai sót',
      changedAt: at,
    })
    expect(ticket.status).toBe('in_progress')
    expect(ticket.rating).toBeUndefined()
    expect(ticket.feedback).toBeUndefined()
  })

  it('should_reject_reopen_when_reason_is_blank_or_ticket_is_active', () => {
    const resolved = makeTicket({ status: 'resolved' })
    const blank: TicketsAction = { type: 'ticket_reopened', ticketId: 'TCK-1', reason: '', changedAt: at }
    expect(ticketsReducer([resolved], blank)).toEqual([resolved])
    const active = makeTicket({ status: 'waiting' })
    const valid: TicketsAction = { type: 'ticket_reopened', ticketId: 'TCK-1', reason: 'Lý do', changedAt: at }
    expect(ticketsReducer([active], valid)).toEqual([active])
  })
})

describe('handoff', () => {
  it('should_record_previous_and_new_assignee_when_ticket_is_handed_over', () => {
    const ticket = run(
      makeTicket({ status: 'in_progress', assigneeName: 'Hà' }),
      { type: 'assignee_set', ticketId: 'TCK-1', assigneeName: 'Ngọc', changedAt: at },
    )
    expect(ticket.assigneeName).toBe('Ngọc')
    expect(ticket.assignmentHistory).toEqual([{ from: 'Hà', to: 'Ngọc', at }])
  })

  it('should_record_first_assignment_without_previous_assignee', () => {
    const ticket = run(makeTicket(), { type: 'assignee_set', ticketId: 'TCK-1', assigneeName: 'Hà', changedAt: at })
    expect(ticket.assignmentHistory).toEqual([{ to: 'Hà', at }])
  })

  it('should_not_record_history_when_assignee_is_unchanged', () => {
    const original = makeTicket({ status: 'in_progress', assigneeName: 'Hà' })
    const ticket = run(original, { type: 'assignee_set', ticketId: 'TCK-1', assigneeName: 'Hà', changedAt: at })
    expect(ticket.assignmentHistory).toBeUndefined()
  })
})

describe('conversation', () => {
  it('should_resume_work_when_requester_replies_to_waiting_ticket', () => {
    const ticket = run(makeTicket({ status: 'waiting' }), { type: 'comment_added', ticketId: 'TCK-1', comment: comment('Bình') })
    expect(ticket.status).toBe('in_progress')
    expect(ticket.comments).toHaveLength(1)
  })

  it('should_stay_waiting_when_handler_comments_on_waiting_ticket', () => {
    const ticket = run(makeTicket({ status: 'waiting' }), { type: 'comment_added', ticketId: 'TCK-1', comment: comment('Hà') })
    expect(ticket.status).toBe('waiting')
  })

  it.each(['open', 'in_progress', 'resolved', 'closed'] as const)('should_keep_status_when_requester_comments_on_%s_ticket', (status) => {
    const ticket = run(makeTicket({ status }), { type: 'comment_added', ticketId: 'TCK-1', comment: comment('Bình') })
    expect(ticket.status).toBe(status)
  })
})

describe('guards found in review', () => {
  it('should_keep_cancelled_ticket_closed_when_reopen_is_attempted', () => {
    const original = makeTicket({ status: 'closed', cancelReason: 'Trùng' })
    const result = ticketsReducer([original], { type: 'ticket_reopened', ticketId: 'TCK-1', reason: 'Vẫn cần', changedAt: at })
    expect(result).toEqual([original])
  })

  it('should_reject_due_date_when_blank_or_ticket_is_closed', () => {
    const active = makeTicket({ status: 'in_progress', dueDate: '2026-03-10' })
    const blank: TicketsAction = { type: 'due_date_changed', ticketId: 'TCK-1', dueDate: '', changedAt: at }
    expect(ticketsReducer([active], blank)).toEqual([active])
    const closed = makeTicket({ status: 'closed' })
    const valid: TicketsAction = { type: 'due_date_changed', ticketId: 'TCK-1', dueDate: '2026-04-01', changedAt: at }
    expect(ticketsReducer([closed], valid)).toEqual([closed])
  })

  it('should_reject_due_date_in_the_past_relative_to_change_time', () => {
    const active = makeTicket({ status: 'in_progress' })
    const action: TicketsAction = { type: 'due_date_changed', ticketId: 'TCK-1', dueDate: '2026-02-28', changedAt: at }
    expect(validateTicketAction([active], action)).toContain('quá khứ')
  })

  it('should_reject_priority_change_and_comments_on_closed_ticket', () => {
    const closed = makeTicket({ status: 'closed' })
    expect(ticketsReducer([closed], { type: 'priority_changed', ticketId: 'TCK-1', priority: 'urgent', changedAt: at })).toEqual([closed])
    expect(ticketsReducer([closed], { type: 'comment_added', ticketId: 'TCK-1', comment: comment('Bình') })).toEqual([closed])
  })
})
