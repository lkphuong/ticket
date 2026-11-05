import {
  addDays,
  buildComment,
  buildTicket,
  canEditDueDate,
  canEditPriority,
  canTransition,
  canViewTicket,
  isActiveTicket,
  STATUS_LABELS,
  validateNewTicket,
} from '@vtdesk/domain'
import type {
  Department,
  NewTicketInput,
  Ticket,
  TicketActor,
  TicketComment,
  TicketPriority,
  TicketStatus,
  Viewer,
} from '@vtdesk/domain'
import type { ITicketStore } from '../repositories/interfaces.ts'

export interface CreateTicketInput {
  readonly title: string
  readonly description: string
  readonly purpose: string
  readonly expectedResult: string
  readonly priority: TicketPriority
  readonly toDepartment: string
  readonly dueDate?: string
  readonly attachments?: Array<{
    readonly name: string
    readonly size?: number
    readonly sizeKb?: number
  }>
}

export interface TicketCreator {
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head' | 'admin'
  readonly isDepartmentHead: boolean
}

export class TicketNotFoundError extends Error {
  constructor(message: string = 'Ticket không tồn tại hoặc không thể truy cập.') {
    super(message)
    this.name = 'TicketNotFoundError'
  }
}

export class TicketAuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TicketAuthorizationError'
  }
}

export class TicketValidationError extends Error {
  readonly errors: Record<string, string>

  constructor(message: string, errors: Record<string, string>) {
    super(message)
    this.name = 'TicketValidationError'
    this.errors = errors
  }
}

// Lightweight promise chain mutex preventing race conditions during concurrent ID allocation
class AsyncMutex {
  private queue = Promise.resolve()

  runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn)
    this.queue = next.then(() => {}, () => {})
    return next
  }
}

const DEFAULT_SLA_HOURS: Record<string, number> = {
  urgent: 4,
  high: 24,
  medium: 72,
  low: 120,
}

// Core business service governing ticket lifecycle actions
export class TicketService {
  private readonly mutex = new AsyncMutex()

