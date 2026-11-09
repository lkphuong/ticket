import { MongoServerError } from 'mongodb'
import type { Collection, Db, Document } from 'mongodb'
import { ACTIVE_STATUSES, formatTicketCode, formatTicketPeriod, parseTicketCode } from '@vtdesk/domain'
import type { Department, Ticket, TicketAssignmentChange, TicketAttachment, TicketComment, TicketPriority, TicketStatus, TicketStatusChange } from '@vtdesk/domain'
import {
  COLLECTION_NAMES,
  type AuditLogDocument,
  type DefaultSlaDocument,
  type DepartmentDocument,
  type DeviceTokenDocument,
  type MemberDocument,
  type NotificationDocument,
  type RequestTemplateDocument,
  type TicketCodeCounterDocument,
  type MemberOtpDocument,
  type TicketDocument,
  type TicketEmbeddedAttachment,
} from '../db/schema.ts'
import { buildTicketFilter, buildTicketSortStages } from './ticketQueryBuilder.ts'
import type {
  DbAuditLog,
  DbDefaultSla,
  DbDeviceToken,
  DbMember,
  DbNotification,
  DbRequestTemplate,
  DepartmentWithPrefix,
  IAuditLogRepository,
  IDepartmentRepository,
  IDeviceTokenRepository,
  IMemberRepository,
  INotificationRepository,
  ISlaRepository,
  ITemplateRepository,
  ITicketRepository,
  ITicketStore,
  MemberOtp,
  TicketPageRequest,
  TicketPageResult,
  TicketQuery,
} from './interfaces.ts'

// MongoDB repository implementing ticket lifecycle persistence and embedded document aggregation
// MongoServerError code raised when a unique index rejects a duplicate key
const DUPLICATE_KEY_ERROR_CODE = 11000
const DEADLINE_CANDIDATE_STATUSES = ['open', 'in_progress']

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === DUPLICATE_KEY_ERROR_CODE
}

export class MongoTicketRepository implements ITicketRepository {
  private readonly collection: Collection<TicketDocument>
  private readonly counters: Collection<TicketCodeCounterDocument>

  constructor(db: Db) {
    this.collection = db.collection<TicketDocument>(COLLECTION_NAMES.TICKETS)
    this.counters = db.collection<TicketCodeCounterDocument>(COLLECTION_NAMES.TICKET_CODE_COUNTERS)
  }

  async findById(id: string): Promise<Ticket | null> {
    const doc = await this.collection.findOne({ _id: id })
    if (!doc) return null
    return this.mapDocumentToTicket(doc)
  }

  async findAll(): Promise<Ticket[]> {
    const docs = await this.collection.find({}).toArray()
    return docs.map((doc) => this.mapDocumentToTicket(doc))
  }

  async save(ticket: Ticket): Promise<void> {
    await this.collection.replaceOne({ _id: ticket.id }, this.mapTicketToDocument(ticket), { upsert: true })
  }

  async saveMany(tickets: readonly Ticket[]): Promise<void> {
    if (tickets.length === 0) return
    await this.collection.bulkWrite(
      tickets.map((ticket) => ({
        replaceOne: { filter: { _id: ticket.id }, replacement: this.mapTicketToDocument(ticket), upsert: true },
      })),
    )
  }

  async findPage(query: TicketQuery, page: TicketPageRequest): Promise<TicketPageResult> {
    const filter = buildTicketFilter(query)
    const offset = (page.page - 1) * page.limit
    const [docs, total] = await Promise.all([
      this.collection
        .aggregate<TicketDocument>([
          { $match: filter as Document },
          ...buildTicketSortStages(query.filters.sort),
          { $skip: offset },
          { $limit: page.limit },
        ])
        .toArray(),
      this.collection.countDocuments(filter),
    ])
    return { items: docs.map((doc) => this.mapDocumentToTicket(doc)), total }
  }

  async findMatching(query: TicketQuery): Promise<Ticket[]> {
    const docs = await this.collection
      .aggregate<TicketDocument>([{ $match: buildTicketFilter(query) as Document }, ...buildTicketSortStages(query.filters.sort)])
      .toArray()
    return docs.map((doc) => this.mapDocumentToTicket(doc))
  }

  async countInvolvingMember(memberName: string): Promise<number> {
    return this.collection.countDocuments({ $or: [{ requesterName: memberName }, { assigneeName: memberName }] })
  }

  async countByDepartment(department: string): Promise<number> {
    return this.collection.countDocuments({ $or: [{ fromDepartment: department }, { toDepartment: department }] })
  }

