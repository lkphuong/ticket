import { Link } from 'react-router-dom'
import type { Ticket } from '../../domain/ticket.ts'
import { formatDate } from '../../lib/formatDate.ts'
import { calculateTicketSla } from '../../lib/ticketSla.ts'
import { DepartmentLabel } from '../ui/DepartmentLabel.tsx'
import { MineBadge } from './MineBadge.tsx'
import { PriorityBadge } from './PriorityBadge.tsx'
import { StatusBadge } from './StatusBadge.tsx'

interface TicketRowProps {
  ticket: Ticket
  now: Date
  waitingOnViewer: boolean
}

export function TicketRow({ ticket, now, waitingOnViewer }: TicketRowProps) {
  const sla = calculateTicketSla(ticket, now)

  return (
    <li>
      <Link
        to={`/tickets/${ticket.id}`}
        className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-4 py-3 transition-colors hover:bg-canvas ${
          waitingOnViewer ? 'bg-mine-100/40' : ''
        }`}
      >
        <span className="min-w-[15rem] flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-bold tracking-wider text-ink-muted">{ticket.code}</span>
            {waitingOnViewer && <MineBadge />}
            {ticket.assigneeName ? (
              <span className="text-[11px] font-medium text-ink-muted">
                Xử lý: <strong className="text-ink">{ticket.assigneeName}</strong>
              </span>
            ) : (
              <span className="rounded bg-ochre-100 px-1.5 py-0.2 text-[10px] font-semibold text-ochre-800 border border-ochre-500/20">
                Chờ phân công
              </span>
            )}
          </span>
          <span className="mt-1 block font-semibold text-ink leading-snug">{ticket.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <DepartmentLabel department={ticket.fromDepartment} />
            <span>gửi đến</span>
            <DepartmentLabel department={ticket.toDepartment} />
            {ticket.rating !== undefined && (
              <span className="ml-1 text-[11px] font-semibold text-moss-700">
                · Đánh giá {ticket.rating}/5
              </span>
            )}
          </span>
        </span>
        <span className="flex flex-col gap-1.5 sm:items-end">
          <span className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className={`rounded px-1.5 py-0.5 text-[11px] ${sla.toneClass}`}>{sla.label}</span>
            {ticket.dueDate && <span className="text-ink-muted">({formatDate(ticket.dueDate)})</span>}
          </span>
        </span>
      </Link>
    </li>
  )
}
