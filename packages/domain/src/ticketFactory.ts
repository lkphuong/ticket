import type { Department, NewTicketInput, Ticket, TicketAttachment, TicketComment, Viewer } from './ticket.ts'

export interface TicketIdentity {
  id: string
  code: string
}

export function buildTicket(input: NewTicketInput, requester: Viewer, identity: TicketIdentity, now: Date): Ticket {
  if (!input.toDepartment) throw new Error('Cannot build a ticket without a target department')
  const timestamp = now.toISOString()
  return {
    id: identity.id,
    code: identity.code,
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
