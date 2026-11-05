// Tests verifying HTTP API client behavior, token handling, and Vietnamese error localization

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ApiClient, ApiError, getStoredSessionToken, setStoredSessionToken } from './apiClient.ts'

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
})
