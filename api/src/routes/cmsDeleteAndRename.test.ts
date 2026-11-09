import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

const DEFAULT_PASSWORD = 'ticket123'

describe('CMS member deletion and department maintenance', () => {
  async function setupCms() {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    await seedDatabase(store, new Date('2026-11-05T12:00:00Z'))
    const app = createApp(config, { store })

    const adminLogin = await request(app).post('/api/auth/login').send({ username: 'admin', password: DEFAULT_PASSWORD })
    const adminToken: string = adminLogin.body.token
    return { app, store, adminToken }
  }

  async function createStaffMember(app: ReturnType<typeof createApp>, token: string, username: string, department: string) {
    const res = await request(app)
      .post('/api/cms/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ username, name: `Nhân viên ${username}`, department, role: 'staff' })
    return res.body.member.id as string
  }

  it('should_delete_member_when_member_has_no_ticket_history', async () => {
    const { app, store, adminToken } = await setupCms()
    const memberId = await createStaffMember(app, adminToken, 'tamthoi', 'Công nghệ thông tin')

    const res = await request(app).delete(`/api/cms/members/${memberId}`).set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(await store.members.findById(memberId)).toBeNull()
  })

  it('should_reject_member_deletion_when_member_is_the_signed_in_admin', async () => {
    const { app, store, adminToken } = await setupCms()
    const admin = await store.members.findByUsername('admin')

    const res = await request(app).delete(`/api/cms/members/${admin!.id}`).set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('đang đăng nhập')
  })

  it('should_reject_member_deletion_when_member_is_requester_of_a_ticket', async () => {
    const { app, store, adminToken } = await setupCms()
    const [ticket] = await store.tickets.findAll()
    const requester = (await store.members.findAll()).find((m) => m.name === ticket.requesterName && m.role !== 'head')
    expect(requester).toBeDefined()

    const res = await request(app).delete(`/api/cms/members/${requester!.id}`).set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('khóa tài khoản')
  })

  it('should_rename_department_and_move_its_members_when_name_is_updated', async () => {
    const { app, store, adminToken } = await setupCms()
    await request(app).post('/api/cms/departments').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Phòng thử nghiệm' })
    const memberId = await createStaffMember(app, adminToken, 'thunghiem', 'Phòng thử nghiệm')

    const res = await request(app)
      .put(`/api/cms/departments/${encodeURIComponent('Phòng thử nghiệm')}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Phòng kiểm thử' })

    expect(res.status).toBe(200)
    expect(await store.departments.findAll()).toContain('Phòng kiểm thử')
    expect(await store.departments.findAll()).not.toContain('Phòng thử nghiệm')
    expect((await store.members.findById(memberId))!.department).toBe('Phòng kiểm thử')
  })

  it('should_reject_department_rename_when_code_prefix_belongs_to_another_department', async () => {
    const { app, store, adminToken } = await setupCms()
    await request(app).post('/api/cms/departments').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Phòng mới', codePrefix: 'PMOI' })
    const takenPrefix = await store.departments.findCodePrefix('Công nghệ thông tin')

    const res = await request(app)
      .put(`/api/cms/departments/${encodeURIComponent('Phòng mới')}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ codePrefix: takenPrefix })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Tiền tố')
  })

  it('should_delete_department_when_it_is_empty_and_unreferenced', async () => {
    const { app, store, adminToken } = await setupCms()
    await request(app).post('/api/cms/departments').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Phòng tạm' })

    const res = await request(app)
      .delete(`/api/cms/departments/${encodeURIComponent('Phòng tạm')}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(await store.departments.findAll()).not.toContain('Phòng tạm')
  })

  it('should_reject_department_deletion_when_department_still_has_members', async () => {
    const { app, adminToken } = await setupCms()

    const res = await request(app)
      .delete(`/api/cms/departments/${encodeURIComponent('Công nghệ thông tin')}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('thành viên')
  })
})