  constructor(
    private readonly store: ITicketStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // Creates a validated work ticket and safely allocates an incremental sequential ID
  async createTicket(input: CreateTicketInput, creator: TicketCreator): Promise<Ticket> {
    // 1. Enforce organizational role constraint: System Administrators supervise only
    if (creator.role === 'admin') {
      throw new TicketAuthorizationError('Quản trị viên chỉ có quyền giám sát, không được tạo Ticket.')
    }

    const now = this.clock()
    const domainViewer: Viewer = {
      name: creator.name,
      department: creator.department as Department,
      isDepartmentHead: creator.isDepartmentHead,
      isExecutive: false,
    }

    // 2. Resolve default due date from SLA if not explicitly provided
    let resolvedDueDate = input.dueDate?.trim() || ''
    if (!resolvedDueDate) {
      const sla = await this.store.slas.findByPriority(input.priority)
      const hours = sla?.resolutionHours ?? DEFAULT_SLA_HOURS[input.priority] ?? 72
      // Project forward in time by SLA resolution hours
      const targetTime = new Date(now.getTime() + hours * 3600 * 1000)
      resolvedDueDate = targetTime.toISOString().slice(0, 10)
    }

    const domainInput: NewTicketInput = {
      title: input.title ?? '',
      description: input.description ?? '',
      purpose: input.purpose ?? '',
      expectedResult: input.expectedResult ?? '',
      priority: input.priority,
      toDepartment: (input.toDepartment ?? '') as Department,
      dueDate: resolvedDueDate,
      attachments: (input.attachments ?? []).map((att) => ({
        name: att.name,
        sizeKb: att.sizeKb ?? (att.size ? Math.round(att.size / 1024) : 0),
      })),
    }

    // 3. Run pure domain validation rules
    const errors = validateNewTicket(domainInput, domainViewer, now)
    if (Object.keys(errors).length > 0) {
      throw new TicketValidationError('Dữ liệu yêu cầu không hợp lệ.', errors as Record<string, string>)
    }

    // 4. Guarantee atomic ID assignment under concurrent load
    return await this.mutex.runExclusive(async () => {
      const existing = await this.store.tickets.findAll()
      const newTicket = buildTicket(domainInput, domainViewer, existing, now)
      await this.store.tickets.save(newTicket)
      return newTicket
    })
  }

  // Assigns a specialist from the receiving department to handle the ticket
  async assignTicket(ticketId: string, assigneeName: string, creator: TicketCreator): Promise<Ticket> {
    const ticket = await this.store.tickets.findById(ticketId)
    if (!ticket) {
      throw new TicketNotFoundError()
    }

    // 1. Enforce receiving department head authority
    if (creator.role !== 'head' || !creator.isDepartmentHead || creator.department !== ticket.toDepartment) {
      throw new TicketAuthorizationError('Chỉ Trưởng phòng của phòng tiếp nhận mới được phân công Ticket.')
    }

    // 2. Validate ticket lifecycle state: only active tickets may be assigned
    if (!isActiveTicket(ticket)) {
      throw new TicketValidationError('Chỉ phân công được yêu cầu còn hoạt động.', {
        status: 'Yêu cầu không còn hoạt động.',
      })
    }

    // 3. Ensure designated assignee is an active member belonging to the receiving department
    const members = await this.store.members.findAll()
    const targetMember = members.find(
      (m) => m.name === assigneeName && m.department === ticket.toDepartment && m.isActive,
    )
    if (!targetMember) {
      throw new TicketValidationError('Người được giao phải là thành viên đang hoạt động của phòng tiếp nhận.', {
        assigneeName: 'Người được giao không thuộc phòng tiếp nhận hoặc đã bị khóa.',
      })
    }

    const now = this.clock()
    const timestamp = now.toISOString()
    const actor: TicketActor = { name: creator.name, department: creator.department as Department }

    // 4. Record handoff or initial assignment in history
    const history = ticket.assignmentHistory ? [...ticket.assignmentHistory] : []
    const assignmentEntry = ticket.assigneeName
      ? { from: ticket.assigneeName, to: assigneeName, at: timestamp, actor }
      : { to: assigneeName, at: timestamp, actor }
    history.push(assignmentEntry)

    // 5. Transition newly assigned tickets from "open" to "in_progress"
    const nextStatus = ticket.status === 'open' ? 'in_progress' : ticket.status
    const statusHistory = ticket.statusHistory ? [...ticket.statusHistory] : []
    if (ticket.status === 'open') {
      statusHistory.push({ status: 'in_progress', at: timestamp, actor })
    }

    const updatedTicket: Ticket = {
      ...ticket,
      assigneeName,
      status: nextStatus,
      assignmentHistory: history,
      statusHistory,
      updatedAt: timestamp,
    }

    await this.store.tickets.save(updatedTicket)
    return updatedTicket
  }

  // Updates priority level of an active ticket
  async updatePriority(ticketId: string, priority: TicketPriority, creator: TicketCreator): Promise<Ticket> {
    const ticket = await this.store.tickets.findById(ticketId)
    if (!ticket) {
      throw new TicketNotFoundError()
    }

    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      throw new TicketValidationError('Mức ưu tiên không hợp lệ.', {
        priority: 'Vui lòng chọn mức ưu tiên hợp lệ.',
      })
    }

    const viewer: Viewer = {
      name: creator.name,
      department: creator.department as Department,
      isDepartmentHead: creator.isDepartmentHead,
      isExecutive: creator.role === 'admin',
    }

    if (!canEditPriority(ticket, viewer)) {
      throw new TicketAuthorizationError('Bạn không có quyền thay đổi mức ưu tiên cho Ticket này.')
    }

    if (!isActiveTicket(ticket)) {
      throw new TicketValidationError('Chỉ đổi được mức ưu tiên của yêu cầu còn hoạt động.', {
        status: 'Yêu cầu không còn hoạt động.',
      })
    }

    const timestamp = this.clock().toISOString()
    const updatedTicket: Ticket = {
      ...ticket,
      priority,
      updatedAt: timestamp,
    }

    await this.store.tickets.save(updatedTicket)
    return updatedTicket
  }

