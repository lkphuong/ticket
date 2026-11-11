// High performance HTTP client connecting the frontend application to the REST API

import type { NewTicketInput, Ticket, TicketAttachment, TicketPriority, TicketStatus } from '../domain/ticket.ts'

const TOKEN_KEY = 'vtdesk_session_token'

export interface AppNotification {
  readonly id: string
  readonly recipientUsername: string
  readonly notificationType: string
  // Event kind written by the API, for example department_transfer_approved
  readonly type: string
  readonly ticketId?: string | null
  readonly title: string
  readonly body: string
  readonly isRead: boolean
  readonly createdAt: string
  readonly readAt?: string | null
}

export interface CmsMember {
  readonly id: string
  readonly username: string
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head' | 'admin'
  readonly isDepartmentHead: boolean
  readonly isActive: boolean
  readonly requiresPasswordChange: boolean
  readonly email?: string | null
  readonly createdAt?: string
  readonly updatedAt?: string
}

export interface PageQuery {
  readonly page?: number
  readonly limit?: number
  readonly search?: string
}

export interface MemberQuery extends PageQuery {
  readonly department?: string
  readonly role?: CmsMember['role']
  readonly status?: 'active' | 'locked'
}

export interface PageMeta {
  readonly total: number
  readonly page: number
  readonly limit: number
  readonly totalPages: number
}

export interface CmsDepartment {
  readonly name: string
  readonly codePrefix: string
  readonly memberCount: number
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export interface CmsAuditLog {
  readonly id: string
  readonly actorUsername: string
  readonly action: string
  readonly entityType: string
  readonly entityId: string
  readonly details?: string
  readonly createdAt: string
}

export interface CmsTemplate {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly targetDepartment: string
  readonly suggestedDays: number
  readonly isActive: boolean
  readonly values: {
    readonly title: string
    readonly description: string
    readonly purpose: string
    readonly expectedResult: string
    readonly priority: TicketPriority
  }
}

export interface CmsSla {
  readonly priority: TicketPriority
  readonly responseHours: number
  readonly resolutionHours: number
  readonly updatedAt?: string
}

export interface DirectoryMember {
  readonly username: string
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head' | 'admin'
  readonly isDepartmentHead: boolean
}

export interface UserSessionProfile {
  readonly id: string
  readonly username: string
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head' | 'admin'
  readonly isDepartmentHead: boolean
  readonly requiresPasswordChange: boolean
  readonly email?: string
  readonly avatarAttachmentId?: string
}

export type DepartmentTransferStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface DepartmentTransfer {
  readonly id: string
  readonly username: string
  readonly memberName: string
  readonly fromDepartment: string
  readonly toDepartment: string
  readonly status: DepartmentTransferStatus
  readonly requestedAt: string
  readonly decidedAt?: string
  readonly rejectReason?: string
}

export interface AuthLoginResponse {
  readonly token: string
  readonly user: UserSessionProfile
}

export interface RegisterInputPayload {
  readonly username: string
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head'
  readonly email: string
  readonly password: string
}

export interface RegisterResultPayload {
  readonly id: string
  readonly username: string
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head'
  readonly email: string
  readonly message: string
}

export interface VerifyEmailResultPayload {
  readonly status: string
  readonly message: string
  readonly user?: {
    readonly username: string
    readonly email: string
  }
}

export interface PublicDepartmentsResponse {
  readonly departments: string[]
  readonly occupiedDepartmentHeads?: Record<string, string>
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly errors?: Record<string, string>
  // Seconds the caller must wait before retrying, when the server rate limits the request
  readonly retryAfterSeconds?: number

  constructor(
    message: string,
    status: number,
    code?: string,
    errors?: Record<string, string>,
    retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
    this.retryAfterSeconds = retryAfterSeconds
  }
}

// Reads a positive whole number of seconds from a JSON field or a Retry-After header value
function parseRetryAfterSeconds(value: unknown): number | undefined {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined
}

let inMemoryToken: string | null = null
let sessionExpiredHandler: (() => void) | null = null

// Lets the auth layer react once when the API rejects a stored session token
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler
}

