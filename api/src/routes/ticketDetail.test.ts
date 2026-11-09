import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import type { Ticket } from '@vtdesk/domain'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

describe('Ticket Detail & Timeline API', () => {
  async function setup() {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    const now = new Date('2026-11-05T12:00:00Z')
    await seedDatabase(store, now)
    const app = createApp(config, { store })

    // Authenticate Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'ticket123' })
    const adminToken = adminLogin.body.token

    // Authenticate Head of Kinh doanh (quocbao)
    const headKinhDoanhLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'quocbao', password: 'ticket123' })
    const headKinhDoanhToken = headKinhDoanhLogin.body.token

    // Authenticate Head of Cong nghe thong tin (vankhoa)
    const headItLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vankhoa', password: 'ticket123' })
    const headItToken = headItLogin.body.token

    // Authenticate Staff in Kinh doanh (minhanh)
    const staffKinhDoanhLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const staffKinhDoanhToken = staffKinhDoanhLogin.body.token

    // Authenticate Staff in Ke toan (thuha)
    const staffKeToanLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'thuha', password: 'ticket123' })
    const staffKeToanToken = staffKeToanLogin.body.token

    return {
      app,
      store,
      now,
      adminToken,
      headKinhDoanhToken,
      headItToken,
      staffKinhDoanhToken,
      staffKeToanToken,
    }
  }

  it('should_return_404_when_ticket_is_outside_viewer_visibility_boundary', async () => {
    const { app, store, staffKinhDoanhToken, headKinhDoanhToken, adminToken } = await setup()

    // Create an isolated ticket between Ke toan and CNTT with no Kinh doanh involvement
    const privateTicket: Ticket = {
      id: 'TCK-PRIVATE-01',
      title: 'Yêu cầu mật nội bộ',
      description: 'Chi tiết kế toán kiểm toán',
      priority: 'high',
      status: 'in_progress',
      requesterName: 'Lê Thu Hà', // Ke toan staff
      fromDepartment: 'Kế toán',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:30:00.000Z',
      comments: [],
      statusHistory: [
        { status: 'open', at: '2026-11-01T08:00:00.000Z' },
        { status: 'in_progress', at: '2026-11-01T08:30:00.000Z' },
      ],
    }
    await store.tickets.save(privateTicket)

    // Staff in unrelated department receives 404
    const staffRes = await request(app)
      .get(`/api/tickets/${privateTicket.id}`)
      .set('Authorization', `Bearer ${staffKinhDoanhToken}`)
    expect(staffRes.status).toBe(404)
    expect(staffRes.body.error).toBe('NotFound')

    // Head of unrelated department receives 404
    const headRes = await request(app)
      .get(`/api/tickets/${privateTicket.id}`)
      .set('Authorization', `Bearer ${headKinhDoanhToken}`)
    expect(headRes.status).toBe(404)
    expect(headRes.body.error).toBe('NotFound')

    // System Administrator receives 200 due to supervisor role
    const adminRes = await request(app)
      .get(`/api/tickets/${privateTicket.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(adminRes.status).toBe(200)
    expect(adminRes.body.ticket.id).toBe(privateTicket.id)

    // Missing ID returns 404 for all roles including Admin
    const missingRes = await request(app)
      .get('/api/tickets/TCK-NONEXISTENT')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(missingRes.status).toBe(404)
  })

  it('should_merge_and_return_chronologically_sorted_timeline_and_activity_log', async () => {
    const { app, store, adminToken } = await setup()

    const richTicket: Ticket = {
      id: 'TCK-TIMELINE-01',
      title: 'Cấu hình mạng VPN',
      description: 'Hỗ trợ thiết lập mạng làm việc từ xa',
      priority: 'urgent',
      status: 'in_progress',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [{ name: 'so_do.png', size: 1024 }],
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
      comments: [
        {
          id: 'cmt-1',
          author: 'Hoàng Gia Huy',
          department: 'Công nghệ thông tin',
          body: 'Đang kiểm tra thông số IP tĩnh.',
          createdAt: '2026-11-01T09:00:00.000Z',
        },
      ],
      statusHistory: [
        { status: 'open', at: '2026-11-01T08:00:00.000Z' },
        { status: 'in_progress', at: '2026-11-01T08:45:00.000Z' },
      ],
      assignmentHistory: [
        {
          at: '2026-11-01T08:30:00.000Z',
          to: 'Hoàng Gia Huy',
          actor: { name: 'Đặng Văn Khoa', department: 'Công nghệ thông tin' },
        },
      ],
    }
    await store.tickets.save(richTicket)

    const res = await request(app)
      .get(`/api/tickets/${richTicket.id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)

    // Validate timeline stages
    const timeline = res.body.timeline
    expect(timeline.length).toBe(6) // STAGES: Mới, Đã tiếp nhận, Đang xử lý, Hoàn thành, Chờ duyệt, Nghiệm thu
    expect(timeline[0].state).toBe('done')
    expect(timeline[2].state).toBe('current') // in_progress stage
    expect(timeline[3].state).toBe('upcoming')

    // Validate chronological activity log ordering
    const activityLog = res.body.activityLog
    expect(activityLog.length).toBeGreaterThanOrEqual(4)
    for (let i = 1; i < activityLog.length; i++) {
      const prevTime = Date.parse(activityLog[i - 1].at)
      const currTime = Date.parse(activityLog[i].at)
      expect(currTime).toBeGreaterThanOrEqual(prevTime)
    }

    // Verify activity event types
    const eventKinds = activityLog.map((e: any) => e.kind)
    expect(eventKinds).toContain('created')
    expect(eventKinds).toContain('assigned')
    expect(eventKinds).toContain('status')
    expect(eventKinds).toContain('comment')
  })

  it('should_display_cancellation_reason_and_prohibit_reopening_for_cancelled_ticket', async () => {
    const { app, store, staffKinhDoanhToken } = await setup()

    const cancelledTicket: Ticket = {
      id: 'TCK-CANCELLED-01',
      title: 'Đăng ký sim doanh nghiệp',
      description: 'Cần cấp 1 sim 4G',
      priority: 'low',
      status: 'closed',
      cancelReason: 'Thay đổi kế hoạch dự án',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Hành chính',
      attachments: [],
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-02T09:00:00.000Z',
      comments: [],
      statusHistory: [
        { status: 'open', at: '2026-11-01T08:00:00.000Z' },
        {
          status: 'closed',
          at: '2026-11-02T09:00:00.000Z',
          reason: 'Thay đổi kế hoạch dự án',
          actor: { name: 'Nguyễn Minh Anh', department: 'Kinh doanh' },
        },
      ],
    }
    await store.tickets.save(cancelledTicket)

    const res = await request(app)
      .get(`/api/tickets/${cancelledTicket.id}`)
      .set('Authorization', `Bearer ${staffKinhDoanhToken}`)

    expect(res.status).toBe(200)
    expect(res.body.ticket.status).toBe('closed')
    expect(res.body.ticket.cancelReason).toBe('Thay đổi kế hoạch dự án')

    // Activity log must feature the cancellation entry
    const cancelEvent = res.body.activityLog.find((e: any) => e.kind === 'cancelled')
    expect(cancelEvent).toBeDefined()
    expect(cancelEvent.detail).toBe('Thay đổi kế hoạch dự án')

    // Permissions: Cancelled ticket CANNOT be reopened even by the requester
    expect(res.body.permissions.canReopen).toBe(false)
    expect(res.body.permissions.canConfirmResult).toBe(false)
  })

  it('should_report_accurate_permissions_for_each_viewer_role_and_state', async () => {
    const { app, store, headItToken, staffKinhDoanhToken, adminToken } = await setup()

    // 1. Test Receiving Department Head permissions on unassigned incoming ticket
    const incomingTicket: Ticket = {
      id: 'TCK-INCOMING-IT',
      title: 'Yêu cầu mở port máy chủ',
      description: 'Mở port 8080',
      priority: 'high',
      status: 'open',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      attachments: [],
      createdAt: '2026-11-02T08:00:00.000Z',
      updatedAt: '2026-11-02T08:00:00.000Z',
      comments: [],
    }
    await store.tickets.save(incomingTicket)

    const headItRes = await request(app)
      .get(`/api/tickets/${incomingTicket.id}`)
      .set('Authorization', `Bearer ${headItToken}`)

    expect(headItRes.status).toBe(200)
    expect(headItRes.body.permissions.canAssign).toBe(true)
    expect(headItRes.body.permissions.canCancel).toBe(true)
    expect(headItRes.body.permissions.canEditPriority).toBe(true)

    // Admin has purely supervisor read-only capabilities on tickets
    const adminRes = await request(app)
      .get(`/api/tickets/${incomingTicket.id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(adminRes.status).toBe(200)
    expect(adminRes.body.permissions.canAssign).toBe(false)
    expect(adminRes.body.permissions.canUpdateProgress).toBe(false)
    expect(adminRes.body.permissions.canCancel).toBe(false)

    // 2. Test Requester permissions on resolved ticket
    const resolvedTicket: Ticket = {
      id: 'TCK-RESOLVED-01',
      title: 'Cài đặt bộ Office',
      description: 'Office 365 bản quyền',
      priority: 'medium',
      status: 'resolved',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-03T10:00:00.000Z',
      comments: [],
    }
    await store.tickets.save(resolvedTicket)

    const requesterRes = await request(app)
      .get(`/api/tickets/${resolvedTicket.id}`)
      .set('Authorization', `Bearer ${staffKinhDoanhToken}`)

    expect(requesterRes.status).toBe(200)
    expect(requesterRes.body.permissions.canConfirmResult).toBe(true)
    expect(requesterRes.body.permissions.canReopen).toBe(true)
  })
})
