import { ACTIVE_STATUSES, filterTickets, filterVisibleTickets, formatTicketCode, formatTicketPeriod, parseTicketCode } from '@vtdesk/domain'
import type { Ticket } from '@vtdesk/domain'
import type {
  DbAuditLog,
  DbDefaultSla,
  DbDepartmentTransfer,
  DbDeviceToken,
  DbMember,
  DbNotification,
  DbRequestTemplate,
  DepartmentWithPrefix,
  IAuditLogRepository,
  IDepartmentRepository,
  IDepartmentTransferRepository,
  IDeviceTokenRepository,
  IMemberRepository,
  INotificationRepository,
  ISlaRepository,
  ITemplateRepository,
  ITicketRepository,
  ITicketStore,
  TicketPageRequest,
  TicketPageResult,
  TicketQuery,
} from './interfaces.ts'

function cloneTicket(ticket: Ticket): Ticket {
  return JSON.parse(JSON.stringify(ticket))
}

// In-memory implementation of ticket repository for isolated zero-IO testing
export class InMemoryTicketRepository implements ITicketRepository {
  private readonly items = new Map<string, Ticket>()

  async findById(id: string): Promise<Ticket | null> {
    const found = this.items.get(id)
    return found ? JSON.parse(JSON.stringify(found)) : null
  }

  async findAll(): Promise<Ticket[]> {
    return Array.from(this.items.values()).map((t) => JSON.parse(JSON.stringify(t)))
  }

  async save(ticket: Ticket): Promise<void> {
    // Preserve immutable snapshot
    this.items.set(ticket.id, JSON.parse(JSON.stringify(ticket)))
  }

  async saveMany(tickets: readonly Ticket[]): Promise<void> {
    for (const ticket of tickets) await this.save(ticket)
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id)
  }

  async findPage(query: TicketQuery, page: TicketPageRequest): Promise<TicketPageResult> {
    const matching = this.selectMatching(query)
    const offset = (page.page - 1) * page.limit
    return { items: matching.slice(offset, offset + page.limit).map(cloneTicket), total: matching.length }
  }

  async findMatching(query: TicketQuery): Promise<Ticket[]> {
    return this.selectMatching(query).map(cloneTicket)
  }

  async countInvolvingMember(memberName: string): Promise<number> {
    return this.all().filter((t) => t.requesterName === memberName || t.assigneeName === memberName).length
  }

  async countByDepartment(department: string): Promise<number> {
    return this.all().filter((t) => t.fromDepartment === department || t.toDepartment === department).length
  }

  async findActiveByAssignee(assigneeName: string): Promise<Ticket[]> {
    return this.all()
      .filter((t) => t.assigneeName === assigneeName && ACTIVE_STATUSES.includes(t.status))
      .map(cloneTicket)
  }

  async findDeadlineCandidates(latestDueDate: string): Promise<Ticket[]> {
    return this.all()
      .filter((t) => (t.status === 'open' || t.status === 'in_progress') && Boolean(t.dueDate) && t.dueDate! <= latestDueDate)
      .map(cloneTicket)
  }

  private all(): Ticket[] {
    return Array.from(this.items.values())
  }

  // Ordering by id first makes ties resolve the same way as the id tiebreaker used by the MongoDB sort
  private selectMatching(query: TicketQuery): Ticket[] {
    const byId = this.all().sort((a, b) => a.id.localeCompare(b.id))
    return filterTickets(filterVisibleTickets(byId, query.viewer), query.filters, query.viewer, query.now)
  }

  async allocateCode(codePrefix: string, now: Date): Promise<string> {
    const period = formatTicketPeriod(now)
    const highest = Array.from(this.items.values()).reduce((max, ticket) => {
      const parsed = parseTicketCode(ticket.code)
      return parsed && parsed.prefix === codePrefix && parsed.period === period ? Math.max(max, parsed.sequence) : max
    }, 0)
    return formatTicketCode(codePrefix, period, highest + 1)
  }
}

// In-memory implementation of member repository
export class InMemoryMemberRepository implements IMemberRepository {
  private readonly items = new Map<string, DbMember>()

  async findById(id: string): Promise<DbMember | null> {
    const found = this.items.get(id)
    return found ? { ...found } : null
  }

  async findByUsername(username: string): Promise<DbMember | null> {
    const normalized = username.trim().toLowerCase()
    for (const member of this.items.values()) {
      if (member.username.toLowerCase() === normalized) {
        return { ...member }
      }
    }
    return null
  }

  async findByEmail(email: string): Promise<DbMember | null> {
    const normalized = email.trim().toLowerCase()
    for (const member of this.items.values()) {
      if (member.email === normalized) return { ...member }
    }
    return null
  }

  async findByUsernames(usernames: readonly string[]): Promise<DbMember[]> {
    const wanted = new Set(usernames.map((username) => username.trim().toLowerCase()))
    return this.select((member) => wanted.has(member.username.toLowerCase()))
  }

