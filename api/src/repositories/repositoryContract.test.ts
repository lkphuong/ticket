import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient } from 'mongodb'
import { DEFAULT_TICKET_FILTERS, filterTickets, filterVisibleTickets } from '@vtdesk/domain'
import type { Ticket, TicketFilters, Viewer } from '@vtdesk/domain'
import { runMigrations } from '../db/migrator.ts'
import { resetDatabase } from '../db/resetDatabase.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from './inMemoryTicketStore.ts'
import type { ITicketStore, TicketQuery } from './interfaces.ts'
import { MongoTicketStore } from './mongoTicketStore.ts'

const SEED_TIME = new Date('2026-11-05T12:00:00Z')
const PAGE_SIZE = 3

const STAFF: Viewer = { name: 'Nguyễn Minh Anh', department: 'Kinh doanh', isDepartmentHead: false }
const HEAD: Viewer = { name: 'Trần Quốc Bảo', department: 'Kinh doanh', isDepartmentHead: true }
const ADMIN: Viewer = { name: 'Quản trị viên Hệ thống', department: 'Công nghệ thông tin', isDepartmentHead: false, isExecutive: true }

function withFilters(overrides: Partial<TicketFilters>): TicketFilters {
  return { ...DEFAULT_TICKET_FILTERS, ...overrides }
}

const FILTER_CASES: Array<[string, Partial<TicketFilters>]> = [
  ['no filters', {}],
  ['status in_progress', { status: 'in_progress' }],
  ['priority urgent', { priority: 'urgent' }],
  ['destination department', { department: 'Công nghệ thông tin' }],
  ['origin department', { fromDepartment: 'Kinh doanh' }],
  ['scope sent', { scope: 'sent' }],
  ['scope received', { scope: 'received' }],
  ['scope assigned', { scope: 'assigned' }],
  ['text query', { query: 'Mạng' }],
  ['created range', { createdFrom: '2026-10-25', createdTo: '2026-11-03' }],
  ['due overdue', { due: 'overdue' }],
  ['due today', { due: 'due_today' }],
  ['due on track', { due: 'on_track' }],
  ['unassigned', { assignment: 'unassigned' }],
  ['assigned', { assignment: 'assigned' }],
  ['exact assignee', { assigneeName: 'Đặng Văn Khoa' }],
  ['sort created_desc', { sort: 'created_desc' }],
  ['sort priority_desc', { sort: 'priority_desc' }],
  ['sort due_asc', { sort: 'due_asc' }],
]

function idsOf(tickets: readonly Ticket[]): string[] {
  return tickets.map((ticket) => ticket.id)
}