  // Updates resolution deadline of an active ticket
  async updateDueDate(ticketId: string, dueDate: string, creator: TicketCreator): Promise<Ticket> {
    const ticket = await this.store.tickets.findById(ticketId)
    if (!ticket) {
      throw new TicketNotFoundError()
    }

    const viewer: Viewer = {
      name: creator.name,
      department: creator.department as Department,
      isDepartmentHead: creator.isDepartmentHead,
      isExecutive: creator.role === 'admin',
    }

    if (!canEditDueDate(ticket, viewer)) {
      throw new TicketAuthorizationError('Bạn không có quyền thay đổi hạn chót cho Ticket này.')
    }

    if (!isActiveTicket(ticket)) {
      throw new TicketValidationError('Chỉ đổi được hạn chót của yêu cầu còn hoạt động.', {
        status: 'Yêu cầu không còn hoạt động.',
      })
    }

    const now = this.clock()
    const todayIso = now.toISOString().slice(0, 10)
    const normalizedDueDate = dueDate?.trim()

    if (!normalizedDueDate) {
      throw new TicketValidationError('Vui lòng chọn hạn chót mới.', {
        dueDate: 'Hạn chót không được để trống.',
      })
    }

    if (normalizedDueDate < todayIso) {
      throw new TicketValidationError('Hạn chót mới không được ở quá khứ.', {
        dueDate: 'Hạn chót mới không được ở quá khứ.',
      })
    }

    const timestamp = now.toISOString()
    const updatedTicket: Ticket = {
      ...ticket,
      dueDate: normalizedDueDate,
      updatedAt: timestamp,
    }

    await this.store.tickets.save(updatedTicket)
    return updatedTicket
  }

  // Updates the progress status of a ticket (Assigned Specialist only)
  async updateProgress(
    ticketId: string,
    targetStatus: TicketStatus,
    creator: TicketCreator,
    questionOrReason?: string,
  ): Promise<Ticket> {
    const ticket = await this.store.tickets.findById(ticketId)
    if (!ticket) {
      throw new TicketNotFoundError()
    }

    // 1. Only assigned specialist may update progress
    if (ticket.assigneeName !== creator.name) {
      throw new TicketAuthorizationError('Chỉ Chuyên viên được giao mới được cập nhật tiến độ Ticket.')
    }

    // 2. Reject modifications to inactive tickets
    if (!isActiveTicket(ticket)) {
      throw new TicketValidationError('Chỉ cập nhật tiến độ cho yêu cầu còn hoạt động.', {
        status: 'Yêu cầu không còn hoạt động.',
      })
    }

    // 3. Prohibit direct transition to closed via progress update
    if (targetStatus === 'closed') {
      throw new TicketValidationError('Không thể đóng yêu cầu trực tiếp qua cập nhật tiến độ.', {
        status: 'Không thể chuyển trực tiếp sang trạng thái Đã đóng.',
      })
    }

    // 4. Validate lifecycle transition correctness
    if (targetStatus === ticket.status) {
      return ticket
    }

    if (!canTransition(ticket.status, targetStatus)) {
      const fromLabel = STATUS_LABELS[ticket.status] || ticket.status
      const toLabel = STATUS_LABELS[targetStatus] || targetStatus
      throw new TicketValidationError(
        `Không thể chuyển yêu cầu từ trạng thái "${fromLabel}" sang "${toLabel}".`,
        { status: `Không thể chuyển yêu cầu từ trạng thái "${fromLabel}" sang "${toLabel}".` },
      )
    }

    const now = this.clock()
    const timestamp = now.toISOString()
    const actor: TicketActor = { name: creator.name, department: creator.department as Department }
    const statusHistory = ticket.statusHistory ? [...ticket.statusHistory] : []

    let updatedDueDate = ticket.dueDate

    // 5. If resuming from waiting, extend SLA due date by calendar days spent in pause
    if (ticket.status === 'waiting' && updatedDueDate) {
      const waitingEntry = statusHistory.findLast((h) => h.status === 'waiting')
      if (waitingEntry) {
        const waitDate = waitingEntry.at.slice(0, 10)
        const resumeDate = timestamp.slice(0, 10)
        const waitMs = new Date(`${waitDate}T00:00:00.000Z`).getTime()
        const resumeMs = new Date(`${resumeDate}T00:00:00.000Z`).getTime()
        const pausedDays = Math.max(0, Math.round((resumeMs - waitMs) / 86400000))
        if (pausedDays > 0) {
          updatedDueDate = addDays(updatedDueDate, pausedDays)
        }
      }
    }

    // 6. Record status history entry with reason or question
    statusHistory.push({
      status: targetStatus,
      at: timestamp,
      reason: questionOrReason?.trim() || undefined,
      actor,
    })

    const updatedTicket: Ticket = {
      ...ticket,
      status: targetStatus,
      dueDate: updatedDueDate,
      statusHistory,
      updatedAt: timestamp,
    }

    await this.store.tickets.save(updatedTicket)
    return updatedTicket
  }

