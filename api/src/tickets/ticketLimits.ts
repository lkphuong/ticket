import type { Ticket } from '@vtdesk/domain'

// Comments and history live inside the ticket document, so each list is capped to keep the document small
export const MAX_COMMENTS_PER_TICKET = 500
export const MAX_HISTORY_ENTRIES_PER_TICKET = 1000

export class TicketLimitExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TicketLimitExceededError'
  }
}

// Rejects a ticket whose embedded comments or combined status and assignment history outgrew the soft limits
export function assertWithinTicketLimits(ticket: Ticket): void {
  if (ticket.comments.length > MAX_COMMENTS_PER_TICKET) {
    throw new TicketLimitExceededError(
      `Yêu cầu đã đạt giới hạn ${MAX_COMMENTS_PER_TICKET} trao đổi, không thể thêm trao đổi mới.`,
    )
  }
  const historyEntries = (ticket.statusHistory?.length ?? 0) + (ticket.assignmentHistory?.length ?? 0)
  if (historyEntries > MAX_HISTORY_ENTRIES_PER_TICKET) {
    throw new TicketLimitExceededError(
      `Yêu cầu đã đạt giới hạn ${MAX_HISTORY_ENTRIES_PER_TICKET} mục lịch sử, không thể ghi nhận thêm thay đổi.`,
    )
  }
}
