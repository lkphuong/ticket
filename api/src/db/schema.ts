import { boolean, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

// Department registry holding canonical organization divisions
export const departments = pgTable('departments', {
  name: text('name').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// System accounts with authentication and authorization roles
export const members = pgTable('members', {
  id: varchar('id', { length: 64 }).primaryKey(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  name: text('name').notNull(),
  department: text('department').notNull().references(() => departments.name, { onDelete: 'restrict' }),
  role: varchar('role', { length: 20 }).notNull(), // 'staff' | 'head' | 'admin'
  isDepartmentHead: boolean('is_department_head').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  passwordHash: text('password_hash').notNull(),
  requiresPasswordChange: boolean('requires_password_change').notNull().default(false),
  email: varchar('email', { length: 255 }),
  receiveEmailNotifications: boolean('receive_email_notifications').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Central Ticket entities representing work requests
export const tickets = pgTable('tickets', {
  id: varchar('id', { length: 64 }).primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  purpose: text('purpose'),
  expectedResult: text('expected_result'),
  priority: varchar('priority', { length: 20 }).notNull(), // 'low' | 'medium' | 'high' | 'urgent'
  status: varchar('status', { length: 20 }).notNull(), // 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
  requesterName: text('requester_name').notNull(),
  fromDepartment: text('from_department').notNull().references(() => departments.name, { onDelete: 'restrict' }),
  toDepartment: text('to_department').notNull().references(() => departments.name, { onDelete: 'restrict' }),
  assigneeName: text('assignee_name'),
  dueDate: varchar('due_date', { length: 10 }), // YYYY-MM-DD
  rating: integer('rating'),
  feedback: text('feedback'),
  cancelReason: text('cancel_reason'),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('created_at_updated', { length: 64 }).notNull(),
})

// File attachment metadata associated with tickets
export const ticketAttachments = pgTable('ticket_attachments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  ticketId: varchar('ticket_id', { length: 64 }).notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sizeKb: integer('size_kb').notNull(),
})

// Discussion and clarification comments on tickets
export const ticketComments = pgTable('ticket_comments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  ticketId: varchar('ticket_id', { length: 64 }).notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  author: text('author').notNull(),
  department: text('department').notNull(),
  body: text('body').notNull(),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
})

// File attachments uploaded inside comment threads
export const commentAttachments = pgTable('comment_attachments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  commentId: varchar('comment_id', { length: 64 }).notNull().references(() => ticketComments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sizeKb: integer('size_kb').notNull(),
})

// Historical log of ticket lifecycle transitions
export const ticketStatusHistory = pgTable('ticket_status_history', {
  id: varchar('id', { length: 64 }).primaryKey(),
  ticketId: varchar('ticket_id', { length: 64 }).notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull(),
  at: varchar('at', { length: 64 }).notNull(),
  reason: text('reason'),
  actorName: text('actor_name'),
  actorDepartment: text('actor_department'),
})

// Historical log of specialist assignment changes
export const ticketAssignmentHistory = pgTable('ticket_assignment_history', {
  id: varchar('id', { length: 64 }).primaryKey(),
  ticketId: varchar('ticket_id', { length: 64 }).notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  fromAssignee: text('from_assignee'),
  toAssignee: text('to_assignee').notNull(),
  at: varchar('at', { length: 64 }).notNull(),
  actorName: text('actor_name'),
  actorDepartment: text('actor_department'),
})

// Request templates configured by administrators
export const requestTemplates = pgTable('request_templates', {
  id: varchar('id', { length: 64 }).primaryKey(),
  targetDepartment: text('target_department').notNull().references(() => departments.name, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  purpose: text('purpose').notNull(),
  expectedResult: text('expected_result').notNull(),
  defaultPriority: varchar('default_priority', { length: 20 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Default Service Level Agreement hours per priority
export const defaultSlas = pgTable('default_slas', {
  priority: varchar('priority', { length: 20 }).primaryKey(),
  responseHours: integer('response_hours').notNull(),
  resolutionHours: integer('resolution_hours').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// System notifications emitted on business workflow events
export const notifications = pgTable('notifications', {
  id: varchar('id', { length: 64 }).primaryKey(),
  recipientUsername: varchar('recipient_username', { length: 64 }).notNull(),
  ticketId: varchar('ticket_id', { length: 64 }),
  type: varchar('type', { length: 64 }).notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
})

// Immutable audit log recording administrative configuration changes
export const auditLogs = pgTable('audit_logs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  actorUsername: varchar('actor_username', { length: 64 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: varchar('entity_id', { length: 64 }).notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Registered device tokens for mobile and web push notifications via Firebase Cloud Messaging
export const deviceTokens = pgTable('device_tokens', {
  id: varchar('id', { length: 64 }).primaryKey(),
  username: varchar('username', { length: 64 }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
