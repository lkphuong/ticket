import { useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { NewTicketInput, TicketActor, TicketAttachment, TicketPriority, TicketStatus, Viewer } from '../domain/ticket.ts'
import { filterVisibleTickets } from '../lib/ticketVisibility.ts'
import { buildComment, buildTicket } from './ticketFactory.ts'
import { validateTicketAction } from './ticketsReducer.ts'
import type { TicketsAction } from './ticketsReducer.ts'
import { TicketStoreContext } from './ticketStoreContext.ts'
import { TicketsContext } from './ticketsContext.ts'
import type { TicketsContextValue } from './ticketsContext.ts'

interface TicketsProviderProps {
  viewer: Viewer
  children: ReactNode
}

// Scopes the shared store to what the signed-in viewer is allowed to see
export function TicketsProvider({ viewer, children }: TicketsProviderProps) {
  const store = useContext(TicketStoreContext)
  if (!store) throw new Error('TicketsProvider must be used inside TicketStoreProvider')
  const { allTickets, dispatch } = store
  const actor = useMemo<TicketActor>(() => ({ name: viewer.name, department: viewer.department }), [viewer])

  const tickets = useMemo(() => filterVisibleTickets(allTickets, viewer), [allTickets, viewer])

  // Applies the action unless the lifecycle rules refuse it, returning the Vietnamese refusal reason
  const submit = useCallback(
    (action: TicketsAction): string | null => {
      const error = validateTicketAction(allTickets, action)
      if (error === null) dispatch(action)
      return error
    },
    [allTickets, dispatch],
  )

  const createTicket = useCallback(
    (input: NewTicketInput) => {
      const ticket = buildTicket(input, viewer, allTickets, new Date())
      dispatch({ type: 'ticket_created', ticket })
      return ticket
    },
    [allTickets, viewer, dispatch],
  )

  const changeStatus = useCallback(
    (ticketId: string, status: TicketStatus) => {
      return submit({ type: 'status_changed', ticketId, status, changedAt: new Date().toISOString(), actor })
    },
    [submit, actor],
  )

  const assignTicket = useCallback(
    (ticketId: string, assigneeName: string) => {
      return submit({ type: 'assignee_set', ticketId, assigneeName, changedAt: new Date().toISOString(), actor })
    },
    [submit, actor],
  )

  const confirmResult = useCallback(
    (ticketId: string, rating: number, feedback?: string) => {
      return submit({ type: 'result_confirmed', ticketId, rating, feedback, changedAt: new Date().toISOString(), actor })
    },
    [submit, actor],
  )

  const addComment = useCallback(
    (ticketId: string, body: string, attachments: TicketAttachment[] = []) => {
      const comment = buildComment(body, viewer.name, viewer.department, new Date(), attachments)
      return submit({ type: 'comment_added', ticketId, comment })
    },
    [viewer, submit],
  )

  const changePriority = useCallback(
    (ticketId: string, priority: TicketPriority) => {
      return submit({ type: 'priority_changed', ticketId, priority, changedAt: new Date().toISOString() })
    },
    [submit],
  )

  const changeDueDate = useCallback(
    (ticketId: string, dueDate: string) => {
      return submit({ type: 'due_date_changed', ticketId, dueDate, changedAt: new Date().toISOString() })
    },
    [submit],
  )

  const cancelTicket = useCallback(
    (ticketId: string, reason: string) => {
      return submit({ type: 'ticket_cancelled', ticketId, reason, changedAt: new Date().toISOString(), actor })
    },
    [submit, actor],
  )

  const reopenTicket = useCallback(
    (ticketId: string, reason: string) =>
      submit({ type: 'ticket_reopened', ticketId, reason, changedAt: new Date().toISOString(), actor }),
    [submit, actor],
  )

  const value = useMemo<TicketsContextValue>(
    () => ({
      tickets,
      viewer,
      createTicket,
      changeStatus,
      assignTicket,
      confirmResult,
      addComment,
      changePriority,
      changeDueDate,
      cancelTicket,
      reopenTicket,
    }),
    [
      tickets,
      viewer,
      createTicket,
      changeStatus,
      assignTicket,
      confirmResult,
      addComment,
      changePriority,
      changeDueDate,
      cancelTicket,
      reopenTicket,
    ],
  )

  return <TicketsContext.Provider value={value}>{children}</TicketsContext.Provider>
}
