import type { Ticket } from '../../domain/ticket.ts'
import { formatDateTime } from '../../lib/formatDate.ts'
import { buildTicketTimeline } from '../../lib/ticketTimeline.ts'
import type { TimelineStepState } from '../../lib/ticketTimeline.ts'
import { STATUS_MARK_CLASSES } from './ticketStyles.ts'

const UPCOMING_MARK_CLASS = 'border-2 border-line-strong bg-surface'

const LABEL_CLASSES: Record<TimelineStepState, string> = {
  done: 'text-ink',
  current: 'font-semibold text-ink',
  upcoming: 'text-ink-muted',
}

const STATE_TEXT: Record<TimelineStepState, string> = {
  done: 'Đã qua',
  current: 'Hiện tại',
  upcoming: 'Chưa tới',
}

export function TicketTimeline({ ticket }: { ticket: Ticket }) {
  const steps = buildTicketTimeline(ticket)

  return (
    <ol className="px-4 py-4">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const markClass = step.state === 'upcoming' ? UPCOMING_MARK_CLASS : STATUS_MARK_CLASSES[step.status]
        const ringClass = step.state === 'current' ? 'ring-4 ring-line' : ''
        return (
          <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0" aria-current={step.state === 'current' ? 'step' : undefined}>
            {!isLast && (
              <span
                aria-hidden="true"
                className={`absolute top-4 left-[7px] h-full w-0.5 ${step.state === 'done' ? 'bg-line-strong' : 'bg-line'}`}
              />
            )}
            <span aria-hidden="true" className={`relative mt-0.5 h-4 w-4 shrink-0 rounded-full ${markClass} ${ringClass}`} />
            <div className="min-w-0">
              <p className={`text-sm ${LABEL_CLASSES[step.state]}`}>
                {step.label}
                <span className="sr-only">, {STATE_TEXT[step.state]}</span>
              </p>
              {step.at && <p className="text-xs text-ink-muted">{formatDateTime(step.at)}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
