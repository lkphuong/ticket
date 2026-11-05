import type { Department, NewTicketInput, Ticket, TicketAttachment, TicketComment, Viewer } from '../domain/ticket.ts'

const TICKET_ID_PREFIX = 'TCK-'
const FIRST_TICKET_NUMBER = 1001

export function nextTicketId(existing: Ticket[]): string {
  const highest = existing.reduce((max, ticket) => {
    const number = Number(ticket.id.slice(TICKET_ID_PREFIX.length))
    return Number.isFinite(number) ? Math.max(max, number) : max
  }, FIRST_TICKET_NUMBER - 1)
  return `${TICKET_ID_PREFIX}${highest + 1}`
}

export function buildTicket(input: NewTicketInput, requester: Viewer, existing: Ticket[], now: Date): Ticket {
  if (!input.toDepartment) throw new Error('Cannot build a ticket without a target department')
  const timestamp = now.toISOString()
  return {
    id: nextTicketId(existing),
    title: input.title.trim(),
    description: input.description.trim(),
    purpose: input.purpose.trim(),
    expectedResult: input.expectedResult.trim(),
    priority: input.priority,
    status: 'open',
    requesterName: requester.name,
    fromDepartment: requester.department,
    toDepartment: input.toDepartment,
    dueDate: input.dueDate || undefined,
    attachments: input.attachments,
    createdAt: timestamp,
    updatedAt: timestamp,
    comments: [],
    statusHistory: [{ status: 'open', at: timestamp, actor: { name: requester.name, department: requester.department } }],
  }
}

export function buildComment(
  body: string,
  author: string,
  department: Department,
  now: Date,
  attachments: TicketAttachment[] = [],
): TicketComment {
  return {
    id: crypto.randomUUID(),
    author,
    department,
    body: body.trim(),
    createdAt: now.toISOString(),
    attachments: attachments.length > 0 ? attachments : undefined,
  }
}