  async findActiveByAssignee(assigneeName: string): Promise<Ticket[]> {
    const docs = await this.collection.find({ assigneeName, status: { $in: [...ACTIVE_STATUSES] } }).toArray()
    return docs.map((doc) => this.mapDocumentToTicket(doc))
  }

  async findDeadlineCandidates(latestDueDate: string): Promise<Ticket[]> {
    const docs = await this.collection
      .find({ status: { $in: DEADLINE_CANDIDATE_STATUSES }, dueDate: { $lte: latestDueDate } })
      .toArray()
    return docs.map((doc) => this.mapDocumentToTicket(doc))
  }

  private mapTicketToDocument(ticket: Ticket): TicketDocument {
    return {
      _id: ticket.id,
      code: ticket.code,
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
      attachments: ticket.attachments ? ticket.attachments.map(toEmbeddedAttachment) : [],
      comments: ticket.comments
        ? ticket.comments.map((c) => ({
            id: c.id,
            author: c.author,
            department: c.department,
            body: c.body,
            createdAt: c.createdAt,
            attachments: c.attachments ? c.attachments.map(toEmbeddedAttachment) : undefined,
          }))
        : [],
      statusHistory: ticket.statusHistory
        ? ticket.statusHistory.map((s) => ({
            status: s.status,
            at: s.at,
            reason: s.reason ?? undefined,
            actor: s.actor ? { name: s.actor.name, department: s.actor.department } : undefined,
          }))
        : [],
      assignmentHistory: ticket.assignmentHistory
        ? ticket.assignmentHistory.map((a) => ({
            from: a.from ?? undefined,
            to: a.to,
            at: a.at,
            actor: a.actor ? { name: a.actor.name, department: a.actor.department } : undefined,
          }))
        : [],
    }
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ _id: id })
  }

  // Summary: Initialize counter document to maximum existing ticket sequence if absent, then atomically increment by 1.
  async allocateCode(codePrefix: string, now: Date): Promise<string> {
    const period = formatTicketPeriod(now)
    const counterId = `${codePrefix}:${period}`
    const codeStem = `TCK-${codePrefix}-${period}-`

    // Verify if counter already exists in the collection
    const existing = await this.counters.findOne({ _id: counterId })
    if (!existing) {
      // Find highest existing sequence from tickets for this prefix and period
      const existingTickets = await this.collection
        .find({ code: { $regex: `^${codeStem}` } })
        .project<{ code: string }>({ code: 1 })
        .toArray()

      let maxSequence = 0
      for (let i = 0; i < existingTickets.length; i++) {
        const parsed = parseTicketCode(existingTickets[i].code)
        if (parsed && parsed.prefix === codePrefix && parsed.period === period) {
          if (parsed.sequence > maxSequence) {
            maxSequence = parsed.sequence
          }
        }
      }

      // Insert counter initialized to maxSequence; catch duplicate key if another concurrent worker inserted it
      try {
        await this.counters.insertOne({
          _id: counterId,
          codePrefix,
          period,
          lastSequence: maxSequence,
          updatedAt: new Date(),
        })
      } catch (error: unknown) {
        // A duplicate key means a concurrent allocator created the counter first, which is fine; anything else is a real failure
        if (!isDuplicateKeyError(error)) throw error
      }
    }

    // Atomically increment the sequence counter
    const result = await this.counters.findOneAndUpdate(
      { _id: counterId },
      {
        $inc: { lastSequence: 1 },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' },
    )

    if (!result) {
      throw new Error(`Failed to allocate ticket code sequence for ${counterId}`)
    }

    return formatTicketCode(codePrefix, period, result.lastSequence)
  }

  // Transforms persistent MongoDB document into validated domain aggregate
  private mapDocumentToTicket(doc: TicketDocument): Ticket {
    const comments: TicketComment[] = (doc.comments || []).map((c) => ({
      id: c.id,
      author: c.author,
      department: c.department as Department,
      body: c.body,
      createdAt: c.createdAt,
      attachments: c.attachments && c.attachments.length > 0 ? c.attachments.map(fromEmbeddedAttachment) : undefined,
    }))

    const attachments: TicketAttachment[] = (doc.attachments || []).map(fromEmbeddedAttachment)

    const statusHistory: TicketStatusChange[] = (doc.statusHistory || []).map((s) => ({
      status: s.status as TicketStatus,
      at: s.at,
      reason: s.reason ?? undefined,
      actor: s.actor ? { name: s.actor.name, department: s.actor.department as Department } : undefined,
    }))

    const assignmentHistory: TicketAssignmentChange[] = (doc.assignmentHistory || []).map((a) => ({
      from: a.from ?? undefined,
      to: a.to,
      at: a.at,
      actor: a.actor ? { name: a.actor.name, department: a.actor.department as Department } : undefined,
    }))

    return {
      id: doc._id,
      code: doc.code,
      title: doc.title,
      description: doc.description,
      purpose: doc.purpose ?? undefined,
      expectedResult: doc.expectedResult ?? undefined,
      priority: doc.priority as TicketPriority,
      status: doc.status as TicketStatus,
      requesterName: doc.requesterName,
      fromDepartment: doc.fromDepartment as Department,
      toDepartment: doc.toDepartment as Department,
      assigneeName: doc.assigneeName ?? undefined,
      attachments,
      rating: doc.rating ?? undefined,
      feedback: doc.feedback ?? undefined,
      cancelReason: doc.cancelReason ?? undefined,
      dueDate: doc.dueDate ?? undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      comments,
      statusHistory: statusHistory.length > 0 ? statusHistory : undefined,
      assignmentHistory: assignmentHistory.length > 0 ? assignmentHistory : undefined,
    }
  }
}

