import type { Ticket } from '@vtdesk/domain'

export interface DbMember {
  id: string
  username: string
  name: string
  department: string
  role: 'staff' | 'head' | 'admin'
  isDepartmentHead: boolean
  isActive: boolean
  passwordHash: string
  requiresPasswordChange: boolean
  email?: string
  receiveEmailNotifications: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface DbRequestTemplate {
  id: string
  targetDepartment: string
  title: string
  description: string
  purpose: string
  expectedResult: string
  defaultPriority: string
  isActive: boolean
}

export interface DbNotification {
  id: string
  recipientUsername: string
  ticketId?: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

export interface DbAuditLog {
  id: string
  actorUsername: string
  action: string
  entityType: string
  entityId: string
  details: string
  createdAt?: Date
}

export interface ITicketRepository {
  findById(id: string): Promise<Ticket | null>
  findAll(): Promise<Ticket[]>
  save(ticket: Ticket): Promise<void>
  delete(id: string): Promise<void>
}

export interface IMemberRepository {
  findById(id: string): Promise<DbMember | null>
  findByUsername(username: string): Promise<DbMember | null>
  findAll(): Promise<DbMember[]>
  save(member: DbMember): Promise<void>
}

export interface IDepartmentRepository {
  findAll(): Promise<string[]>
  create(name: string): Promise<void>
}

export interface ITemplateRepository {
  findAll(): Promise<DbRequestTemplate[]>
  findByDepartment(targetDepartment: string): Promise<DbRequestTemplate[]>
  save(template: DbRequestTemplate): Promise<void>
}

export interface INotificationRepository {
  findByRecipient(recipientUsername: string): Promise<DbNotification[]>
  findByTicketAndType(ticketId: string, type: string): Promise<DbNotification[]>
  save(notification: DbNotification): Promise<void>
  markAsRead(id: string): Promise<void>
  markAllAsRead(recipientUsername: string): Promise<void>
}

export interface IAuditLogRepository {
  findAll(): Promise<DbAuditLog[]>
  save(log: DbAuditLog): Promise<void>
}

export interface DbDefaultSla {
  readonly priority: string
  readonly responseHours: number
  readonly resolutionHours: number
}

export interface ISlaRepository {
  findAll(): Promise<DbDefaultSla[]>
  findByPriority(priority: string): Promise<DbDefaultSla | null>
  save(sla: DbDefaultSla): Promise<void>
}

export interface DbDeviceToken {
  readonly id: string
  readonly username: string
  readonly token: string
  readonly createdAt?: Date | string
}

export interface IDeviceTokenRepository {
  findByUsername(username: string): Promise<DbDeviceToken[]>
  findAll(): Promise<DbDeviceToken[]>
  save(deviceToken: DbDeviceToken): Promise<void>
  deleteByToken(token: string): Promise<void>
}

// Unified repository store facade separating domain operations from persistence driver
export interface ITicketStore {
  tickets: ITicketRepository
  members: IMemberRepository
  departments: IDepartmentRepository
  templates: ITemplateRepository
  slas: ISlaRepository
  notifications: INotificationRepository
  auditLogs: IAuditLogRepository
  deviceTokens: IDeviceTokenRepository
}
