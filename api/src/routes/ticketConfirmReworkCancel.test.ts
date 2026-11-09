import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import { REOPEN_MAX_DAYS } from '@vtdesk/domain'
import type { Ticket } from '@vtdesk/domain'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'
import { TicketService } from '../tickets/ticketService.ts'

describe('Ticket Lifecycle Actions: Confirm, Rework, Reopen & Cancel API', () => {
  async function setup(injectedNow: Date = new Date('2026-11-05T10:00:00.000Z')) {
    let currentTime = injectedNow
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    await seedDatabase(store, currentTime)

    const ticketService = new TicketService(store, () => currentTime)
    const app = createApp(config, { store, ticketService })

    // Authenticate Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'ticket123' })
    const adminToken = adminLogin.body.token

    // Authenticate Receiving Department Head in CNTT (vankhoa)
    const headItLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vankhoa', password: 'ticket123' })
    const headItToken = headItLogin.body.token

    // Authenticate Requester in Kinh doanh (minhanh)
    const requesterLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const requesterToken = requesterLogin.body.token

    // Authenticate Requesting Department Head in Kinh doanh (quocbao)
    const requestingHeadLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'quocbao', password: 'ticket123' })
    const requestingHeadToken = requestingHeadLogin.body.token

    // Authenticate Other Staff in Kinh doanh (quangvinh)
    const otherStaffLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'quangvinh', password: 'ticket123' })
    const otherStaffToken = otherStaffLogin.body.token

    const setClock = (nextTime: Date) => {
      currentTime = nextTime
    }

    return {
      app,
      store,
      adminToken,
      headItToken,
      requesterToken,
      requestingHeadToken,
      otherStaffToken,
      setClock,
    }
  }

  it('should_reject_confirmation_when_ticket_is_not_resolved', async () => {
    const { app, store, requesterToken } = await setup()

    const activeTicket: Ticket = {
      id: 'TCK-CONFIRM-FAIL',
      title: 'Cài đặt hệ điều hành',
      description: 'Cài đặt Windows 11 Pro cho máy bàn',
      purpose: 'Trang bị máy mới',
      expectedResult: 'Máy khởi động bình thường',
      priority: 'medium',
      status: 'in_progress',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T08:00:00.000Z',
      comments: [],
    }
    await store.tickets.save(activeTicket)

    const res = await request(app)
      .post(`/api/tickets/${activeTicket.id}/confirm`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ rating: 5, feedback: 'Rất hài lòng' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ValidationError')
    expect(res.body.message).toContain('Chỉ nghiệm thu được yêu cầu ở trạng thái "Đã xử lý"')
  })

  it('should_validate_csat_rating_between_1_and_5_and_reject_non_integers', async () => {
    const { app, store, requesterToken } = await setup()

    const resolvedTicket: Ticket = {
      id: 'TCK-CSAT-VALIDATION',
      title: 'Khởi tạo tài khoản email',
      description: 'Cấp email @congty.vn cho nhân viên thử việc',
      purpose: 'Giao dịch với khách hàng',
      expectedResult: 'Email gửi nhận được',
      priority: 'high',
      status: 'resolved',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T09:00:00.000Z',
      comments: [],
    }
    await store.tickets.save(resolvedTicket)

    // Test boundary conditions: 0, 6, 3.5, -1
    for (const invalidRating of [0, 6, 3.5, -1]) {
      const res = await request(app)
        .post(`/api/tickets/${resolvedTicket.id}/confirm`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ rating: invalidRating })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('Điểm đánh giá phải là số nguyên từ 1 đến 5')
    }

    // Valid CSAT rating succeeds and moves the ticket to the head approval step
    const validRes = await request(app)
      .post(`/api/tickets/${resolvedTicket.id}/confirm`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ rating: 5, feedback: 'Xử lý cực nhanh và chuyên nghiệp' })

    expect(validRes.status).toBe(200)
    expect(validRes.body.ticket.status).toBe('pending_approval')
    expect(validRes.body.ticket.rating).toBe(5)
    expect(validRes.body.ticket.feedback).toBe('Xử lý cực nhanh và chuyên nghiệp')
  })

  it('should_preserve_assignee_and_entire_history_on_rework_and_reopen', async () => {
    const { app, store, requesterToken } = await setup()

    // 1. Rework scenario
    const resolvedTicket: Ticket = {
      id: 'TCK-REWORK-TEST',
      title: 'Tạo banner khuyến mãi',
      description: 'Thiết kế banner 1200x628 cho mạng xã hội',
      purpose: 'Chạy chiến dịch Black Friday',
      expectedResult: 'Banner đúng kích thước và màu sắc thương hiệu',
      priority: 'medium',
      status: 'resolved',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T09:00:00.000Z',
      comments: [],
      assignmentHistory: [
        {
          to: 'Hoàng Gia Huy',
          at: '2026-11-05T08:15:00.000Z',
          actor: { name: 'Đặng Văn Khoa', department: 'Công nghệ thông tin' },
        },
      ],
      statusHistory: [
        { status: 'open', at: '2026-11-05T08:00:00.000Z' },
        { status: 'in_progress', at: '2026-11-05T08:15:00.000Z' },
        { status: 'resolved', at: '2026-11-05T09:00:00.000Z' },
      ],
    }
    await store.tickets.save(resolvedTicket)

    const reworkRes = await request(app)
      .post(`/api/tickets/${resolvedTicket.id}/rework`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'Font chữ tiêu đề chưa đúng chuẩn thương hiệu.' })

    expect(reworkRes.status).toBe(200)
    const reworked = reworkRes.body.ticket
    expect(reworked.status).toBe('in_progress')
    // Assignee and history are preserved
    expect(reworked.assigneeName).toBe('Hoàng Gia Huy')
    expect(reworked.assignmentHistory.length).toBe(1)
    expect(reworked.statusHistory.length).toBe(4)
    const reworkEntry = reworked.statusHistory.at(-1)
    expect(reworkEntry.status).toBe('in_progress')
    expect(reworkEntry.reason).toBe('Font chữ tiêu đề chưa đúng chuẩn thương hiệu.')

    // 2. Reopen scenario
    const closedTicket: Ticket = {
      id: 'TCK-REOPEN-TEST',
      title: 'Cấp chứng thư số nội bộ',
      description: 'Chứng thư ký tài liệu PDF',
      purpose: 'Ký duyệt tờ trình nội bộ',
      expectedResult: 'Chứng thư hợp lệ',
      priority: 'low',
      status: 'closed',
      rating: 4,
      feedback: 'Tốt',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-02T10:00:00.000Z',
      comments: [],
      statusHistory: [
        { status: 'open', at: '2026-11-01T08:00:00.000Z' },
        { status: 'in_progress', at: '2026-11-01T08:30:00.000Z' },
        { status: 'closed', at: '2026-11-02T10:00:00.000Z' },
      ],
    }
    await store.tickets.save(closedTicket)

    const reopenRes = await request(app)
      .post(`/api/tickets/${closedTicket.id}/reopen`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'Chứng thư bị lỗi không nhận diện trên Adobe Reader.' })

    expect(reopenRes.status).toBe(200)
    const reopened = reopenRes.body.ticket
    expect(reopened.status).toBe('in_progress')
    expect(reopened.assigneeName).toBe('Hoàng Gia Huy')
    expect(reopened.rating).toBeUndefined()
    expect(reopened.feedback).toBeUndefined()
    expect(reopened.statusHistory.length).toBe(4)
    expect(reopened.statusHistory.at(-1).reason).toBe('Chứng thư bị lỗi không nhận diện trên Adobe Reader.')
  })

  it('should_reject_reopening_after_7_days_configured_by_named_constant', async () => {
    // Initial closure at 2026-11-01T08:00:00Z
    const closedTime = new Date('2026-11-01T08:00:00.000Z')
    const { app, store, requesterToken, setClock } = await setup(closedTime)

    const ticket: Ticket = {
      id: 'TCK-EXPIRED-REOPEN',
      title: 'Mở cổng SSH máy chủ',
      description: 'Mở cổng 2222',
      purpose: 'Truy cập quản trị từ xa',
      expectedResult: 'SSH thành công',
      priority: 'medium',
      status: 'closed',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-01T07:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      comments: [],
      statusHistory: [
        { status: 'open', at: '2026-11-01T07:00:00.000Z' },
        { status: 'closed', at: '2026-11-01T08:00:00.000Z' },
      ],
    }
    await store.tickets.save(ticket)

    // Ensure named constant REOPEN_MAX_DAYS is explicitly 7 days
    expect(REOPEN_MAX_DAYS).toBe(7)

    // Advance clock to 8 days later (2026-11-09T08:01:00Z)
    setClock(new Date('2026-11-09T08:01:00.000Z'))

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/reopen`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'Muốn mở lại sau hơn một tuần' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ValidationError')
    expect(res.body.message).toContain('Đã quá thời hạn 7 ngày')
  })

  it('should_prohibit_reopening_cancelled_tickets_and_display_cancellation_reason', async () => {
    const { app, store, requesterToken } = await setup()

    const cancelledTicket: Ticket = {
      id: 'TCK-CANCEL-NO-REOPEN',
      title: 'Mua bản quyền phần mềm đồ họa',
      description: 'Cấp tài khoản Figma Enterprise',
      purpose: 'Phục vụ thiết kế giao diện',
      expectedResult: 'Tài khoản kích hoạt',
      priority: 'high',
      status: 'closed',
      cancelReason: 'Thay đổi nhà cung cấp phần mềm',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T08:30:00.000Z',
      comments: [],
      statusHistory: [
        { status: 'open', at: '2026-11-05T08:00:00.000Z' },
        {
          status: 'closed',
          at: '2026-11-05T08:30:00.000Z',
          reason: 'Thay đổi nhà cung cấp phần mềm',
          actor: { name: 'Nguyễn Minh Anh', department: 'Kinh doanh' },
        },
      ],
    }
    await store.tickets.save(cancelledTicket)

    const res = await request(app)
      .post(`/api/tickets/${cancelledTicket.id}/reopen`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'Thử mở lại yêu cầu đã hủy' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ValidationError')
    expect(res.body.message).toContain('Yêu cầu đã bị hủy nên không thể mở lại')
  })

  it('should_require_cancellation_reason_and_support_requester_or_head_cancellation', async () => {
    const { app, store, requesterToken, headItToken, otherStaffToken } = await setup()

    const activeTicket: Ticket = {
      id: 'TCK-CANCEL-TEST',
      title: 'Cấp phát màn hình phụ',
      description: 'Màn hình 24 inch 1080p',
      purpose: 'Làm việc đa nhiệm',
      expectedResult: 'Màn hình nhận tín hiệu tốt',
      priority: 'medium',
      status: 'in_progress',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T08:00:00.000Z',
      comments: [],
    }
    await store.tickets.save(activeTicket)

    // 1. Missing reason is rejected
    const blankRes = await request(app)
      .post(`/api/tickets/${activeTicket.id}/cancel`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: '   ' })

    expect(blankRes.status).toBe(400)
    expect(blankRes.body.message).toContain('Vui lòng nhập lý do hủy yêu cầu')

    // 2. Unauthorized staff cannot cancel
    const unauthRes = await request(app)
      .post(`/api/tickets/${activeTicket.id}/cancel`)
      .set('Authorization', `Bearer ${otherStaffToken}`)
      .send({ reason: 'Lý do cá nhân' })

    expect(unauthRes.status).toBe(403)

    // 3. Receiving Department Head can cancel/reject
    const headCancelRes = await request(app)
      .post(`/api/tickets/${activeTicket.id}/cancel`)
      .set('Authorization', `Bearer ${headItToken}`)
      .send({ reason: 'Kho thiết bị hiện đã hết màn hình dự phòng.' })

    expect(headCancelRes.status).toBe(200)
    expect(headCancelRes.body.ticket.status).toBe('closed')
    expect(headCancelRes.body.ticket.cancelReason).toBe('Kho thiết bị hiện đã hết màn hình dự phòng.')
  })

  it('should_allow_receiving_department_head_to_view_csat_and_feedback', async () => {
    const { app, store, headItToken } = await setup()

    const confirmedTicket: Ticket = {
      id: 'TCK-HEAD-CSAT-VIEW',
      title: 'Khắc phục sự cố máy in mạng',
      description: 'Máy in kẹt giấy liên tục',
      purpose: 'In hợp đồng kinh tế',
      expectedResult: 'Máy in hoạt động trơn tru',
      priority: 'high',
      status: 'closed',
      rating: 5,
      feedback: 'Kỹ thuật viên hỗ trợ rất nhiệt tình và chu đáo.',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T09:30:00.000Z',
      comments: [],
    }
    await store.tickets.save(confirmedTicket)

    // Receiving Department Head views ticket details
    const res = await request(app)
      .get(`/api/tickets/${confirmedTicket.id}`)
      .set('Authorization', `Bearer ${headItToken}`)

    expect(res.status).toBe(200)
    expect(res.body.ticket.rating).toBe(5)
    expect(res.body.ticket.feedback).toBe('Kỹ thuật viên hỗ trợ rất nhiệt tình và chu đáo.')
  })
  describe('two-step acceptance', () => {
    const pendingTicket = (): Ticket => ({
      id: 'TCK-PENDING-APPROVAL',
      title: 'Cấp quyền truy cập thư mục chung',
      description: 'Cần quyền ghi vào thư mục kế hoạch kinh doanh',
      purpose: 'Chia sẻ tài liệu',
      expectedResult: 'Ghi được tệp',
      priority: 'medium',
      status: 'pending_approval',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      rating: 4,
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T09:00:00.000Z',
      comments: [],
    })

    it('should_close_ticket_when_requesting_head_approves', async () => {
      const { app, store, requestingHeadToken } = await setup()
      const ticket = pendingTicket()
      await store.tickets.save(ticket)

      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/approve`)
        .set('Authorization', `Bearer ${requestingHeadToken}`)

      expect(res.status).toBe(200)
      expect(res.body.ticket.status).toBe('closed')
      expect(res.body.ticket.rating).toBe(4)
    })

    it.each([
      ['requester', 'requesterToken'],
      ['other staff', 'otherStaffToken'],
      ['receiving head', 'headItToken'],
      ['admin', 'adminToken'],
    ] as const)('should_return_403_when_%s_tries_to_approve', async (_label, tokenKey) => {
      const context = await setup()
      const ticket = pendingTicket()
      await context.store.tickets.save(ticket)

      const res = await request(context.app)
        .post(`/api/tickets/${ticket.id}/approve`)
        .set('Authorization', `Bearer ${context[tokenKey]}`)

      expect(res.status).toBe(403)
      const unchanged = await context.store.tickets.findById(ticket.id)
      expect(unchanged?.status).toBe('pending_approval')
    })

    it('should_return_400_when_ticket_is_not_pending_approval', async () => {
      const { app, store, requestingHeadToken } = await setup()
      const ticket: Ticket = { ...pendingTicket(), status: 'resolved' }
      await store.tickets.save(ticket)

      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/approve`)
        .set('Authorization', `Bearer ${requestingHeadToken}`)

      expect(res.status).toBe(400)
    })

    it('should_return_to_in_progress_and_clear_rating_when_head_rejects_with_reason', async () => {
      const { app, store, requestingHeadToken } = await setup()
      const ticket = pendingTicket()
      await store.tickets.save(ticket)

      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/reject-approval`)
        .set('Authorization', `Bearer ${requestingHeadToken}`)
        .send({ reason: 'Chưa đủ quyền ghi' })

      expect(res.status).toBe(200)
      expect(res.body.ticket.status).toBe('in_progress')
      expect(res.body.ticket.rating).toBeUndefined()
      expect(res.body.ticket.assigneeName).toBe('Hoàng Gia Huy')
    })

    it('should_return_400_when_head_rejects_without_reason', async () => {
      const { app, store, requestingHeadToken } = await setup()
      const ticket = pendingTicket()
      await store.tickets.save(ticket)

      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/reject-approval`)
        .set('Authorization', `Bearer ${requestingHeadToken}`)
        .send({ reason: '   ' })

      expect(res.status).toBe(400)
    })

    it('should_return_403_when_non_head_rejects_approval', async () => {
      const { app, store, requesterToken } = await setup()
      const ticket = pendingTicket()
      await store.tickets.save(ticket)

      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/reject-approval`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ reason: 'Tự từ chối' })

      expect(res.status).toBe(403)
    })

    it('should_reject_direct_status_change_to_pending_approval', async () => {
      const { app, store } = await setup()
      const ticket: Ticket = { ...pendingTicket(), status: 'in_progress', rating: undefined }
      await store.tickets.save(ticket)
      const specialistLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: 'giahuy', password: 'ticket123' })

      const res = await request(app)
        .patch(`/api/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${specialistLogin.body.token}`)
        .send({ status: 'pending_approval' })

      expect(res.status).toBe(400)
    })
  })
})
