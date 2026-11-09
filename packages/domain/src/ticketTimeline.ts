import type { Ticket, TicketStatus } from './ticket.ts'

export type TimelineStepState = 'done' | 'current' | 'upcoming'

export interface TimelineStep {
  status: TicketStatus
  label: string
  state: TimelineStepState
  // Absent when the moment was not recorded, as on tickets that predate the history
  at?: string
}

interface TimelineStage {
  label: string
  // Status whose mark colour represents this stage
  status: TicketStatus
  // Statuses in which the ticket sits at this stage
  currentWhen: readonly TicketStatus[]
  // Whether the stage reads the earliest or the latest matching history entry
  recordedAt: 'first' | 'last'
}

// Receiving and processing both happen while the ticket is in progress, so the first entry marks receipt and the
// latest one marks the current round of work. A ticket waiting on the requester is still being processed.
const STAGES: readonly TimelineStage[] = [
  { label: 'Mới', status: 'open', currentWhen: ['open'], recordedAt: 'last' },
  { label: 'Đã tiếp nhận', status: 'in_progress', currentWhen: [], recordedAt: 'first' },
  { label: 'Đang xử lý', status: 'in_progress', currentWhen: ['in_progress', 'waiting'], recordedAt: 'last' },
  { label: 'Hoàn thành', status: 'resolved', currentWhen: ['resolved'], recordedAt: 'last' },
  { label: 'Chờ duyệt', status: 'pending_approval', currentWhen: ['pending_approval'], recordedAt: 'last' },
  { label: 'Nghiệm thu', status: 'closed', currentWhen: ['closed'], recordedAt: 'last' },
]

function findStageTime(ticket: Ticket, stage: TimelineStage): string | undefined {
  const matching = ticket.statusHistory?.filter((change) => change.status === stage.status) ?? []
  const recorded = stage.recordedAt === 'first' ? matching[0] : matching[matching.length - 1]
  if (recorded) return recorded.at
  if (stage.status === 'open') return ticket.createdAt
  return ticket.status === stage.status ? ticket.updatedAt : undefined
}

// Index of the stage the ticket is at now; the receipt stage is never current because processing follows at once
function findCurrentStageIndex(ticket: Ticket): number {
  const lastIndex = STAGES.findLastIndex((stage) => stage.currentWhen.includes(ticket.status))
  return lastIndex === -1 ? 0 : lastIndex
}

// Walks the fixed stages in order: everything before the current stage is done, everything after is upcoming
export function buildTicketTimeline(ticket: Ticket): TimelineStep[] {
  const currentIndex = findCurrentStageIndex(ticket)
  return STAGES.map((stage, index) => {
    const state: TimelineStepState = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming'
    return { status: stage.status, label: stage.label, state, at: state === 'upcoming' ? undefined : findStageTime(ticket, stage) }
  })
}