// MongoDB repository implementing user account and permission storage
export class MongoMemberRepository implements IMemberRepository {
  private readonly collection: Collection<MemberDocument>

  constructor(db: Db) {
    this.collection = db.collection<MemberDocument>(COLLECTION_NAMES.MEMBERS)
  }

  async findById(id: string): Promise<DbMember | null> {
    const doc = await this.collection.findOne({ _id: id })
    if (!doc) return null
    return this.mapDocumentToMember(doc)
  }

  async findByUsername(username: string): Promise<DbMember | null> {
    const normalized = username.trim().toLowerCase()
    const doc = await this.collection.findOne({ username: normalized })
    if (!doc) return null
    return this.mapDocumentToMember(doc)
  }

  async findByEmail(email: string): Promise<DbMember | null> {
    const doc = await this.collection.findOne({ email: email.trim().toLowerCase() })
    return doc ? this.mapDocumentToMember(doc) : null
  }

  async findByUsernames(usernames: readonly string[]): Promise<DbMember[]> {
    if (usernames.length === 0) return []
    const normalized = usernames.map((username) => username.trim().toLowerCase())
    const docs = await this.collection.find({ username: { $in: normalized } }).toArray()
    return docs.map((doc) => this.mapDocumentToMember(doc))
  }

  async findByNames(names: readonly string[]): Promise<DbMember[]> {
    if (names.length === 0) return []
    const docs = await this.collection.find({ name: { $in: [...names] } }).toArray()
    return docs.map((doc) => this.mapDocumentToMember(doc))
  }

  async findHeads(departments?: readonly string[]): Promise<DbMember[]> {
    if (departments && departments.length === 0) return []
    const headRole = { $or: [{ role: 'head' as const }, { isDepartmentHead: true }] }
    const filter = departments ? { ...headRole, department: { $in: [...departments] } } : headRole
    const docs = await this.collection.find(filter).toArray()
    return docs.map((doc) => this.mapDocumentToMember(doc))
  }

  async countByDepartment(): Promise<Record<string, number>> {
    const groups = await this.collection
      .aggregate<{ _id: string; count: number }>([{ $group: { _id: '$department', count: { $sum: 1 } } }])
      .toArray()
    return Object.fromEntries(groups.map((group) => [group._id, group.count]))
  }

  async findAll(): Promise<DbMember[]> {
    const docs = await this.collection.find({}).toArray()
    return docs.map((doc) => this.mapDocumentToMember(doc))
  }

