import { describe, expect, it } from 'vitest'
import { DEPARTMENTS, TICKET_PRIORITIES, TICKET_STATUSES } from './ticket.ts'
import { calculateTicketSla } from './ticketSla.ts'
import { MEMBERS } from './members.ts'
import { buildMockTickets } from './mockTickets.ts'

const now = new Date('2026-06-15T09:00:00.000Z')
const tickets = buildMockTickets(now)

describe('mock members', () => {
  it.each(DEPARTMENTS)('should_have_one_head_and_several_specialists_when_department_is_%s', (department) => {
    const members = MEMBERS.filter((member) => member.department === department && !member.isExecutive)
    expect(members.filter((member) => member.isDepartmentHead)).toHaveLength(1)
    expect(members.filter((member) => !member.isDepartmentHead).length).toBeGreaterThanOrEqual(2)
  })

  it('should_have_unique_usernames_and_names', () => {
    expect(new Set(MEMBERS.map((member) => member.username)).size).toBe(MEMBERS.length)
    expect(new Set(MEMBERS.map((member) => member.name)).size).toBe(MEMBERS.length)
  })

  it('should_include_an_executive', () => {
    expect(MEMBERS.some((member) => member.isExecutive)).toBe(true)
  })
})

describe('mock tickets coverage', () => {
  it.each(TICKET_STATUSES)('should_include_a_ticket_when_status_is_%s', (status) => {
    expect(tickets.some((ticket) => ticket.status === status)).toBe(true)
  })

  it.each(DEPARTMENTS)('should_include_a_ticket_received_by_%s', (department) => {
    expect(tickets.some((ticket) => ticket.toDepartment === department)).toBe(true)
  })

  it.each(DEPARTMENTS)('should_include_a_ticket_sent_by_%s', (department) => {
    expect(tickets.some((ticket) => ticket.fromDepartment === department)).toBe(true)
  })

  it.each(TICKET_PRIORITIES)('should_include_a_ticket_when_priority_is_%s', (priority) => {
    expect(tickets.some((ticket) => ticket.priority === priority)).toBe(true)
  })

  it.each(['overdue', 'due_today', 'due_soon', 'on_track', 'none', 'completed'] as const)(
    'should_include_a_ticket_when_sla_urgency_is_%s',
    (urgency) => {
      expect(tickets.some((ticket) => calculateTicketSla(ticket, now).urgency === urgency)).toBe(true)
    },
  )

  it('should_include_a_cancelled_ticket_with_reason', () => {
    expect(tickets.some((ticket) => ticket.status === 'closed' && Boolean(ticket.cancelReason))).toBe(true)
  })

  it('should_include_a_reworked_ticket_with_reason_in_history', () => {
    expect(tickets.some((ticket) => ticket.statusHistory?.some((change) => Boolean(change.reason)))).toBe(true)
  })

  it('should_include_a_handed_over_ticket', () => {
    expect(tickets.some((ticket) => (ticket.assignmentHistory ?? []).some((change) => change.from !== undefined))).toBe(true)
  })

  it('should_include_a_rated_ticket_with_feedback', () => {
    expect(tickets.some((ticket) => ticket.rating !== undefined && Boolean(ticket.feedback))).toBe(true)
  })

  it('should_include_a_ticket_finished_after_its_due_date', () => {
    expect(tickets.some((ticket) => calculateTicketSla(ticket, now).finishedLate)).toBe(true)
  })

  it('should_include_a_comment_with_attachment', () => {
    expect(tickets.some((ticket) => ticket.comments.some((comment) => (comment.attachments ?? []).length > 0))).toBe(true)
  })

  it('should_use_unique_ticket_ids', () => {
    expect(new Set(tickets.map((ticket) => ticket.id)).size).toBe(tickets.length)
  })

  it('should_only_reference_known_members_as_requesters_and_assignees', () => {
    const names = new Set(MEMBERS.map((member) => member.name))
    for (const ticket of tickets) {
      expect(names.has(ticket.requesterName)).toBe(true)
      if (ticket.assigneeName) expect(names.has(ticket.assigneeName)).toBe(true)
    }
  })

  it('should_shift_every_date_with_the_injected_clock', () => {
    const later = buildMockTickets(new Date('2026-09-15T09:00:00.000Z'))
    const shiftDays = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
    expect(shiftDays(tickets[0].createdAt, later[0].createdAt)).toBe(92)
    expect(tickets.map((ticket) => ticket.dueDate === undefined)).toEqual(later.map((ticket) => ticket.dueDate === undefined))
  })
})
