import { describe, expect, it } from 'vitest'
import type { Ticket, Viewer } from '../domain/ticket.ts'
import { buildDashboardKpis } from './dashboardSummary.ts'

const NOW = new Date('2026-06-10T08:00:00')

const head: Viewer = { name: 'Trưởng IT', department: 'Công nghệ thông tin', isDepartmentHead: true }
const member: Viewer = { name: 'An', department: 'Công nghệ thông tin', isDepartmentHead: false }

function makeTicket(overrides: Partial<Ticket>): Ticket {
  return {
    id: 'T-1',
    title: 'Test',
    description: '',
    priority: 'medium',
    status: 'open',
    requesterName: 'Bình',
    fromDepartment: 'Nhân sự',
    toDepartment: 'Công nghệ thông tin',
    attachments: [],
    createdAt: '2026-06-01T00:00:00',
    updatedAt: '2026-06-01T00:00:00',
    comments: [],
    ...overrides,
  }
}

describe('buildDashboardKpis', () => {
  it('should_count_unassigned_open_tickets_when_role_is_head', () => {
    const tickets = [makeTicket({ id: 'T-1' }), makeTicket({ id: 'T-2', assigneeName: 'An' })]
    const kpis = buildDashboardKpis('head', tickets, head, NOW)
    expect(kpis.find((kpi) => kpi.key === 'unassigned')?.value).toBe('1')
  })

  it('should_flag_overdue_as_danger_when_assigned_ticket_is_past_due', () => {
    const tickets = [makeTicket({ status: 'in_progress', assigneeName: 'An', dueDate: '2026-06-01' })]
    const kpis = buildDashboardKpis('member', tickets, member, NOW)
    expect(kpis.find((kpi) => kpi.key === 'assigned')?.tone).toBe('danger')
  })

  it('should_show_placeholder_csat_when_no_ticket_is_rated', () => {
    const kpis = buildDashboardKpis('executive', [makeTicket({})], member, NOW)
    expect(kpis.find((kpi) => kpi.key === 'csat')?.value).toBe('–')
  })
})
