import { STATUS_LABELS } from './ticket.ts'
import type { Ticket, TicketActor, TicketComment, TicketPriority, TicketStatus, TicketStatusChange } from './ticket.ts'
import { canTransition } from './ticketTransitions.ts'
import { isActiveTicket } from './ticket.ts'

export type TicketsAction =
  | { type: 'ticket_created'; ticket: Ticket }
  | { type: 'status_changed'; ticketId: string; status: TicketStatus; changedAt: string; actor?: TicketActor }
  | { type: 'assignee_set'; ticketId: string; assigneeName: string; changedAt: string; actor?: TicketActor }
  | { type: 'result_confirmed'; ticketId: string; rating: number; feedback?: string; changedAt: string; actor?: TicketActor }
  | { type: 'comment_added'; ticketId: string; comment: TicketComment }
  | { type: 'priority_changed'; ticketId: string; priority: TicketPriority; changedAt: string }
  | { type: 'due_date_changed'; ticketId: string; dueDate: string; changedAt: string }
  | { type: 'ticket_cancelled'; ticketId: string; reason: string; changedAt: string; actor?: TicketActor }
  | { type: 'ticket_reopened'; ticketId: string; reason: string; changedAt: string; actor?: TicketActor }

const MIN_RATING = 1
const MAX_RATING = 5

function updateTicket(tickets: Ticket[], ticketId: string, change: (ticket: Ticket) => Ticket): Ticket[] {
  return tickets.map((ticket) => (ticket.id === ticketId ? change(ticket) : ticket))
}

interface StatusChangeDetail {
  reason?: string
  actor?: TicketActor
}

function withStatusChange(ticket: Ticket, status: TicketStatus, changedAt: string, detail: StatusChangeDetail = {}): Ticket {
  if (ticket.status === status) return { ...ticket, updatedAt: changedAt }
  const history: TicketStatusChange[] = ticket.statusHistory ?? []
  const entry: TicketStatusChange = { status, at: changedAt, ...detail }
  return { ...ticket, status, statusHistory: [...history, entry], updatedAt: changedAt }
}

function describeBadTransition(from: TicketStatus, to: TicketStatus): string {
  return `Không thể chuyển yêu cầu từ trạng thái "${STATUS_LABELS[from]}" sang "${STATUS_LABELS[to]}".`
}

function validateOnTicket(ticket: Ticket, action: TicketsAction): string | null {
  switch (action.type) {
    case 'status_changed':
      // Closing and reopening carry their own rules (reason, rating) in dedicated actions
      if (action.status === ticket.status) return null
      if (action.status === 'closed' || ticket.status === 'closed' || !canTransition(ticket.status, action.status)) {
        return describeBadTransition(ticket.status, action.status)
      }
      return null
    case 'assignee_set':
      return isActiveTicket(ticket) ? null : 'Chỉ phân công được yêu cầu còn hoạt động.'
    case 'result_confirmed':
      if (ticket.status !== 'resolved') return 'Chỉ nghiệm thu được yêu cầu ở trạng thái "Đã xử lý".'
      if (!Number.isInteger(action.rating) || action.rating < MIN_RATING || action.rating > MAX_RATING) {
        return `Điểm đánh giá phải là số nguyên từ ${MIN_RATING} đến ${MAX_RATING}.`
      }
      return null
    case 'ticket_cancelled':
      if (!isActiveTicket(ticket)) return 'Chỉ hủy được yêu cầu còn hoạt động.'
      return action.reason.trim() ? null : 'Vui lòng nhập lý do hủy yêu cầu.'
    case 'comment_added':
      return ticket.status === 'closed' ? 'Yêu cầu đã đóng, không thể thêm trao đổi. Hãy mở lại yêu cầu trước.' : null
    case 'priority_changed':
      return isActiveTicket(ticket) ? null : 'Chỉ đổi được mức ưu tiên của yêu cầu còn hoạt động.'
    case 'due_date_changed':
      if (!isActiveTicket(ticket)) return 'Chỉ đổi được hạn chót của yêu cầu còn hoạt động.'
      if (!action.dueDate) return 'Vui lòng chọn hạn chót mới.'
      return action.dueDate < action.changedAt.slice(0, 10) ? 'Hạn chót mới không được ở quá khứ.' : null
    case 'ticket_reopened':
      if (ticket.cancelReason) return 'Yêu cầu đã bị hủy nên không thể mở lại. Hãy tạo yêu cầu mới.'
      if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
        return 'Chỉ làm lại hoặc mở lại được yêu cầu ở trạng thái "Đã xử lý" hoặc "Đã đóng".'
      }
      return action.reason.trim() ? null : 'Vui lòng nhập lý do làm lại yêu cầu.'
    default:
      return null
  }
}

