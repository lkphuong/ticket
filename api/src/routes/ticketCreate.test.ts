import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'
import { TicketService } from '../tickets/ticketService.ts'

describe('Create Ticket API', () => {
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

    // Authenticate Staff in Kinh doanh (minhanh)
    const staffKinhDoanhLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const staffToken = staffKinhDoanhLogin.body.token

    // Authenticate Head in Kinh doanh (quocbao)
    const headKinhDoanhLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'quocbao', password: 'ticket123' })
    const headToken = headKinhDoanhLogin.body.token

    return { app, store, fixedNow, adminToken, staffToken, headToken }
  }

  it('should_reject_admin_from_creating_tickets_with_forbidden_status', async () => {
    const { app, adminToken } = await setup()

    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Thử nghiệm tạo ticket bởi Admin',
        description: 'Mô tả chi tiết yêu cầu cần hỗ trợ kỹ thuật',
        purpose: 'Kiểm tra quyền hạn tạo ticket',
        expectedResult: 'Hệ thống từ chối yêu cầu tạo ticket',
        priority: 'high',
        toDepartment: 'Kế toán',
      })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Forbidden')
    expect(res.body.message).toBe('Quản trị viên chỉ có quyền giám sát, không được tạo Ticket.')
  })

  it('should_return_comprehensive_validation_errors_for_each_invalid_field', async () => {
    const { app, staffToken } = await setup()

    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: '',
        description: 'Ngắn',
        purpose: 'Ngắn',
        expectedResult: 'Ngắn',
        priority: 'invalid_priority',
        toDepartment: '',
        dueDate: '2026-11-01', // Date in the past relative to 2026-11-05
        attachments: [
          { name: 'oversized.zip', sizeKb: 15 * 1024 }, // Exceeds 10MB limit
        ],
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ValidationError')
    const errors = res.body.errors
    expect(errors.title).toBe('Vui lòng nhập tiêu đề.')
    expect(errors.description).toContain('ít nhất 10 ký tự')
    expect(errors.purpose).toContain('ít nhất 10 ký tự')
    expect(errors.expectedResult).toContain('ít nhất 10 ký tự')
    expect(errors.priority).toBe('Vui lòng chọn mức độ ưu tiên hợp lệ.')
    expect(errors.toDepartment).toBe('Vui lòng chọn phòng ban xử lý.')
    expect(errors.dueDate).toBe('Hạn xử lý không được ở quá khứ.')
    expect(errors.attachments).toContain('tối đa 10 MB')
  })

  it('should_enforce_cross_department_rule_prohibiting_tickets_sent_to_own_department', async () => {
    const { app, staffToken } = await setup()

    // Staff in Kinh doanh attempts to send a ticket to Kinh doanh
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Yêu cầu nội bộ trong phòng',
        description: 'Mô tả chi tiết yêu cầu cần hỗ trợ nội bộ phòng',
        purpose: 'Mục đích kiểm tra quy tắc phòng ban tiếp nhận',
        expectedResult: 'Hệ thống báo lỗi không cho gửi cho chính phòng mình',
        priority: 'medium',
        toDepartment: 'Kinh doanh',
      })

    expect(res.status).toBe(400)
    expect(res.body.errors.toDepartment).toBe('Phòng ban xử lý phải khác phòng ban của bạn.')
  })

  it('should_derive_default_due_date_from_sla_when_due_date_is_omitted', async () => {
    const { app, staffToken } = await setup()

    // Priority 'high' has 24 hours SLA; fixedNow is 2026-11-05T10:00:00Z -> target is 2026-11-06
    const highRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Yêu cầu hỗ trợ hạ tầng máy chủ',
        description: 'Cần hỗ trợ mở port 443 và 80 trên tường lửa',
        purpose: 'Phục vụ triển khai dịch vụ nội bộ mới',
        expectedResult: 'Các cổng mạng được thông suốt',
        priority: 'high',
        toDepartment: 'Công nghệ thông tin',
      })

    expect(highRes.status).toBe(201)
    expect(highRes.body.ticket.dueDate).toBe('2026-11-06')

    // Priority 'medium' has 72 hours (3 days) SLA -> target is 2026-11-08
    const medRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Cấp tài khoản phần mềm kế toán',
        description: 'Cần cấp quyền truy cập phần mềm MISA',
        purpose: 'Phục vụ đối soát chứng từ hàng tháng',
        expectedResult: 'Tài khoản đăng nhập thành công',
        priority: 'medium',
        toDepartment: 'Kế toán',
      })

    expect(medRes.status).toBe(201)
    expect(medRes.body.ticket.dueDate).toBe('2026-11-08')
  })

  it('should_store_department_snapshot_and_initial_status_history', async () => {
    const { app, staffToken } = await setup()

    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Hỗ trợ hợp đồng kinh tế mẫu',
        description: 'Soát xét phụ lục hợp đồng phân phối sản phẩm',
        purpose: 'Đảm bảo tuân thủ các điều khoản pháp lý hiện hành',
        expectedResult: 'Bản phụ lục hợp đồng hoàn chỉnh có ý kiến pháp chế',
        priority: 'urgent',
        toDepartment: 'Pháp chế',
        dueDate: '2026-11-07',
        attachments: [{ name: 'hop_dong.docx', sizeKb: 256 }],
      })

    expect(res.status).toBe(201)
    const ticket = res.body.ticket
    expect(ticket.fromDepartment).toBe('Kinh doanh')
    expect(ticket.toDepartment).toBe('Pháp chế')
    expect(ticket.requesterName).toBe('Nguyễn Minh Anh')
    expect(ticket.status).toBe('open')
    expect(ticket.attachments.length).toBe(1)
    expect(ticket.attachments[0].name).toBe('hop_dong.docx')
    expect(ticket.statusHistory.length).toBe(1)
    expect(ticket.statusHistory[0].status).toBe('open')
    expect(ticket.statusHistory[0].actor.name).toBe('Nguyễn Minh Anh')
    expect(ticket.statusHistory[0].actor.department).toBe('Kinh doanh')
  })

  it('should_allocate_unique_ticket_ids_and_codes_under_concurrent_ticket_creation', async () => {
    const { app, staffToken } = await setup()

    // Dispatch 10 simultaneous creation requests
    const count = 10
    const creationPromises = Array.from({ length: count }, (_, index) =>
      request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          title: `Yêu cầu đồng thời số ${index + 1}`,
          description: `Mô tả chi tiết nội dung cho yêu cầu đồng thời số ${index + 1}`,
          purpose: `Mục đích xử lý công việc cho yêu cầu đồng thời số ${index + 1}`,
          expectedResult: `Kết quả hoàn thành cho yêu cầu đồng thời số ${index + 1}`,
          priority: 'medium',
          toDepartment: 'Công nghệ thông tin',
        }),
    )

    const responses = await Promise.all(creationPromises)

    for (const res of responses) {
      expect(res.status).toBe(201)
    }

    const tickets = responses.map((res) => res.body.ticket)

    // Verify all generated identifiers and codes are strictly unique and well formed
    expect(new Set(tickets.map((ticket) => ticket.id)).size).toBe(count)
    expect(new Set(tickets.map((ticket) => ticket.code)).size).toBe(count)
    for (const ticket of tickets) {
      expect(ticket.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      expect(ticket.code).toMatch(/^TCK-CNTT-\d{4}-\d{3,}$/)
    }
  })
})
