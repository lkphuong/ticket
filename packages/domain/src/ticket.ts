export const TICKET_STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'pending_approval', 'closed'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const DEPARTMENTS = [
  'Công nghệ thông tin',
  'Nhân sự',
  'Kế toán',
  'Marketing',
  'Kinh doanh',
  'Vận hành',
  'Pháp chế',
  'Hành chính',
] as const
export type Department = (typeof DEPARTMENTS)[number]

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Mới',
  in_progress: 'Đang xử lý',
  waiting: 'Chờ phản hồi',
  resolved: 'Đã xử lý',
  pending_approval: 'Chờ duyệt',
  closed: 'Đã đóng',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  urgent: 'Khẩn cấp',
}

export const ACTIVE_STATUSES: readonly TicketStatus[] = ['open', 'in_progress', 'waiting']

export interface TicketComment {
  id: string
  author: string
  department: Department
  body: string
  createdAt: string
  // Optional file attachments accompanying the comment
  attachments?: TicketAttachment[]
}

// Who performed a change, kept so the activity log can name the author and the department they speak for
export interface TicketActor {
  name: string
  department: Department
}

export interface TicketStatusChange {
  status: TicketStatus
  at: string
  // Why the ticket was sent back for rework or reopened
  reason?: string
  actor?: TicketActor
}

export interface TicketAssignmentChange {
  // Absent on the first assignment
  from?: string
  to: string
  at: string
  actor?: TicketActor
}

export interface TicketAttachment {
  name: string
  sizeKb: number
  // Reference to the uploaded content; absent for attachments recorded before file storage existed
  id?: string
  mimeType?: string
}

export interface Ticket {
  // Database identifier (uuid); never shown to people
  id: string
  // Human readable code such as TCK-CNTT-2611-001, shown in screens, exports and notifications
  code: string
  title: string
  description: string
  // Absent on tickets created before these fields were introduced
  purpose?: string
  expectedResult?: string
  priority: TicketPriority
  status: TicketStatus
  requesterName: string
  fromDepartment: Department
  toDepartment: Department
  assigneeName?: string
  attachments: TicketAttachment[]
  // Requester satisfaction from 1 to 5, set when the requester confirms the result
  rating?: number
  // Requester notes provided upon confirming ticket completion
  feedback?: string
  // Explanation recorded when a ticket is cancelled before normal completion
  cancelReason?: string
  // Calendar date in YYYY-MM-DD form, as produced by an HTML date input
  dueDate?: string
  createdAt: string
  updatedAt: string
  comments: TicketComment[]
  // Absent on tickets created before the timeline was introduced
  statusHistory?: TicketStatusChange[]
  assignmentHistory?: TicketAssignmentChange[]
}

export interface NewTicketInput {
  title: string
  description: string
  purpose: string
  expectedResult: string
  priority: TicketPriority
  toDepartment: Department | ''
  dueDate: string
  attachments: TicketAttachment[]
}

export interface Viewer {
  id?: string
  username?: string
  name: string
  department: Department
  isDepartmentHead: boolean
  role?: 'staff' | 'head' | 'admin'
  isAdmin?: boolean
  isExecutive?: boolean
  requiresPasswordChange?: boolean
  avatarAttachmentId?: string
}

export function isActiveTicket(ticket: Ticket): boolean {
  return ACTIVE_STATUSES.includes(ticket.status)
}

export function isTicketOverdue(ticket: Ticket, now: Date): boolean {
  if (!ticket.dueDate || !isActiveTicket(ticket)) return false
  // A ticket is due until the end of its due date; ISO date strings compare chronologically, in UTC like the SLA labels
  return ticket.dueDate < now.toISOString().slice(0, 10)
}
