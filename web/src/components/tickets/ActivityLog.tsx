import type { Ticket } from '../../domain/ticket.ts'
import { formatDateTime } from '../../lib/formatDate.ts'
import { buildActivityLog } from '../../lib/ticketActivityLog.ts'

// Chronological record of status changes, assignments and comments, with who acted for which department
export function ActivityLog({ ticket }: { ticket: Ticket }) {
  const events = buildActivityLog(ticket)

  return (
    <ol className="divide-y divide-line">
      {events.map((event, index) => (
        <li key={`${event.at}-${event.kind}-${index}`} className="px-4 py-3">
          <p className="text-sm font-semibold text-ink">{event.summary}</p>
          <p className="text-xs text-ink-muted">
            {event.actor ? `${event.actor.name} · ${event.actor.department} · ` : ''}
            {formatDateTime(event.at)}
          </p>
          {event.detail && <p className="mt-1 text-xs whitespace-pre-wrap text-ink">{event.detail}</p>}
        </li>
      ))}
    </ol>
  )
}
