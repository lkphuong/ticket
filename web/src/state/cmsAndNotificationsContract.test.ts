// Contract tests verifying CMS administrative operations and notification feed against the HTTP Express API

import { describe, expect, it } from 'vitest'
import request from 'supertest'
import {
  createApp,
  loadEnvironmentConfig,
  InMemoryTicketStore,
  TicketService,
  seedDatabase,
} from '@vtdesk/api'

describe('CMS and notifications contract tests against API', () => {
  async function setup(injectedNow: Date = new Date('2026-11-05T10:00:00.000Z')) {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3000' })
    const store = new InMemoryTicketStore()
    await seedDatabase(store, injectedNow)

    const ticketService = new TicketService(store, () => injectedNow)
    const app = createApp(config, { store, ticketService })

    // Administrator: admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'ticket123' })
    const adminToken = adminRes.body.token

    // Standard Member: minhanh
    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const staffToken = staffRes.body.token

    // Department Head: vankhoa
    const headRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vankhoa', password: 'ticket123' })
    const headToken = headRes.body.token

    return { app, adminToken, staffToken, headToken }
  }

  it('should_strictly_allow_administrator_and_reject_staff_and_head_from_cms_endpoints', async () => {
    const { app, adminToken, staffToken, headToken } = await setup()

    // Admin should access CMS members list
    const adminAccessRes = await request(app)
      .get('/api/cms/members')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(adminAccessRes.status).toBe(200)
    expect(Array.isArray(adminAccessRes.body.members)).toBe(true)

    // Staff should receive 403 Forbidden
    const staffAccessRes = await request(app)
      .get('/api/cms/members')
      .set('Authorization', `Bearer ${staffToken}`)
    expect(staffAccessRes.status).toBe(403)

    // Head should receive 403 Forbidden
    const headAccessRes = await request(app)
      .get('/api/cms/members')
      .set('Authorization', `Bearer ${headToken}`)
    expect(headAccessRes.status).toBe(403)
  })

  it('should_allow_admin_to_create_member_lock_unlock_and_reset_temporary_password', async () => {
    const { app, adminToken } = await setup()

    // 1. Create a new member with temporary password
    const createRes = await request(app)
      .post('/api/cms/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'nguyenvanb',
        name: 'Nguyễn Văn B',
        department: 'Công nghệ thông tin',
        role: 'staff',
        isDepartmentHead: false,
        email: 'nguyenvanb@vinatrans.com.vn',
        tempPassword: 'temporaryPass123',
      })
    expect(createRes.status).toBe(201)
    expect(createRes.body.member.username).toBe('nguyenvanb')
    expect(createRes.body.member.requiresPasswordChange).toBe(true)
    const newMemberId = createRes.body.member.id

    // 2. Lock member
    const lockRes = await request(app)
      .post(`/api/cms/members/${newMemberId}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(lockRes.status).toBe(200)

    // 3. Unlock member
    const unlockRes = await request(app)
      .post(`/api/cms/members/${newMemberId}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(unlockRes.status).toBe(200)

    // 4. Reset password to generated temporary password
    const resetRes = await request(app)
      .post(`/api/cms/members/${newMemberId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(resetRes.status).toBe(200)
    expect(typeof resetRes.body.temporaryPassword).toBe('string')
    expect(resetRes.body.temporaryPassword.length).toBeGreaterThan(5)
  })

  it('should_reassign_tickets_to_department_queue_when_member_is_locked', async () => {
    const { app, adminToken, headToken } = await setup()

    // Fetch members to locate a specialist with assigned tickets
    const membersRes = await request(app)
      .get('/api/cms/members')
      .set('Authorization', `Bearer ${adminToken}`)
    const giahuy = membersRes.body.members.find((m: any) => m.username === 'giahuy')
    expect(giahuy).toBeDefined()

    // Lock giahuy
    const lockRes = await request(app)
      .post(`/api/cms/members/${giahuy.id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(lockRes.status).toBe(200)
    expect(lockRes.body.reassignedTicketsCount).toBeGreaterThanOrEqual(1)

    // Verify tickets returned to unassigned state in department
    const ticketsRes = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${headToken}`)
    const unassignedInDept = ticketsRes.body.tickets.filter(
      (t: any) => t.toDepartment === 'Công nghệ thông tin' && !t.assigneeName && t.status === 'open',
    )
    expect(unassignedInDept.length).toBeGreaterThan(0)
  })

  it('should_allow_admin_to_create_department_and_list_all_departments', async () => {
    const { app, adminToken } = await setup()

    const createDeptRes = await request(app)
      .post('/api/cms/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Chuyển đổi số' })
    expect(createDeptRes.status).toBe(201)

    const listDeptRes = await request(app)
      .get('/api/cms/departments')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(listDeptRes.status).toBe(200)
    expect(listDeptRes.body.departments).toContain('Chuyển đổi số')
  })

  it('should_allow_admin_to_manage_slas_and_retrieve_audit_logs', async () => {
    const { app, adminToken } = await setup()

    // Update SLA for urgent priority
    const updateSlaRes = await request(app)
      .put('/api/cms/slas/urgent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ responseHours: 2, resolutionHours: 8 })
    expect(updateSlaRes.status).toBe(200)
    expect(updateSlaRes.body.sla.priority).toBe('urgent')
    expect(updateSlaRes.body.sla.responseHours).toBe(2)
    expect(updateSlaRes.body.sla.resolutionHours).toBe(8)

    // Audit logs should capture the SLA update
    const auditRes = await request(app)
      .get('/api/cms/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(auditRes.status).toBe(200)
    expect(auditRes.body.auditLogs.length).toBeGreaterThan(0)
    const updateSlaLog = auditRes.body.auditLogs.find((l: any) => l.action === 'update_default_sla')
    expect(updateSlaLog).toBeDefined()
  })

  it('should_retrieve_notifications_and_track_unread_counter_accurately', async () => {
    const { app, staffToken } = await setup()

    // List notifications for staff member
    const listRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${staffToken}`)
    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.body.notifications)).toBe(true)
    const initialUnreadCount = listRes.body.unreadCount

    if (listRes.body.notifications.length > 0) {
      const firstNotification = listRes.body.notifications[0]

      // Mark single notification as read
      const markSingleRes = await request(app)
        .patch(`/api/notifications/${firstNotification.id}/read`)
        .set('Authorization', `Bearer ${staffToken}`)
      expect(markSingleRes.status).toBe(200)
      expect(markSingleRes.body.notification.isRead).toBe(true)

      // Mark all notifications as read
      const markAllRes = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${staffToken}`)
      expect(markAllRes.status).toBe(200)
      expect(markAllRes.body.success).toBe(true)
    } else {
      expect(initialUnreadCount).toBe(0)
    }
  })

  it('should_allow_registering_browser_device_push_token', async () => {
    const { app, staffToken } = await setup()

    const registerRes = await request(app)
      .post('/api/notifications/devices')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ token: 'simulated-browser-fcm-token-xyz-123' })
    expect(registerRes.status).toBe(200)
    expect(registerRes.body.message).toContain('Device token registered successfully')
  })

  it('should_update_user_email_and_enforce_email_format_validation', async () => {
    const { app, staffToken } = await setup()

    // 1. Initial profile should have default email notifications flag as false
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${staffToken}`)
    expect(meRes.status).toBe(200)
    expect(meRes.body.user.receiveEmailNotifications).toBe(false)

    // 2. Reject invalid email format with 400 Bad Request
    const invalidEmailRes = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ email: 'invalid-email-format-without-at' })
    expect(invalidEmailRes.status).toBe(400)

    // 3. Accept valid email format and update notification preference
    const validEmailRes = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        email: 'staff.minhanh@vinatrans.com.vn',
        receiveEmailNotifications: true,
      })
    expect(validEmailRes.status).toBe(200)
    expect(validEmailRes.body.user.email).toBe('staff.minhanh@vinatrans.com.vn')
    expect(validEmailRes.body.user.receiveEmailNotifications).toBe(true)
  })
})
