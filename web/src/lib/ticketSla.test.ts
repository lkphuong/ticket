import { describe, expect, it } from 'vitest'
import type { Ticket } from '../domain/ticket.ts'
import { calculateTicketSla } from './ticketSla.ts'

function createSampleTicket(overrides: Partial<Ticket>): Ticket {
  return {
    id: 'TCK-2001',
    title: 'Kiem tra he thong',
    description: 'Mo ta kiem tra he thong',
    priority: 'medium',
    status: 'in_progress',
    requesterName: 'Nguyen Van A',
    fromDepartment: 'Kinh doanh',
    toDepartment: 'Công nghệ thông tin',
    attachments: [],
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-01T08:00:00.000Z',
    comments: [],
    ...overrides,
  }
}

describe('calculateTicketSla', () => {
  const referenceDate = new Date('2026-03-10T10:00:00.000Z')

  it('should_return_completed_when_ticket_status_is_closed', () => {
    const ticket = createSampleTicket({ status: 'closed', dueDate: '2026-03-05' })
    const info = calculateTicketSla(ticket, referenceDate)
    expect(info.urgency).toBe('completed')
    expect(info.isOverdue).toBe(false)
  })

  it('should_return_none_when_ticket_has_no_due_date', () => {
    const ticket = createSampleTicket({ dueDate: undefined })
    const info = calculateTicketSla(ticket, referenceDate)
    expect(info.urgency).toBe('none')
    expect(info.label).toBe('Không có hạn')
  })

  it('should_identify_overdue_ticket_when_target_date_passed', () => {
    const ticket = createSampleTicket({ dueDate: '2026-03-08' })
    const info = calculateTicketSla(ticket, referenceDate)
    expect(info.urgency).toBe('overdue')
    expect(info.isOverdue).toBe(true)
  })

  it('should_identify_due_today_when_due_date_matches_current_day', () => {
    const ticket = createSampleTicket({ dueDate: '2026-03-10' })
    const info = calculateTicketSla(ticket, referenceDate)
    expect(info.urgency).toBe('due_today')
    expect(info.isOverdue).toBe(false)
  })

  it('should_identify_due_soon_when_due_within_two_days', () => {
    const ticket = createSampleTicket({ dueDate: '2026-03-12' })
    const info = calculateTicketSla(ticket, referenceDate)
    expect(info.urgency).toBe('due_soon')
    expect(info.isOverdue).toBe(false)
  })

  it('should_identify_on_track_when_due_after_three_days', () => {
    const ticket = createSampleTicket({ dueDate: '2026-03-20' })
    const info = calculateTicketSla(ticket, referenceDate)
    expect(info.urgency).toBe('on_track')
    expect(info.isOverdue).toBe(false)
  })
})

describe('calculateTicketSla completion', () => {
  const now = new Date('2026-03-20T10:00:00.000Z')

  it('should_not_warn_overdue_when_closed_ticket_was_finished_before_due_date', () => {
    const ticket = createSampleTicket({
      status: 'closed',
      dueDate: '2026-03-10',
      statusHistory: [
        { status: 'resolved', at: '2026-03-09T08:00:00.000Z' },
        { status: 'closed', at: '2026-03-15T08:00:00.000Z' },
      ],
    })
    const info = calculateTicketSla(ticket, now)
    expect(info.isOverdue).toBe(false)
    expect(info.finishedLate).toBe(false)
  })

  it('should_mark_finished_late_without_overdue_warning_when_closed_after_due_date', () => {
    const ticket = createSampleTicket({
      status: 'closed',
      dueDate: '2026-03-10',
      statusHistory: [{ status: 'closed', at: '2026-03-12T08:00:00.000Z' }],
    })
    const info = calculateTicketSla(ticket, now)
    expect(info.isOverdue).toBe(false)
    expect(info.finishedLate).toBe(true)
    expect(info.urgency).toBe('completed')
  })

  it('should_count_ticket_finished_on_due_day_as_on_time', () => {
    const ticket = createSampleTicket({
      status: 'resolved',
      dueDate: '2026-03-10',
      statusHistory: [{ status: 'resolved', at: '2026-03-10T23:00:00.000Z' }],
    })
    expect(calculateTicketSla(ticket, now).finishedLate).toBe(false)
  })

  it('should_stay_neutral_when_closed_ticket_has_no_due_date', () => {
    const ticket = createSampleTicket({ status: 'closed', dueDate: undefined })
    expect(calculateTicketSla(ticket, now).finishedLate).toBe(false)
  })

  it('should_keep_counting_down_when_ticket_is_waiting_for_requester', () => {
    const ticket = createSampleTicket({ status: 'waiting', dueDate: '2026-03-18' })
    expect(calculateTicketSla(ticket, now).urgency).toBe('overdue')
  })
})

describe('calculateTicketSla cancellation', () => {
  it('should_show_cancelled_label_and_not_late_when_ticket_was_cancelled_after_due_date', () => {
    const ticket = createSampleTicket({
      status: 'closed',
      dueDate: '2026-03-05',
      cancelReason: 'Trùng',
      statusHistory: [{ status: 'closed', at: '2026-03-09T00:00:00.000Z', reason: 'Trùng' }],
    })
    const info = calculateTicketSla(ticket, new Date('2026-03-10T10:00:00.000Z'))
    expect(info.finishedLate).toBe(false)
    expect(info.label).toBe('Đã hủy')
  })
})