  async save(member: DbMember): Promise<void> {
    const doc: MemberDocument = {
      _id: member.id,
      username: member.username.trim().toLowerCase(),
      name: member.name,
      department: member.department,
      role: member.role,
      isDepartmentHead: member.isDepartmentHead,
      isActive: member.isActive,
      passwordHash: member.passwordHash,
      requiresPasswordChange: member.requiresPasswordChange,
      email: member.email?.trim().toLowerCase() ?? null,
      receiveEmailNotifications: member.receiveEmailNotifications,
      isVerified: member.isVerified,
      otp: member.otp ? this.mapOtpToDocument(member.otp) : null,
      createdAt: member.createdAt ?? new Date(),
      updatedAt: new Date(),
    }
    await this.collection.replaceOne({ _id: member.id }, doc, { upsert: true })
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ _id: id })
  }

  private mapOtpToDocument(otp: MemberOtp): MemberOtpDocument {
    return { hash: otp.hash, expiresAt: otp.expiresAt, attempts: otp.attempts, sentAt: otp.sentAt }
  }

  private mapDocumentToOtp(doc: MemberOtpDocument): MemberOtp {
    return { hash: doc.hash, expiresAt: new Date(doc.expiresAt), attempts: doc.attempts, sentAt: new Date(doc.sentAt) }
  }

  private mapDocumentToMember(doc: MemberDocument): DbMember {
    return {
      id: doc._id,
      username: doc.username,
      name: doc.name,
      department: doc.department,
      role: doc.role,
      isDepartmentHead: doc.isDepartmentHead,
      isActive: doc.isActive,
      passwordHash: doc.passwordHash,
      requiresPasswordChange: doc.requiresPasswordChange,
      email: doc.email ?? undefined,
      receiveEmailNotifications: doc.receiveEmailNotifications,
      isVerified: doc.isVerified,
      otp: doc.otp ? this.mapDocumentToOtp(doc.otp) : undefined,
      createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : undefined,
    }
  }
}

// MongoDB repository implementing organization department registry with cascading rename
export class MongoDepartmentRepository implements IDepartmentRepository {
  private readonly collection: Collection<DepartmentDocument>

  constructor(private readonly db: Db) {
    this.collection = db.collection<DepartmentDocument>(COLLECTION_NAMES.DEPARTMENTS)
  }

  async findAll(): Promise<string[]> {
    const docs = await this.collection.find({}).toArray()
    return docs.map((d) => d.name)
  }

  async findAllWithPrefix(): Promise<DepartmentWithPrefix[]> {
    const docs = await this.collection.find({}).project<{ name: string; codePrefix: string }>({ name: 1, codePrefix: 1 }).toArray()
    return docs.map((doc) => ({ name: doc.name, codePrefix: doc.codePrefix }))
  }

  async findCodePrefix(name: string): Promise<string | null> {
    const doc = await this.collection.findOne({ name })
    return doc ? doc.codePrefix : null
  }

