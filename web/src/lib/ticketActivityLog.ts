import { STATUS_LABELS } from '../domain/ticket.ts'
import type { Ticket, TicketActor, TicketStatus } from '../domain/ticket.ts'

export type ActivityKind =
  | 'created'
  | 'assigned'
  | 'handoff'
  | 'status'
  | 'comment'
  | 'rework'
  | 'reopened'
  | 'confirmed'
  | 'cancelled'

export interface ActivityEvent {
  kind: ActivityKind
  at: string
  summary: string
  // Cancel reason, rework reason or comment text
  detail?: string
  actor?: TicketActor
}

function describeStatusEntry(
  ticket: Ticket,
  previousStatus: TicketStatus,
  entry: NonNullable<Ticket['statusHistory']>[number],
): Pick<ActivityEvent, 'kind' | 'summary' | 'detail'> {
  if (entry.status === 'closed') {
    if (entry.reason) return { kind: 'cancelled', summary: 'Hủy yêu cầu', detail: entry.reason }
    const rating = ticket.rating === undefined ? '' : ` (${ticket.rating}/5)`
    return { kind: 'confirmed', summary: `Nghiệm thu và đóng yêu cầu${rating}` }
  }
  if (entry.status === 'in_progress' && entry.reason) {
    const isReopen = previousStatus === 'closed'
    return {
      kind: isReopen ? 'reopened' : 'rework',
      summary: isReopen ? 'Mở lại yêu cầu đã đóng' : 'Yêu cầu làm lại',
      detail: entry.reason,
    }
  }
  return { kind: 'status', summary: `Chuyển trạng thái sang "${STATUS_LABELS[entry.status]}"` }
}

function buildStatusEvents(ticket: Ticket): ActivityEvent[] {
  const history = ticket.statusHistory ?? []
  // The first "open" entry duplicates the creation event, so it is skipped
  return history.flatMap((entry, index) => {
    if (index === 0 && entry.status === 'open') return []
    const previousStatus = history[index - 1]?.status ?? 'open'
    return [{ ...describeStatusEntry(ticket, previousStatus, entry), at: entry.at, actor: entry.actor }]
  })
}

function buildAssignmentEvents(ticket: Ticket): ActivityEvent[] {
  return (ticket.assignmentHistory ?? []).map((change) => ({
    kind: change.from ? 'handoff' : 'assigned',
    at: change.at,
    summary: change.from ? `Chuyển giao từ ${change.from} sang ${change.to}` : `Phân công cho ${change.to}`,
    actor: change.actor,
  }))
}

function buildCommentEvents(ticket: Ticket): ActivityEvent[] {
  return ticket.comments.map((comment) => ({
    kind: 'comment',
    at: comment.createdAt,
    summary: 'Bình luận',
    detail: comment.body,
    actor: { name: comment.author, department: comment.department },
  }))
}

// Merges status changes, assignments and comments into one chronological log; an assignment or comment precedes the status change it triggers
export function buildActivityLog(ticket: Ticket): ActivityEvent[] {
  const requester: TicketActor = { name: ticket.requesterName, department: ticket.fromDepartment }
  const creation: ActivityEvent = { kind: 'created', at: ticket.createdAt, summary: 'Khởi tạo yêu cầu', actor: requester }
  return [creation, ...buildAssignmentEvents(ticket), ...buildCommentEvents(ticket), ...buildStatusEvents(ticket)].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  )
}
