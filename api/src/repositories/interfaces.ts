import type { Ticket, TicketFilters, Viewer } from '@vtdesk/domain'

// Hashed one-time verification code with its expiry, failed attempt counter and last send time
export interface MemberOtp {
  hash: string
  expiresAt: Date
  attempts: number
  sentAt: Date
}

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
  isVerified?: boolean
  otp?: MemberOtp
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

// Visibility, filters and clock that decide which tickets a list request returns
export interface TicketQuery {
  readonly viewer: Viewer
  readonly filters: TicketFilters
  readonly now: Date
}

export interface TicketPageRequest {
  // One based page number; a page past the end yields no items
  readonly page: number
  readonly limit: number
}

export interface TicketPageResult {
  readonly items: Ticket[]
  // Number of tickets matching the query across all pages
  readonly total: number
}

export interface DepartmentWithPrefix {
  readonly name: string
  readonly codePrefix: string
}

export interface ITicketRepository {
  findById(id: string): Promise<Ticket | null>
  findAll(): Promise<Ticket[]>
  save(ticket: Ticket): Promise<void>
  // Persists many tickets in a single round trip
  saveMany(tickets: readonly Ticket[]): Promise<void>
  delete(id: string): Promise<void>
  // Returns one page of the tickets the viewer may see, filtered and sorted by the query
  findPage(query: TicketQuery, page: TicketPageRequest): Promise<TicketPageResult>
  // Returns every ticket matching the query, for exports and aggregate reports
  findMatching(query: TicketQuery): Promise<Ticket[]>
  // Counts tickets the person raised or handles, identified by member name
  countInvolvingMember(memberName: string): Promise<number>
  // Counts tickets sent from or received by the department
  countByDepartment(department: string): Promise<number>
  // Returns open, in progress or waiting tickets handled by the person
  findActiveByAssignee(assigneeName: string): Promise<Ticket[]>
  // Returns open or in progress tickets whose due date is on or before the given YYYY-MM-DD date
  findDeadlineCandidates(latestDueDate: string): Promise<Ticket[]>
  // Reserves the next ticket code for a department prefix in the month of `now`
  allocateCode(codePrefix: string, now: Date): Promise<string>
}

export interface IMemberRepository {
  findById(id: string): Promise<DbMember | null>
  findByUsername(username: string): Promise<DbMember | null>
  findByEmail(email: string): Promise<DbMember | null>
  findByUsernames(usernames: readonly string[]): Promise<DbMember[]>
  findByNames(names: readonly string[]): Promise<DbMember[]>
  // Returns members holding a head role (role head or department head flag), optionally limited to departments
  findHeads(departments?: readonly string[]): Promise<DbMember[]>
  // Returns the member count of every department that has members
  countByDepartment(): Promise<Record<string, number>>
  findAll(): Promise<DbMember[]>
  save(member: DbMember): Promise<void>
  delete(id: string): Promise<void>
}

export interface IDepartmentRepository {
  findAll(): Promise<string[]>
  // Returns every department with its code prefix in one query
  findAllWithPrefix(): Promise<DepartmentWithPrefix[]>
  findCodePrefix(name: string): Promise<string | null>
  create(name: string, codePrefix: string): Promise<void>
  // Renames and re-prefixes a department; records referencing the old name follow the new one
  update(currentName: string, next: { name: string; codePrefix: string }): Promise<void>
  delete(name: string): Promise<void>
}

export interface ITemplateRepository {
  findAll(): Promise<DbRequestTemplate[]>
  findByDepartment(targetDepartment: string): Promise<DbRequestTemplate[]>
  save(template: DbRequestTemplate): Promise<void>
}

export interface INotificationRepository {
  findByRecipient(recipientUsername: string): Promise<DbNotification[]>
  findByTicketAndType(ticketId: string, type: string): Promise<DbNotification[]>
  // Returns the ids of tickets that already have a notification of the given type
  findExistingKeys(ticketIds: readonly string[], type: string): Promise<Set<string>>
  save(notification: DbNotification): Promise<void>
  saveMany(notifications: readonly DbNotification[]): Promise<void>
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
  findByUsernames(usernames: readonly string[]): Promise<DbDeviceToken[]>
  findAll(): Promise<DbDeviceToken[]>
  save(deviceToken: DbDeviceToken): Promise<void>
  deleteByToken(token: string): Promise<void>
  deleteByTokens(tokens: readonly string[]): Promise<void>
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
