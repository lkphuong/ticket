import { STATUS_LABELS, TICKET_STATUSES } from '../../domain/ticket.ts'
import type { Ticket } from '../../domain/ticket.ts'
import { countByStatus } from '../../lib/ticketStats.ts'
import { Panel } from '../ui/Panel.tsx'
import { STATUS_MARK_CLASSES } from './ticketStyles.ts'

interface StatusBreakdownProps {
  title: string
  tickets: Ticket[]
}

// One proportional bar for the whole pipeline; empty statuses stay in the legend only
export function StatusBreakdown({ title, tickets }: StatusBreakdownProps) {
  const counts = countByStatus(tickets)
  const total = tickets.length

  return (
    <Panel title={title} aside={<span className="text-xs font-semibold text-ink-muted">{total} yêu cầu</span>}>
      <div className="px-4 py-4">
        {total > 0 && (
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Phân bổ ${total} yêu cầu theo trạng thái`}>
            {TICKET_STATUSES.filter((status) => counts[status] > 0).map((status) => (
              <span key={status} style={{ flexGrow: counts[status] }} className={`basis-0 ${STATUS_MARK_CLASSES[status]}`} />
            ))}
          </div>
        )}
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
          {TICKET_STATUSES.map((status) => (
            <li key={status} className={`flex items-center gap-2 text-xs ${counts[status] === 0 ? 'text-ink-muted' : 'text-ink'}`}>
              <span className={`size-2.5 shrink-0 rounded-full ${STATUS_MARK_CLASSES[status]}`} />
              <span className="truncate">{STATUS_LABELS[status]}</span>
              <span className="ml-auto font-bold">{counts[status]}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