  // Appends a comment with optional attachments to the ticket discussion
  async addComment(
    ticketId: string,
    body: string,
    creator: TicketCreator,
    attachments: Array<{ name: string; size?: number; sizeKb?: number }> = [],
  ): Promise<{ comment: TicketComment; ticket: Ticket }> {
    const ticket = await this.store.tickets.findById(ticketId)
    if (!ticket) {
      throw new TicketNotFoundError()
    }

    const domainViewer: Viewer = {
      name: creator.name,
      department: creator.department as Department,
      isDepartmentHead: creator.isDepartmentHead,
      isExecutive: creator.role === 'admin',
    }

    // 1. Enforce visibility boundary: users cannot comment on inaccessible tickets
    if (!canViewTicket(ticket, domainViewer)) {
      throw new TicketNotFoundError()
    }

    // 2. Reject comments on closed tickets
    if (ticket.status === 'closed') {
      throw new TicketValidationError('Yêu cầu đã đóng, không thể thêm trao đổi. Hãy mở lại yêu cầu trước.', {
        status: 'Yêu cầu đã đóng, không thể thêm trao đổi. Hãy mở lại yêu cầu trước.',
      })
    }

    const trimmedBody = body?.trim()
    if (!trimmedBody) {
      throw new TicketValidationError('Vui lòng nhập nội dung bình luận.', {
        body: 'Vui lòng nhập nội dung bình luận.',
      })
    }

    const now = this.clock()
    const timestamp = now.toISOString()
    const parsedAttachments = attachments.map((att) => ({
      name: att.name,
      sizeKb: att.sizeKb ?? (att.size ? Math.round(att.size / 1024) : 0),
    }))

    const comment = buildComment(
      trimmedBody,
      creator.name,
      creator.department as Department,
      now,
      parsedAttachments,
    )

    const comments = [...ticket.comments, comment]
    let nextStatus = ticket.status
    const statusHistory = ticket.statusHistory ? [...ticket.statusHistory] : []
    let updatedDueDate = ticket.dueDate

    // 3. If requester replies while ticket is waiting for feedback, transition back to in_progress
    if (ticket.status === 'waiting' && creator.name === ticket.requesterName) {
      nextStatus = 'in_progress'

      // Calculate calendar days paused and postpone due date
      if (updatedDueDate) {
        const waitingEntry = statusHistory.findLast((h) => h.status === 'waiting')
        if (waitingEntry) {
          const waitDate = waitingEntry.at.slice(0, 10)
          const resumeDate = timestamp.slice(0, 10)
          const waitMs = new Date(`${waitDate}T00:00:00.000Z`).getTime()
          const resumeMs = new Date(`${resumeDate}T00:00:00.000Z`).getTime()
          const pausedDays = Math.max(0, Math.round((resumeMs - waitMs) / 86400000))
          if (pausedDays > 0) {
            updatedDueDate = addDays(updatedDueDate, pausedDays)
          }
        }
      }

      const actor: TicketActor = { name: creator.name, department: creator.department as Department }
      statusHistory.push({
        status: 'in_progress',
        at: timestamp,
        actor,
      })
    }

    const updatedTicket: Ticket = {
      ...ticket,
      status: nextStatus,
      dueDate: updatedDueDate,
      comments,
      statusHistory,
      updatedAt: timestamp,
    }

    await this.store.tickets.save(updatedTicket)
    return { comment, ticket: updatedTicket }
  }
}
