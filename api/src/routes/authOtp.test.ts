import { beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'
import { AuthService } from '../auth/authService.ts'
import { MemorySessionService } from '../auth/sessionService.ts'
import { OtpService, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS } from '../auth/otpService.ts'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { MockEmailService } from '../notifications/emailService.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

const START_TIME = new Date('2026-11-05T12:00:00Z')
const MILLISECONDS_PER_SECOND = 1000
const REGISTRANT_EMAIL = 'otp.user@example.com'
const REGISTRANT_USERNAME = 'otp_user'

describe('Email verification OTP over HTTP', () => {
  let now: Date
  let store: InMemoryTicketStore
  let emailService: MockEmailService
  let app: ReturnType<typeof createApp>

  beforeEach(async () => {
    now = new Date(START_TIME)
    store = new InMemoryTicketStore()
    emailService = new MockEmailService()
    await seedDatabase(store, START_TIME)
    const authService = new AuthService(
      store.members,
      new MemorySessionService(),
      store.departments,
      emailService,
      new OtpService('test-otp-secret', () => now),
    )
    app = createApp(loadEnvironmentConfig({ NODE_ENV: 'development' }), { store, emailService, authService })
  })

  async function register(): Promise<string> {
    const res = await request(app).post('/api/auth/register').send({
      username: REGISTRANT_USERNAME,
      name: 'Người Dùng OTP',
      department: 'Kinh doanh',
      role: 'staff',
      email: REGISTRANT_EMAIL,
      password: 'password123',
    })
    expect(res.status).toBe(201)
    return lastSentCode()
  }

  function lastSentCode(): string {
    return emailService.sentEmails[emailService.sentEmails.length - 1].token
  }

  function verify(token: string) {
    return request(app).post('/api/auth/verify-email').send({ identifier: REGISTRANT_EMAIL, token })
  }

  function wrongCodeFor(code: string): string {
    return code === '000000' ? '000001' : '000000'
  }

  function advanceSeconds(seconds: number): void {
    now = new Date(now.getTime() + seconds * MILLISECONDS_PER_SECOND)
  }

  it('should_store_only_a_hash_with_ten_minute_expiry_when_registering', async () => {
    const code = await register()

    const member = await store.members.findByEmail(REGISTRANT_EMAIL)
    expect(code).toMatch(/^\d{6}$/)
    expect(member?.otp?.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(member?.otp?.hash).not.toContain(code)
    expect(member?.otp?.attempts).toBe(0)
    expect(member!.otp!.expiresAt.getTime() - member!.otp!.sentAt.getTime()).toBe(OTP_TTL_MS)
  })

  it('should_verify_account_and_clear_otp_when_correct_code_is_submitted', async () => {
    const code = await register()

    const res = await verify(code)

    expect(res.status).toBe(200)
    const member = await store.members.findByEmail(REGISTRANT_EMAIL)
    expect(member?.isVerified).toBe(true)
    expect(member?.otp).toBeUndefined()
  })

  it('should_return_400_with_remaining_attempts_when_code_is_wrong', async () => {
    const code = await register()

    const res = await verify(wrongCodeFor(code))

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('attempt')
    expect(res.body.remainingAttempts).toBe(OTP_MAX_ATTEMPTS - 1)
    expect(res.body.message).toContain(`còn ${OTP_MAX_ATTEMPTS - 1} lần`)
  })

  it('should_return_423_and_invalidate_code_when_attempts_are_exhausted', async () => {
    const code = await register()
    const wrong = wrongCodeFor(code)

    for (let attempt = 1; attempt < OTP_MAX_ATTEMPTS; attempt++) {
      expect((await verify(wrong)).status).toBe(400)
    }
    const lockedRes = await verify(wrong)

    expect(lockedRes.status).toBe(423)
    expect(lockedRes.body.error).toContain('locked')
    expect(lockedRes.body.message).toContain('yêu cầu mã mới')
    // Even the correct code no longer works once the code is invalidated
    expect((await verify(code)).status).toBe(423)

    advanceSeconds(OTP_RESEND_COOLDOWN_MS / MILLISECONDS_PER_SECOND + 1)
    expect((await request(app).post('/api/auth/resend-verification').send({ identifier: REGISTRANT_EMAIL })).status).toBe(200)
    expect((await verify(lastSentCode())).status).toBe(200)
  })

  it('should_return_410_when_code_has_expired', async () => {
    const code = await register()
    advanceSeconds(OTP_TTL_MS / MILLISECONDS_PER_SECOND + 1)

    const res = await verify(code)

    expect(res.status).toBe(410)
    expect(res.body.message).toContain('hết hạn')
  })

  it('should_return_429_with_retry_after_when_resending_inside_cooldown', async () => {
    await register()
    advanceSeconds(20)

    const res = await request(app).post('/api/auth/resend-verification').send({ identifier: REGISTRANT_USERNAME })

    expect(res.status).toBe(429)
    expect(res.body.retryAfterSeconds).toBe(40)
    expect(res.headers['retry-after']).toBe('40')
    expect(res.body.message).toContain('40 giây')
    expect(emailService.sentEmails).toHaveLength(1)
  })

  it('should_send_new_code_and_invalidate_old_one_when_resending_after_cooldown', async () => {
    const firstCode = await register()
    advanceSeconds(OTP_RESEND_COOLDOWN_MS / MILLISECONDS_PER_SECOND + 1)

    const res = await request(app).post('/api/auth/resend-verification').send({ identifier: REGISTRANT_EMAIL })

    expect(res.status).toBe(200)
    expect(emailService.sentEmails).toHaveLength(2)
    const secondCode = lastSentCode()
    if (secondCode !== firstCode) {
      expect((await verify(firstCode)).status).toBe(400)
    }
    expect((await verify(secondCode)).status).toBe(200)
  })

  it('should_answer_identically_without_sending_email_when_resending_for_unknown_identifier', async () => {
    const res = await request(app).post('/api/auth/resend-verification').send({ identifier: 'nobody@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(emailService.sentEmails).toHaveLength(0)
  })

  it('should_return_generic_400_when_verifying_unknown_identifier', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({ identifier: 'nobody@example.com', token: '123456' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VerificationError')
  })
})
