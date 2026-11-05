import { eq } from 'drizzle-orm'
import type { Department, Ticket, TicketAssignmentChange, TicketAttachment, TicketComment, TicketPriority, TicketStatus, TicketStatusChange } from '@vtdesk/domain'
import * as schema from '../db/schema.ts'
import type {
  DbAuditLog,
  DbDefaultSla,
  DbMember,
  DbNotification,
  DbRequestTemplate,
  IAuditLogRepository,
  IDepartmentRepository,
  IMemberRepository,
  INotificationRepository,
  ISlaRepository,
  ITemplateRepository,
  ITicketRepository,
  ITicketStore,
} from './interfaces.ts'

// Generic query executor interface compatible across Drizzle Postgres drivers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDrizzleDb = any

export class PostgresTicketRepository implements ITicketRepository {
  constructor(private readonly db: AnyDrizzleDb) {}

  async findById(id: string): Promise<Ticket | null> {
    const rawTickets = await this.db.select().from(schema.tickets).where(eq(schema.tickets.id, id))
    if (!rawTickets || rawTickets.length === 0) return null
    const row = rawTickets[0]

    const [attachments, comments, statusHistory, assignmentHistory] = await Promise.all([
      this.db.select().from(schema.ticketAttachments).where(eq(schema.ticketAttachments.ticketId, id)),
      this.db.select().from(schema.ticketComments).where(eq(schema.ticketComments.ticketId, id)),
      this.db.select().from(schema.ticketStatusHistory).where(eq(schema.ticketStatusHistory.ticketId, id)),
      this.db.select().from(schema.ticketAssignmentHistory).where(eq(schema.ticketAssignmentHistory.ticketId, id)),
    ])

    // Load comment attachments for nested discussion threads
    const parsedComments: TicketComment[] = []
    for (const comment of comments) {
      const commentAtts = await this.db
        .select()
        .from(schema.commentAttachments)
        .where(eq(schema.commentAttachments.commentId, comment.id))

      parsedComments.push({
        id: comment.id,
        author: comment.author,
        department: comment.department as Department,
        body: comment.body,
        createdAt: comment.createdAt,
        attachments: commentAtts.length > 0 ? commentAtts.map((a: { name: string; sizeKb: number }) => ({ name: a.name, sizeKb: a.sizeKb })) : undefined,
      })
    }

    const domainAttachments: TicketAttachment[] = attachments.map((a: { name: string; sizeKb: number }) => ({
      name: a.name,
      sizeKb: a.sizeKb,
    }))

    const parsedStatusHistory: TicketStatusChange[] = statusHistory.map((s: { status: string; at: string; reason: string | null; actorName: string | null; actorDepartment: string | null }) => ({
      status: s.status as TicketStatus,
      at: s.at,
      reason: s.reason ?? undefined,
      actor: s.actorName && s.actorDepartment ? { name: s.actorName, department: s.actorDepartment as Department } : undefined,
    }))

    const parsedAssignmentHistory: TicketAssignmentChange[] = assignmentHistory.map((a: { fromAssignee: string | null; toAssignee: string; at: string; actorName: string | null; actorDepartment: string | null }) => ({
      from: a.fromAssignee ?? undefined,
      to: a.toAssignee,
      at: a.at,
      actor: a.actorName && a.actorDepartment ? { name: a.actorName, department: a.actorDepartment as Department } : undefined,
    }))

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      purpose: row.purpose ?? undefined,
      expectedResult: row.expectedResult ?? undefined,
      priority: row.priority as TicketPriority,
      status: row.status as TicketStatus,
      requesterName: row.requesterName,
      fromDepartment: row.fromDepartment as Department,
      toDepartment: row.toDepartment as Department,
      assigneeName: row.assigneeName ?? undefined,
      attachments: domainAttachments,
      rating: row.rating ?? undefined,
      feedback: row.feedback ?? undefined,
      cancelReason: row.cancelReason ?? undefined,
      dueDate: row.dueDate ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      comments: parsedComments,
      statusHistory: parsedStatusHistory.length > 0 ? parsedStatusHistory : undefined,
      assignmentHistory: parsedAssignmentHistory.length > 0 ? parsedAssignmentHistory : undefined,
    }
  }

  async findAll(): Promise<Ticket[]> {
    const rawTickets = await this.db.select().from(schema.tickets)
    const result: Ticket[] = []
    for (const raw of rawTickets) {
      const ticket = await this.findById(raw.id)
      if (ticket) result.push(ticket)
    }
    return result
  }

  async save(ticket: Ticket): Promise<void> {
    const existing = await this.db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id))

    const ticketValues = {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      purpose: ticket.purpose ?? null,
      expectedResult: ticket.expectedResult ?? null,
      priority: ticket.priority,
      status: ticket.status,
      requesterName: ticket.requesterName,
      fromDepartment: ticket.fromDepartment,
      toDepartment: ticket.toDepartment,
      assigneeName: ticket.assigneeName ?? null,
      dueDate: ticket.dueDate ?? null,
      rating: ticket.rating ?? null,
      feedback: ticket.feedback ?? null,
      cancelReason: ticket.cancelReason ?? null,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    }

    if (existing.length === 0) {
      await this.db.insert(schema.tickets).values(ticketValues)
    } else {
      await this.db.update(schema.tickets).set(ticketValues).where(eq(schema.tickets.id, ticket.id))
    }

    // Synchronize ticket attachments
    await this.db.delete(schema.ticketAttachments).where(eq(schema.ticketAttachments.ticketId, ticket.id))
    if (ticket.attachments && ticket.attachments.length > 0) {
      for (let i = 0; i < ticket.attachments.length; i++) {
        const att = ticket.attachments[i]
        await this.db.insert(schema.ticketAttachments).values({
          id: `${ticket.id}-att-${i}`,
          ticketId: ticket.id,
          name: att.name,
          sizeKb: att.sizeKb,
        })
      }
    }

    // Synchronize comments and comment attachments
    await this.db.delete(schema.ticketComments).where(eq(schema.ticketComments.ticketId, ticket.id))
    if (ticket.comments && ticket.comments.length > 0) {
      for (const comment of ticket.comments) {
        await this.db.insert(schema.ticketComments).values({
          id: comment.id,
          ticketId: ticket.id,
          author: comment.author,
          department: comment.department,
          body: comment.body,
          createdAt: comment.createdAt,
        })

        if (comment.attachments && comment.attachments.length > 0) {
          for (let k = 0; k < comment.attachments.length; k++) {
            const cAtt = comment.attachments[k]
            await this.db.insert(schema.commentAttachments).values({
              id: `${comment.id}-att-${k}`,
              commentId: comment.id,
              name: cAtt.name,
              sizeKb: cAtt.sizeKb,
            })
          }
        }
      }
    }

    // Synchronize status history
    await this.db.delete(schema.ticketStatusHistory).where(eq(schema.ticketStatusHistory.ticketId, ticket.id))
    if (ticket.statusHistory && ticket.statusHistory.length > 0) {
      for (let i = 0; i < ticket.statusHistory.length; i++) {
        const sh = ticket.statusHistory[i]
        await this.db.insert(schema.ticketStatusHistory).values({
          id: `${ticket.id}-sh-${i}`,
          ticketId: ticket.id,
          status: sh.status,
          at: sh.at,
          reason: sh.reason ?? null,
          actorName: sh.actor?.name ?? null,
          actorDepartment: sh.actor?.department ?? null,
        })
      }
    }

    // Synchronize assignment history
    await this.db.delete(schema.ticketAssignmentHistory).where(eq(schema.ticketAssignmentHistory.ticketId, ticket.id))
    if (ticket.assignmentHistory && ticket.assignmentHistory.length > 0) {
      for (let i = 0; i < ticket.assignmentHistory.length; i++) {
        const ah = ticket.assignmentHistory[i]
        await this.db.insert(schema.ticketAssignmentHistory).values({
          id: `${ticket.id}-ah-${i}`,
          ticketId: ticket.id,
          fromAssignee: ah.from ?? null,
          toAssignee: ah.to,
          at: ah.at,
          actorName: ah.actor?.name ?? null,
          actorDepartment: ah.actor?.department ?? null,
        })
      }
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.tickets).where(eq(schema.tickets.id, id))
  }
}