// Translates API response codes and error bodies into contextual Vietnamese messages
function toVietnameseErrorMessage(status: number, message?: string, errors?: Record<string, string>): string {
  if (errors && Object.keys(errors).length > 0) {
    const firstKey = Object.keys(errors)[0]
    return errors[firstKey]
  }
  switch (status) {
    case 401:
      return 'Tên đăng nhập hoặc mật khẩu không chính xác.'
    case 403:
      // Preserves explicit business messages for unverified accounts or manager constraints
      if (message && (message.includes('xác thực') || message.includes('quản lý'))) return message
      return 'Bạn không có quyền thực hiện thao tác này.'
    case 404:
      return 'Yêu cầu không tồn tại hoặc đã bị xóa.'
    case 400:
      return message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.'
    case 409:
    case 410:
    case 413:
    case 423:
    case 429:
      // Conflict, expiry, lockout and rate limit messages carry the recovery step for the user
      return message || 'Yêu cầu chưa thể thực hiện lúc này. Vui lòng thử lại sau.'
    case 500:
    default:
      return 'Lỗi hệ thống máy chủ. Vui lòng thử lại sau.'
  }
}

export function getStoredSessionToken(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY) || sessionStorage?.getItem(TOKEN_KEY) || inMemoryToken
    }
  } catch {
    // Gracefully handle restricted storage contexts
  }
  return inMemoryToken
}

export function setStoredSessionToken(token: string | null): void {
  inMemoryToken = token
  try {
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token)
        sessionStorage?.setItem(TOKEN_KEY, token)
      } else {
        localStorage.removeItem(TOKEN_KEY)
        sessionStorage?.removeItem(TOKEN_KEY)
      }
    }
  } catch {
    // Gracefully handle restricted storage contexts
  }
}

export class ApiClient {
  private readonly baseUrl: string

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  // Pure request dispatcher managing headers and contextual error translation
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = getStoredSessionToken()
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

    let response: Response
    try {
      response = await fetch(url, { ...options, headers })
    } catch {
      throw new ApiError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng.', 0)
    }

    // Handles raw text responses such as CSV file downloads
    if (response.headers.get('content-type')?.includes('text/csv')) {
      if (!response.ok) {
        throw new ApiError('Không thể xuất dữ liệu CSV.', response.status)
      }
      return (await response.text()) as unknown as T
    }

