import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient } from 'mongodb'
import type { CommandStartedEvent, Db } from 'mongodb'
import { DEFAULT_TICKET_FILTERS } from '@vtdesk/domain'
import type { Ticket } from '@vtdesk/domain'
import { CmsService } from '../cms/cmsService.ts'
import { runMigrations } from '../db/migrator.ts'
import { resetDatabase } from '../db/resetDatabase.ts'
import { seedDatabase } from '../db/seed.ts'
import { DeadlineService } from '../notifications/deadlineService.ts'
import { NotificationService } from '../notifications/notificationService.ts'
import { MockPushGateway } from '../notifications/pushGateway.ts'
import { MongoTicketStore } from './mongoTicketStore.ts'

const DATABASE_NAME = 'query_count'
const NOW = new Date('2026-11-05T12:00:00Z')
const SMALL_ROW_COUNT = 3
const LARGE_ROW_COUNT = 40
const DATA_COMMANDS = new Set(['find', 'aggregate', 'count', 'distinct', 'insert', 'update', 'delete', 'findAndModify'])
const ADMIN_ACTOR = { userId: 'admin-id', username: 'admin', name: 'Quản trị viên Hệ thống', department: 'Công nghệ thông tin', role: 'admin' as const }

let mongod: MongoMemoryServer
let client: MongoClient
let db: Db
let store: MongoTicketStore

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  client = new MongoClient(mongod.getUri(), { monitorCommands: true })
  await client.connect()
  db = client.db(DATABASE_NAME)
  await runMigrations(db)
  store = new MongoTicketStore(db)
})

afterAll(async () => {
  await client.close()
  await mongod.stop()
})

// Runs the action and returns how many data commands it sent to the database
async function countDatabaseCommands(action: () => Promise<unknown>): Promise<number> {
  let count = 0
  const listener = (event: CommandStartedEvent) => {
    if (event.databaseName === DATABASE_NAME && DATA_COMMANDS.has(event.commandName)) count++
  }
  client.on('commandStarted', listener)
  try {
    await action()
  } finally {
    client.off('commandStarted', listener)
  }
  return count
}

async function resetAndSeed(): Promise<void> {
  await resetDatabase(db)
  await seedDatabase(store, NOW)
}

function cloneTickets(template: Ticket, count: number, overrides: Partial<Ticket>): Ticket[] {
  return Array.from({ length: count }, (_, index) => ({
    ...template,
    ...overrides,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    code: `TCK-LOAD-2611-${String(index).padStart(3, '0')}`,
  }))
}

async function expectConstantCommandCount(measure: (rowCount: number) => Promise<number>): Promise<void> {
  const small = await measure(SMALL_ROW_COUNT)
  const large = await measure(LARGE_ROW_COUNT)
  expect(small).toBeGreaterThan(0)
  expect(large).toBe(small)
}

describe('database command count stays constant as row count grows', () => {
  it('should_send_same_number_of_commands_when_listing_department_summaries_for_few_or_many_departments', async () => {
    await expectConstantCommandCount(async (rowCount) => {
      await resetAndSeed()
      for (let index = 0; index < rowCount; index++) {
        await store.departments.create(`Phòng thử ${index}`, `PT${index}`)
      }
      const cms = new CmsService(store)

      return countDatabaseCommands(() => cms.listDepartmentSummaries(undefined, { page: 1, limit: 100 }))
    })
  })

  it('should_send_same_number_of_commands_when_checking_deadlines_for_few_or_many_overdue_tickets', async () => {
    await expectConstantCommandCount(async (rowCount) => {
      await resetAndSeed()
      const [template] = await store.tickets.findAll()
      await store.tickets.saveMany(
        cloneTickets(template, rowCount, {
          status: 'in_progress',
          cancelReason: undefined,
          dueDate: '2026-11-01',
          toDepartment: 'Công nghệ thông tin',
          assigneeName: 'Đặng Văn Khoa',
        }),
      )
      const deadlines = new DeadlineService(store, new NotificationService(store, undefined, () => NOW), () => NOW)

      const commands = await countDatabaseCommands(() => deadlines.checkDeadlines(NOW))

      const sent = await store.notifications.findByTicketAndType('00000000-0000-4000-8000-000000000000', 'deadline_overdue')
      expect(sent.length).toBeGreaterThan(0)
      return commands
    })
  })

  it('should_send_same_number_of_commands_when_dispatching_notifications_for_few_or_many_events', async () => {
    await expectConstantCommandCount(async (rowCount) => {
      await resetAndSeed()
      const [template] = await store.tickets.findAll()
      const tickets = cloneTickets(template, rowCount, { toDepartment: 'Công nghệ thông tin', assigneeName: 'Đặng Văn Khoa' })
      await store.deviceTokens.save({ id: 'device-head', username: 'vankhoa', token: 'tok-valid' })
      await store.deviceTokens.save({ id: 'device-bad', username: 'vankhoa', token: 'tok-rejected' })
      const gateway = new MockPushGateway()
      gateway.setRejectedTokens(['tok-rejected'])
      const notifications = new NotificationService(store, undefined, () => NOW, gateway)

      const commands = await countDatabaseCommands(() =>
        notifications.dispatchMany(tickets.map((ticket) => ({ type: 'ticket_created', ticket, actorUsername: 'someone' }) as const)),
      )

      expect(gateway.sentMessages.length).toBeGreaterThan(0)
      return commands
    })
  })

  it('should_send_same_number_of_commands_when_listing_a_ticket_page_for_few_or_many_tickets', async () => {
    await expectConstantCommandCount(async (rowCount) => {
      await resetAndSeed()
      const [template] = await store.tickets.findAll()
      await store.tickets.saveMany(cloneTickets(template, rowCount, {}))

      return countDatabaseCommands(() =>
        store.tickets.findPage(
          { viewer: { name: ADMIN_ACTOR.name, department: 'Công nghệ thông tin', isDepartmentHead: false, isExecutive: true }, filters: DEFAULT_TICKET_FILTERS, now: NOW },
          { page: 1, limit: 20 },
        ),
      )
    })
  })

  it('should_send_same_number_of_commands_when_locking_a_member_with_few_or_many_assigned_tickets', async () => {
    await expectConstantCommandCount(async (rowCount) => {
      await resetAndSeed()
      const [template] = await store.tickets.findAll()
      await store.tickets.saveMany(cloneTickets(template, rowCount, { status: 'in_progress', assigneeName: 'Đặng Văn Khoa', cancelReason: undefined }))
      const member = (await store.members.findByNames(['Đặng Văn Khoa']))[0]
      await store.members.save({ ...member, isDepartmentHead: false, role: 'staff' })
      const cms = new CmsService(store)

      return countDatabaseCommands(() => cms.lockMember(ADMIN_ACTOR, member.id))
    })
  })
})