function describeStoreContract(label: string, openStore: () => Promise<ITicketStore>): void {
  describe(`${label} repository contract`, () => {
    let store: ITicketStore
    let allTickets: Ticket[]

    beforeEach(async () => {
      store = await openStore()
      await seedDatabase(store, SEED_TIME)
      allTickets = await store.tickets.findAll()
    })

    function expectedIds(viewer: Viewer, filters: TicketFilters): string[] {
      return idsOf(filterTickets(filterVisibleTickets(allTickets, viewer), filters, viewer, SEED_TIME))
    }

    for (const [viewerLabel, viewer] of [['staff', STAFF], ['head', HEAD], ['admin', ADMIN]] as const) {
      for (const [caseLabel, overrides] of FILTER_CASES) {
        it(`should_return_same_tickets_as_domain_rules_when_${viewerLabel}_lists_with_${caseLabel.replace(/ /g, '_')}`, async () => {
          const filters = withFilters(overrides)
          const query: TicketQuery = { viewer, filters, now: SEED_TIME }

          const matching = await store.tickets.findMatching(query)
          const page = await store.tickets.findPage(query, { page: 1, limit: PAGE_SIZE })

          expect([...idsOf(matching)].sort()).toEqual([...expectedIds(viewer, filters)].sort())
          expect(page.total).toBe(matching.length)
          expect(idsOf(page.items)).toEqual(idsOf(matching).slice(0, PAGE_SIZE))
        })
      }
    }

    it('should_cover_every_ticket_exactly_once_when_walking_all_pages', async () => {
      const query: TicketQuery = { viewer: ADMIN, filters: withFilters({ sort: 'priority_desc' }), now: SEED_TIME }
      const matching = await store.tickets.findMatching(query)

      const walked: string[] = []
      for (let page = 1; walked.length < matching.length; page++) {
        walked.push(...idsOf((await store.tickets.findPage(query, { page, limit: PAGE_SIZE })).items))
      }

      expect(walked).toEqual(idsOf(matching))
      expect((await store.tickets.findPage(query, { page: 999, limit: PAGE_SIZE })).items).toHaveLength(0)
    })

    it('should_sort_newest_first_when_using_default_order', async () => {
      const { items } = await store.tickets.findPage({ viewer: ADMIN, filters: DEFAULT_TICKET_FILTERS, now: SEED_TIME }, { page: 1, limit: 50 })

      const updatedAt = items.map((ticket) => ticket.updatedAt)
      expect(updatedAt).toEqual([...updatedAt].sort().reverse())
    })

    it('should_persist_every_ticket_when_saving_many', async () => {
      const [first, second] = allTickets
      await store.tickets.saveMany([
        { ...first, title: 'Bulk one' },
        { ...second, title: 'Bulk two' },
      ])

      expect((await store.tickets.findById(first.id))?.title).toBe('Bulk one')
      expect((await store.tickets.findById(second.id))?.title).toBe('Bulk two')
      expect((await store.tickets.findAll()).length).toBe(allTickets.length)
      await expect(store.tickets.saveMany([])).resolves.toBeUndefined()
    })

    it('should_count_tickets_by_member_and_department_when_counting', async () => {
      const name = allTickets[0].requesterName
      const department = allTickets[0].toDepartment

      expect(await store.tickets.countInvolvingMember(name)).toBe(
        allTickets.filter((t) => t.requesterName === name || t.assigneeName === name).length,
      )
      expect(await store.tickets.countByDepartment(department)).toBe(
        allTickets.filter((t) => t.fromDepartment === department || t.toDepartment === department).length,
      )
      expect(await store.tickets.countInvolvingMember('Không Tồn Tại')).toBe(0)
    })

    it('should_return_only_active_tickets_when_finding_by_assignee', async () => {
      const assignee = 'Đặng Văn Khoa'

      const found = await store.tickets.findActiveByAssignee(assignee)

      const expected = allTickets.filter((t) => t.assigneeName === assignee && ['open', 'in_progress', 'waiting'].includes(t.status))
      expect(idsOf(found).sort()).toEqual(idsOf(expected).sort())
    })

    it('should_return_open_and_in_progress_tickets_due_on_or_before_cutoff_when_finding_deadline_candidates', async () => {
      const cutoff = '2026-11-06'

      const found = await store.tickets.findDeadlineCandidates(cutoff)

      const expected = allTickets.filter(
        (t) => (t.status === 'open' || t.status === 'in_progress') && t.dueDate !== undefined && t.dueDate <= cutoff,
      )
      expect(idsOf(found).sort()).toEqual(idsOf(expected).sort())
    })

    it('should_return_every_department_with_its_prefix_when_listing_with_prefix', async () => {
      const departments = await store.departments.findAllWithPrefix()

      const names = await store.departments.findAll()
      expect(departments.map((d) => d.name).sort()).toEqual([...names].sort())
      for (const department of departments) {
        expect(department.codePrefix).toBe(await store.departments.findCodePrefix(department.name))
      }
    })

    it('should_find_members_case_insensitively_when_looking_up_by_email_or_username', async () => {
      const admin = await store.members.findByUsername('admin')

      expect((await store.members.findByEmail(' ADMIN@vtdesk.vn '))?.id).toBe(admin?.id)
      expect(await store.members.findByEmail('nobody@example.com')).toBeNull()
      expect((await store.members.findByUsernames(['ADMIN', 'minhanh', 'ghost'])).map((m) => m.username).sort()).toEqual(['admin', 'minhanh'])
      expect(await store.members.findByUsernames([])).toEqual([])
    })

    it('should_find_members_by_name_when_looking_up_names', async () => {
      const found = await store.members.findByNames(['Nguyễn Minh Anh', 'Không Tồn Tại'])

      expect(found.map((m) => m.username)).toEqual(['minhanh'])
      expect(await store.members.findByNames([])).toEqual([])
    })

    it('should_return_heads_filtered_by_department_when_finding_heads', async () => {
      const all = await store.members.findAll()

      const heads = await store.members.findHeads(['Kinh doanh'])
      const everyHead = await store.members.findHeads()

      expect(heads.map((m) => m.username)).toEqual(['quocbao'])
      expect(everyHead.length).toBe(all.filter((m) => m.role === 'head' || m.isDepartmentHead).length)
      expect(await store.members.findHeads([])).toEqual([])
    })

    it('should_count_members_per_department_when_counting', async () => {
      const all = await store.members.findAll()

      const counts = await store.members.countByDepartment()

      expect(counts['Kinh doanh']).toBe(all.filter((m) => m.department === 'Kinh doanh').length)
      expect(Object.values(counts).reduce((sum, value) => sum + value, 0)).toBe(all.length)
    })

    it('should_round_trip_hashed_otp_when_saving_member', async () => {
      const member = (await store.members.findByUsername('minhanh'))!
      const otp = { hash: 'a'.repeat(64), expiresAt: new Date('2026-11-05T12:10:00Z'), attempts: 2, sentAt: SEED_TIME }

      await store.members.save({ ...member, otp })

      expect((await store.members.findByUsername('minhanh'))?.otp).toEqual(otp)
    })

    it('should_report_only_ticket_ids_with_matching_type_when_finding_existing_keys', async () => {
      const [first, second, third] = allTickets
      const base = { recipientUsername: 'minhanh', title: 't', body: 'b', isRead: false, createdAt: SEED_TIME.toISOString() }
      await store.notifications.saveMany([
        { ...base, id: 'n1', ticketId: first.id, type: 'deadline_overdue' },
        { ...base, id: 'n2', ticketId: second.id, type: 'deadline_impending' },
      ])

      const overdue = await store.notifications.findExistingKeys([first.id, second.id, third.id], 'deadline_overdue')

      expect([...overdue]).toEqual([first.id])
      expect((await store.notifications.findExistingKeys([], 'deadline_overdue')).size).toBe(0)
      expect(await store.notifications.findByRecipient('minhanh')).toHaveLength(2)
    })

    it('should_find_and_delete_device_tokens_in_bulk_when_given_many', async () => {
      await store.deviceTokens.save({ id: 'd1', username: 'minhanh', token: 'tok-1' })
      await store.deviceTokens.save({ id: 'd2', username: 'quocbao', token: 'tok-2' })
      await store.deviceTokens.save({ id: 'd3', username: 'vankhoa', token: 'tok-3' })

      const found = await store.deviceTokens.findByUsernames(['minhanh', 'quocbao'])
      await store.deviceTokens.deleteByTokens(['tok-1', 'tok-2'])

      expect(found.map((d) => d.token).sort()).toEqual(['tok-1', 'tok-2'])
      expect((await store.deviceTokens.findAll()).map((d) => d.token)).toEqual(['tok-3'])
      await expect(store.deviceTokens.deleteByTokens([])).resolves.toBeUndefined()
    })
  })
}

describeStoreContract('InMemoryTicketStore', async () => new InMemoryTicketStore())

describe('MongoTicketStore repository contract setup', () => {
  let mongod: MongoMemoryServer
  let client: MongoClient

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create()
    client = new MongoClient(mongod.getUri())
    await client.connect()
    await runMigrations(client.db('contract'))
  })

  afterAll(async () => {
    await client.close()
    await mongod.stop()
  })

  describeStoreContract('MongoTicketStore', async () => {
    const db = client.db('contract')
    await resetDatabase(db)
    return new MongoTicketStore(db)
  })
})
