// High performance tickets store provider backed by the REST API

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { NewTicketInput, Ticket, TicketAttachment, TicketPriority, TicketStatus, Viewer } from '../domain/ticket.ts'
import { ApiError, apiClient } from '../lib/apiClient.ts'
import { TicketsContext } from './ticketsContext.ts'
import type { TicketsContextValue } from './ticketsContext.ts'

interface TicketsProviderProps {
  viewer: Viewer
  children: ReactNode
}

export function TicketsProvider({ viewer, children }: TicketsProviderProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Synchronizes tickets from the API conforming to viewer role boundaries
  const refreshTickets = useCallback(async () => {
    try {
      const res = await apiClient.tickets.list({ limit: 1000 })
      setTickets(res.tickets)
    } catch {
      // Maintain existing cached tickets on transient network hiccups
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    apiClient.tickets
      .list({ limit: 1000 })
      .then((res) => {
        if (!ignore) {
          setTickets(res.tickets)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!ignore) {
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [viewer])

  const createTicket = useCallback(
    async (input: NewTicketInput): Promise<Ticket> => {
      const res = await apiClient.tickets.create(input)
      setTickets((prev) => [res.ticket, ...prev.filter((t) => t.id !== res.ticket.id)])
      return res.ticket
    },
    [],
  )

  const changeStatus = useCallback(
    async (ticketId: string, status: TicketStatus, reason?: string): Promise<string | null> => {
      try {
        const res = await apiClient.tickets.updateStatus(ticketId, status, reason)
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? res.ticket : t)))
        return null
      } catch (err: any) {
        return err instanceof ApiError ? err.message : 'Không thể cập nhật tiến trình.'
      }
    },
    [],
  )

  const assignTicket = useCallback(
    async (ticketId: string, assigneeName: string): Promise<string | null> => {
      try {
        const res = await apiClient.tickets.assign(ticketId, assigneeName)
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? res.ticket : t)))
        return null
      } catch (err: any) {
        return err instanceof ApiError ? err.message : 'Không thể phân công yêu cầu.'
      }
    },
    [],
  )

  const confirmResult = useCallback(
    async (ticketId: string, rating: number, feedback?: string): Promise<string | null> => {
      try {
        const res = await apiClient.tickets.confirm(ticketId, rating, feedback)
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? res.ticket : t)))
        return null
      } catch (err: any) {
        return err instanceof ApiError ? err.message : 'Không thể nghiệm thu kết quả.'
      }
    },
    [],
  )

  const addComment = useCallback(
    async (ticketId: string, body: string, attachments?: TicketAttachment[]): Promise<string | null> => {
      try {
        const res = await apiClient.tickets.addComment(ticketId, body, attachments)
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? res.ticket : t)))
        return null
      } catch (err: any) {
        return err instanceof ApiError ? err.message : 'Không thể gửi bình luận.'
      }
    },
    [],
  )

  const changePriority = useCallback(
    async (ticketId: string, priority: TicketPriority): Promise<string | null> => {
      try {
        const res = await apiClient.tickets.updatePriority(ticketId, priority)
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? res.ticket : t)))
        return null
      } catch (err: any) {
        return err instanceof ApiError ? err.message : 'Không thể thay đổi mức ưu tiên.'
      }
    },
    [],
  )

  const changeDueDate = useCallback(
    async (ticketId: string, dueDate: string): Promise<string | null> => {
      try {
        const res = await apiClient.tickets.updateDueDate(ticketId, dueDate)
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? res.ticket : t)))
        return null
      } catch (err: any) {
        return err instanceof ApiError ? err.message : 'Không thể thay đổi hạn chót.'
      }
    },
    [],
  )

  const cancelTicket = useCallback(
    async (ticketId: string, reason: string): Promise<string | null> => {
      try {
        const res = await apiClient.tickets.cancel(ticketId, reason)
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? res.ticket : t)))
        return null
      } catch (err: any) {
        return err instanceof ApiError ? err.message : 'Không thể hủy yêu cầu.'
      }
    },
    [],
  )

  const reopenTicket = useCallback(
    async (ticketId: string, reason: string): Promise<string | null> => {
      try {
        const current = tickets.find((t) => t.id === ticketId)
        // Resolves rework vs reopening of permanently closed ticket
        const res =
          current?.status === 'resolved'
            ? await apiClient.tickets.rework(ticketId, reason)
            : await apiClient.tickets.reopen(ticketId, reason)

        setTickets((prev) => prev.map((t) => (t.id === ticketId ? res.ticket : t)))
        return null
      } catch (err: any) {
        return err instanceof ApiError ? err.message : 'Không thể mở lại yêu cầu.'
      }
    },
    [tickets],
  )

  const value = useMemo<TicketsContextValue>(
    () => ({
      tickets,
      viewer,
      isLoading,
      refreshTickets,
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
      isLoading,
      refreshTickets,
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
