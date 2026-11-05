import { useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { MOCK_TICKETS } from '../data/mockTickets.ts'
import { TicketStoreContext } from './ticketStoreContext.ts'
import type { TicketStoreValue } from './ticketStoreContext.ts'
import { ticketsReducer } from './ticketsReducer.ts'

interface TicketStoreProviderProps {
  children: ReactNode
}

// In-memory store standing in for the future API; it outlives sign-in and sign-out so users share one data set
export function TicketStoreProvider({ children }: TicketStoreProviderProps) {
  const [allTickets, dispatch] = useReducer(ticketsReducer, MOCK_TICKETS)
  const value = useMemo<TicketStoreValue>(() => ({ allTickets, dispatch }), [allTickets])

  return <TicketStoreContext.Provider value={value}>{children}</TicketStoreContext.Provider>
}
