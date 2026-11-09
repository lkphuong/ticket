import { describe, expect, it } from 'bun:test'
import { ConsoleEmailService, MockEmailService, ResendEmailService } from './emailService.ts'

describe('Email Services', () => {
  it('should_record_sent_emails_in_mock_email_service', async () => {
    const mockService = new MockEmailService()
    await mockService.sendVerificationEmail({
      to: 'test@gmail.com',
      name: 'Nguyen Van A',
      token: 'token-12345',
    })

    expect(mockService.sentEmails.length).toBe(1)
    expect(mockService.sentEmails[0].to).toBe('test@gmail.com')
    expect(mockService.sentEmails[0].token).toBe('token-12345')

    mockService.clear()
    expect(mockService.sentEmails.length).toBe(0)
  })

  it('should_dispatch_verification_email_via_resend_api', async () => {
    let capturedUrl = ''
    let capturedAuth = ''
    let capturedPayload: any = null

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url)
      capturedAuth = (init?.headers as Record<string, string>)?.Authorization || ''
      capturedPayload = JSON.parse(String(init?.body || '{}'))
      return new Response(JSON.stringify({ id: 'resend_email_id_123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as any

    try {
      const resendService = new ResendEmailService('test_resend_key_xyz', 'VTDesk <onboarding@resend.dev>')
      await resendService.sendVerificationEmail({
        to: 'user@outlook.com',
        name: 'Tran Van B',
        token: 'resend-tok-777',
      })

      expect(capturedUrl).toBe('https://api.resend.com/emails')
      expect(capturedAuth).toBe('Bearer test_resend_key_xyz')
      expect(capturedPayload.to).toEqual(['user@outlook.com'])
      expect(capturedPayload.from).toBe('VTDesk <onboarding@resend.dev>')
      expect(capturedPayload.html).toContain('resend-tok-777')
      expect(capturedPayload.text).toContain('resend-tok-777')
      expect(capturedPayload.subject).toContain('resend-tok-777')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('should_handle_resend_api_errors_explicitly', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: 'Invalid API Key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as any

    try {
      const resendService = new ResendEmailService('invalid_key')
      await expect(
        resendService.sendVerificationEmail({
          to: 'user@gmail.com',
          name: 'Le Thi C',
          token: 'tok-abc',
        }),
      ).rejects.toThrow('Resend email delivery failed')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('should_log_to_console_without_throwing_in_console_email_service', async () => {
    const consoleService = new ConsoleEmailService()
    await expect(
      consoleService.sendVerificationEmail({
        to: 'audit@gmail.com',
        name: 'Auditor',
        token: 'console-tok',
      }),
    ).resolves.toBeUndefined()
  })
})
