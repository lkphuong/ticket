import { describe, expect, it } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import type { Ticket } from '@vtdesk/domain'
import { runMigrations } from '../db/migrator.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from './inMemoryTicketStore.ts'
import { PostgresTicketStore } from './postgresTicketStore.ts'

describe('InMemoryTicketStore', () => {
  it('should_write_and_read_back_ticket_with_full_fidelity_when_saved_in_memory', async () => {
    const store = new InMemoryTicketStore()
    const ticket: Ticket = {
      id: '11111111-1111-4111-8111-111111111101',
      code: 'TCK-CNTT-2611-001',
      title: 'Fix VPN Gateway Authentication',
      description: 'Users cannot connect to internal services via Wireguard gateway',
      priority: 'urgent',
      status: 'in_progress',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Đặng Văn Khoa',
      dueDate: '2026-11-10',
      createdAt: '2026-11-05T08:00:00.000Z',
      updatedAt: '2026-11-05T09:00:00.000Z',
      attachments: [{ name: 'error-log.txt', sizeKb: 128 }],
      comments: [
        {
          id: '33333333-3333-4333-8333-333333333301',
          author: 'Đặng Văn Khoa',
          department: 'Công nghệ thông tin',
          body: 'Checking RADIUS server connection',
          createdAt: '2026-11-05T08:30:00.000Z',
          attachments: [{ name: 'radius.conf', sizeKb: 4 }],
        },
      ],
      statusHistory: [
        {
          status: 'in_progress',
          at: '2026-11-05T08:15:00.000Z',
          actor: { name: 'Đặng Văn Khoa', department: 'Công nghệ thông tin' },
        },
      ],
      assignmentHistory: [
        {
          from: undefined,
          to: 'Đặng Văn Khoa',
          at: '2026-11-05T08:10:00.000Z',
          actor: { name: 'Đặng Văn Khoa', department: 'Công nghệ thông tin' },
        },
      ],
    }

    await store.tickets.save(ticket)
    const retrieved = await store.tickets.findById('11111111-1111-4111-8111-111111111101')

    expect(retrieved).not.toBeNull()
    expect(retrieved?.id).toBe('11111111-1111-4111-8111-111111111101')
    expect(retrieved?.title).toBe(ticket.title)
    expect(retrieved?.attachments).toHaveLength(1)
    expect(retrieved?.comments).toHaveLength(1)
    expect(retrieved?.comments[0].attachments).toHaveLength(1)
    expect(retrieved?.statusHistory).toHaveLength(1)
    expect(retrieved?.assignmentHistory).toHaveLength(1)
  })

  it('should_seed_in_memory_store_without_io', async () => {
    const store = new InMemoryTicketStore()
    await seedDatabase(store, new Date('2026-11-05T12:00:00Z'))

    const allTickets = await store.tickets.findAll()
    const allMembers = await store.members.findAll()
    const admin = await store.members.findByUsername('admin')

    expect(allTickets.length).toBeGreaterThan(10)
    expect(allMembers.length).toBeGreaterThan(15)
    expect(admin).not.toBeNull()
    expect(admin?.role).toBe('admin')
  })
})