export class PostgresMemberRepository implements IMemberRepository {
  constructor(private readonly db: AnyDrizzleDb) {}

  async findById(id: string): Promise<DbMember | null> {
    const rows = await this.db.select().from(schema.members).where(eq(schema.members.id, id))
    if (rows.length === 0) return null
    return this.mapRow(rows[0])
  }

  async findByUsername(username: string): Promise<DbMember | null> {
    const rows = await this.db.select().from(schema.members).where(eq(schema.members.username, username.trim().toLowerCase()))
    if (rows.length === 0) return null
    return this.mapRow(rows[0])
  }

  async findAll(): Promise<DbMember[]> {
    const rows = await this.db.select().from(schema.members)
    return rows.map((r: any) => this.mapRow(r))
  }

  async save(member: DbMember): Promise<void> {
    const existing = await this.db.select().from(schema.members).where(eq(schema.members.id, member.id))
    const values = {
      id: member.id,
      username: member.username.trim().toLowerCase(),
      name: member.name,
      department: member.department,
      role: member.role,
      isDepartmentHead: member.isDepartmentHead,
      isActive: member.isActive,
      passwordHash: member.passwordHash,
      requiresPasswordChange: member.requiresPasswordChange,
      email: member.email ?? null,
      receiveEmailNotifications: member.receiveEmailNotifications,
      updatedAt: new Date(),
    }

    if (existing.length === 0) {
      await this.db.insert(schema.members).values(values)
    } else {
      await this.db.update(schema.members).set(values).where(eq(schema.members.id, member.id))
    }
  }

