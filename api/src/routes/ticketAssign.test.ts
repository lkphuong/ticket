import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import type { Ticket } from '@vtdesk/domain'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'
import { TicketService } from '../tickets/ticketService.ts'

describe('Ticket Assignment, Handoff, Priority & Due Date API', () => {
  async function setup() {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    const fixedNow = new Date('2026-11-05T10:00:00.000Z')
    await seedDatabase(store, fixedNow)

    const ticketService = new TicketService(store, () => fixedNow)
    const app = createApp(config, { store, ticketService })

    // Authenticate Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'ticket123' })
    const adminToken = adminLogin.body.token

    // Authenticate Head of Cong nghe thong tin (vankhoa) - Receiving Head
    const headItLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vankhoa', password: 'ticket123' })
    const headItToken = headItLogin.body.token

    // Authenticate Staff in Cong nghe thong tin (giahuy) - Specialist
    const staffItLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'giahuy', password: 'ticket123' })
    const staffItToken = staffItLogin.body.token

    // Authenticate Head of Kinh doanh (quocbao) - Sending Head
    const headKinhDoanhLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'quocbao', password: 'ticket123' })
    const headKinhDoanhToken = headKinhDoanhLogin.body.token

    // Authenticate Staff in Kinh doanh (minhanh) - Requester
    const staffKinhDoanhLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const staffKinhDoanhToken = staffKinhDoanhLogin.body.token

    return {
      app,
      store,
      fixedNow,
      adminToken,
      headItToken,
      staffItToken,
      headKinhDoanhToken,
      staffKinhDoanhToken,
    }
  }

  it('should_only_permit_receiving_department_head_to_assign_ticket', async () => {
    const { app, store, adminToken, staffKinhDoanhToken, headKinhDoanhToken, headItToken } = await setup()

    // Create an open ticket sent to Cong nghe thong tin
    const ticket: Ticket = {
      id: 'TCK-ASSIGN-TEST-1',
      title: 'Hỗ trợ sự cố mạng văn phòng',
      description: 'Mất kết nối Internet tại tầng 3 tòa nhà',
      purpose: 'Khôi phục kết nối cho bộ phận kinh doanh',
      expectedResult: 'Mạng hoạt động ổn định',
      priority: 'high',
      status: 'open',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T08:00:00.000Z',
      comments: [],
      statusHistory: [{ status: 'open', at: '2026-11-05T08:00:00.000Z' }],
    }
    await store.tickets.save(ticket)

    // 1. Admin attempted assignment is rejected with 403 Forbidden
    const adminRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigneeName: 'Hoàng Gia Huy' })
    expect(adminRes.status).toBe(403)
    expect(adminRes.body.error).toBe('Forbidden')

    // 2. Staff attempted assignment is rejected with 403 Forbidden
    const staffRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${staffKinhDoanhToken}`)
      .send({ assigneeName: 'Hoàng Gia Huy' })
    expect(staffRes.status).toBe(403)
    expect(staffRes.body.error).toBe('Forbidden')

    // 3. Sending Department Head attempted assignment is rejected with 403 Forbidden
    const sendingHeadRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${headKinhDoanhToken}`)
      .send({ assigneeName: 'Hoàng Gia Huy' })
    expect(sendingHeadRes.status).toBe(403)
    expect(sendingHeadRes.body.error).toBe('Forbidden')

    // 4. Receiving Department Head assignment succeeds
    const receivingHeadRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${headItToken}`)
      .send({ assigneeName: 'Hoàng Gia Huy' })
    expect(receivingHeadRes.status).toBe(200)
    expect(receivingHeadRes.body.ticket.assigneeName).toBe('Hoàng Gia Huy')
  })

  it('should_reject_assigning_inactive_tickets_or_assignees_outside_receiving_department', async () => {
    const { app, store, headItToken } = await setup()

    // 1. Reject inactive (closed) ticket assignment
    const closedTicket: Ticket = {
      id: 'TCK-CLOSED-TEST',
      title: 'Yêu cầu đã hoàn thành',
      description: 'Mô tả ticket đã kết thúc chu kỳ xử lý',
      purpose: 'Mục đích kiểm tra ràng buộc trạng thái đóng',
      expectedResult: 'Từ chối phân công',
      priority: 'low',
      status: 'closed',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      attachments: [],
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-02T08:00:00.000Z',
      comments: [],
    }
    await store.tickets.save(closedTicket)

    const closedRes = await request(app)
      .patch(`/api/tickets/${closedTicket.id}/assign`)
      .set('Authorization', `Bearer ${headItToken}`)
      .send({ assigneeName: 'Hoàng Gia Huy' })
    expect(closedRes.status).toBe(400)
    expect(closedRes.body.message).toContain('Chỉ phân công được yêu cầu còn hoạt động')

    // 2. Reject assignment to an employee from another department
    const openTicket: Ticket = {
      id: 'TCK-OPEN-TEST',
      title: 'Cài phần mềm đồ họa',
      description: 'Cài đặt Adobe Illustrator bản quyền',
      purpose: 'Phục vụ thiết kế tài liệu tiếp thị',
      expectedResult: 'Phần mềm cài đặt xong',
      priority: 'medium',
      status: 'open',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T08:00:00.000Z',
      comments: [],
    }
    await store.tickets.save(openTicket)

    // 'Lê Thu Hà' is in Kế toán, not Công nghệ thông tin
    const foreignMemberRes = await request(app)
      .patch(`/api/tickets/${openTicket.id}/assign`)
      .set('Authorization', `Bearer ${headItToken}`)
      .send({ assigneeName: 'Lê Thu Hà' })
    expect(foreignMemberRes.status).toBe(400)
    expect(foreignMemberRes.body.message).toContain('phải là thành viên đang hoạt động của phòng tiếp nhận')
  })

  it('should_automatically_transition_open_ticket_to_in_progress_upon_assignment', async () => {
    const { app, store, headItToken } = await setup()

    const openTicket: Ticket = {
      id: 'TCK-AUTO-TRANSITION',
      title: 'Cấp thẻ từ ra vào văn phòng',
      description: 'Làm lại thẻ từ cho nhân viên mới chuyển bộ phận',
      purpose: 'Đảm bảo an ninh ra vào tòa nhà',
      expectedResult: 'Thẻ từ quẹt cửa thành công',
      priority: 'medium',
      status: 'open',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T08:00:00.000Z',
      comments: [],
      statusHistory: [{ status: 'open', at: '2026-11-05T08:00:00.000Z' }],
    }
    await store.tickets.save(openTicket)

    const res = await request(app)
      .patch(`/api/tickets/${openTicket.id}/assign`)
      .set('Authorization', `Bearer ${headItToken}`)
      .send({ assigneeName: 'Hoàng Gia Huy' })

    expect(res.status).toBe(200)
    const updated = res.body.ticket
    expect(updated.status).toBe('in_progress')
    expect(updated.assigneeName).toBe('Hoàng Gia Huy')

    // Status history must log transition from open to in_progress
    const inProgressEntry = updated.statusHistory.find((h: any) => h.status === 'in_progress')
    expect(inProgressEntry).toBeDefined()
    expect(inProgressEntry.actor.name).toBe('Đặng Văn Khoa')
    expect(inProgressEntry.actor.department).toBe('Công nghệ thông tin')
  })

  it('should_record_comprehensive_handoff_history_when_reassigning_specialist', async () => {
    const { app, store, headItToken } = await setup()

    // Seed ticket already assigned to Hoang Gia Huy
    const assignedTicket: Ticket = {
      id: 'TCK-HANDOFF-TEST',
      title: 'Kiểm tra hạ tầng mạng Wi-Fi',
      description: 'Tốc độ mạng chập chờn tại phòng họp lớn',
      purpose: 'Chuẩn bị họp trực tuyến với đối tác',
      expectedResult: 'Mạng Wi-Fi ổn định không ngắt quãng',
      priority: 'high',
      status: 'in_progress',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T08:30:00.000Z',
      comments: [],
      assignmentHistory: [
        {
          to: 'Hoàng Gia Huy',
          at: '2026-11-05T08:30:00.000Z',
          actor: { name: 'Đặng Văn Khoa', department: 'Công nghệ thông tin' },
        },
      ],
    }
    await store.tickets.save(assignedTicket)

    // Reassign from Hoang Gia Huy to Chu Tuan Anh (both in CNTT)
    const res = await request(app)
      .patch(`/api/tickets/${assignedTicket.id}/assign`)
      .set('Authorization', `Bearer ${headItToken}`)
      .send({ assigneeName: 'Chu Tuấn Anh' })

    expect(res.status).toBe(200)
    const updated = res.body.ticket
    expect(updated.assigneeName).toBe('Chu Tuấn Anh')

    // Verify handoff entry in assignmentHistory
    expect(updated.assignmentHistory.length).toBe(2)
    const handoffEntry = updated.assignmentHistory[1]
    expect(handoffEntry.from).toBe('Hoàng Gia Huy')
    expect(handoffEntry.to).toBe('Chu Tuấn Anh')
    expect(handoffEntry.actor.name).toBe('Đặng Văn Khoa')
    expect(handoffEntry.actor.department).toBe('Công nghệ thông tin')
  })

  it('should_validate_and_update_due_date_preventing_past_dates', async () => {
    const { app, store, headItToken, staffItToken } = await setup()

    const ticket: Ticket = {
      id: 'TCK-DUE-DATE-TEST',
      title: 'Thiết lập máy chủ phát triển',
      description: 'Khởi tạo VPS Ubuntu cho đội lập trình',
      purpose: 'Môi trường kiểm thử tính năng',
      expectedResult: 'Máy chủ truy cập được qua SSH',
      priority: 'medium',
      status: 'in_progress',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      attachments: [],
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T08:00:00.000Z',
      dueDate: '2026-11-10',
      comments: [],
    }
    await store.tickets.save(ticket)

    // 1. Setting past due date is rejected
    const pastRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/due-date`)
      .set('Authorization', `Bearer ${headItToken}`)
      .send({ dueDate: '2026-11-01' })

    expect(pastRes.status).toBe(400)
    expect(pastRes.body.error).toBe('ValidationError')
    expect(pastRes.body.message).toContain('Hạn chót mới không được ở quá khứ')

    // 2. Setting valid future date by Assigned Specialist succeeds
    const futureRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/due-date`)
      .set('Authorization', `Bearer ${staffItToken}`)
      .send({ dueDate: '2026-11-15' })

    expect(futureRes.status).toBe(200)
    expect(futureRes.body.ticket.dueDate).toBe('2026-11-15')
  })

  it('should_update_priority_by_authorized_requester_or_receiving_head', async () => {
    const { app, store, headItToken, staffKinhDoanhToken } = await setup()

    const ticket: Ticket = {
      id: 'TCK-PRIO-TEST',
      title: 'Bảo trì hệ thống định kỳ',
      description: 'Nâng cấp phiên bản cơ sở dữ liệu',
      purpose: 'Vá các lỗ hổng bảo mật',
      expectedResult: 'Cơ sở dữ liệu hoạt động bình thường',
      priority: 'low',
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

    // Requester updates priority to urgent
    const reqRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/priority`)
      .set('Authorization', `Bearer ${staffKinhDoanhToken}`)
      .send({ priority: 'urgent' })

    expect(reqRes.status).toBe(200)
    expect(reqRes.body.ticket.priority).toBe('urgent')

    // Receiving head updates priority to high
    const headRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/priority`)
      .set('Authorization', `Bearer ${headItToken}`)
      .send({ priority: 'high' })

    expect(headRes.status).toBe(200)
    expect(headRes.body.ticket.priority).toBe('high')
  })
})
