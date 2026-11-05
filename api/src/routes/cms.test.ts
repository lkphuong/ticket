import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import type { Ticket } from '@vtdesk/domain'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

describe('CMS Members & Departments', () => {
  async function setupCms() {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    await seedDatabase(store, new Date('2026-11-05T12:00:00Z'))
    const app = createApp(config, { store })

    // Login as Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'ticket123' })
    const adminToken = adminLogin.body.token

    // Login as Staff (minhanh)
    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const staffToken = staffLogin.body.token

    return { app, store, adminToken, staffToken }
  }

  it('should_reject_non_admin_roles_with_403_when_accessing_cms_endpoints', async () => {
    const { app, staffToken } = await setupCms()

    const res = await request(app)
      .get('/api/cms/members')
      .set('Authorization', `Bearer ${staffToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Forbidden')
  })

  it('should_allow_admin_to_list_departments_and_members', async () => {
    const { app, adminToken } = await setupCms()

    const deptRes = await request(app)
      .get('/api/cms/departments')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(deptRes.status).toBe(200)
    expect(deptRes.body.departments).toContain('Công nghệ thông tin')
    expect(deptRes.body.departments).toContain('Kế toán')

    const memberRes = await request(app)
      .get('/api/cms/members')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(memberRes.status).toBe(200)
    expect(memberRes.body.members.length).toBeGreaterThan(15)
  })

  it('should_reject_member_creation_when_username_already_exists', async () => {
    const { app, adminToken } = await setupCms()

    const res = await request(app)
      .post('/api/cms/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'minhanh', // already exists
        name: 'Nguyễn Minh Anh Mới',
        department: 'Kinh doanh',
        role: 'staff',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ValidationError')
    expect(res.body.message).toContain('đã tồn tại')
  })

  it('should_reject_creating_second_department_head_for_a_department', async () => {
    const { app, adminToken } = await setupCms()

    // IT department already has vankhoa as head
    const res = await request(app)
      .post('/api/cms/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'new_it_head',
        name: 'Trần Văn Mới',
        department: 'Công nghệ thông tin',
        role: 'head',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ValidationError')
    expect(res.body.message).toContain('Mỗi phòng luôn có đúng một Trưởng phòng')
  })

  it('should_return_assigned_tickets_to_department_queue_when_member_is_locked', async () => {
    const { app, store, adminToken } = await setupCms()

    // Create active ticket assigned to giahuy (staff in IT)
    const activeTicket: Ticket = {
      id: 'TK-ASSIGNED-01',
      title: 'Ticket for locked member test',
      description: 'Testing return to department queue',
      priority: 'high',
      status: 'in_progress',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      createdAt: '2026-11-05T08:00:00Z',
      updatedAt: '2026-11-05T08:00:00Z',
      attachments: [],
      comments: [],
    }
    await store.tickets.save(activeTicket)

    // Find giahuy user id
    const giaHuy = await store.members.findByUsername('giahuy')
    expect(giaHuy).not.toBeNull()

    // Lock giahuy
    const lockRes = await request(app)
      .post(`/api/cms/members/${giaHuy!.id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(lockRes.status).toBe(200)
    expect(lockRes.body.reassignedTicketsCount).toBeGreaterThanOrEqual(1)

    // Check ticket state
    const updatedTicket = await store.tickets.findById('TK-ASSIGNED-01')
    expect(updatedTicket).not.toBeNull()
    expect(updatedTicket?.assigneeName).toBeUndefined()
    expect(updatedTicket?.status).toBe('open')
    expect(updatedTicket?.assignmentHistory).toBeDefined()
    expect(updatedTicket?.assignmentHistory?.at(-1)?.from).toBe('Hoàng Gia Huy')
    expect(updatedTicket?.statusHistory?.at(-1)?.reason).toContain('bị khóa tài khoản')
  })

  it('should_record_audit_log_without_passwords_on_each_administrative_operation', async () => {
    const { app, adminToken } = await setupCms()

    // Create a new member
    const createRes = await request(app)
      .post('/api/cms/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'thanhvan',
        name: 'Lê Thanh Vân',
        department: 'Hành chính',
        role: 'staff',
        tempPassword: 'secretTempPassword999',
      })

    expect(createRes.status).toBe(201)
    const newId = createRes.body.member.id

    // Reset password
    const resetRes = await request(app)
      .post(`/api/cms/members/${newId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tempPassword: 'anotherSecretPassword111' })

    expect(resetRes.status).toBe(200)

    // Check audit logs
    const logsRes = await request(app)
      .get('/api/cms/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(logsRes.status).toBe(200)
    const logs = logsRes.body.auditLogs

    const createLog = logs.find((l: any) => l.action === 'create_member' && l.entityId === newId)
    expect(createLog).toBeDefined()
    expect(createLog.details).not.toContain('secretTempPassword999')
    expect(createLog.details).not.toContain('passwordHash')

    const resetLog = logs.find((l: any) => l.action === 'reset_password' && l.entityId === newId)
    expect(resetLog).toBeDefined()
    expect(resetLog.details).not.toContain('anotherSecretPassword111')
  })
})