  async findByNames(names: readonly string[]): Promise<DbMember[]> {
    const wanted = new Set(names)
    return this.select((member) => wanted.has(member.name))
  }

  async findHeads(departments?: readonly string[]): Promise<DbMember[]> {
    return this.select(
      (member) =>
        (member.role === 'head' || member.isDepartmentHead) && (!departments || departments.includes(member.department)),
    )
  }

  async countByDepartment(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {}
    for (const member of this.items.values()) counts[member.department] = (counts[member.department] ?? 0) + 1
    return counts
  }

  private select(predicate: (member: DbMember) => boolean): DbMember[] {
    return Array.from(this.items.values())
      .filter(predicate)
      .map((member) => ({ ...member }))
  }

  async findAll(): Promise<DbMember[]> {
    return Array.from(this.items.values()).map((m) => ({ ...m }))
  }

  async save(member: DbMember): Promise<void> {
    // Email is stored lowercase so lookups are case-insensitive, matching the MongoDB repository
    this.items.set(member.id, { ...member, email: member.email?.trim().toLowerCase() })
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id)
  }
}

// In-memory implementation of department repository
export class InMemoryDepartmentRepository implements IDepartmentRepository {
  private readonly items = new Map<string, string>()

  // Mirrors the database foreign key cascade for records that reference a department by name
  constructor(private readonly onRenamed: (currentName: string, nextName: string) => Promise<void> = async () => {}) {}

  async findAll(): Promise<string[]> {
    return Array.from(this.items.keys())
  }

  async findAllWithPrefix(): Promise<DepartmentWithPrefix[]> {
    return Array.from(this.items.entries()).map(([name, codePrefix]) => ({ name, codePrefix }))
  }

  async findCodePrefix(name: string): Promise<string | null> {
    return this.items.get(name) ?? null
  }

  async create(name: string, codePrefix: string): Promise<void> {
    if (!this.items.has(name)) this.items.set(name, codePrefix)
  }

  async update(currentName: string, next: { name: string; codePrefix: string }): Promise<void> {
    // Rebuild the map so the renamed department keeps its original position
    const entries = Array.from(this.items.entries()).map(([name, prefix]): [string, string] =>
      name === currentName ? [next.name, next.codePrefix] : [name, prefix],
    )
    this.items.clear()
    for (const [name, prefix] of entries) this.items.set(name, prefix)
    if (currentName !== next.name) await this.onRenamed(currentName, next.name)
  }

  async delete(name: string): Promise<void> {
    this.items.delete(name)
  }
}

// In-memory implementation of template repository
export class InMemoryTemplateRepository implements ITemplateRepository {
  private readonly items = new Map<string, DbRequestTemplate>()

  async findAll(): Promise<DbRequestTemplate[]> {
    return Array.from(this.items.values()).map((t) => ({ ...t }))
  }

  async findByDepartment(targetDepartment: string): Promise<DbRequestTemplate[]> {
    return Array.from(this.items.values())
      .filter((t) => t.targetDepartment === targetDepartment)
      .map((t) => ({ ...t }))
  }

  async save(template: DbRequestTemplate): Promise<void> {
    this.items.set(template.id, { ...template })
  }
}

// In-memory implementation of default SLA repository
export class InMemorySlaRepository implements ISlaRepository {
  private readonly items = new Map<string, DbDefaultSla>()

  async findAll(): Promise<DbDefaultSla[]> {
    return Array.from(this.items.values()).map((s) => ({ ...s }))
  }

  async findByPriority(priority: string): Promise<DbDefaultSla | null> {
    const item = this.items.get(priority)
    return item ? { ...item } : null
  }

  async save(sla: DbDefaultSla): Promise<void> {
    this.items.set(sla.priority, { ...sla })
  }
}

// In-memory implementation of notification repository
export class InMemoryNotificationRepository implements INotificationRepository {
  private readonly items = new Map<string, DbNotification>()

  async findByRecipient(recipientUsername: string): Promise<DbNotification[]> {
    return Array.from(this.items.values())
      .filter((n) => n.recipientUsername === recipientUsername)
      .map((n) => ({ ...n }))
  }

  async findByTicketAndType(ticketId: string, type: string): Promise<DbNotification[]> {
    return Array.from(this.items.values())
      .filter((n) => n.ticketId === ticketId && n.type === type)
      .map((n) => ({ ...n }))
  }

  async findExistingKeys(ticketIds: readonly string[], type: string): Promise<Set<string>> {
    const wanted = new Set(ticketIds)
    const keys = new Set<string>()
    for (const n of this.items.values()) {
      if (n.type === type && n.ticketId && wanted.has(n.ticketId)) keys.add(n.ticketId)
    }
    return keys
  }

  async save(notification: DbNotification): Promise<void> {
    this.items.set(notification.id, { ...notification })
  }

