// Tests verifying HTTP API client behavior, token handling, and Vietnamese error localization

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ApiClient, getStoredSessionToken, setStoredSessionToken } from './apiClient.ts'

describe('ApiClient', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    setStoredSessionToken(null)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    setStoredSessionToken(null)
  })

  it('should_store_and_clear_session_tokens_correctly', () => {
    setStoredSessionToken('test-token-123')
    expect(getStoredSessionToken()).toBe('test-token-123')
    setStoredSessionToken(null)
    expect(getStoredSessionToken()).toBeNull()
  })

  it('should_attach_bearer_token_when_session_token_is_stored', async () => {
    setStoredSessionToken('auth-xyz')
    let capturedHeader = ''

    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeader = (init?.headers as Record<string, string>)?.Authorization || ''
      return new Response(JSON.stringify({ user: { id: 'usr-1', name: 'Minh' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as any

    const client = new ApiClient('/api')
    await client.auth.me()
    expect(capturedHeader).toBe('Bearer auth-xyz')
  })

  it('should_translate_401_status_to_vietnamese_error_message', async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Invalid username or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as any

    const client = new ApiClient('/api')
    await expect(client.auth.login('wrong', 'badpass')).rejects.toThrow(
      'Tên đăng nhập hoặc mật khẩu không chính xác.',
    )
  })

  it('should_translate_403_status_to_vietnamese_forbidden_message', async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied: insufficient role privileges.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as any

    const client = new ApiClient('/api')
    await expect(client.tickets.create({} as any)).rejects.toThrow(
      'Bạn không có quyền thực hiện thao tác này.',
    )
  })

  it('should_extract_field_validation_errors_in_vietnamese', async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          error: 'ValidationError',
          message: 'Dữ liệu không hợp lệ.',
          errors: { title: 'Tiêu đề không được để trống.' },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }) as any

    const client = new ApiClient('/api')
    await expect(client.tickets.create({} as any)).rejects.toThrow(
      'Tiêu đề không được để trống.',
    )
  })

  it('should_translate_network_connection_errors_into_vietnamese', async () => {
    globalThis.fetch = (async () => {
      throw new Error('Failed to fetch')
    }) as any

    const client = new ApiClient('/api')
    await expect(client.tickets.list()).rejects.toThrow(
      'Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng.',
    )
  })

  it('should_handle_csv_export_text_payload', async () => {
    const csvContent = '\uFEFFMã yêu cầu,Tiêu đề\nTCK-1,Yêu cầu mẫu'
    globalThis.fetch = (async () => {
      return new Response(csvContent, {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    }) as any

    const client = new ApiClient('/api')
    const result = await client.tickets.exportCsv()
    expect(result).toBe(csvContent)
  })

  it('should_execute_notification_api_requests_with_correct_payloads', async () => {
    let capturedUrl = ''
    let capturedMethod = ''
    let capturedBody = ''

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url)
      capturedMethod = init?.method || 'GET'
      capturedBody = typeof init?.body === 'string' ? init.body : ''
      return new Response(JSON.stringify({ ok: true, notifications: [], unreadCount: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as any

    const client = new ApiClient('/api')
    await client.notifications.list()
    expect(capturedUrl).toBe('/api/notifications')
    expect(capturedMethod).toBe('GET')

    await client.notifications.markRead('ntf-1')
    expect(capturedUrl).toBe('/api/notifications/ntf-1/read')
    expect(capturedMethod).toBe('PATCH')

    await client.notifications.markAllRead()
    expect(capturedUrl).toBe('/api/notifications/read-all')
    expect(capturedMethod).toBe('PATCH')

    await client.notifications.registerDevice('token-device-xyz')
    expect(capturedUrl).toBe('/api/notifications/devices')
    expect(capturedMethod).toBe('POST')
    expect(capturedBody).toContain('token-device-xyz')
  })

  it('should_execute_cms_api_requests_with_correct_routes_and_payloads', async () => {
    let capturedUrl = ''
    let capturedMethod = ''

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url)
      capturedMethod = init?.method || 'GET'
      return new Response(JSON.stringify({ members: [], departments: [], templates: [], slas: [], auditLogs: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as any

    const client = new ApiClient('/api')
    await client.cms.getMembers()
    expect(capturedUrl).toBe('/api/cms/members')

    await client.cms.lockMember('mbr-1')
    expect(capturedUrl).toBe('/api/cms/members/mbr-1/lock')
    expect(capturedMethod).toBe('POST')

    await client.cms.unlockMember('mbr-1')
    expect(capturedUrl).toBe('/api/cms/members/mbr-1/unlock')
    expect(capturedMethod).toBe('POST')

    await client.cms.resetPassword('mbr-1')
    expect(capturedUrl).toBe('/api/cms/members/mbr-1/reset-password')
    expect(capturedMethod).toBe('POST')

    await client.cms.getDepartments()
    expect(capturedUrl).toBe('/api/cms/departments')

    await client.cms.getTemplates()
    expect(capturedUrl).toBe('/api/cms/templates')

    await client.cms.getSlas()
    expect(capturedUrl).toBe('/api/cms/slas')

    await client.cms.updateSla('urgent', 2, 8)
    expect(capturedUrl).toBe('/api/cms/slas/urgent')
    expect(capturedMethod).toBe('PUT')

    await client.cms.getAuditLogs()
    expect(capturedUrl).toBe('/api/cms/audit-logs')
  })

  it('should_execute_auth_registration_and_verification_api_calls', async () => {
    let capturedUrl = ''
    let capturedMethod = ''
    let capturedBody = ''

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url)
      capturedMethod = init?.method || 'GET'
      capturedBody = String(init?.body || '')
      return new Response(JSON.stringify({ status: 'ok', departments: ['Kinh doanh'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as any

    const client = new ApiClient('/api')

    await client.auth.getDepartments()
    expect(capturedUrl).toBe('/api/auth/departments')
    expect(capturedMethod).toBe('GET')

    await client.auth.register({
      username: 'nv001',
      name: 'Nguyễn Văn Một',
      department: 'Kinh doanh',
      role: 'staff',
      email: 'vanmot@gmail.com',
      password: 'password123',
    })
    expect(capturedUrl).toBe('/api/auth/register')
    expect(capturedMethod).toBe('POST')
    expect(capturedBody).toContain('vanmot@gmail.com')

    await client.auth.verifyEmail('tok-123')
    expect(capturedUrl).toBe('/api/auth/verify-email')
    expect(capturedMethod).toBe('POST')
    expect(capturedBody).toContain('tok-123')

    await client.auth.verifyEmail('654321', 'nv001')
    expect(capturedUrl).toBe('/api/auth/verify-email')
    expect(capturedMethod).toBe('POST')
    expect(capturedBody).toContain('654321')
    expect(capturedBody).toContain('nv001')

    await client.auth.resendVerification('nv001')
    expect(capturedUrl).toBe('/api/auth/resend-verification')
    expect(capturedMethod).toBe('POST')
    expect(capturedBody).toContain('nv001')
  })
})
