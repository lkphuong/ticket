// High performance HTTP client connecting the frontend application to the REST API

import type { NewTicketInput, Ticket, TicketAttachment, TicketPriority, TicketStatus } from '../domain/ticket.ts'

const TOKEN_KEY = 'vtdesk_session_token'

export interface AppNotification {
  readonly id: string
  readonly recipientUsername: string
  readonly notificationType: string
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

export interface CmsAuditLog {
  readonly id: string
  readonly actorUsername: string
  readonly actorName: string
  readonly action: string
  readonly targetType: string
  readonly targetId: string
  readonly details?: any
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

export interface UserSessionProfile {
  readonly id: string
  readonly username: string
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head' | 'admin'
  readonly isDepartmentHead: boolean
  readonly requiresPasswordChange: boolean
  readonly email?: string
  readonly receiveEmailNotifications?: boolean
}

export interface AuthLoginResponse {
  readonly token: string
  readonly user: UserSessionProfile
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly errors?: Record<string, string>

  constructor(
    message: string,
    status: number,
    code?: string,
    errors?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
  }
}

let inMemoryToken: string | null = null

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
      return 'Bạn không có quyền thực hiện thao tác này.'
    case 404:
      return 'Yêu cầu không tồn tại hoặc đã bị xóa.'
    case 400:
      return message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.'
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
      const message = toVietnameseErrorMessage(response.status, payload?.message, payload?.errors)
      throw new ApiError(message, response.status, payload?.error, payload?.errors)
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

    updateProfile: async (data: { email?: string | null; receiveEmailNotifications?: boolean }): Promise<{ user: UserSessionProfile }> => {
      return this.request<{ user: UserSessionProfile }>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
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

  readonly cms = {
    getDepartments: async (): Promise<{ departments: string[] }> => {
      return this.request('/cms/departments', { method: 'GET' })
    },
    createDepartment: async (name: string): Promise<void> => {
      await this.request('/cms/departments', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
    },
    getMembers: async (): Promise<{ members: CmsMember[] }> => {
      return this.request('/cms/members', { method: 'GET' })
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
    getAuditLogs: async (): Promise<{ auditLogs: CmsAuditLog[] }> => {
      return this.request('/cms/audit-logs', { method: 'GET' })
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