  async create(name: string, codePrefix: string): Promise<void> {
    await this.collection.updateOne(
      { name },
      {
        $setOnInsert: {
          _id: name,
          name,
          codePrefix,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    )
  }

  // Summary: Renames department document and cascades new name across members, tickets and templates collections.
  async update(currentName: string, next: { name: string; codePrefix: string }): Promise<void> {
    await this.collection.updateOne(
      { name: currentName },
      { $set: { name: next.name, codePrefix: next.codePrefix } },
    )

    if (currentName !== next.name) {
      await Promise.all([
        this.db.collection(COLLECTION_NAMES.MEMBERS).updateMany(
          { department: currentName },
          { $set: { department: next.name } },
        ),
        this.db.collection(COLLECTION_NAMES.TICKETS).updateMany(
          { fromDepartment: currentName },
          { $set: { fromDepartment: next.name } },
        ),
        this.db.collection(COLLECTION_NAMES.TICKETS).updateMany(
          { toDepartment: currentName },
          { $set: { toDepartment: next.name } },
        ),
        this.db.collection(COLLECTION_NAMES.REQUEST_TEMPLATES).updateMany(
          { targetDepartment: currentName },
          { $set: { targetDepartment: next.name } },
        ),
      ])
    }
  }

  async delete(name: string): Promise<void> {
    await this.collection.deleteOne({ name })
  }
}

// MongoDB repository implementing request template persistence
export class MongoTemplateRepository implements ITemplateRepository {
  private readonly collection: Collection<RequestTemplateDocument>

  constructor(db: Db) {
    this.collection = db.collection<RequestTemplateDocument>(COLLECTION_NAMES.REQUEST_TEMPLATES)
  }

  async findAll(): Promise<DbRequestTemplate[]> {
    const docs = await this.collection.find({}).toArray()
    return docs.map((d) => this.mapDocumentToTemplate(d))
  }

  async findByDepartment(targetDepartment: string): Promise<DbRequestTemplate[]> {
    const docs = await this.collection.find({ targetDepartment }).toArray()
    return docs.map((d) => this.mapDocumentToTemplate(d))
  }

  async save(template: DbRequestTemplate): Promise<void> {
    const doc: RequestTemplateDocument = {
      _id: template.id,
      targetDepartment: template.targetDepartment,
      title: template.title,
      description: template.description,
      purpose: template.purpose,
      expectedResult: template.expectedResult,
      defaultPriority: template.defaultPriority,
      isActive: template.isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await this.collection.replaceOne({ _id: template.id }, doc, { upsert: true })
  }

  private mapDocumentToTemplate(doc: RequestTemplateDocument): DbRequestTemplate {
    return {
      id: doc._id,
      targetDepartment: doc.targetDepartment,
      title: doc.title,
      description: doc.description,
      purpose: doc.purpose,
      expectedResult: doc.expectedResult,
      defaultPriority: doc.defaultPriority,
      isActive: doc.isActive,
    }
  }
}

// MongoDB repository implementing SLA parameter management
export class MongoSlaRepository implements ISlaRepository {
  private readonly collection: Collection<DefaultSlaDocument>

  constructor(db: Db) {
    this.collection = db.collection<DefaultSlaDocument>(COLLECTION_NAMES.DEFAULT_SLAS)
  }

  async findAll(): Promise<DbDefaultSla[]> {
    const docs = await this.collection.find({}).toArray()
    return docs.map((d) => ({
      priority: d.priority,
      responseHours: d.responseHours,
      resolutionHours: d.resolutionHours,
    }))
  }

  async findByPriority(priority: string): Promise<DbDefaultSla | null> {
    const doc = await this.collection.findOne({ priority })
    if (!doc) return null
    return {
      priority: doc.priority,
      responseHours: doc.responseHours,
      resolutionHours: doc.resolutionHours,
    }
  }

  async save(sla: DbDefaultSla): Promise<void> {
    const doc: DefaultSlaDocument = {
      _id: sla.priority,
      priority: sla.priority,
      responseHours: sla.responseHours,
      resolutionHours: sla.resolutionHours,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await this.collection.replaceOne({ _id: sla.priority }, doc, { upsert: true })
  }
}

// MongoDB repository implementing notification feed and read tracking
export class MongoNotificationRepository implements INotificationRepository {
  private readonly collection: Collection<NotificationDocument>

  constructor(db: Db) {
    this.collection = db.collection<NotificationDocument>(COLLECTION_NAMES.NOTIFICATIONS)
  }

  async findByRecipient(recipientUsername: string): Promise<DbNotification[]> {
    const docs = await this.collection.find({ recipientUsername }).sort({ createdAt: -1 }).toArray()
    return docs.map((d) => this.mapDocumentToNotification(d))
  }

  async findByTicketAndType(ticketId: string, type: string): Promise<DbNotification[]> {
    const docs = await this.collection.find({ ticketId, type }).toArray()
    return docs.map((d) => this.mapDocumentToNotification(d))
  }

  async findExistingKeys(ticketIds: readonly string[], type: string): Promise<Set<string>> {
    if (ticketIds.length === 0) return new Set()
    const existing = await this.collection.distinct('ticketId', { ticketId: { $in: [...ticketIds] }, type })
    return new Set(existing.filter((id): id is string => typeof id === 'string'))
  }

  async save(notification: DbNotification): Promise<void> {
    await this.collection.replaceOne({ _id: notification.id }, this.mapNotificationToDocument(notification), { upsert: true })
  }

  async saveMany(notifications: readonly DbNotification[]): Promise<void> {
    if (notifications.length === 0) return
    await this.collection.bulkWrite(
      notifications.map((notification) => ({
        replaceOne: {
          filter: { _id: notification.id },
          replacement: this.mapNotificationToDocument(notification),
          upsert: true,
        },
      })),
    )
  }

  private mapNotificationToDocument(notification: DbNotification): NotificationDocument {
    return {
      _id: notification.id,
      recipientUsername: notification.recipientUsername,
      ticketId: notification.ticketId ?? null,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    }
  }

  async markAsRead(id: string): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: { isRead: true } })
  }

  async markAllAsRead(recipientUsername: string): Promise<void> {
    await this.collection.updateMany({ recipientUsername }, { $set: { isRead: true } })
  }

  private mapDocumentToNotification(doc: NotificationDocument): DbNotification {
    return {
      id: doc._id,
      recipientUsername: doc.recipientUsername,
      ticketId: doc.ticketId ?? undefined,
      type: doc.type,
      title: doc.title,
      body: doc.body,
      isRead: doc.isRead,
      createdAt: doc.createdAt,
    }
  }
}

// MongoDB repository implementing append-only administrative audit log
export class MongoAuditLogRepository implements IAuditLogRepository {
  private readonly collection: Collection<AuditLogDocument>

