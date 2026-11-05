import { STATUS_LABELS } from '../../domain/ticket.ts'
import type { TicketStatus } from '../../domain/ticket.ts'
import { Badge } from '../ui/Badge.tsx'
import { STATUS_TONE_CLASSES } from './ticketStyles.ts'

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge label={STATUS_LABELS[status]} toneClass={STATUS_TONE_CLASSES[status]} />
}
