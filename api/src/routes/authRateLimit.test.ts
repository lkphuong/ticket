import { beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

const MAX_REQUESTS_PER_ACCOUNT = 3
const FAILED_LOGIN_BODY = { username: 'nobody', password: 'wrong-password' }

describe('Authentication rate limiting over HTTP', () => {
  let app: ReturnType<typeof createApp>

  beforeEach(async () => {
    const store = new InMemoryTicketStore()
    await seedDatabase(store, new Date('2026-11-05T12:00:00Z'))
    app = createApp(loadEnvironmentConfig({ NODE_ENV: 'development' }), {
      store,
      authRateLimits: { windowMs: 60_000, maxRequestsPerAddress: 100, maxRequestsPerAccount: MAX_REQUESTS_PER_ACCOUNT },
    })
  })

  it('should_return_429_when_one_account_exceeds_the_login_limit', async () => {
    for (let attempt = 0; attempt < MAX_REQUESTS_PER_ACCOUNT; attempt += 1) {
      const res = await request(app).post('/api/auth/login').send(FAILED_LOGIN_BODY)
      expect(res.status).toBe(401)
    }
    const blocked = await request(app).post('/api/auth/login').send(FAILED_LOGIN_BODY)
    expect(blocked.status).toBe(429)
    expect(blocked.body.error).toBe('TooManyRequests')
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('should_keep_other_accounts_unaffected_when_one_account_is_limited', async () => {
    for (let attempt = 0; attempt <= MAX_REQUESTS_PER_ACCOUNT; attempt += 1) {
      await request(app).post('/api/auth/login').send(FAILED_LOGIN_BODY)
    }
    const other = await request(app).post('/api/auth/login').send({ username: 'someone_else', password: 'x' })
    expect(other.status).toBe(401)
  })

  it('should_set_security_headers_on_every_response', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('should_return_413_when_json_body_is_oversized', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'a'.repeat(2 * 1024 * 1024), password: 'x' })
    expect(res.status).toBe(413)
  })
})