// Returns the Vietnamese reason an action would be refused, or null when the reducer will apply it
export function validateTicketAction(tickets: Ticket[], action: TicketsAction): string | null {
  if (action.type === 'ticket_created') return null
  const { ticketId } = action
  const ticket = tickets.find((candidate) => candidate.id === ticketId)
  if (!ticket) return `Không tìm thấy yêu cầu ${ticketId}.`
  return validateOnTicket(ticket, action)
}

function applyAssignment(ticket: Ticket, assigneeName: string, changedAt: string, actor?: TicketActor): Ticket {
  // Assigning a fresh ticket transitions state to in_progress to start work
  const started = withStatusChange(ticket, ticket.status === 'open' ? 'in_progress' : ticket.status, changedAt, { actor })
  if (ticket.assigneeName === assigneeName) return started
  const history = ticket.assignmentHistory ?? []
  const change = ticket.assigneeName
    ? { from: ticket.assigneeName, to: assigneeName, at: changedAt, actor }
    : { to: assigneeName, at: changedAt, actor }
  return { ...started, assigneeName, assignmentHistory: [...history, change] }
}

function applyComment(ticket: Ticket, comment: TicketComment): Ticket {
  const withComment = { ...ticket, comments: [...ticket.comments, comment], updatedAt: comment.createdAt }
  // The requester answering a question hands the ticket back to the handler
  if (ticket.status === 'waiting' && comment.author === ticket.requesterName) {
    return withStatusChange(withComment, 'in_progress', comment.createdAt)
  }
  return withComment
}

function applyReopen(ticket: Ticket, reason: string, changedAt: string, actor?: TicketActor): Ticket {
  const reopened = withStatusChange(ticket, 'in_progress', changedAt, { reason: reason.trim(), actor })
  return { ...reopened, rating: undefined, feedback: undefined, cancelReason: undefined }
}

export function ticketsReducer(tickets: Ticket[], action: TicketsAction): Ticket[] {
  if (validateTicketAction(tickets, action) !== null) return tickets
  switch (action.type) {
    case 'ticket_created':
      return [action.ticket, ...tickets]
    case 'status_changed':
      return updateTicket(tickets, action.ticketId, (ticket) =>
        withStatusChange(ticket, action.status, action.changedAt, { actor: action.actor }),
      )
    case 'assignee_set':
      return updateTicket(tickets, action.ticketId, (ticket) => applyAssignment(ticket, action.assigneeName, action.changedAt, action.actor))
    case 'result_confirmed':
      return updateTicket(tickets, action.ticketId, (ticket) => ({
        ...withStatusChange(ticket, 'closed', action.changedAt, { actor: action.actor }),
        rating: action.rating,
        feedback: action.feedback,
      }))
    case 'comment_added':
      return updateTicket(tickets, action.ticketId, (ticket) => applyComment(ticket, action.comment))
    case 'priority_changed':
      return updateTicket(tickets, action.ticketId, (ticket) => ({
        ...ticket,
        priority: action.priority,
        updatedAt: action.changedAt,
      }))
    case 'due_date_changed':
      return updateTicket(tickets, action.ticketId, (ticket) => ({
        ...ticket,
        dueDate: action.dueDate,
        updatedAt: action.changedAt,
      }))
    case 'ticket_cancelled':
      return updateTicket(tickets, action.ticketId, (ticket) => ({
        ...withStatusChange(ticket, 'closed', action.changedAt, { reason: action.reason.trim(), actor: action.actor }),
        cancelReason: action.reason.trim(),
      }))
    case 'ticket_reopened':
      return updateTicket(tickets, action.ticketId, (ticket) => applyReopen(ticket, action.reason, action.changedAt, action.actor))
  }
}
