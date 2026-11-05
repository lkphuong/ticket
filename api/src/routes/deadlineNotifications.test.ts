import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import type { Ticket } from '@vtdesk/domain'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { DeadlineService } from '../notifications/deadlineService.ts'
import { NotificationService } from '../notifications/notificationService.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

describe('Deadline Notifications & Hourly Scheduled SLA Scanner API', () => {
  async function setup(currentDateString: string = '2026-11-05T10:00:00.000Z') {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    const now = new Date(currentDateString)
    await seedDatabase(store, now)

    const notificationService = new NotificationService(store, undefined, () => now)
    const deadlineService = new DeadlineService(store, notificationService, () => now)
    const app = createApp(config, {
      store,
      notificationService,
      deadlineService,
    })

    // Authenticate Head of CNTT (vankhoa)
    const headLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vankhoa', password: 'ticket123' })
    const headToken = headLogin.body.token

    // Authenticate Specialist in CNTT (giahuy)
    const specialistLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'giahuy', password: 'ticket123' })
    const specialistToken = specialistLogin.body.token

    return {
      app,
      store,
      notificationService,
      deadlineService,
      headToken,
      specialistToken,
      now,
    }
  }

  function makeSampleTicket(overrides: Partial<Ticket> = {}): Ticket {
    return {
      id: 'TCK-SLA-01',
      title: 'Xử lý sự cố chuyển mạch trung tâm',
      description: 'Switch core tầng 3 mất nguồn phụ',
      priority: 'high',
      status: 'in_progress',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Hoàng Gia Huy',
      dueDate: '2026-11-06',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      attachments: [],
      comments: [],
      statusHistory: [{ status: 'in_progress', at: '2026-11-01T08:00:00.000Z' }],
      assignmentHistory: [],
      ...overrides,
    }
  }

  it('should_dispatch_impending_warning_when_ticket_has_exactly_one_day_remaining', async () => {
    // Current date is 2026-11-05; due date 2026-11-06 means diffDays === 1
    const { store, deadlineService } = await setup('2026-11-05T09:00:00.000Z')
    const ticket = makeSampleTicket({ id: 'TCK-WARN-01', dueDate: '2026-11-06' })
    await store.tickets.save(ticket)

    const scanResult = await deadlineService.checkDeadlines()
    expect(scanResult.impendingSent).toContain('TCK-WARN-01')
    expect(scanResult.overdueSent).not.toContain('TCK-WARN-01')

    // Verify both head (vankhoa) and specialist (giahuy) received the impending alert
    const headNotifs = await store.notifications.findByRecipient('vankhoa')
    const specialistNotifs = await store.notifications.findByRecipient('giahuy')

    const headWarning = headNotifs.find((n) => n.ticketId === 'TCK-WARN-01' && n.type === 'deadline_impending')
    const specialistWarning = specialistNotifs.find((n) => n.ticketId === 'TCK-WARN-01' && n.type === 'deadline_impending')

    expect(headWarning).toBeDefined()
    expect(headWarning?.title).toBe('Ticket sắp đến hạn')
    expect(headWarning?.body).toContain('còn 1 ngày')

    expect(specialistWarning).toBeDefined()
    expect(specialistWarning?.title).toBe('Ticket sắp đến hạn')
  })

  it('should_dispatch_overdue_warning_when_ticket_is_past_due_date', async () => {
    // Current date is 2026-11-05; due date 2026-11-04 means diffDays === -1 (overdue)
    const { store, deadlineService } = await setup('2026-11-05T09:00:00.000Z')
    const ticket = makeSampleTicket({ id: 'TCK-OVERDUE-01', dueDate: '2026-11-04' })
    await store.tickets.save(ticket)

    const scanResult = await deadlineService.checkDeadlines()
    expect(scanResult.overdueSent).toContain('TCK-OVERDUE-01')
    expect(scanResult.impendingSent).not.toContain('TCK-OVERDUE-01')

    const headNotifs = await store.notifications.findByRecipient('vankhoa')
    const specialistNotifs = await store.notifications.findByRecipient('giahuy')

    const headOverdue = headNotifs.find((n) => n.ticketId === 'TCK-OVERDUE-01' && n.type === 'deadline_overdue')
    const specialistOverdue = specialistNotifs.find((n) => n.ticketId === 'TCK-OVERDUE-01' && n.type === 'deadline_overdue')

    expect(headOverdue).toBeDefined()
    expect(headOverdue?.title).toBe('Ticket đã quá hạn')
    expect(headOverdue?.body).toContain('đã quá hạn')

    expect(specialistOverdue).toBeDefined()
    expect(specialistOverdue?.title).toBe('Ticket đã quá hạn')
  })

  it('should_dispatch_warning_only_to_receiving_head_when_ticket_is_unassigned', async () => {
    const { store, deadlineService } = await setup('2026-11-05T09:00:00.000Z')
    const unassignedTicket = makeSampleTicket({
      id: 'TCK-UNASSIGNED-01',
      assigneeName: undefined,
      dueDate: '2026-11-04',
      status: 'open',
    })
    await store.tickets.save(unassignedTicket)

    await deadlineService.checkDeadlines()

    // Receiving head receives warning
    const headNotifs = await store.notifications.findByRecipient('vankhoa')
    const headWarning = headNotifs.find((n) => n.ticketId === 'TCK-UNASSIGNED-01')
    expect(headWarning).toBeDefined()

    // No specialist was assigned, so no notifications delivered to specialist
    const specialistNotifs = await store.notifications.findByRecipient('giahuy')
    const specialistWarning = specialistNotifs.find((n) => n.ticketId === 'TCK-UNASSIGNED-01')
    expect(specialistWarning).toBeUndefined()
  })

  it('should_never_dispatch_duplicate_warnings_when_job_runs_repeatedly', async () => {
    const { store, deadlineService } = await setup('2026-11-05T09:00:00.000Z')
    const ticket = makeSampleTicket({ id: 'TCK-REPEATED-01', dueDate: '2026-11-06' })
    await store.tickets.save(ticket)

    // Run first scan: warning generated
    const firstRun = await deadlineService.checkDeadlines()
    expect(firstRun.impendingSent).toContain('TCK-REPEATED-01')

    // Run second scan within the same hour: no duplicate alerts generated
    const secondRun = await deadlineService.checkDeadlines()
    expect(secondRun.impendingSent).not.toContain('TCK-REPEATED-01')

    // Run third scan: still zero duplicate alerts
    const thirdRun = await deadlineService.checkDeadlines()
    expect(thirdRun.impendingSent).not.toContain('TCK-REPEATED-01')

    const headNotifs = await store.notifications.findByRecipient('vankhoa')
    const ticketNotifs = headNotifs.filter((n) => n.ticketId === 'TCK-REPEATED-01' && n.type === 'deadline_impending')
    expect(ticketNotifs).toHaveLength(1)
  })

  it('should_never_dispatch_warnings_for_closed_resolved_or_undated_tickets', async () => {
    const { store, deadlineService } = await setup('2026-11-05T09:00:00.000Z')

    // 1. Closed ticket past due
    await store.tickets.save(
      makeSampleTicket({
        id: 'TCK-CLOSED-01',
        status: 'closed',
        dueDate: '2026-11-01',
      }),
    )

    // 2. Resolved ticket past due
    await store.tickets.save(
      makeSampleTicket({
        id: 'TCK-RESOLVED-01',
        status: 'resolved',
        dueDate: '2026-11-01',
      }),
    )

    // 3. Active ticket without due date
    await store.tickets.save(
      makeSampleTicket({
        id: 'TCK-NODATE-01',
        status: 'in_progress',
        dueDate: undefined,
      }),
    )

    const scanResult = await deadlineService.checkDeadlines()
    expect(scanResult.impendingSent).not.toContain('TCK-CLOSED-01')
    expect(scanResult.impendingSent).not.toContain('TCK-RESOLVED-01')
    expect(scanResult.impendingSent).not.toContain('TCK-NODATE-01')
    expect(scanResult.overdueSent).not.toContain('TCK-CLOSED-01')
    expect(scanResult.overdueSent).not.toContain('TCK-RESOLVED-01')
    expect(scanResult.overdueSent).not.toContain('TCK-NODATE-01')
  })

  it('should_pause_and_never_dispatch_overdue_warnings_when_ticket_status_is_waiting', async () => {
    const { store, deadlineService } = await setup('2026-11-05T09:00:00.000Z')

    // Ticket past due date but currently paused in waiting status
    const waitingTicket = makeSampleTicket({
      id: 'TCK-WAITING-01',
      status: 'waiting',
      dueDate: '2026-11-03',
    })
    await store.tickets.save(waitingTicket)

    const scanResult = await deadlineService.checkDeadlines()
    expect(scanResult.overdueSent).not.toContain('TCK-WAITING-01')
    expect(scanResult.impendingSent).not.toContain('TCK-WAITING-01')

    const headNotifs = await store.notifications.findByRecipient('vankhoa')
    const waitingAlerts = headNotifs.filter((n) => n.ticketId === 'TCK-WAITING-01')
    expect(waitingAlerts).toHaveLength(0)
  })

  it('should_support_triggering_deadline_scan_via_authenticated_api_endpoint', async () => {
    const { app, store, headToken } = await setup('2026-11-05T09:00:00.000Z')
    await store.tickets.save(makeSampleTicket({ id: 'TCK-API-01', dueDate: '2026-11-06' }))

    const res = await request(app)
      .post('/api/notifications/check-deadlines')
      .set('Authorization', `Bearer ${headToken}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.impendingSent).toContain('TCK-API-01')
  })
})
