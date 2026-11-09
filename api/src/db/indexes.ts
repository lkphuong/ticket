import type { Db } from 'mongodb'
import { COLLECTION_NAMES } from './schema.ts'

// Ensures all primary, unique, and compound indexes exist across MongoDB collections
export async function ensureMongoIndexes(db: Db): Promise<string[]> {
  const created: string[] = []

  // Department collection indexes enforcing uniqueness on names and ticket prefix abbreviations
  const deptColl = db.collection(COLLECTION_NAMES.DEPARTMENTS)
  await deptColl.createIndex({ name: 1 }, { unique: true })
  await deptColl.createIndex({ codePrefix: 1 }, { unique: true })
  created.push('indexes:departments')

  // Members collection indexes optimizing authentication lookups and department directory filtering
  const memberColl = db.collection(COLLECTION_NAMES.MEMBERS)
  await memberColl.createIndex({ username: 1 }, { unique: true })
  await memberColl.createIndex({ department: 1 })
  await memberColl.createIndex({ role: 1 })
  await memberColl.createIndex({ isActive: 1 })
  await memberColl.createIndex({ email: 1 }, { sparse: true })
  await memberColl.createIndex({ name: 1 })
  created.push('indexes:members')

  // Tickets collection indexes supporting high-throughput filtering, search, and visibility boundaries
  const ticketColl = db.collection(COLLECTION_NAMES.TICKETS)
  await ticketColl.createIndex({ code: 1 }, { unique: true })
  await ticketColl.createIndex({ fromDepartment: 1 })
  await ticketColl.createIndex({ toDepartment: 1 })
  await ticketColl.createIndex({ status: 1 })
  await ticketColl.createIndex({ priority: 1 })
  await ticketColl.createIndex({ requesterName: 1 })
  await ticketColl.createIndex({ assigneeName: 1 })
  await ticketColl.createIndex({ createdAt: -1 })
  await ticketColl.createIndex({ updatedAt: -1 })
  await ticketColl.createIndex({ toDepartment: 1, status: 1 })
  await ticketColl.createIndex({ fromDepartment: 1, status: 1 })
  // Visibility branches of the list query each pair a participant key with the default sort field
  await ticketColl.createIndex({ requesterName: 1, updatedAt: -1 })
  await ticketColl.createIndex({ assigneeName: 1, updatedAt: -1 })
  await ticketColl.createIndex({ toDepartment: 1, updatedAt: -1 })
  await ticketColl.createIndex({ fromDepartment: 1, updatedAt: -1 })
  // Deadline scan selects open tickets by status and due date
  await ticketColl.createIndex({ status: 1, dueDate: 1 })
  created.push('indexes:tickets')

  // Atomic sequence counter index preventing concurrent code collision
  const counterColl = db.collection(COLLECTION_NAMES.TICKET_CODE_COUNTERS)
  await counterColl.createIndex({ codePrefix: 1, period: 1 }, { unique: true })
  created.push('indexes:ticket_code_counters')

  // Request templates index supporting target department matching
  const templateColl = db.collection(COLLECTION_NAMES.REQUEST_TEMPLATES)
  await templateColl.createIndex({ targetDepartment: 1, isActive: 1 })
  created.push('indexes:request_templates')

  // Default SLAs priority uniqueness index
  const slaColl = db.collection(COLLECTION_NAMES.DEFAULT_SLAS)
  await slaColl.createIndex({ priority: 1 }, { unique: true })
  created.push('indexes:default_slas')

  // Notification stream indexes optimizing unread badge queries and deduplication checks
  const notifColl = db.collection(COLLECTION_NAMES.NOTIFICATIONS)
  await notifColl.createIndex({ recipientUsername: 1, isRead: 1, createdAt: -1 })
  await notifColl.createIndex({ ticketId: 1, type: 1 })
  created.push('indexes:notifications')

  // Audit logs query optimization
  const auditColl = db.collection(COLLECTION_NAMES.AUDIT_LOGS)
  await auditColl.createIndex({ actorUsername: 1 })
  await auditColl.createIndex({ createdAt: -1 })
  await auditColl.createIndex({ entityType: 1, entityId: 1 })
  created.push('indexes:audit_logs')

  // Device push tokens uniqueness index
  const deviceColl = db.collection(COLLECTION_NAMES.DEVICE_TOKENS)
  await deviceColl.createIndex({ token: 1 }, { unique: true })
  await deviceColl.createIndex({ username: 1 })
  created.push('indexes:device_tokens')

  return created
}
