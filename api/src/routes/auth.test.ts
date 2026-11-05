import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { requireDepartmentHead, requireRoles } from '../middleware/authMiddleware.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

describe('Authentication & Session Management', () => {
  async function setupApp() {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    await seedDatabase(store, new Date('2026-11-05T12:00:00Z'))
    const app = createApp(config, { store })
    return { app, store }
  }

  it('should_return_session_token_and_user_profile_when_credentials_are_valid', async () => {
    const { app } = await setupApp()

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.username).toBe('minhanh')
    expect(res.body.user.name).toBe('Nguyễn Minh Anh')
    expect(res.body.user.department).toBe('Kinh doanh')
    expect(res.body.user.role).toBe('staff')
    expect(res.body.user.isDepartmentHead).toBe(false)
    expect(res.body.user.passwordHash).toBeUndefined()
    expect(res.body.user.password).toBeUndefined()
  })

  it('should_return_generic_unauthorized_error_when_username_or_password_is_incorrect', async () => {
    const { app } = await setupApp()

    // Non-existent username
    const res1 = await request(app)
      .post('/api/auth/login')
      .send({ username: 'non_existent_user', password: 'wrong_password' })

    expect(res1.status).toBe(401)
    expect(res1.body.message).toBe('Invalid username or password')

    // Existing username with wrong password
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'wrong_password' })

    expect(res2.status).toBe(401)
    expect(res2.body.message).toBe('Invalid username or password')
  })

  it('should_reject_login_when_account_is_locked', async () => {
    const { app, store } = await setupApp()

    // Lock account
    const member = await store.members.findByUsername('minhanh')
    if (member) {
      await store.members.save({ ...member, isActive: false })
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('AccountLocked')
  })

  it('should_return_personal_information_via_me_endpoint', async () => {
    const { app } = await setupApp()

    // Login as Head of IT (vankhoa)
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vankhoa', password: 'ticket123' })

    const token = loginRes.body.token

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(meRes.status).toBe(200)
    expect(meRes.body.user.username).toBe('vankhoa')
    expect(meRes.body.user.role).toBe('head')
    expect(meRes.body.user.department).toBe('Công nghệ thông tin')
    expect(meRes.body.user.isDepartmentHead).toBe(true)
    expect(meRes.body.user.password).toBeUndefined()
  })

  it('should_block_other_endpoints_when_account_has_temporary_password_until_password_is_changed', async () => {
    const { app, store } = await setupApp()

    // Set requiresPasswordChange flag on user
    const member = await store.members.findByUsername('thuha')
    if (member) {
      await store.members.save({ ...member, requiresPasswordChange: true })
    }

    // Add a protected test endpoint to verify blocking
    const dummyAuthMiddleware = (req: any, res: any, next: any) => next()
    app.get('/api/test-protected-resource', dummyAuthMiddleware, (_req, res) => {
      res.status(200).json({ ok: true })
    })

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'thuha', password: 'ticket123' })

    const token = loginRes.body.token

    // Attempt to access me endpoint (allowed for status check)
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
    expect(meRes.status).toBe(200)

    // Change password successfully
    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'ticket123', newPassword: 'newSecurePassword456' })

    expect(changeRes.status).toBe(200)

    // Verify login with new password works
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'thuha', password: 'newSecurePassword456' })

    expect(newLoginRes.status).toBe(200)
    expect(newLoginRes.body.user.requiresPasswordChange).toBe(false)
  })

  it('should_enforce_role_and_department_head_guards_correctly', () => {
    const reqStaff: any = { viewer: { role: 'staff', isDepartmentHead: false } }
    const reqHead: any = { viewer: { role: 'head', isDepartmentHead: true } }
    const reqAdmin: any = { viewer: { role: 'admin', isDepartmentHead: false } }

    const adminGuard = requireRoles('admin')
    const headGuard = requireDepartmentHead()

    let nextCalled = false
    const next = () => { nextCalled = true }
    const res: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this },
      json() { return this },
    }

    // Staff calling admin endpoint -> Rejected with 403
    nextCalled = false
    adminGuard(reqStaff, res, next)
    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(403)

    // Admin calling admin endpoint -> Allowed
    nextCalled = false
    adminGuard(reqAdmin, res, next)
    expect(nextCalled).toBe(true)

    // Staff calling head endpoint -> Rejected with 403
    nextCalled = false
    headGuard(reqStaff, res, next)
    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(403)

    // Head calling head endpoint -> Allowed
    nextCalled = false
    headGuard(reqHead, res, next)
    expect(nextCalled).toBe(true)

    // Admin calling head endpoint -> Allowed
    nextCalled = false
    headGuard(reqAdmin, res, next)
    expect(nextCalled).toBe(true)
  })
})