  async saveMany(notifications: readonly DbNotification[]): Promise<void> {
    for (const notification of notifications) await this.save(notification)
  }

  async markAsRead(id: string): Promise<void> {
    const item = this.items.get(id)
    if (item) {
      item.isRead = true
    }
  }

  async markAllAsRead(recipientUsername: string): Promise<void> {
    for (const item of this.items.values()) {
      if (item.recipientUsername === recipientUsername) {
        item.isRead = true
      }
    }
  }
}

// In-memory implementation of audit log repository
export class InMemoryAuditLogRepository implements IAuditLogRepository {
  private readonly items: DbAuditLog[] = []

  async findAll(): Promise<DbAuditLog[]> {
    return this.items.map((log) => ({ ...log }))
  }

  async save(log: DbAuditLog): Promise<void> {
    this.items.push({ ...log })
  }
}

// In-memory implementation of device token registry
export class InMemoryDeviceTokenRepository implements IDeviceTokenRepository {
  private readonly items = new Map<string, DbDeviceToken>()

  async findByUsername(username: string): Promise<DbDeviceToken[]> {
    const normalized = username.trim().toLowerCase()
    return Array.from(this.items.values())
      .filter((t) => t.username.toLowerCase() === normalized)
      .map((t) => ({ ...t }))
  }

  async findByUsernames(usernames: readonly string[]): Promise<DbDeviceToken[]> {
    const wanted = new Set(usernames.map((username) => username.trim().toLowerCase()))
    return Array.from(this.items.values())
      .filter((t) => wanted.has(t.username.toLowerCase()))
      .map((t) => ({ ...t }))
  }

  async findAll(): Promise<DbDeviceToken[]> {
    return Array.from(this.items.values()).map((t) => ({ ...t }))
  }

  async save(deviceToken: DbDeviceToken): Promise<void> {
    this.items.set(deviceToken.token, { ...deviceToken })
  }

  async deleteByToken(token: string): Promise<void> {
    this.items.delete(token)
  }

  async deleteByTokens(tokens: readonly string[]): Promise<void> {
    for (const token of tokens) this.items.delete(token)
  }
}

// In-memory implementation of department transfer requests
export class InMemoryDepartmentTransferRepository implements IDepartmentTransferRepository {
  private readonly items = new Map<string, DbDepartmentTransfer>()

  async findById(id: string): Promise<DbDepartmentTransfer | null> {
    const found = this.items.get(id)
    return found ? { ...found } : null
  }

  async findLatestByMember(memberId: string): Promise<DbDepartmentTransfer | null> {
    const requests = [...this.items.values()].filter((item) => item.memberId === memberId)
    requests.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())
    return requests[0] ? { ...requests[0] } : null
  }

  async findPendingByMember(memberId: string): Promise<DbDepartmentTransfer | null> {
    const found = [...this.items.values()].find((item) => item.memberId === memberId && item.status === 'pending')
    return found ? { ...found } : null
  }

  async findPendingByFromDepartment(department: string): Promise<DbDepartmentTransfer[]> {
    return [...this.items.values()]
      .filter((item) => item.fromDepartment === department && item.status === 'pending')
      .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime())
      .map((item) => ({ ...item }))
  }

  async save(transfer: DbDepartmentTransfer): Promise<void> {
    this.items.set(transfer.id, { ...transfer })
  }
}

// Unified in-memory ticket store
export class InMemoryTicketStore implements ITicketStore {
  readonly tickets = new InMemoryTicketRepository()
  readonly members = new InMemoryMemberRepository()
  readonly templates = new InMemoryTemplateRepository()
  readonly departments = new InMemoryDepartmentRepository((currentName, nextName) =>
    this.cascadeDepartmentRename(currentName, nextName),
  )
  readonly slas = new InMemorySlaRepository()
  readonly notifications = new InMemoryNotificationRepository()
  readonly auditLogs = new InMemoryAuditLogRepository()
  readonly deviceTokens = new InMemoryDeviceTokenRepository()
  readonly departmentTransfers = new InMemoryDepartmentTransferRepository()

  private async cascadeDepartmentRename(currentName: string, nextName: string): Promise<void> {
    for (const member of await this.members.findAll()) {
      if (member.department === currentName) await this.members.save({ ...member, department: nextName })
    }
    for (const template of await this.templates.findAll()) {
      if (template.targetDepartment === currentName) await this.templates.save({ ...template, targetDepartment: nextName })
    }
    for (const ticket of await this.tickets.findAll()) {
      if (ticket.fromDepartment === currentName || ticket.toDepartment === currentName) {
        await this.tickets.save({
          ...ticket,
          fromDepartment: (ticket.fromDepartment === currentName ? nextName : ticket.fromDepartment) as Ticket['fromDepartment'],
          toDepartment: (ticket.toDepartment === currentName ? nextName : ticket.toDepartment) as Ticket['toDepartment'],
        })
      }
    }
  }
}
