import { useContext } from 'react'
import { TicketsContext } from './ticketsContext.ts'
import type { TicketsContextValue } from './ticketsContext.ts'

export function useTickets(): TicketsContextValue {
  const value = useContext(TicketsContext)
  if (!value) throw new Error('useTickets must be used inside TicketsProvider')
  return value
}
