import { Link } from 'react-router-dom'
import { isTicketOverdue } from '../../domain/ticket.ts'
import type { DepartmentWorkload } from '../../lib/ticketStats.ts'
import { STATUS_LABELS } from '../../domain/ticket.ts'
import { DepartmentLabel } from '../ui/DepartmentLabel.tsx'
import { badgeStyleFor, departmentCode } from '../ui/departmentBadges.ts'
import { OVERDUE_RING_CLASS, STATUS_RING_CLASSES } from './ticketStyles.ts'

interface WorkloadMosaicProps {
  workload: DepartmentWorkload[]
  now: Date
}

const LEGEND_STATUSES = ['open', 'in_progress', 'waiting'] as const

// One square per unfinished ticket, so a busy department visibly fills its row
export function WorkloadMosaic({ workload, now }: WorkloadMosaicProps) {
  return (
    <div className="px-4 py-4">
      <ul className="flex flex-col gap-3">
        {workload.map((entry) => (
          <li key={entry.department} className="grid gap-1.5 sm:grid-cols-[13rem_1fr] sm:items-center">
            <span className="flex items-center justify-between gap-2 text-sm font-medium text-ink">
              <Link
                to={`/tickets?department=${encodeURIComponent(entry.department)}`}
                className="hover:underline hover:text-accent-700"
                title={`Xem toàn bộ yêu cầu của phòng ${entry.department}`}
              >
                <DepartmentLabel department={entry.department} />
              </Link>
              <span className="font-bold sm:hidden">{entry.tickets.length}</span>
            </span>
            <span className="flex flex-wrap items-center gap-2.5">
              {entry.tickets.map((ticket) => {
                const overdue = isTicketOverdue(ticket, now)
                const label = `${ticket.id}, ${STATUS_LABELS[ticket.status]}${overdue ? ', quá hạn' : ''}`
                return (
                  <Link
                    key={ticket.id}
                    to={`/tickets/${ticket.id}`}
                    aria-label={label}
                    title={label}
                    style={badgeStyleFor(entry.department)}
                    className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-[10px] font-bold ring-2 ring-offset-2 ring-offset-surface transition-transform hover:scale-110 ${
                      overdue ? OVERDUE_RING_CLASS : STATUS_RING_CLASSES[ticket.status]
                    }`}
                  >
                    {departmentCode(entry.department)}
                  </Link>
                )
              })}
              <span className="ml-2 hidden text-sm font-bold text-ink sm:inline">{entry.tickets.length}</span>
            </span>
          </li>
        ))}
      </ul>
      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-xs text-ink-muted">
        {LEGEND_STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-[2px] bg-surface ring-2 ${STATUS_RING_CLASSES[status]}`} />
            {STATUS_LABELS[status]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className={`size-3 rounded-[2px] bg-surface ring-2 ${OVERDUE_RING_CLASS}`} />
          Quá hạn
        </li>
        <li>Mỗi ô là một ticket, chữ là mã phòng ban xử lý, viền là trạng thái.</li>
      </ul>
    </div>
  )
}
