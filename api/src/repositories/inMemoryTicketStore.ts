import type { Ticket } from '@vtdesk/domain'
import type {
  DbAuditLog,
  DbDefaultSla,
  DbDeviceToken,
  DbMember,
  DbNotification,
  DbRequestTemplate,
  IAuditLogRepository,
  IDepartmentRepository,
  IDeviceTokenRepository,
  IMemberRepository,
  INotificationRepository,
  ISlaRepository,
  ITemplateRepository,
  ITicketRepository,
  ITicketStore,
} from './interfaces.ts'

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

  async delete(id: string): Promise<void> {
    this.items.delete(id)
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

  async findAll(): Promise<DbMember[]> {
    return Array.from(this.items.values()).map((m) => ({ ...m }))
  }

  async save(member: DbMember): Promise<void> {
    this.items.set(member.id, { ...member })
  }
}

// In-memory implementation of department repository
export class InMemoryDepartmentRepository implements IDepartmentRepository {
  private readonly items = new Set<string>()

  async findAll(): Promise<string[]> {
    return Array.from(this.items)
  }

  async create(name: string): Promise<void> {
    this.items.add(name)
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

  async save(notification: DbNotification): Promise<void> {
    this.items.set(notification.id, { ...notification })
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

  async findAll(): Promise<DbDeviceToken[]> {
    return Array.from(this.items.values()).map((t) => ({ ...t }))
  }

  async save(deviceToken: DbDeviceToken): Promise<void> {
    this.items.set(deviceToken.token, { ...deviceToken })
  }

  async deleteByToken(token: string): Promise<void> {
    this.items.delete(token)
  }
}

// Unified in-memory ticket store
export class InMemoryTicketStore implements ITicketStore {
  readonly tickets = new InMemoryTicketRepository()
  readonly members = new InMemoryMemberRepository()
  readonly departments = new InMemoryDepartmentRepository()
  readonly templates = new InMemoryTemplateRepository()
  readonly slas = new InMemorySlaRepository()
  readonly notifications = new InMemoryNotificationRepository()
  readonly auditLogs = new InMemoryAuditLogRepository()
  readonly deviceTokens = new InMemoryDeviceTokenRepository()
}
