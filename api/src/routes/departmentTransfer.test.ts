import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'
import type { DbMember } from '../repositories/interfaces.ts'

const PASSWORD = 'ticket123'
const SOURCE_DEPARTMENT = 'Kinh doanh'
const TARGET_DEPARTMENT = 'Marketing'
const SOURCE_HEAD = 'quocbao'
const TARGET_HEAD = 'khanhlinh'
const IDLE_STAFF_USERNAME = 'nhanvienrảnh'

describe('Department transfer requests', () => {
  async function setup() {
    const store = new InMemoryTicketStore()
    await seedDatabase(store, new Date('2026-11-05T12:00:00Z'))
    const passwordHash = await Bun.password.hash(PASSWORD, { algorithm: 'bcrypt', cost: 4 })
    // A member without assigned tickets, so only the rule under test can block the move
    const idleStaff: DbMember = {
      id: crypto.randomUUID(),
      username: IDLE_STAFF_USERNAME,
      name: 'Nhân Viên Rảnh',
      department: SOURCE_DEPARTMENT,
      role: 'staff',
      isDepartmentHead: false,
      isActive: true,
      passwordHash,
      requiresPasswordChange: false,
      isVerified: true,
    }
    await store.members.save(idleStaff)
    const app = createApp(loadEnvironmentConfig({ NODE_ENV: 'development' }), { store })

    async function login(username: string): Promise<string> {
      const res = await request(app).post('/api/auth/login').send({ username, password: PASSWORD })
      return res.body.token
    }
    return { app, store, login }
  }

  async function requestTransfer(app: ReturnType<typeof createApp>, token: string, toDepartment: string) {
    return request(app).post('/api/department-transfers').set('Authorization', `Bearer ${token}`).send({ toDepartment })
  }

  it('should_create_pending_request_and_notify_releasing_head_when_staff_requests_transfer', async () => {
    const { app, login } = await setup()
    const staffToken = await login(IDLE_STAFF_USERNAME)
    const headToken = await login(SOURCE_HEAD)

    const created = await requestTransfer(app, staffToken, TARGET_DEPARTMENT)

    expect(created.status).toBe(201)
    expect(created.body.transfer).toMatchObject({ status: 'pending', fromDepartment: SOURCE_DEPARTMENT, toDepartment: TARGET_DEPARTMENT })
    const notifications = await request(app).get('/api/notifications').set('Authorization', `Bearer ${headToken}`)
    expect(notifications.body.notifications.some((item: { type: string }) => item.type === 'department_transfer_requested')).toBe(true)
  })

  it('should_reject_second_request_when_one_is_already_pending', async () => {
    const { app, login } = await setup()
    const staffToken = await login(IDLE_STAFF_USERNAME)
    await requestTransfer(app, staffToken, TARGET_DEPARTMENT)

    const second = await requestTransfer(app, staffToken, 'Kế toán')

    expect(second.status).toBe(409)
  })

  it('should_reject_request_when_target_is_current_or_unknown_department', async () => {
    const { app, login } = await setup()
    const staffToken = await login(IDLE_STAFF_USERNAME)

    expect((await requestTransfer(app, staffToken, SOURCE_DEPARTMENT)).status).toBe(400)
    expect((await requestTransfer(app, staffToken, 'Phòng không tồn tại')).status).toBe(400)
  })

  it('should_reject_request_when_requester_is_department_head', async () => {
    const { app, login } = await setup()

    const res = await requestTransfer(app, await login(SOURCE_HEAD), TARGET_DEPARTMENT)

    expect(res.status).toBe(403)
  })

  it('should_move_member_and_notify_when_releasing_head_approves', async () => {
    const { app, store, login } = await setup()
    const staffToken = await login(IDLE_STAFF_USERNAME)
    const headToken = await login(SOURCE_HEAD)
    const created = await requestTransfer(app, staffToken, TARGET_DEPARTMENT)

    const incoming = await request(app).get('/api/department-transfers/incoming').set('Authorization', `Bearer ${headToken}`)
    expect(incoming.body.transfers.map((item: { id: string }) => item.id)).toEqual([created.body.transfer.id])

    const approved = await request(app)
      .post(`/api/department-transfers/${created.body.transfer.id}/approve`)
      .set('Authorization', `Bearer ${headToken}`)

    expect(approved.status).toBe(200)
    expect(approved.body.transfer.status).toBe('approved')
    expect((await store.members.findByUsername(IDLE_STAFF_USERNAME))?.department).toBe(TARGET_DEPARTMENT)
    // The open session reflects the new department without logging in again
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${staffToken}`)
    expect(me.body.user.department).toBe(TARGET_DEPARTMENT)
    const staffNotices = await request(app).get('/api/notifications').set('Authorization', `Bearer ${staffToken}`)
    expect(staffNotices.body.notifications.some((item: { type: string }) => item.type === 'department_transfer_approved')).toBe(true)
    const targetHeadNotices = await request(app).get('/api/notifications').set('Authorization', `Bearer ${await login(TARGET_HEAD)}`)
    expect(targetHeadNotices.body.notifications.some((item: { type: string }) => item.type === 'department_transfer_approved')).toBe(true)
  })

  it('should_keep_department_and_store_reason_when_head_rejects', async () => {
    const { app, store, login } = await setup()
    const staffToken = await login(IDLE_STAFF_USERNAME)
    const headToken = await login(SOURCE_HEAD)
    const created = await requestTransfer(app, staffToken, TARGET_DEPARTMENT)

    const withoutReason = await request(app)
      .post(`/api/department-transfers/${created.body.transfer.id}/reject`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({})
    expect(withoutReason.status).toBe(400)

    const rejected = await request(app)
      .post(`/api/department-transfers/${created.body.transfer.id}/reject`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ reason: 'Đang thiếu người' })

    expect(rejected.status).toBe(200)
    expect(rejected.body.transfer).toMatchObject({ status: 'rejected', rejectReason: 'Đang thiếu người' })
    expect((await store.members.findByUsername(IDLE_STAFF_USERNAME))?.department).toBe(SOURCE_DEPARTMENT)
    const mine = await request(app).get('/api/department-transfers/mine').set('Authorization', `Bearer ${staffToken}`)
    expect(mine.body.transfer.status).toBe('rejected')
  })

  it('should_forbid_decision_when_viewer_is_not_head_of_releasing_department', async () => {
    const { app, login } = await setup()
    const created = await requestTransfer(app, await login(IDLE_STAFF_USERNAME), TARGET_DEPARTMENT)

    const byOtherHead = await request(app)
      .post(`/api/department-transfers/${created.body.transfer.id}/approve`)
      .set('Authorization', `Bearer ${await login(TARGET_HEAD)}`)
    const byStaff = await request(app)
      .post(`/api/department-transfers/${created.body.transfer.id}/approve`)
      .set('Authorization', `Bearer ${await login('minhanh')}`)

    expect(byOtherHead.status).toBe(403)
    expect(byStaff.status).toBe(403)
  })

  it('should_block_approval_when_member_still_has_active_assigned_tickets', async () => {
    const { app, store, login } = await setup()
    const staffWithTickets = await Promise.all(
      (await store.members.findAll())
        .filter((member) => member.role === 'staff')
        .map(async (member) => ({ member, tickets: await store.tickets.findActiveByAssignee(member.name) })),
    )
    // The seed data assigns open work to at least one staff member
    const assignedStaff = staffWithTickets.find((entry) => entry.tickets.length > 0)?.member
    expect(assignedStaff).toBeDefined()
    const staffToken = await login(assignedStaff!.username)
    const headToken = await login((await store.members.findHeads([assignedStaff!.department]))[0].username)
    const otherDepartment = assignedStaff!.department === TARGET_DEPARTMENT ? SOURCE_DEPARTMENT : TARGET_DEPARTMENT
    const created = await requestTransfer(app, staffToken, otherDepartment)

    const res = await request(app)
      .post(`/api/department-transfers/${created.body.transfer.id}/approve`)
      .set('Authorization', `Bearer ${headToken}`)

    expect(res.status).toBe(409)
    expect((await store.members.findById(assignedStaff!.id))?.department).toBe(assignedStaff!.department)
  })

  it('should_allow_requester_to_cancel_pending_request', async () => {
    const { app, login } = await setup()
    const staffToken = await login(IDLE_STAFF_USERNAME)
    await requestTransfer(app, staffToken, TARGET_DEPARTMENT)

    const cancelled = await request(app).delete('/api/department-transfers/mine').set('Authorization', `Bearer ${staffToken}`)
    const mine = await request(app).get('/api/department-transfers/mine').set('Authorization', `Bearer ${staffToken}`)

    expect(cancelled.status).toBe(200)
    expect(mine.body.transfer.status).toBe('cancelled')
  })
})