describe('PostgresTicketStore with real PostgreSQL engine', () => {
  it('should_run_clean_migrations_on_empty_database_and_seed_comprehensive_dataset', async () => {
    // Spin up fresh in-process PostgreSQL database
    const pglite = new PGlite()
    const db = drizzle(pglite)

    // 1. Run migrations cleanly
    const applied = await runMigrations(pglite)
    expect(applied.length).toBeGreaterThan(0)

    // 2. Instantiate repository store
    const store = new PostgresTicketStore(db)

    // 3. Seed database with relative dates
    await seedDatabase(store, new Date('2026-11-05T12:00:00Z'))

    // 4. Verify members: each department has head + staff, and admin exists
    const members = await store.members.findAll()
    expect(members.length).toBeGreaterThan(15)

    const admin = await store.members.findByUsername('admin')
    expect(admin).not.toBeNull()
    expect(admin?.role).toBe('admin')
    expect(admin?.name).toBe('Quản trị viên Hệ thống')

    const itHead = await store.members.findByUsername('vankhoa')
    expect(itHead).not.toBeNull()
    expect(itHead?.isDepartmentHead).toBe(true)

    // 5. Verify tickets seeded cover all states
    const tickets = await store.tickets.findAll()
    expect(tickets.length).toBeGreaterThanOrEqual(17)

    const statuses = new Set(tickets.map((t) => t.status))
    expect(statuses.has('open')).toBe(true)
    expect(statuses.has('in_progress')).toBe(true)
    expect(statuses.has('waiting')).toBe(true)
    expect(statuses.has('resolved')).toBe(true)
    expect(statuses.has('closed')).toBe(true)

    const priorities = new Set(tickets.map((t) => t.priority))
    expect(priorities.has('low')).toBe(true)
    expect(priorities.has('medium')).toBe(true)
    expect(priorities.has('high')).toBe(true)
    expect(priorities.has('urgent')).toBe(true)

    // 6. Test save and retrieve round-trip with full history and attachments
    const newTicket: Ticket = {
      id: '22222222-2222-4222-8222-222222222999',
      code: 'TCK-CNTT-2611-050',
      title: 'Postgres Persistence Verification',
      description: 'End-to-end relational schema and mapping verification',
      priority: 'high',
      status: 'resolved',
      requesterName: 'Nguyễn Minh Anh',
      fromDepartment: 'Kinh doanh',
      toDepartment: 'Công nghệ thông tin',
      assigneeName: 'Đặng Văn Khoa',
      dueDate: '2026-11-12',
      rating: 5,
      feedback: 'Resolved within expected timeline',
      createdAt: '2026-11-05T10:00:00.000Z',
      updatedAt: '2026-11-05T11:00:00.000Z',
      attachments: [{ name: 'spec.pdf', sizeKb: 512 }],
      comments: [
        {
          id: '33333333-3333-4333-8333-333333333302',
          author: 'Đặng Văn Khoa',
          department: 'Công nghệ thông tin',
          body: 'Fix deployed to production cluster',
          createdAt: '2026-11-05T10:45:00.000Z',
          attachments: [{ name: 'deploy.log', sizeKb: 64 }],
        },
      ],
      statusHistory: [
        {
          status: 'in_progress',
          at: '2026-11-05T10:15:00.000Z',
          actor: { name: 'Đặng Văn Khoa', department: 'Công nghệ thông tin' },
        },
        {
          status: 'resolved',
          at: '2026-11-05T10:50:00.000Z',
          actor: { name: 'Đặng Văn Khoa', department: 'Công nghệ thông tin' },
        },
      ],
      assignmentHistory: [
        {
          from: undefined,
          to: 'Đặng Văn Khoa',
          at: '2026-11-05T10:10:00.000Z',
          actor: { name: 'Đặng Văn Khoa', department: 'Công nghệ thông tin' },
        },
      ],
    }

    await store.tickets.save(newTicket)
    const readTicket = await store.tickets.findById('22222222-2222-4222-8222-222222222999')

    expect(readTicket).not.toBeNull()
    expect(readTicket?.id).toBe('22222222-2222-4222-8222-222222222999')
    expect(readTicket?.title).toBe(newTicket.title)
    expect(readTicket?.attachments).toHaveLength(1)
    expect(readTicket?.attachments[0].name).toBe('spec.pdf')
    expect(readTicket?.comments).toHaveLength(1)
    expect(readTicket?.comments[0].attachments?.[0].name).toBe('deploy.log')
    expect(readTicket?.statusHistory).toHaveLength(2)
    expect(readTicket?.assignmentHistory).toHaveLength(1)
    expect(readTicket?.rating).toBe(5)

    // 7. Test notification repository operations
    await store.notifications.save({
      id: '44444444-4444-4444-8444-444444444401',
      recipientUsername: 'minhanh',
      ticketId: '22222222-2222-4222-8222-222222222999',
      type: 'ticket_resolved',
      title: 'Ticket resolved',
      body: 'Your ticket TCK-CNTT-2611-050 has been resolved.',
      isRead: false,
      createdAt: '2026-11-05T10:50:00.000Z',
    })

    const notifications = await store.notifications.findByRecipient('minhanh')
    expect(notifications).toHaveLength(1)
    expect(notifications[0].isRead).toBe(false)

    await store.notifications.markAsRead('44444444-4444-4444-8444-444444444401')
    const updatedNotifications = await store.notifications.findByRecipient('minhanh')
    expect(updatedNotifications[0].isRead).toBe(true)

    // 8. Test device tokens repository operations in PostgreSQL
    await store.deviceTokens.save({
      id: '55555555-5555-4555-8555-555555555501',
      username: 'minhanh',
      token: 'fcm-pg-token-01',
    })

    const userTokens = await store.deviceTokens.findByUsername('minhanh')
    expect(userTokens).toHaveLength(1)
    expect(userTokens[0].token).toBe('fcm-pg-token-01')

    await store.deviceTokens.deleteByToken('fcm-pg-token-01')
    const afterDeleteTokens = await store.deviceTokens.findByUsername('minhanh')
    expect(afterDeleteTokens).toHaveLength(0)

    await pglite.close()
  })
})
