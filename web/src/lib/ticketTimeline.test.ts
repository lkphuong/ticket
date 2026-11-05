import { describe, expect, it } from 'vitest'
import type { Ticket } from '../domain/ticket.ts'
import { buildTicketTimeline } from './ticketTimeline.ts'

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

describe('buildTicketTimeline', () => {
  it('should_mark_first_step_current_when_ticket_is_new', () => {
    const steps = buildTicketTimeline(makeTicket({}))
    expect(steps.map((step) => step.state)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    expect(steps[0].at).toBe('2026-01-01T00:00:00.000Z')
  })

  it('should_list_new_received_processing_completed_and_accepted_steps_in_order', () => {
    const steps = buildTicketTimeline(makeTicket({}))
    expect(steps.map((step) => step.label)).toEqual(['Mới', 'Đã tiếp nhận', 'Đang xử lý', 'Hoàn thành', 'Nghiệm thu'])
  })

  it('should_mark_processing_current_and_receipt_done_when_ticket_is_in_progress', () => {
    const steps = buildTicketTimeline(
      makeTicket({
        status: 'in_progress',
        statusHistory: [
          { status: 'open', at: '2026-01-01T00:00:00.000Z' },
          { status: 'in_progress', at: '2026-01-02T00:00:00.000Z' },
          { status: 'in_progress', at: '2026-01-03T00:00:00.000Z' },
        ],
      }),
    )
    expect(steps.map((step) => step.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming'])
    expect(steps[1].at).toBe('2026-01-02T00:00:00.000Z')
    expect(steps[2].at).toBe('2026-01-03T00:00:00.000Z')
  })

  it('should_keep_processing_current_when_ticket_waits_on_requester', () => {
    const steps = buildTicketTimeline(makeTicket({ status: 'waiting' }))
    expect(steps.map((step) => step.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming'])
  })

  it('should_mark_completed_step_current_when_ticket_is_resolved', () => {
    const steps = buildTicketTimeline(makeTicket({ status: 'resolved' }))
    expect(steps.map((step) => step.state)).toEqual(['done', 'done', 'done', 'current', 'upcoming'])
  })

  it('should_mark_acceptance_current_when_ticket_is_closed', () => {
    const steps = buildTicketTimeline(makeTicket({ status: 'closed', updatedAt: '2026-02-01T00:00:00.000Z' }))
    expect(steps.map((step) => step.state)).toEqual(['done', 'done', 'done', 'done', 'current'])
    expect(steps[4].at).toBe('2026-02-01T00:00:00.000Z')
  })
})