  private mapRow(row: any): DbMember {
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      department: row.department,
      role: row.role as 'staff' | 'head' | 'admin',
      isDepartmentHead: row.isDepartmentHead,
      isActive: row.isActive,
      passwordHash: row.passwordHash,
      requiresPasswordChange: row.requiresPasswordChange,
      email: row.email ?? undefined,
      receiveEmailNotifications: row.receiveEmailNotifications,
      createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
    }
  }
}

export class PostgresDepartmentRepository implements IDepartmentRepository {
  constructor(private readonly db: AnyDrizzleDb) {}

  async findAll(): Promise<string[]> {
    const rows = await this.db.select().from(schema.departments)
    return rows.map((r: { name: string }) => r.name)
  }

  async create(name: string): Promise<void> {
    const existing = await this.db.select().from(schema.departments).where(eq(schema.departments.name, name))
    if (existing.length === 0) {
      await this.db.insert(schema.departments).values({ name })
    }
  }
}

export class PostgresTemplateRepository implements ITemplateRepository {
  constructor(private readonly db: AnyDrizzleDb) {}

  async findAll(): Promise<DbRequestTemplate[]> {
    const rows = await this.db.select().from(schema.requestTemplates)
    return rows.map((r: any) => ({
      id: r.id,
      targetDepartment: r.targetDepartment,
      title: r.title,
      description: r.description,
      purpose: r.purpose,
      expectedResult: r.expectedResult,
      defaultPriority: r.defaultPriority,
      isActive: r.isActive,
    }))
  }

  async findByDepartment(targetDepartment: string): Promise<DbRequestTemplate[]> {
    const rows = await this.db.select().from(schema.requestTemplates).where(eq(schema.requestTemplates.targetDepartment, targetDepartment))
    return rows.map((r: any) => ({
      id: r.id,
      targetDepartment: r.targetDepartment,
      title: r.title,
      description: r.description,
      purpose: r.purpose,
      expectedResult: r.expectedResult,
      defaultPriority: r.defaultPriority,
      isActive: r.isActive,
    }))
  }

  async save(template: DbRequestTemplate): Promise<void> {
    const existing = await this.db.select().from(schema.requestTemplates).where(eq(schema.requestTemplates.id, template.id))
    const values = {
      id: template.id,
      targetDepartment: template.targetDepartment,
      title: template.title,
      description: template.description,
      purpose: template.purpose,
      expectedResult: template.expectedResult,
      defaultPriority: template.defaultPriority,
      isActive: template.isActive,
      updatedAt: new Date(),
    }
    if (existing.length === 0) {
      await this.db.insert(schema.requestTemplates).values(values)
    } else {
      await this.db.update(schema.requestTemplates).set(values).where(eq(schema.requestTemplates.id, template.id))
    }
  }
}

export class PostgresSlaRepository implements ISlaRepository {
  constructor(private readonly db: AnyDrizzleDb) {}