    let payload: any = null
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        payload = await response.json()
      } catch {
        payload = null
      }
    }

    if (!response.ok) {
      // Auth endpoints report their own credential failures, so only data calls signal an expired session
      if (response.status === 401 && token && sessionExpiredHandler && !endpoint.startsWith('/auth/')) sessionExpiredHandler()
      const message = toVietnameseErrorMessage(response.status, payload?.message, payload?.errors)
      const retryAfterSeconds = parseRetryAfterSeconds(payload?.retryAfterSeconds ?? response.headers.get('retry-after'))
      throw new ApiError(message, response.status, payload?.error, payload?.errors, retryAfterSeconds)
    }

    return payload as T
  }

  readonly auth = {
    login: async (usernameRaw: string, passwordRaw: string): Promise<AuthLoginResponse> => {
      const data = await this.request<AuthLoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: usernameRaw, password: passwordRaw }),
      })
      setStoredSessionToken(data.token)
      return data
    },

    me: async (): Promise<{ user: UserSessionProfile }> => {
      return this.request<{ user: UserSessionProfile }>('/auth/me', { method: 'GET' })
    },

    logout: async (): Promise<void> => {
      try {
        await this.request('/auth/logout', { method: 'POST' })
      } finally {
        setStoredSessionToken(null)
      }
    },

    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
      await this.request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
    },

    // Pass null to remove the current profile picture
    updateAvatar: async (avatarAttachmentId: string | null): Promise<{ user: UserSessionProfile }> => {
      return this.request<{ user: UserSessionProfile }>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ avatarAttachmentId }),
      })
    },

    register: async (payload: RegisterInputPayload): Promise<RegisterResultPayload> => {
      return this.request<RegisterResultPayload>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },

    verifyEmail: async (token: string, identifier?: string): Promise<VerifyEmailResultPayload> => {
      return this.request<VerifyEmailResultPayload>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token, identifier }),
      })
    },

    resendVerification: async (identifier: string): Promise<{ status: string; message: string }> => {
      return this.request<{ status: string; message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      })
    },

    getDepartments: async (): Promise<PublicDepartmentsResponse> => {
      return this.request<PublicDepartmentsResponse>('/auth/departments', { method: 'GET' })
    },
  }

  readonly tickets = {
    list: async (params: Record<string, string | number | undefined> = {}): Promise<{ tickets: Ticket[]; total: number; page: number; limit: number; totalPages: number }> => {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      }
      const query = searchParams.toString()
      return this.request(`/tickets${query ? `?${query}` : ''}`, { method: 'GET' })
    },

    get: async (id: string): Promise<{ ticket: Ticket; timeline: any[]; activityLog: any[]; permissions: any }> => {
      return this.request(`/tickets/${encodeURIComponent(id)}`, { method: 'GET' })
    },

    create: async (input: NewTicketInput): Promise<{ ticket: Ticket }> => {
      return this.request('/tickets', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    assign: async (id: string, assigneeName: string): Promise<{ ticket: Ticket }> => {
      return this.request(`/tickets/${encodeURIComponent(id)}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ assigneeName }),
      })
    },

    updatePriority: async (id: string, priority: TicketPriority): Promise<{ ticket: Ticket }> => {
      return this.request(`/tickets/${encodeURIComponent(id)}/priority`, {
        method: 'PATCH',
        body: JSON.stringify({ priority }),
      })
    },

    updateDueDate: async (id: string, dueDate: string): Promise<{ ticket: Ticket }> => {
      return this.request(`/tickets/${encodeURIComponent(id)}/due-date`, {
        method: 'PATCH',
        body: JSON.stringify({ dueDate }),
      })
    },

    updateStatus: async (id: string, status: TicketStatus, reason?: string): Promise<{ ticket: Ticket }> => {
      return this.request(`/tickets/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      })
    },

    confirm: async (id: string, rating: number, feedback?: string): Promise<{ ticket: Ticket }> => {
      return this.request(`/tickets/${encodeURIComponent(id)}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ rating, feedback }),
      })
    },

    approve: async (id: string): Promise<{ ticket: Ticket }> => {
      return this.request(`/tickets/${encodeURIComponent(id)}/approve`, { method: 'POST' })
    },

    rejectApproval: async (id: string, reason: string): Promise<{ ticket: Ticket }> => {
      return this.request(`/tickets/${encodeURIComponent(id)}/reject-approval`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
    },

    rework: async (id: string, reason: string): Promise<{ ticket: Ticket }> => {
      return this.request(`/tickets/${encodeURIComponent(id)}/rework`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
    },

    reopen: async (id: string, reason: string): Promise<{ ticket: Ticket }> => {
      return this.request(`/tickets/${encodeURIComponent(id)}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
    },

    cancel: async (id: string, reason: string): Promise<{ ticket: Ticket }> => {
      return this.request(`/tickets/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
    },

    addComment: async (id: string, body: string, attachments?: TicketAttachment[]): Promise<{ comment: any; ticket: Ticket }> => {
      return this.request(`/tickets/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body, attachments }),
      })
    },

    exportCsv: async (params: Record<string, string | number | undefined> = {}): Promise<string> => {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      }
      const query = searchParams.toString()
      return this.request(`/tickets/export${query ? `?${query}` : ''}`, { method: 'GET' })
    },
  }

  readonly attachments = {
    // Sends the raw file bytes; the original name travels in a header because the body carries no metadata
    upload: async (file: File): Promise<TicketAttachment> => {
      const { attachment } = await this.request<{ attachment: TicketAttachment }>('/attachments', {
        method: 'POST',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
        },
      })
      return attachment
    },

    uploadAll: (files: File[]): Promise<TicketAttachment[]> => Promise.all(files.map((file) => this.attachments.upload(file))),

    // The session token travels in a header, so content is fetched as a blob instead of linked directly
    fetchContent: async (id: string, forDownload = false): Promise<Blob> => {
      const token = getStoredSessionToken()
      const query = forDownload ? '?download=1' : ''
      let response: Response
      try {
        response = await fetch(`${this.baseUrl}/attachments/${encodeURIComponent(id)}${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      } catch {
        throw new ApiError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng.', 0)
      }
      if (!response.ok) throw new ApiError(toVietnameseErrorMessage(response.status), response.status)
      return response.blob()
    },
  }

  readonly notifications = {
    list: async (): Promise<{ notifications: AppNotification[]; unreadCount: number }> => {
      return this.request('/notifications', { method: 'GET' })
    },
    markRead: async (id: string): Promise<void> => {
      await this.request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
    },
    markAllRead: async (): Promise<void> => {
      await this.request('/notifications/read-all', { method: 'PATCH' })
    },
    registerDevice: async (token: string): Promise<void> => {
      await this.request('/notifications/devices', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
    },
    unregisterDevice: async (token: string): Promise<void> => {
      await this.request(`/notifications/devices/${encodeURIComponent(token)}`, {
        method: 'DELETE',
      })
    },
  }

  readonly departmentTransfers = {
    // Latest request of the signed-in member, or null when none was ever filed
    mine: async (): Promise<{ transfer: DepartmentTransfer | null }> => {
      return this.request('/department-transfers/mine', { method: 'GET' })
    },
    request: async (toDepartment: string): Promise<{ transfer: DepartmentTransfer }> => {
      return this.request('/department-transfers', {
        method: 'POST',
        body: JSON.stringify({ toDepartment }),
      })
    },
    cancelMine: async (): Promise<void> => {
      await this.request('/department-transfers/mine', { method: 'DELETE' })
    },
    incoming: async (): Promise<{ transfers: DepartmentTransfer[] }> => {
      return this.request('/department-transfers/incoming', { method: 'GET' })
    },
    approve: async (id: string): Promise<{ transfer: DepartmentTransfer }> => {
      return this.request(`/department-transfers/${encodeURIComponent(id)}/approve`, { method: 'POST' })
    },
    reject: async (id: string, reason: string): Promise<{ transfer: DepartmentTransfer }> => {
      return this.request(`/department-transfers/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
    },
  }

  readonly members = {
    directory: async (): Promise<{ members: DirectoryMember[] }> => {
      return this.request('/members/directory', { method: 'GET' })
    },
  }

  readonly cms = {
    getDepartmentOptions: async (): Promise<{ departments: string[] }> => {
      return this.request('/cms/departments/options', { method: 'GET' })
    },
    getDepartments: async (query: PageQuery = {}): Promise<{ departments: CmsDepartment[] } & PageMeta> => {
      return this.request(`/cms/departments${buildQueryString({ ...query })}`, { method: 'GET' })
    },
    createDepartment: async (name: string, codePrefix?: string): Promise<void> => {
      await this.request('/cms/departments', {
        method: 'POST',
        body: JSON.stringify({ name, codePrefix }),
      })
    },
    updateDepartment: async (currentName: string, data: { name?: string; codePrefix?: string }): Promise<void> => {
      await this.request(`/cms/departments/${encodeURIComponent(currentName)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
    deleteDepartment: async (name: string): Promise<void> => {
      await this.request(`/cms/departments/${encodeURIComponent(name)}`, { method: 'DELETE' })
    },
    getMembers: async (query: MemberQuery = {}): Promise<{ members: CmsMember[] } & PageMeta> => {
      return this.request(`/cms/members${buildQueryString({ ...query })}`, { method: 'GET' })
    },
    createMember: async (data: {
      username: string
      name: string
      department: string
      role: 'staff' | 'head' | 'admin'
      isDepartmentHead?: boolean
      email?: string
      tempPassword?: string
    }): Promise<{ member: CmsMember }> => {
      return this.request('/cms/members', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    updateMember: async (
      id: string,
      data: {
        name?: string
        department?: string
        role?: 'staff' | 'head' | 'admin'
        isDepartmentHead?: boolean
        email?: string
      },
    ): Promise<{ member: CmsMember }> => {
      return this.request(`/cms/members/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
    deleteMember: async (id: string): Promise<void> => {
      await this.request(`/cms/members/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
    lockMember: async (id: string): Promise<{ reassignedTicketsCount: number }> => {
      return this.request(`/cms/members/${encodeURIComponent(id)}/lock`, { method: 'POST' })
    },
    unlockMember: async (id: string): Promise<void> => {
      await this.request(`/cms/members/${encodeURIComponent(id)}/unlock`, { method: 'POST' })
    },
    resetPassword: async (id: string, tempPassword?: string): Promise<{ temporaryPassword: string }> => {
      return this.request(`/cms/members/${encodeURIComponent(id)}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ tempPassword }),
      })
    },
    getAuditLogs: async (query: PageQuery = {}): Promise<{ auditLogs: CmsAuditLog[] } & PageMeta> => {
      return this.request(`/cms/audit-logs${buildQueryString({ ...query })}`, { method: 'GET' })
    },
    getTemplates: async (department?: string): Promise<{ templates: CmsTemplate[] }> => {
      const query = department ? `?department=${encodeURIComponent(department)}` : ''
      return this.request(`/cms/templates${query}`, { method: 'GET' })
    },
    createTemplate: async (data: any): Promise<{ template: CmsTemplate }> => {
      return this.request('/cms/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    updateTemplate: async (id: string, data: any): Promise<{ template: CmsTemplate }> => {
      return this.request(`/cms/templates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
    getSlas: async (): Promise<{ slas: CmsSla[] }> => {
      return this.request('/cms/slas', { method: 'GET' })
    },
    updateSla: async (
      priority: TicketPriority,
      responseHours: number,
      resolutionHours: number,
    ): Promise<{ sla: CmsSla }> => {
      return this.request(`/cms/slas/${encodeURIComponent(priority)}`, {
        method: 'PUT',
        body: JSON.stringify({ responseHours, resolutionHours }),
      })
    },
  }

  readonly reports = {
    getDashboard: async (params: Record<string, string | number | undefined> = {}): Promise<any> => {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      }
      const query = searchParams.toString()
      return this.request(`/reports/dashboard${query ? `?${query}` : ''}`, { method: 'GET' })
    },
  }
}

export const apiClient = new ApiClient()
