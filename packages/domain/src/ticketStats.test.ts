import { describe, expect, it } from 'vitest'
import type { Ticket } from './ticket.ts'
import { calculateSlaComplianceRate } from './ticketStats.ts'

function makeTicket(overrides: Partial<Ticket>): Ticket {
  return {
    id: 'TCK-1',
    title: 'Mẫu',
    description: 'Mô tả mẫu cho ticket',
    priority: 'medium',
    status: 'in_progress',
    requesterName: 'Bình',
    fromDepartment: 'Marketing',
    toDepartment: 'Kế toán',
    attachments: [],
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    comments: [],
    ...overrides,
  }
}

const now = new Date('2026-03-20T10:00:00.000Z')

describe('calculateSlaComplianceRate', () => {
  it('should_return_full_rate_when_there_are_no_tickets', () => {
    expect(calculateSlaComplianceRate([], now)).toBe(100)
  })

  it('should_count_late_closed_and_overdue_open_tickets_as_missed', () => {
    const tickets = [
      makeTicket({ id: 'a', status: 'in_progress', dueDate: '2026-03-25' }),
      makeTicket({ id: 'b', status: 'in_progress', dueDate: '2026-03-10' }),
      makeTicket({ id: 'c', status: 'closed', dueDate: '2026-03-10', statusHistory: [{ status: 'closed', at: '2026-03-12T00:00:00.000Z' }] }),
      makeTicket({ id: 'd', status: 'closed', dueDate: '2026-03-10', statusHistory: [{ status: 'closed', at: '2026-03-09T00:00:00.000Z' }] }),
    ]
    expect(calculateSlaComplianceRate(tickets, now)).toBe(50)
  })

  it('should_ignore_cancelled_tickets_when_measuring_delivery', () => {
    const tickets = [
      makeTicket({ id: 'a', status: 'closed', dueDate: '2026-03-10', cancelReason: 'Trùng', statusHistory: [{ status: 'closed', at: '2026-03-18T00:00:00.000Z' }] }),
      makeTicket({ id: 'b', status: 'in_progress', dueDate: '2026-03-25' }),
    ]
    expect(calculateSlaComplianceRate(tickets, now)).toBe(100)
  })

  it('should_treat_tickets_without_due_date_as_on_time', () => {
    expect(calculateSlaComplianceRate([makeTicket({ dueDate: undefined })], now)).toBe(100)
  })
})
