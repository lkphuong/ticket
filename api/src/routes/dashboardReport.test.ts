import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import type { Ticket } from '@vtdesk/domain'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { ReportService } from '../reports/reportService.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

describe('Dashboard & Performance Reports API', () => {
  async function setup(currentDateString: string = '2026-11-05T10:00:00.000Z') {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    const now = new Date(currentDateString)
    await seedDatabase(store, now)

    const reportService = new ReportService(store, () => now)
    const app = createApp(config, {
      store,
      reportService,
    })

    // Authenticate System Admin
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
      reportService,
      adminToken,
      headItToken,
      staffToken,
      now,
    }
  }

  function makeCustomTicket(overrides: Partial<Ticket> = {}): Ticket {
    return {
      id: 'TCK-REP-01',
      title: 'Hỗ trợ cấu hình hạ tầng mạng',
      description: 'Cần cấu hình VLAN cho phòng ban mới',
      priority: 'high',
      status: 'in_progress',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      dueDate: '2026-11-10',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      attachments: [],
      comments: [],
      statusHistory: [{ status: 'in_progress', at: '2026-11-01T08:00:00.000Z' }],
      assignmentHistory: [],
      ...overrides,
    }
  }

  it('should_match_dashboard_metrics_with_ticket_list_under_identical_filters', async () => {
    const { app, headItToken } = await setup()

    // Query ticket list with specific priority filter
    const listRes = await request(app)
      .get('/api/tickets?scope=received&priority=high')
      .set('Authorization', `Bearer ${headItToken}`)

    expect(listRes.status).toBe(200)
    const listTotal = listRes.body.total

    // Query dashboard with the exact same filter
    const reportRes = await request(app)
      .get('/api/reports/dashboard?scope=received&priority=high')
      .set('Authorization', `Bearer ${headItToken}`)

    expect(reportRes.status).toBe(200)
    expect(reportRes.body.total).toBe(listTotal)
  })

  it('should_confine_department_head_to_own_department_and_reject_access_to_other_departments', async () => {
    const { app, headItToken } = await setup()

    // 1. Department head requesting their own dashboard succeeds
    const ownDashboard = await request(app)
      .get('/api/reports/dashboard')
      .set('Authorization', `Bearer ${headItToken}`)

    expect(ownDashboard.status).toBe(200)
    expect(ownDashboard.body.total).toBeGreaterThan(0)
    expect(ownDashboard.body.departmentReport).toBeUndefined()

    // 2. Department head attempting to inspect another division is rejected with 403
    const forbiddenDashboard = await request(app)
      .get('/api/reports/dashboard?department=Nhân sự')
      .set('Authorization', `Bearer ${headItToken}`)

    expect(forbiddenDashboard.status).toBe(403)
    expect(forbiddenDashboard.body.error).toBe('Forbidden')
    expect(forbiddenDashboard.body.message).toContain('chỉ được xem số liệu của phòng mình')

    // 3. Department head requesting cross-department matrix is rejected with 403
    const forbiddenCross = await request(app)
      .get('/api/reports/cross-department')
      .set('Authorization', `Bearer ${headItToken}`)

    expect(forbiddenCross.status).toBe(403)
    expect(forbiddenCross.body.error).toBe('Forbidden')
  })

  it('should_evaluate_closed_tickets_by_completion_timestamp_and_never_flag_as_overdue_warning', async () => {
    // Isolated ticket store verifying SLA evaluation without noise from seed dataset
    const store = new InMemoryTicketStore()
    const now = new Date('2026-11-10T12:00:00.000Z')
    const reportService = new ReportService(store, () => now)

    // 1. Insert closed on-time ticket: due 2026-11-05, resolved/closed at 2026-11-04 (on time)
    const onTimeTicket = makeCustomTicket({
      id: 'TCK-ONTIME',
      status: 'closed',
      dueDate: '2026-11-05',
      updatedAt: '2026-11-04T10:00:00.000Z',
      statusHistory: [{ status: 'closed', at: '2026-11-04T10:00:00.000Z' }],
    })
    await store.tickets.save(onTimeTicket)

    const adminViewer = {
      name: 'Quản trị viên Hệ thống',
      department: 'Công nghệ thông tin' as const,
      isDepartmentHead: false,
      isExecutive: true,
    }

    const report = await reportService.getDashboardReport(adminViewer)
    // Closed ticket is never reported as overdue warning
    expect(report.overdueCount).toBe(0)
    // Delivered on time, SLA compliance is 100%
    expect(report.onTimeRate).toBe(100)

    // 2. Insert late closed ticket: due 2026-11-05, closed at 2026-11-08 (late)
    const lateTicket = makeCustomTicket({
      id: 'TCK-LATE',
      status: 'closed',
      dueDate: '2026-11-05',
      updatedAt: '2026-11-08T10:00:00.000Z',
      statusHistory: [{ status: 'closed', at: '2026-11-08T10:00:00.000Z' }],
    })
    await store.tickets.save(lateTicket)

    const reportWithLate = await reportService.getDashboardReport(adminViewer)
    // Closed tickets still never count as active overdue alerts
    expect(reportWithLate.overdueCount).toBe(0)
    // 1 out of 2 tickets finished late -> 50% compliance
    expect(reportWithLate.onTimeRate).toBe(50)
  })

  it('should_treat_undated_tickets_neutrally_without_reducing_sla_compliance_rate', async () => {
    // Isolated ticket store verifying neutral handling of tickets lacking due dates
    const store = new InMemoryTicketStore()
    const now = new Date('2026-11-10T12:00:00.000Z')
    const reportService = new ReportService(store, () => now)

    // Insert active ticket without due date
    const undatedTicket = makeCustomTicket({
      id: 'TCK-UNDATED',
      status: 'in_progress',
      dueDate: undefined,
    })
    await store.tickets.save(undatedTicket)

    const adminViewer = {
      name: 'Quản trị viên Hệ thống',
      department: 'Công nghệ thông tin' as const,
      isDepartmentHead: false,
      isExecutive: true,
    }

    const report = await reportService.getDashboardReport(adminViewer)
    expect(report.overdueCount).toBe(0)
    expect(report.onTimeRate).toBe(100)
  })

  it('should_reject_staff_members_with_403_when_attempting_to_access_cross_department_report', async () => {
    const { app, staffToken } = await setup()

    const crossRes = await request(app)
      .get('/api/reports/cross-department')
      .set('Authorization', `Bearer ${staffToken}`)

    expect(crossRes.status).toBe(403)
    expect(crossRes.body.error).toBe('Forbidden')

    const aliasRes = await request(app)
      .get('/api/reports/departments')
      .set('Authorization', `Bearer ${staffToken}`)

    expect(aliasRes.status).toBe(403)

    const deptParamRes = await request(app)
      .get('/api/reports/dashboard?department=Công nghệ thông tin')
      .set('Authorization', `Bearer ${staffToken}`)

    expect(deptParamRes.status).toBe(403)
    expect(deptParamRes.body.error).toBe('Forbidden')
  })

  it('should_allow_admin_to_view_company_wide_dashboard_and_cross_department_matrix', async () => {
    const { app, adminToken } = await setup()

    // 1. Dashboard summary contains cross-department matrix and workload mosaic
    const dashboardRes = await request(app)
      .get('/api/reports/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(dashboardRes.status).toBe(200)
    expect(dashboardRes.body.departmentReport).toBeDefined()
    expect(dashboardRes.body.departmentReport.length).toBeGreaterThan(0)
    expect(dashboardRes.body.workload).toBeDefined()

    // 2. Dedicated cross-department endpoint provides structured performance rows
    const crossRes = await request(app)
      .get('/api/reports/cross-department')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(crossRes.status).toBe(200)
    expect(crossRes.body.departmentReport).toBeDefined()
    expect(crossRes.body.summary).toBeDefined()
    expect(crossRes.body.summary.totalReceived).toBeGreaterThan(0)
  })
})
