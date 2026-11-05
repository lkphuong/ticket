import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import type { Ticket } from '@vtdesk/domain'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

describe('CMS Request Templates & Default SLAs', () => {
  async function setup() {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    await seedDatabase(store, new Date('2026-11-05T12:00:00Z'))
    const app = createApp(config, { store })

    // Login as Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'ticket123' })
    const adminToken = adminLogin.body.token

    // Login as Staff (minhanh in Kinh doanh)
    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const staffToken = staffLogin.body.token

    return { app, store, adminToken, staffToken }
  }

  it('should_allow_staff_and_head_to_read_active_templates_and_slas', async () => {
    const { app, staffToken } = await setup()

    const tplRes = await request(app)
      .get('/api/templates')
      .set('Authorization', `Bearer ${staffToken}`)

    expect(tplRes.status).toBe(200)
    expect(tplRes.body.templates.length).toBeGreaterThan(0)
    expect(tplRes.body.templates.every((t: any) => t.isActive)).toBe(true)

    const slaRes = await request(app)
      .get('/api/slas')
      .set('Authorization', `Bearer ${staffToken}`)

    expect(slaRes.status).toBe(200)
    expect(slaRes.body.slas.length).toBe(4) // urgent, high, medium, low
  })

  it('should_reject_staff_when_attempting_to_modify_templates_or_slas', async () => {
    const { app, staffToken } = await setup()

    // Staff cannot create template
    const createRes = await request(app)
      .post('/api/cms/templates')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        targetDepartment: 'Công nghệ thông tin',
        title: 'Mẫu thử nghiệm',
        description: 'Mô tả mẫu',
      })
    expect(createRes.status).toBe(403)

    // Staff cannot update SLA
    const slaRes = await request(app)
      .put('/api/cms/slas/urgent')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ responseHours: 2, resolutionHours: 6 })
    expect(slaRes.status).toBe(403)
  })

  it('should_allow_admin_to_create_update_template_and_record_audit_log', async () => {
    const { app, adminToken } = await setup()

    const createRes = await request(app)
      .post('/api/cms/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetDepartment: 'Kế toán',
        title: 'Quyết toán công tác phí đặc biệt',
        description: 'Mẫu kê khai quyết toán công tác phí các đoàn công tác',
        purpose: 'Hoàn ứng công tác phí',
        expectedResult: 'Tiền được chuyển khoản trong 48h',
        defaultPriority: 'high',
      })

    expect(createRes.status).toBe(201)
    const newTemplateId = createRes.body.template.id

    // Update template
    const updateRes = await request(app)
      .put(`/api/cms/templates/${newTemplateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Quyết toán công tác phí sửa đổi' })

    expect(updateRes.status).toBe(200)
    expect(updateRes.body.template.title).toBe('Quyết toán công tác phí sửa đổi')

    // Verify audit logs
    const logsRes = await request(app)
      .get('/api/cms/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(logsRes.status).toBe(200)
    const logs = logsRes.body.auditLogs
    expect(logs.some((l: any) => l.action === 'create_template' && l.entityId === newTemplateId)).toBe(true)
    expect(logs.some((l: any) => l.action === 'update_template' && l.entityId === newTemplateId)).toBe(true)
  })

  it('should_reject_invalid_target_department_on_template', async () => {
    const { app, adminToken } = await setup()

    const res = await request(app)
      .post('/api/cms/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetDepartment: 'Phòng Ban Không Tồn Tại',
        title: 'Mẫu không hợp lệ',
        description: 'Mô tả',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ValidationError')
    expect(res.body.message).toContain('không hợp lệ')
  })

  it('should_save_and_read_updated_default_slas_and_not_change_existing_tickets', async () => {
    const { app, store, adminToken } = await setup()

    // 1. Create an existing ticket with snapshot due date
    const existingTicket: Ticket = {
      id: 'TK-SNAPSHOT-01',
      title: 'Ticket with preserved SLA snapshot',
      description: 'Snapshot should not change when default SLA changes',
      priority: 'urgent',
      status: 'open',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      dueDate: '2026-11-06',
      createdAt: '2026-11-05T08:00:00Z',
      updatedAt: '2026-11-05T08:00:00Z',
      attachments: [],
      comments: [],
    }
    await store.tickets.save(existingTicket)

    // 2. Admin updates urgent SLA from 1/4 hours to 2/8 hours
    const updateSlaRes = await request(app)
      .put('/api/cms/slas/urgent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ responseHours: 2, resolutionHours: 8 })

    expect(updateSlaRes.status).toBe(200)
    expect(updateSlaRes.body.sla.responseHours).toBe(2)
    expect(updateSlaRes.body.sla.resolutionHours).toBe(8)

    // 3. Read back SLA
    const getSlaRes = await request(app)
      .get('/api/slas')
      .set('Authorization', `Bearer ${adminToken}`)

    const urgentSla = getSlaRes.body.slas.find((s: any) => s.priority === 'urgent')
    expect(urgentSla.responseHours).toBe(2)
    expect(urgentSla.resolutionHours).toBe(8)

    // 4. Verify existing ticket snapshot remained intact
    const reloaded = await store.tickets.findById('TK-SNAPSHOT-01')
    expect(reloaded).not.toBeNull()
    expect(reloaded?.dueDate).toBe('2026-11-06')
    expect(reloaded?.priority).toBe('urgent')

    // 5. Verify audit log was written for SLA change
    const logsRes = await request(app)
      .get('/api/cms/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)

    const slaLog = logsRes.body.auditLogs.find(
      (l: any) => l.action === 'update_default_sla' && l.entityId === 'urgent',
    )
    expect(slaLog).toBeDefined()
  })
})