  constructor(db: Db) {
    this.collection = db.collection<AuditLogDocument>(COLLECTION_NAMES.AUDIT_LOGS)
  }

  async findAll(): Promise<DbAuditLog[]> {
    const docs = await this.collection.find({}).sort({ createdAt: -1 }).toArray()
    return docs.map((d) => ({
      id: d._id,
      actorUsername: d.actorUsername,
      action: d.action,
      entityType: d.entityType,
      entityId: d.entityId,
      details: d.details,
      createdAt: d.createdAt ? new Date(d.createdAt) : undefined,
    }))
  }

  async save(log: DbAuditLog): Promise<void> {
    const doc: AuditLogDocument = {
      _id: log.id,
      actorUsername: log.actorUsername,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.details,
      createdAt: log.createdAt ?? new Date(),
    }
    await this.collection.insertOne(doc)
  }
}

// MongoDB repository implementing device push token registry
export class MongoDeviceTokenRepository implements IDeviceTokenRepository {
  private readonly collection: Collection<DeviceTokenDocument>

  constructor(db: Db) {
    this.collection = db.collection<DeviceTokenDocument>(COLLECTION_NAMES.DEVICE_TOKENS)
  }

  async findByUsername(username: string): Promise<DbDeviceToken[]> {
    const docs = await this.collection.find({ username }).toArray()
    return docs.map((d) => ({
      id: d._id,
      username: d.username,
      token: d.token,
      createdAt: d.createdAt ? new Date(d.createdAt) : undefined,
    }))
  }

  async findByUsernames(usernames: readonly string[]): Promise<DbDeviceToken[]> {
    if (usernames.length === 0) return []
    const docs = await this.collection.find({ username: { $in: [...usernames] } }).toArray()
    return docs.map((d) => ({
      id: d._id,
      username: d.username,
      token: d.token,
      createdAt: d.createdAt ? new Date(d.createdAt) : undefined,
    }))
  }

  async findAll(): Promise<DbDeviceToken[]> {
    const docs = await this.collection.find({}).toArray()
    return docs.map((d) => ({
      id: d._id,
      username: d.username,
      token: d.token,
      createdAt: d.createdAt ? new Date(d.createdAt) : undefined,
    }))
  }

  async save(deviceToken: DbDeviceToken): Promise<void> {
    await this.collection.updateOne(
      { token: deviceToken.token },
      {
        $setOnInsert: {
          _id: deviceToken.id,
          username: deviceToken.username,
          token: deviceToken.token,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    )
  }

  async deleteByToken(token: string): Promise<void> {
    await this.collection.deleteOne({ token })
  }

  async deleteByTokens(tokens: readonly string[]): Promise<void> {
    if (tokens.length === 0) return
    await this.collection.deleteMany({ token: { $in: [...tokens] } })
  }
}

// Unified MongoDB store facade implementing ITicketStore
// Optional fields are omitted rather than stored as null so legacy name-only attachments round-trip unchanged
function toEmbeddedAttachment(a: TicketAttachment): TicketEmbeddedAttachment {
  return { name: a.name, sizeKb: a.sizeKb, ...(a.id && { id: a.id }), ...(a.mimeType && { mimeType: a.mimeType }) }
}

function fromEmbeddedAttachment(a: TicketEmbeddedAttachment): TicketAttachment {
  return { name: a.name, sizeKb: a.sizeKb, ...(a.id && { id: a.id }), ...(a.mimeType && { mimeType: a.mimeType }) }
}

export class MongoTicketStore implements ITicketStore {
  readonly tickets: MongoTicketRepository
  readonly members: MongoMemberRepository
  readonly departments: MongoDepartmentRepository
  readonly templates: MongoTemplateRepository
  readonly slas: MongoSlaRepository
  readonly notifications: MongoNotificationRepository
  readonly auditLogs: MongoAuditLogRepository
  readonly deviceTokens: MongoDeviceTokenRepository

  constructor(db: Db) {
    this.tickets = new MongoTicketRepository(db)
    this.members = new MongoMemberRepository(db)
    this.departments = new MongoDepartmentRepository(db)
    this.templates = new MongoTemplateRepository(db)
    this.slas = new MongoSlaRepository(db)
    this.notifications = new MongoNotificationRepository(db)
    this.auditLogs = new MongoAuditLogRepository(db)
    this.deviceTokens = new MongoDeviceTokenRepository(db)
  }
}
