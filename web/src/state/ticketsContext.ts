import { createContext } from 'react'
import type { NewTicketInput, Ticket, TicketAttachment, TicketPriority, TicketStatus, Viewer } from '../domain/ticket.ts'

// Mutations return the Vietnamese refusal reason when the lifecycle rules reject them, otherwise null
export interface TicketsContextValue {
  tickets: Ticket[]
  viewer: Viewer
  createTicket: (input: NewTicketInput) => Ticket
  changeStatus: (ticketId: string, status: TicketStatus) => string | null
  assignTicket: (ticketId: string, assigneeName: string) => string | null
  confirmResult: (ticketId: string, rating: number, feedback?: string) => string | null
  addComment: (ticketId: string, body: string, attachments?: TicketAttachment[]) => string | null
  changePriority: (ticketId: string, priority: TicketPriority) => string | null
  changeDueDate: (ticketId: string, dueDate: string) => string | null
  cancelTicket: (ticketId: string, reason: string) => string | null
  reopenTicket: (ticketId: string, reason: string) => string | null
}

export const TicketsContext = createContext<TicketsContextValue | null>(null)
