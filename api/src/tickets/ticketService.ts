import { buildTicket, validateNewTicket } from '@vtdesk/domain'
import type { Department, NewTicketInput, Ticket, TicketPriority, Viewer } from '@vtdesk/domain'
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
}
