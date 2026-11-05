import { PRIORITY_LABELS } from '../../domain/ticket.ts'
import type { TicketPriority } from '../../domain/ticket.ts'
import { Badge } from '../ui/Badge.tsx'
import { PRIORITY_TONE_CLASSES } from './ticketStyles.ts'

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge label={PRIORITY_LABELS[priority]} toneClass={PRIORITY_TONE_CLASSES[priority]} />
}