  async findAll(): Promise<DbDefaultSla[]> {
    const rows = await this.db.select().from(schema.defaultSlas)
    return rows.map((r: any) => ({
      priority: r.priority,
      responseHours: r.responseHours,
      resolutionHours: r.resolutionHours,
    }))
  }

  async findByPriority(priority: string): Promise<DbDefaultSla | null> {
    const rows = await this.db.select().from(schema.defaultSlas).where(eq(schema.defaultSlas.priority, priority))
    if (rows.length === 0) return null
    return {
      priority: rows[0].priority,
      responseHours: rows[0].responseHours,
      resolutionHours: rows[0].resolutionHours,
    }
  }

  async save(sla: DbDefaultSla): Promise<void> {
    const existing = await this.db.select().from(schema.defaultSlas).where(eq(schema.defaultSlas.priority, sla.priority))
    const values = {
      priority: sla.priority,
      responseHours: sla.responseHours,
      resolutionHours: sla.resolutionHours,
      updatedAt: new Date(),
    }
    if (existing.length === 0) {
      await this.db.insert(schema.defaultSlas).values(values)
    } else {
      await this.db.update(schema.defaultSlas).set(values).where(eq(schema.defaultSlas.priority, sla.priority))
    }
  }
}

export class PostgresNotificationRepository implements INotificationRepository {
  constructor(private readonly db: AnyDrizzleDb) {}

  async findByRecipient(recipientUsername: string): Promise<DbNotification[]> {
    const rows = await this.db.select().from(schema.notifications).where(eq(schema.notifications.recipientUsername, recipientUsername))
    return rows.map((r: any) => ({
      id: r.id,
      recipientUsername: r.recipientUsername,
      ticketId: r.ticketId ?? undefined,
      type: r.type,
      title: r.title,
      body: r.body,
      isRead: r.isRead,
      createdAt: r.createdAt,
    }))
  }

  async save(notification: DbNotification): Promise<void> {
    const existing = await this.db.select().from(schema.notifications).where(eq(schema.notifications.id, notification.id))
    const values = {
      id: notification.id,
      recipientUsername: notification.recipientUsername,
      ticketId: notification.ticketId ?? null,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    }
    if (existing.length === 0) {
      await this.db.insert(schema.notifications).values(values)
    } else {
      await this.db.update(schema.notifications).set(values).where(eq(schema.notifications.id, notification.id))
    }
  }

  async markAsRead(id: string): Promise<void> {
    await this.db.update(schema.notifications).set({ isRead: true }).where(eq(schema.notifications.id, id))
  }

  async markAllAsRead(recipientUsername: string): Promise<void> {
    await this.db.update(schema.notifications).set({ isRead: true }).where(eq(schema.notifications.recipientUsername, recipientUsername))
  }
}

export class PostgresAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: AnyDrizzleDb) {}

  async findAll(): Promise<DbAuditLog[]> {
    const rows = await this.db.select().from(schema.auditLogs)
    return rows.map((r: any) => ({
      id: r.id,
      actorUsername: r.actorUsername,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      details: r.details,
      createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
    }))
  }

  async save(log: DbAuditLog): Promise<void> {
    await this.db.insert(schema.auditLogs).values({
      id: log.id,
      actorUsername: log.actorUsername,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.details,
    })
  }
}

// Unified PostgreSQL store implementation implementing ITicketStore
export class PostgresTicketStore implements ITicketStore {
  readonly tickets: PostgresTicketRepository
  readonly members: PostgresMemberRepository
  readonly departments: PostgresDepartmentRepository
  readonly templates: PostgresTemplateRepository
  readonly slas: PostgresSlaRepository
  readonly notifications: PostgresNotificationRepository
  readonly auditLogs: PostgresAuditLogRepository

  constructor(db: AnyDrizzleDb) {
    this.tickets = new PostgresTicketRepository(db)
    this.members = new PostgresMemberRepository(db)
    this.departments = new PostgresDepartmentRepository(db)
    this.templates = new PostgresTemplateRepository(db)
    this.slas = new PostgresSlaRepository(db)
    this.notifications = new PostgresNotificationRepository(db)
    this.auditLogs = new PostgresAuditLogRepository(db)
  }
}
