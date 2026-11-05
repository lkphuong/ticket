import { createContext } from 'react'
import type { Dispatch } from 'react'
import type { Ticket } from '../domain/ticket.ts'
import type { TicketsAction } from './ticketsReducer.ts'

export interface TicketStoreValue {
  // Every ticket in the system, regardless of who is signed in
  allTickets: Ticket[]
  dispatch: Dispatch<TicketsAction>
}

export const TicketStoreContext = createContext<TicketStoreValue | null>(null)
