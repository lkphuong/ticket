// Canonical MongoDB collection names
export const COLLECTION_NAMES = {
  DEPARTMENTS: 'departments',
  MEMBERS: 'members',
  TICKETS: 'tickets',
  TICKET_CODE_COUNTERS: 'ticket_code_counters',
  REQUEST_TEMPLATES: 'request_templates',
  DEFAULT_SLAS: 'default_slas',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'audit_logs',
  DEVICE_TOKENS: 'device_tokens',
} as const

export type CollectionName = (typeof COLLECTION_NAMES)[keyof typeof COLLECTION_NAMES]

// Department document storing organizational divisions and ticket prefix codes
export interface DepartmentDocument {
  _id: string
  name: string
  codePrefix: string
  createdAt: Date
}

// Hashed email verification code with expiry, wrong attempt counter and last send time
export interface MemberOtpDocument {
  hash: string
  expiresAt: Date
  attempts: number
  sentAt: Date
}

// User account document maintaining credentials, role boundaries, and profile state
export interface MemberDocument {
  _id: string
  username: string
  name: string
  department: string
  role: 'staff' | 'head' | 'admin'
  isDepartmentHead: boolean
  isActive: boolean
  passwordHash: string
  requiresPasswordChange: boolean
  email?: string | null
  receiveEmailNotifications: boolean
  isVerified?: boolean
  otp?: MemberOtpDocument | null
  createdAt: Date
  updatedAt: Date
}

// Embedded attachment metadata stored directly inside ticket and comment subdocuments
export interface TicketEmbeddedAttachment {
  readonly name: string
  readonly sizeKb: number
  readonly id?: string
  readonly mimeType?: string
}

// Embedded comment record maintaining discussion timeline without requiring join queries
export interface TicketEmbeddedComment {
  readonly id: string
  readonly author: string
  readonly department: string
  readonly body: string
  readonly createdAt: string
  readonly attachments?: readonly TicketEmbeddedAttachment[]
}

// Embedded lifecycle status transition record preserving auditability within document boundary
export interface TicketEmbeddedStatusChange {
  readonly status: string
  readonly at: string
  readonly reason?: string
  readonly actor?: {
    readonly name: string
    readonly department: string
  }
}

// Embedded assignment handoff record tracking specialist dispatch history
export interface TicketEmbeddedAssignmentChange {
  readonly from?: string
  readonly to: string
  readonly at: string
  readonly actor?: {
    readonly name: string
    readonly department: string
  }
}

// Central Ticket document aggregate embedding all child entities for single-read performance and atomic updates
export interface TicketDocument {
  _id: string
  code: string
  title: string
  description: string
  purpose?: string | null
  expectedResult?: string | null
  priority: string
  status: string
  requesterName: string
  fromDepartment: string
  toDepartment: string
  assigneeName?: string | null
  dueDate?: string | null
  rating?: number | null
  feedback?: string | null
  cancelReason?: string | null
  createdAt: string
  updatedAt: string
  attachments: readonly TicketEmbeddedAttachment[]
  comments: readonly TicketEmbeddedComment[]
  statusHistory: readonly TicketEmbeddedStatusChange[]
  assignmentHistory: readonly TicketEmbeddedAssignmentChange[]
}

// Atomic counter tracking the next sequence number per department prefix and month period
export interface TicketCodeCounterDocument {
  _id: string
  codePrefix: string
  period: string
  lastSequence: number
  updatedAt?: Date
}

// Request template document holding standardized input blueprints for departments
export interface RequestTemplateDocument {
  _id: string
  targetDepartment: string
  title: string
  description: string
  purpose: string
  expectedResult: string
  defaultPriority: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// SLA configuration document mapping response and resolution hours per priority tier
export interface DefaultSlaDocument {
  _id: string
  priority: string
  responseHours: number
  resolutionHours: number
  createdAt: Date
  updatedAt: Date
}

// Personal workflow notification document delivered to individual accounts
export interface NotificationDocument {
  _id: string
  recipientUsername: string
  ticketId?: string | null
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

// Immutable audit log document recording administrative modifications
export interface AuditLogDocument {
  _id: string
  actorUsername: string
  action: string
  entityType: string
  entityId: string
  details: string
  createdAt: Date
}

// Push notification registration document mapping device push tokens to user accounts
export interface DeviceTokenDocument {
  _id: string
  username: string
  token: string
  createdAt: Date
}

// Collection JSON schema validators enforcing data invariants at the MongoDB engine layer
export const COLLECTION_VALIDATORS: Record<string, Record<string, unknown>> = {
  [COLLECTION_NAMES.DEPARTMENTS]: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'codePrefix', 'createdAt'],
      properties: {
        _id: { bsonType: ['string', 'objectId'] },
        name: { bsonType: 'string', minLength: 1 },
        codePrefix: { bsonType: 'string', minLength: 1, maxLength: 12 },
        createdAt: { bsonType: 'date' },
      },
    },
  },
  [COLLECTION_NAMES.MEMBERS]: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'name', 'department', 'role', 'passwordHash'],
      properties: {
        _id: { bsonType: ['string', 'objectId'] },
        username: { bsonType: 'string', minLength: 1 },
        name: { bsonType: 'string', minLength: 1 },
        department: { bsonType: 'string', minLength: 1 },
        role: { enum: ['staff', 'head', 'admin'] },
        isDepartmentHead: { bsonType: 'bool' },
        isActive: { bsonType: 'bool' },
        passwordHash: { bsonType: 'string' },
        requiresPasswordChange: { bsonType: 'bool' },
        email: { bsonType: ['string', 'null'] },
        receiveEmailNotifications: { bsonType: 'bool' },
      },
    },
  },
  [COLLECTION_NAMES.TICKETS]: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['code', 'title', 'description', 'priority', 'status', 'requesterName', 'fromDepartment', 'toDepartment', 'createdAt', 'updatedAt'],
      properties: {
        _id: { bsonType: ['string', 'objectId'] },
        code: { bsonType: 'string' },
        title: { bsonType: 'string' },
        description: { bsonType: 'string' },
        priority: { enum: ['low', 'medium', 'high', 'urgent'] },
        status: { enum: ['open', 'in_progress', 'waiting', 'resolved', 'pending_approval', 'closed'] },
        requesterName: { bsonType: 'string' },
        fromDepartment: { bsonType: 'string' },
        toDepartment: { bsonType: 'string' },
        attachments: { bsonType: 'array' },
        comments: { bsonType: 'array' },
        statusHistory: { bsonType: 'array' },
        assignmentHistory: { bsonType: 'array' },
      },
    },
  },
}
