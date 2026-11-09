import { createContext } from 'react'
import type { NewTicketInput, Ticket, TicketAttachment, TicketPriority, TicketStatus, Viewer } from '../domain/ticket.ts'

// Mutations return the Vietnamese refusal reason when the lifecycle rules reject them, otherwise null
export interface TicketsContextValue {
  tickets: Ticket[]
  viewer: Viewer
  isLoading?: boolean
  loadError?: string | null
  refreshTickets?: () => Promise<void>
  createTicket: (input: NewTicketInput) => Promise<Ticket>
  changeStatus: (ticketId: string, status: TicketStatus, reason?: string) => Promise<string | null>
  assignTicket: (ticketId: string, assigneeName: string) => Promise<string | null>
  confirmResult: (ticketId: string, rating: number, feedback?: string) => Promise<string | null>
  approveResult: (ticketId: string) => Promise<string | null>
  rejectApproval: (ticketId: string, reason: string) => Promise<string | null>
  addComment: (ticketId: string, body: string, attachments?: TicketAttachment[]) => Promise<string | null>
  changePriority: (ticketId: string, priority: TicketPriority) => Promise<string | null>
  changeDueDate: (ticketId: string, dueDate: string) => Promise<string | null>
  cancelTicket: (ticketId: string, reason: string) => Promise<string | null>
  reopenTicket: (ticketId: string, reason: string) => Promise<string | null>
}

export const TicketsContext = createContext<TicketsContextValue | null>(null)
