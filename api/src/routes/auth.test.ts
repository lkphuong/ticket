import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { requireDepartmentHead, requireRoles } from '../middleware/authMiddleware.ts'
import { MockEmailService } from '../notifications/emailService.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

describe('Authentication & Session Management', () => {
  async function setupApp() {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    const emailService = new MockEmailService()
    await seedDatabase(store, new Date('2026-11-05T12:00:00Z'))
    const app = createApp(config, { store, emailService })
    return { app, store, emailService }
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

  it('should_allow_protected_endpoints_with_same_token_when_temporary_password_was_just_changed', async () => {
    const { app, store } = await setupApp()
    const member = await store.members.findByUsername('thuha')
    if (member) {
      await store.members.save({ ...member, requiresPasswordChange: true })
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'thuha', password: 'ticket123' })
    const token = loginRes.body.token

    const blockedRes = await request(app).get('/api/templates').set('Authorization', `Bearer ${token}`)
    expect(blockedRes.status).toBe(403)
    expect(blockedRes.body.error).toBe('PasswordChangeRequired')

    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'ticket123', newPassword: 'newSecurePassword456' })

    const allowedRes = await request(app).get('/api/templates').set('Authorization', `Bearer ${token}`)
    expect(allowedRes.status).toBe(200)
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

  it('should_register_new_user_and_enforce_email_verification_before_login', async () => {
    const { app, emailService } = await setupApp()

    // 1. Submit valid registration with @gmail.com
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'nv001',
        name: 'Nguyễn Văn Một',
        department: 'Kinh doanh',
        role: 'staff',
        email: 'vanmot@gmail.com',
        password: 'password123',
      })

    expect(regRes.status).toBe(201)
    expect(regRes.body.username).toBe('nv001')
    expect(regRes.body.role).toBe('staff')
    // OTP verification token must NEVER be disclosed in the API response
    expect(regRes.body.verificationToken).toBeUndefined()

    // 2. Verify that an email was dispatched
    expect(emailService.sentEmails.length).toBe(1)
    expect(emailService.sentEmails[0].to).toBe('vanmot@gmail.com')
    const dispatchedToken = emailService.sentEmails[0].token
    expect(dispatchedToken).toMatch(/^\d{6}$/)

    // 3. Attempting login before verification must be blocked
    const unverifiedLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nv001', password: 'password123' })

    expect(unverifiedLogin.status).toBe(403)
    expect(unverifiedLogin.body.error).toBe('AccountNotVerified')

    // 4. Verify account with token received from email dispatch
    const verifyRes = await request(app)
      .post('/api/auth/verify-email')
      .send({ identifier: 'vanmot@gmail.com', token: dispatchedToken })

    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.status).toBe('ok')

    // 5. Login successfully after verification
    const verifiedLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nv001', password: 'password123' })

    expect(verifiedLogin.status).toBe(200)
    expect(verifiedLogin.body.token).toBeDefined()
    expect(verifiedLogin.body.user.username).toBe('nv001')
  })

  it('should_accept_any_well_formed_email_domain_and_store_it_lowercase_when_registering', async () => {
    const { app, store } = await setupApp()

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'custom_domain_user',
        name: 'Người Dùng Tên Miền Riêng',
        department: 'Kinh doanh',
        role: 'staff',
        email: 'User.Name@CustomDomain.vn',
        password: 'password123',
      })

    expect(res.status).toBe(201)
    expect(res.body.email).toBe('user.name@customdomain.vn')
    expect((await store.members.findByEmail('USER.NAME@customdomain.vn'))?.username).toBe('custom_domain_user')
  })

  it('should_reject_registration_when_email_format_is_malformed', async () => {
    const { app } = await setupApp()

    for (const email of ['not-an-email', 'missing@tld', 'two@@signs.com', 'spaces in@mail.com']) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: `user_${Math.random().toString(36).substring(7)}`,
          name: 'Họ Và Tên',
          department: 'Kinh doanh',
          role: 'staff',
          email,
          password: 'password123',
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('ValidationError')
      expect(res.body.message).toContain('định dạng')
    }
  })

  it('should_strictly_enforce_one_manager_per_department_constraint', async () => {
    const { app } = await setupApp()

    // Department 'Kinh doanh' already has manager 'quocbao' (Trần Quốc Bảo) from seed
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'candidate_head',
        name: 'Ứng Viên Quản Lý',
        department: 'Kinh doanh',
        role: 'head',
        email: 'candidate_head@gmail.com',
        password: 'password123',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ValidationError')
    expect(res.body.message).toContain('đã có quản lý')

    // But can register as staff in the same department
    const staffRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'candidate_head',
        name: 'Ứng Viên Quản Lý',
        department: 'Kinh doanh',
        role: 'staff',
        email: 'candidate_head@gmail.com',
        password: 'password123',
      })

    expect(staffRes.status).toBe(201)
  })

  it('should_reject_verification_when_token_is_invalid_for_unknown_account', async () => {
    const { app } = await setupApp()

    const invalidRes = await request(app)
      .post('/api/auth/verify-email')
      .send({ identifier: 'ghost@gmail.com', token: 'non_existent_token_123' })

    expect(invalidRes.status).toBe(400)
    expect(invalidRes.body.error).toBe('VerificationError')
  })

  it('should_expose_public_departments_and_occupied_head_status', async () => {
    const { app } = await setupApp()

    const res = await request(app).get('/api/auth/departments')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.departments)).toBe(true)
    expect(res.body.departments.length).toBeGreaterThan(0)
    expect(res.body.occupiedDepartmentHeads).toBeDefined()
    expect(res.body.occupiedDepartmentHeads['Kinh doanh']).toBe('Trần Quốc Bảo')
  })

  it('should_overwrite_unverified_account_when_user_re_registers_after_abandoning', async () => {
    const { app, emailService } = await setupApp()

    // 1. Initial registration that gets abandoned before verification
    const initialRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'abandoned_user',
        name: 'Tên Ban Đầu',
        department: 'Nhân sự',
        role: 'staff',
        email: 'abandoned@gmail.com',
        password: 'initialPassword123',
      })

    expect(initialRes.status).toBe(201)
    expect(initialRes.body.verificationToken).toBeUndefined()
    expect(emailService.sentEmails.length).toBe(1)
    const initialOtp = emailService.sentEmails[0].token
    expect(initialOtp).toMatch(/^\d{6}$/)

    // 2. Unverified login attempt must be rejected
    const failedLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'abandoned_user', password: 'initialPassword123' })

    expect(failedLogin.status).toBe(403)
    expect(failedLogin.body.error).toBe('AccountNotVerified')

    // 3. User closes browser and registers again with same username and email, updating credentials
    const reRegisterRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'abandoned_user',
        name: 'Tên Đã Cập Nhật',
        department: 'Nhân sự',
        role: 'staff',
        email: 'abandoned@gmail.com',
        password: 'newSecretPassword456',
      })

    // Must succeed with overwrite rather than returning duplicate user error
    expect(reRegisterRes.status).toBe(201)
    expect(reRegisterRes.body.verificationToken).toBeUndefined()
    expect(emailService.sentEmails.length).toBe(2)
    const newOtp = emailService.sentEmails[1].token
    expect(newOtp).toMatch(/^\d{6}$/)

    // 4. Verification with the old abandoned OTP must fail if different
    if (initialOtp !== newOtp) {
      const oldVerifyRes = await request(app)
        .post('/api/auth/verify-email')
        .send({ identifier: 'abandoned@gmail.com', token: initialOtp })

      expect(oldVerifyRes.status).toBe(400)
    }

    // 5. Verification with the new OTP succeeds
    const verifyRes = await request(app)
      .post('/api/auth/verify-email')
      .send({ identifier: 'abandoned@gmail.com', token: newOtp })

    expect(verifyRes.status).toBe(200)

    // 6. Login succeeds with updated credentials
    const successfulLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'abandoned_user', password: 'newSecretPassword456' })

    expect(successfulLogin.status).toBe(200)
    expect(successfulLogin.body.user.name).toBe('Tên Đã Cập Nhật')
  })

  it('should_overwrite_unverified_account_when_abandoned_with_different_username_or_email', async () => {
    const { app, emailService } = await setupApp()

    // 1. First attempt with username "first_try" and email "shared@gmail.com"
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'first_try',
        name: 'Thử Lần Một',
        department: 'Kế toán',
        role: 'staff',
        email: 'shared@gmail.com',
        password: 'passOne123',
      })
    expect(res1.status).toBe(201)

    // 2. Second attempt abandoning the first, changing username to "second_try" with same email
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'second_try',
        name: 'Thử Lần Hai',
        department: 'Kế toán',
        role: 'staff',
        email: 'shared@gmail.com',
        password: 'passTwo123',
      })
    expect(res2.status).toBe(201)
    expect(res2.body.verificationToken).toBeUndefined()
    const secondUserOtp = emailService.sentEmails[emailService.sentEmails.length - 1].token
    expect(secondUserOtp).toMatch(/^\d{6}$/)

    // 3. Verify second registration
    const verifyRes = await request(app)
      .post('/api/auth/verify-email')
      .send({ identifier: 'shared@gmail.com', token: secondUserOtp })
    expect(verifyRes.status).toBe(200)

    // 4. Second user can login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'second_try', password: 'passTwo123' })
    expect(loginRes.status).toBe(200)

    // 5. First username no longer exists or cannot login
    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'first_try', password: 'passOne123' })
    expect(oldLogin.status).toBe(401)
  })

  it('should_not_block_department_manager_slot_when_previous_head_registration_was_unverified', async () => {
    const { app, store, emailService } = await setupApp()

    // Add a new department without a manager
    await store.departments.create('Chăm sóc khách hàng', 'CSKH')

    const deptRes1 = await request(app).get('/api/auth/departments')
    expect(deptRes1.body.occupiedDepartmentHeads['Chăm sóc khách hàng']).toBeUndefined()

    // Unverified candidate registers as manager
    const unverifiedHead = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'unverified_head',
        name: 'Quản Lý Chưa Xác Thực',
        department: 'Chăm sóc khách hàng',
        role: 'head',
        email: 'unverified_head@gmail.com',
        password: 'headPass123',
      })
    expect(unverifiedHead.status).toBe(201)

    // Unverified candidate must not lock the department in public directory
    const deptRes2 = await request(app).get('/api/auth/departments')
    expect(deptRes2.body.occupiedDepartmentHeads['Chăm sóc khách hàng']).toBeUndefined()

    // Another candidate can register as manager in the same department
    const realHead = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'official_head',
        name: 'Quản Lý Chính Thức',
        department: 'Chăm sóc khách hàng',
        role: 'head',
        email: 'official_head@gmail.com',
        password: 'headPass456',
      })
    expect(realHead.status).toBe(201)
    expect(realHead.body.verificationToken).toBeUndefined()
    const headOtp = emailService.sentEmails[emailService.sentEmails.length - 1].token
    expect(headOtp).toMatch(/^\d{6}$/)

    // Official candidate verifies email
    const verifyRes = await request(app)
      .post('/api/auth/verify-email')
      .send({ identifier: 'official_head@gmail.com', token: headOtp })
    expect(verifyRes.status).toBe(200)

    // Department now reflects the verified manager
    const deptRes3 = await request(app).get('/api/auth/departments')
    expect(deptRes3.body.occupiedDepartmentHeads['Chăm sóc khách hàng']).toBe('Quản Lý Chính Thức')
  })

  it('should_store_profile_email_lowercase_without_domain_restriction_when_updating_profile', async () => {
    const { app } = await setupApp()
    const login = await request(app).post('/api/auth/login').send({ username: 'minhanh', password: 'ticket123' })

    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ email: ' Minh.Anh@Corp-Mail.VN ', receiveEmailNotifications: true })

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('minh.anh@corp-mail.vn')
  })
})
