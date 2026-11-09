import { describe, expect, it } from 'vitest'
import type { Ticket, TicketActor } from '../domain/ticket.ts'
import { ticketsReducer } from '@vtdesk/domain'
import type { TicketsAction } from '@vtdesk/domain'
import { buildActivityLog } from './ticketActivityLog.ts'

const requester: TicketActor = { name: 'Bình', department: 'Marketing' }
const head: TicketActor = { name: 'Ngọc', department: 'Kế toán' }
const handler: TicketActor = { name: 'Hà', department: 'Kế toán' }

function at(minute: number): string {
  return new Date(Date.UTC(2026, 2, 1, 8, minute)).toISOString()
}

const created: Ticket = {
  id: 'TCK-1',
  title: 'Mẫu',
  description: 'Mô tả mẫu cho ticket',
  priority: 'medium',
  status: 'open',
  requesterName: 'Bình',
  fromDepartment: 'Marketing',
  toDepartment: 'Kế toán',
  attachments: [],
  createdAt: at(0),
  updatedAt: at(0),
  comments: [],
  statusHistory: [{ status: 'open', at: at(0), actor: requester }],
}

function replay(actions: TicketsAction[]): Ticket {
  return actions.reduce((state, action) => ticketsReducer(state, action), [created])[0]
}

describe('buildActivityLog', () => {
  it('should_list_every_kind_of_event_in_time_order_when_ticket_goes_through_full_flow', () => {
    const ticket = replay([
      { type: 'assignee_set', ticketId: 'TCK-1', assigneeName: 'Hà', changedAt: at(10), actor: head },
      { type: 'status_changed', ticketId: 'TCK-1', status: 'waiting', changedAt: at(20), actor: handler },
      {
        type: 'comment_added',
        ticketId: 'TCK-1',
        comment: { id: 'c1', author: 'Bình', department: 'Marketing', body: 'Đã bổ sung', createdAt: at(30) },
      },
      { type: 'assignee_set', ticketId: 'TCK-1', assigneeName: 'Lan', changedAt: at(40), actor: head },
      { type: 'status_changed', ticketId: 'TCK-1', status: 'resolved', changedAt: at(50), actor: handler },
      { type: 'ticket_reopened', ticketId: 'TCK-1', reason: 'Thiếu phụ lục', changedAt: at(60), actor: requester },
    ])
    const kinds = buildActivityLog(ticket).map((event) => event.kind)
    expect(kinds).toEqual([
      'created',
      'assigned',
      'status',
      'status',
      'comment',
      'status',
      'handoff',
      'status',
      'rework',
    ])
  })

  it('should_show_actor_name_and_department_on_each_event', () => {
    const ticket = replay([{ type: 'assignee_set', ticketId: 'TCK-1', assigneeName: 'Hà', changedAt: at(10), actor: head }])
    const assigned = buildActivityLog(ticket).find((event) => event.kind === 'assigned')
    expect(assigned?.actor).toEqual(head)
    expect(assigned?.summary).toContain('Hà')
  })

  it('should_show_cancel_reason_and_not_present_ticket_as_completed_when_cancelled', () => {
    const ticket = replay([
      { type: 'ticket_cancelled', ticketId: 'TCK-1', reason: 'Yêu cầu trùng lặp', changedAt: at(10), actor: requester },
    ])
    const last = buildActivityLog(ticket).at(-1)
    expect(last?.kind).toBe('cancelled')
    expect(last?.detail).toBe('Yêu cầu trùng lặp')
    expect(last?.summary).not.toContain('nghiệm thu')
  })

  it('should_record_confirmation_with_rating_when_result_is_confirmed', () => {
    const ticket = replay([
      { type: 'assignee_set', ticketId: 'TCK-1', assigneeName: 'Hà', changedAt: at(10), actor: head },
      { type: 'status_changed', ticketId: 'TCK-1', status: 'resolved', changedAt: at(20), actor: handler },
      { type: 'result_confirmed', ticketId: 'TCK-1', rating: 5, changedAt: at(30), actor: requester },
    ])
    expect(buildActivityLog(ticket).at(-1)?.kind).toBe('confirmed')
  })

  it('should_record_rejection_reason_when_head_rejects_approval', () => {
    const ticket = replay([
      { type: 'assignee_set', ticketId: 'TCK-1', assigneeName: 'Hà', changedAt: at(10), actor: head },
      { type: 'status_changed', ticketId: 'TCK-1', status: 'resolved', changedAt: at(20), actor: handler },
      { type: 'result_confirmed', ticketId: 'TCK-1', rating: 3, changedAt: at(30), actor: requester },
      { type: 'approval_rejected', ticketId: 'TCK-1', reason: 'Thiếu chứng từ', changedAt: at(40), actor: head },
    ])
    const last = buildActivityLog(ticket).at(-1)
    expect(last?.kind).toBe('rework')
    expect(last?.detail).toBe('Thiếu chứng từ')
  })

  it('should_mark_reopen_when_closed_ticket_is_reopened', () => {
    const ticket = replay([
      { type: 'assignee_set', ticketId: 'TCK-1', assigneeName: 'Hà', changedAt: at(5), actor: head },
      { type: 'status_changed', ticketId: 'TCK-1', status: 'resolved', changedAt: at(8), actor: handler },
      { type: 'result_confirmed', ticketId: 'TCK-1', rating: 4, changedAt: at(10), actor: requester },
      { type: 'result_approved', ticketId: 'TCK-1', changedAt: at(15), actor: head },
      { type: 'ticket_reopened', ticketId: 'TCK-1', reason: 'Vẫn cần', changedAt: at(20), actor: requester },
    ])
    const last = buildActivityLog(ticket).at(-1)
    expect(last?.kind).toBe('reopened')
    expect(last?.detail).toBe('Vẫn cần')
  })

  it('should_interleave_comments_by_time_when_history_and_comments_overlap', () => {
    const ticket: Ticket = {
      ...created,
      comments: [{ id: 'c1', author: 'Hà', department: 'Kế toán', body: 'Xin chào', createdAt: at(5) }],
      statusHistory: [
        { status: 'open', at: at(0) },
        { status: 'in_progress', at: at(10) },
      ],
    }
    expect(buildActivityLog(ticket).map((event) => event.kind)).toEqual(['created', 'comment', 'status'])
  })

  it('should_still_show_creation_when_ticket_has_no_history', () => {
    const { statusHistory: _omitted, ...bare } = created
    expect(buildActivityLog(bare).map((event) => event.kind)).toEqual(['created'])
  })
})
