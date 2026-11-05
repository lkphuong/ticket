import { describe, expect, it } from 'vitest'
import { DEPARTMENTS, TICKET_STATUSES } from '../domain/ticket.ts'
import type { Viewer } from '../domain/ticket.ts'
import { buildMockTickets } from '../data/mockTickets.ts'
import { generateTicketsCsv } from './ticketExport.ts'
import { DEFAULT_TICKET_FILTERS, filterTickets } from './ticketFilters.ts'
import { buildDepartmentReport, filterByDepartmentView } from './ticketReport.ts'
import { calculateSlaComplianceRate, countByStatus } from './ticketStats.ts'
import { filterVisibleTickets } from './ticketVisibility.ts'

const now = new Date('2026-06-15T09:00:00.000Z')
const all = buildMockTickets(now)
const executive: Viewer = { name: 'Nguyễn Hải Đăng', department: 'Hành chính', isDepartmentHead: false, isExecutive: true }
const head: Viewer = { name: 'Ngô Bích Ngọc', department: 'Kế toán', isDepartmentHead: true }
const staff: Viewer = { name: 'Lê Thu Hà', department: 'Kế toán', isDepartmentHead: false }

describe('buildDepartmentReport', () => {
  it('should_list_every_department_with_received_volume_matching_the_tickets', () => {
    const report = buildDepartmentReport(all, now)
    expect(report.map((row) => row.department)).toEqual([...DEPARTMENTS])
    for (const row of report) {
      expect(row.received).toBe(all.filter((ticket) => ticket.toDepartment === row.department).length)
    }
  })

  it('should_average_csat_only_over_rated_tickets_of_the_department', () => {
    const accounting = buildDepartmentReport(all, now).find((row) => row.department === 'Kế toán')
    const rated = all.filter((ticket) => ticket.toDepartment === 'Kế toán' && ticket.rating !== undefined)
    expect(rated.length).toBeGreaterThan(0)
    expect(accounting?.averageRating).toBe(Math.round((rated.reduce((sum, ticket) => sum + (ticket.rating ?? 0), 0) / rated.length) * 10) / 10)
  })

  it('should_report_null_csat_when_department_has_no_rated_ticket', () => {
    const report = buildDepartmentReport(all, now)
    expect(report.find((row) => row.department === 'Vận hành')?.averageRating).toBeNull()
  })

  it('should_report_on_time_rate_matching_stats_for_the_department', () => {
    const row = buildDepartmentReport(all, now).find((entry) => entry.department === 'Pháp chế')
    const tickets = all.filter((ticket) => ticket.toDepartment === 'Pháp chế')
    expect(row?.onTimeRate).toBe(calculateSlaComplianceRate(tickets, now))
  })
})

describe('filterByDepartmentView', () => {
  it('should_keep_tickets_sent_or_received_by_the_chosen_department', () => {
    const view = filterByDepartmentView(all, 'Pháp chế')
    expect(view.length).toBeGreaterThan(0)
    expect(view.every((ticket) => ticket.fromDepartment === 'Pháp chế' || ticket.toDepartment === 'Pháp chế')).toBe(true)
  })

  it('should_return_everything_when_no_department_is_chosen', () => {
    expect(filterByDepartmentView(all, 'all')).toEqual(all)
  })
})

describe('shared visibility across list, dashboard and csv', () => {
  it.each([
    ['executive', executive],
    ['head', head],
    ['staff', staff],
  ] as const)('should_agree_on_counts_when_viewer_is_%s', (_label, viewer) => {
    const visible = filterVisibleTickets(all, viewer)
    const counts = countByStatus(visible)
    for (const status of TICKET_STATUSES) {
      const listed = filterTickets(visible, { ...DEFAULT_TICKET_FILTERS, status }, viewer, now)
      expect(listed).toHaveLength(counts[status])
    }
  })

  it('should_export_exactly_the_rows_of_the_current_filter', () => {
    const visible = filterVisibleTickets(all, head)
    const filtered = filterTickets(visible, { ...DEFAULT_TICKET_FILTERS, priority: 'high' }, head, now)
    const csv = generateTicketsCsv(filtered)
    expect(csv.split('\r\n')).toHaveLength(filtered.length + 1)
    for (const ticket of filtered) expect(csv).toContain(`"${ticket.id}"`)
    for (const ticket of visible.filter((candidate) => candidate.priority !== 'high')) expect(csv).not.toContain(`"${ticket.id}"`)
  })
})

describe('assignee filter', () => {
  it('should_return_only_tickets_of_the_chosen_assignee', () => {
    const result = filterTickets(all, { ...DEFAULT_TICKET_FILTERS, assigneeName: 'Lê Thu Hà' }, executive, now)
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((ticket) => ticket.assigneeName === 'Lê Thu Hà')).toBe(true)
  })
})
