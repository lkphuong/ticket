import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import type { Ticket } from '@vtdesk/domain'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'
import { TicketService } from '../tickets/ticketService.ts'

describe('Ticket Progress Updates, Comments & SLA Pausing API', () => {
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

    // Authenticate Assigned Specialist in CNTT (giahuy)
    const specialistLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'giahuy', password: 'ticket123' })
    const specialistToken = specialistLogin.body.token

    // Authenticate Other Specialist in CNTT (tuananh)
    const otherSpecialistLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'tuananh', password: 'ticket123' })
    const otherSpecialistToken = otherSpecialistLogin.body.token

    // Authenticate Requester in Kinh doanh (minhanh)
    const requesterLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const requesterToken = requesterLogin.body.token

    const setClock = (nextTime: Date) => {
      currentTime = nextTime
    }

    return {
      app,
      store,
      adminToken,
      specialistToken,
      otherSpecialistToken,
      requesterToken,
      setClock,
    }
  }

  it('should_only_permit_assigned_specialist_to_update_progress_status', async () => {
    const { app, store, adminToken, requesterToken, otherSpecialistToken, specialistToken } = await setup()

    const ticket: Ticket = {
      id: 'TCK-PROGRESS-AUTH',
      title: 'Xử lý lỗi máy chủ VPN',
      description: 'Cấu hình lại certificate cho OpenVPN',
      purpose: 'Bảo mật hạ tầng mạng',
      expectedResult: 'VPN kết nối thông suốt',
      priority: 'high',
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
    await store.tickets.save(ticket)

    // Admin rejected with 403
    const adminRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved' })
    expect(adminRes.status).toBe(403)
    expect(adminRes.body.error).toBe('Forbidden')

    // Requester rejected with 403
    const reqRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ status: 'resolved' })
    expect(reqRes.status).toBe(403)

    // Another specialist in the same department rejected with 403
    const otherRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${otherSpecialistToken}`)
      .send({ status: 'resolved' })
    expect(otherRes.status).toBe(403)

    // Assigned specialist succeeds
    const okRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ status: 'waiting', reason: 'Vui lòng cung cấp thêm log kết nối client.' })
    expect(okRes.status).toBe(200)
    expect(okRes.body.ticket.status).toBe('waiting')
  })

  it('should_reject_disallowed_status_transitions_with_clear_vietnamese_message', async () => {
    const { app, store, specialistToken } = await setup()

    const ticket: Ticket = {
      id: 'TCK-BAD-TRANSITION',
      title: 'Cài đặt tường lửa',
      description: 'Mở port và thiết lập iptables',
      purpose: 'Bảo vệ cổng kết nối ứng dụng',
      expectedResult: 'Port mở đúng yêu cầu',
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
    await store.tickets.save(ticket)

    // In_progress cannot transition back to open
    const backToOpenRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ status: 'open' })

    expect(backToOpenRes.status).toBe(400)
    expect(backToOpenRes.body.error).toBe('ValidationError')
    expect(backToOpenRes.body.message).toContain('Không thể chuyển yêu cầu từ trạng thái "Đang xử lý" sang "Mới"')

    // Progress update cannot directly close a ticket
    const directCloseRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ status: 'closed' })

    expect(directCloseRes.status).toBe(400)
    expect(directCloseRes.body.message).toContain('Không thể đóng yêu cầu trực tiếp')
  })

  it('should_record_comment_author_department_and_file_attachments', async () => {
    const { app, store, specialistToken } = await setup()

    const ticket: Ticket = {
      id: 'TCK-COMMENT-TEST',
      title: 'Tạo tài khoản database',
      description: 'Khởi tạo tài khoản MariaDB cho ứng dụng ERP',
      purpose: 'Phục vụ triển khai ERP',
      expectedResult: 'Tài khoản hoạt động',
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
    await store.tickets.save(ticket)

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({
        body: 'Đã tạo tài khoản cơ sở dữ liệu trên cụm thử nghiệm.',
        attachments: [{ name: 'thong_tin_ket_noi.txt', sizeKb: 12 }],
      })

    expect(res.status).toBe(201)
    const comment = res.body.comment
    expect(comment.author).toBe('Hoàng Gia Huy')
    expect(comment.department).toBe('Công nghệ thông tin')
    expect(comment.body).toBe('Đã tạo tài khoản cơ sở dữ liệu trên cụm thử nghiệm.')
    expect(comment.attachments.length).toBe(1)
    expect(comment.attachments[0].name).toBe('thong_tin_ket_noi.txt')
  })

  it('should_prohibit_posting_comments_on_closed_tickets', async () => {
    const { app, store, specialistToken } = await setup()

    const closedTicket: Ticket = {
      id: 'TCK-CLOSED-COMMENT',
      title: 'Đăng ký tên miền',
      description: 'Đăng ký tên miền mới cho sự kiện',
      purpose: 'Triển khai landing page',
      expectedResult: 'Tên miền trỏ về đúng máy chủ',
      priority: 'low',
      status: 'closed',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-03T08:00:00.000Z',
      comments: [],
    }
    await store.tickets.save(closedTicket)

    const res = await request(app)
      .post(`/api/tickets/${closedTicket.id}/comments`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ body: 'Bình luận trên ticket đã hoàn tất' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ValidationError')
    expect(res.body.message).toContain('Yêu cầu đã đóng, không thể thêm trao đổi')
  })

  it('should_resume_to_in_progress_when_requester_replies_to_waiting_ticket', async () => {
    const { app, store, specialistToken, requesterToken } = await setup()

    const waitingTicket: Ticket = {
      id: 'TCK-WAIT-REPLY',
      title: 'Cấp chứng chỉ SSL',
      description: 'Cài đặt Let’s Encrypt trên máy chủ web',
      purpose: 'Mã hóa kết nối HTTPS',
      expectedResult: 'Trang web hiển thị biểu tượng bảo mật',
      priority: 'high',
      status: 'waiting',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T09:00:00.000Z',
      dueDate: '2026-11-10',
      comments: [],
      statusHistory: [
        { status: 'open', at: '2026-11-05T08:00:00.000Z' },
        { status: 'in_progress', at: '2026-11-05T08:30:00.000Z' },
        { status: 'waiting', at: '2026-11-05T09:00:00.000Z', reason: 'Tên miền phụ đã trỏ DNS chưa?' },
      ],
    }
    await store.tickets.save(waitingTicket)

    // 1. Specialist comments -> remains waiting
    const specCommentRes = await request(app)
      .post(`/api/tickets/${waitingTicket.id}/comments`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ body: 'Nhắc nhẹ kiểm tra cấu hình DNS.' })

    expect(specCommentRes.status).toBe(201)
    expect(specCommentRes.body.ticket.status).toBe('waiting')

    // 2. Requester replies -> automatically resumes to in_progress
    const reqCommentRes = await request(app)
      .post(`/api/tickets/${waitingTicket.id}/comments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ body: 'DNS đã trỏ xong về IP máy chủ.' })

    expect(reqCommentRes.status).toBe(201)
    expect(reqCommentRes.body.ticket.status).toBe('in_progress')
    const lastHistory = reqCommentRes.body.ticket.statusHistory.at(-1)
    expect(lastHistory.status).toBe('in_progress')
    expect(lastHistory.actor.name).toBe('Nguyễn Minh Anh')
  })

  it('should_accurately_postpone_due_date_by_calendar_days_spent_in_waiting_state', async () => {
    const initialTime = new Date('2026-11-05T10:00:00.000Z')
    const { app, store, requesterToken, setClock } = await setup(initialTime)

    // Ticket entered waiting at 2026-11-05 with original dueDate 2026-11-10
    const ticket: Ticket = {
      id: 'TCK-SLA-PAUSE',
      title: 'Thiết kế báo cáo tùy chỉnh',
      description: 'Lập mẫu biểu doanh thu theo kênh bán hàng',
      purpose: 'Họp ban giám đốc cuối tháng',
      expectedResult: 'Mẫu báo cáo đầy đủ chỉ tiêu',
      priority: 'medium',
      status: 'waiting',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T10:00:00.000Z',
      dueDate: '2026-11-10',
      comments: [],
      statusHistory: [
        { status: 'open', at: '2026-11-05T08:00:00.000Z' },
        { status: 'in_progress', at: '2026-11-05T08:30:00.000Z' },
        { status: 'waiting', at: '2026-11-05T10:00:00.000Z', reason: 'Cần danh sách các cột chỉ tiêu.' },
      ],
    }
    await store.tickets.save(ticket)

    // Advance clock by 3 calendar days to 2026-11-08
    const resumeTime = new Date('2026-11-08T14:30:00.000Z')
    setClock(resumeTime)

    // Requester replies after 3 days of waiting
    const replyRes = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ body: 'Đã gửi file danh sách cột chỉ tiêu qua email.' })

    expect(replyRes.status).toBe(201)
    const updatedTicket = replyRes.body.ticket
    expect(updatedTicket.status).toBe('in_progress')

    // 2026-11-10 postponed by 3 paused days becomes 2026-11-13
    expect(updatedTicket.dueDate).toBe('2026-11-13')
  })
})
