import { Link } from 'react-router-dom'
import type { Ticket, Viewer } from '../../domain/ticket.ts'
import { isWaitingOnViewer } from '../../lib/ticketInbox.ts'
import { EmptyState } from '../ui/EmptyState.tsx'
import { Panel } from '../ui/Panel.tsx'
import { TicketRow } from './TicketRow.tsx'

interface TicketListPanelProps {
  title: string
  emptyTitle: string
  emptyDescription: string
  tickets: Ticket[]
  viewer: Viewer
  now: Date
}

const PREVIEW_LIMIT = 6

// A short preview of tickets with a link into the full filtered list
export function TicketListPanel({ title, emptyTitle, emptyDescription, tickets, viewer, now }: TicketListPanelProps) {
  const hiddenCount = tickets.length - PREVIEW_LIMIT

  return (
    <Panel title={title}>
      {tickets.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="divide-y divide-line">
          {tickets.slice(0, PREVIEW_LIMIT).map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} now={now} waitingOnViewer={isWaitingOnViewer(ticket, viewer)} />
          ))}
        </ul>
      )}
      {hiddenCount > 0 && (
        <Link to="/tickets" className="block border-t border-line px-4 py-3 text-sm font-semibold text-accent-700 hover:underline">
          Xem thêm {hiddenCount} ticket
        </Link>
      )}
    </Panel>
  )
}
