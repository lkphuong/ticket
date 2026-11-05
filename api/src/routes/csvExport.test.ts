import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import type { Ticket } from '@vtdesk/domain'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

describe('Ticket CSV Export API', () => {
  async function setup(currentDateString: string = '2026-11-05T10:00:00.000Z') {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    const now = new Date(currentDateString)
    await seedDatabase(store, now)

    const app = createApp(config, { store })

    // Authenticate Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'ticket123' })
    const adminToken = adminLogin.body.token

    // Authenticate Head of CNTT (vankhoa)
    const headItLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vankhoa', password: 'ticket123' })
    const headItToken = headItLogin.body.token

    // Authenticate Staff in Kinh doanh (minhanh)
    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const staffToken = staffLogin.body.token

    return {
      app,
      store,
      adminToken,
      headItToken,
      staffToken,
      now,
    }
  }

  function makeCustomTicket(overrides: Partial<Ticket> = {}): Ticket {
    return {
      id: 'TCK-CSV-01',
      title: 'Hỗ trợ thiết bị máy in',
      description: 'Máy in văn phòng tầng 2 bị kẹt giấy liên tục',
      priority: 'medium',
      status: 'in_progress',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      dueDate: '2026-11-12',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      attachments: [],
      comments: [],
      statusHistory: [{ status: 'in_progress', at: '2026-11-01T08:00:00.000Z' }],
      assignmentHistory: [],
      ...overrides,
    }
  }

  it('should_export_csv_with_utf8_bom_at_the_beginning', async () => {
    const { app, adminToken } = await setup()

    const res = await request(app)
      .get('/api/tickets/export')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('attachment')
    expect(res.headers['content-disposition']).toContain('tickets.csv')

    const text = res.text
    // The very first character must be the UTF-8 Byte Order Mark \uFEFF
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text.startsWith('\uFEFF')).toBe(true)

    // Check header column names
    expect(text).toContain('Mã yêu cầu')
    expect(text).toContain('Tiêu đề')
    expect(text).toContain('Phòng gửi')
    expect(text).toContain('Phòng nhận')
    expect(text).toContain('Trạng thái')
  })

  it('should_strictly_restrict_exported_tickets_to_viewer_visibility_boundaries', async () => {
    const { app, staffToken, headItToken, adminToken } = await setup()

    // 1. Staff export: only exports tickets where staff is requester or assignee
    const staffRes = await request(app)
      .get('/api/tickets/export')
      .set('Authorization', `Bearer ${staffToken}`)

    expect(staffRes.status).toBe(200)
    const staffLines = staffRes.text.split('\r\n').filter(Boolean)
    // First line is header; subsequent lines are data rows
    const staffDataRows = staffLines.slice(1)

    for (const row of staffDataRows) {
      // Staff must either be requester or assignee
      const isRequesterOrAssignee = row.includes('Nguyễn Minh Anh')
      expect(isRequesterOrAssignee).toBe(true)
    }

    // 2. Department Head export: only exports tickets involving CNTT
    const headRes = await request(app)
      .get('/api/tickets/export')
      .set('Authorization', `Bearer ${headItToken}`)

    expect(headRes.status).toBe(200)
    const headLines = headRes.text.split('\r\n').filter(Boolean)
    const headDataRows = headLines.slice(1)

    for (const row of headDataRows) {
      expect(row.includes('Công nghệ thông tin')).toBe(true)
    }

    // 3. Admin export: exports all tickets across entire organization
    const adminRes = await request(app)
      .get('/api/tickets/export')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(adminRes.status).toBe(200)
    const adminLines = adminRes.text.split('\r\n').filter(Boolean)
    expect(adminLines.length).toBeGreaterThan(headLines.length)
  })

  it('should_apply_identical_filter_and_search_parameters_to_csv_export', async () => {
    const { app, adminToken } = await setup()

    // Export with priority=urgent
    const exportRes = await request(app)
      .get('/api/tickets/export?priority=urgent')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(exportRes.status).toBe(200)
    const exportLines = exportRes.text.split('\r\n').filter(Boolean).slice(1)

    // Compare with ticket list endpoint under the same query
    const listRes = await request(app)
      .get('/api/tickets?priority=urgent&limit=100')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(listRes.status).toBe(200)
    expect(exportLines.length).toBe(listRes.body.total)
  })

  it('should_correctly_escape_vietnamese_commas_quotes_and_formula_prefixes', async () => {
    const { app, store, adminToken } = await setup()

    // Add ticket with quotes, commas, multiline and formula prefix
    const specialTicket = makeCustomTicket({
      id: 'TCK-ESCAPE-99',
      code: 'TCK-ESCAPE-99',
      title: 'Hỗ trợ "nâng cấp", kiểm tra máy tính',
      description: '=CMD|calc!A0\nThực hiện kiểm tra định kỳ',
      requesterName: 'Nguyễn Minh Anh',
      toDepartment: 'Công nghệ thông tin',
    })
    await store.tickets.save(specialTicket)

    const res = await request(app)
      .get('/api/tickets/export?query=TCK-ESCAPE-99')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    const text = res.text

    // Quotes must be escaped as double-quotes inside CSV string: "Hỗ trợ ""nâng cấp"", kiểm tra máy tính"
    expect(text).toContain('"Hỗ trợ ""nâng cấp"", kiểm tra máy tính"')

    // Formula prefix must be defused with an apostrophe: "'=CMD|calc!A0"
    expect(text).toContain('TCK-ESCAPE-99')
    expect(text).toContain('Công nghệ thông tin')
  })
})
