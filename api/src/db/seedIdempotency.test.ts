import { describe, expect, it } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { PostgresTicketStore } from '../repositories/postgresTicketStore.ts'
import { runMigrations } from './migrator.ts'
import { resetDatabase } from './resetDatabase.ts'
import { seedDatabase } from './seed.ts'

const SEED_TIME = new Date('2026-11-05T12:00:00Z')

async function createMigratedStore() {
  const client = new PGlite()
  await runMigrations(client)
  return { client, store: new PostgresTicketStore(drizzle(client)) }
}

describe('seedDatabase on postgres', () => {
  it('should_not_duplicate_rows_when_seed_runs_twice', async () => {
    const { store } = await createMigratedStore()
    await seedDatabase(store, SEED_TIME)
    const first = { tickets: (await store.tickets.findAll()).length, members: (await store.members.findAll()).length }

    await seedDatabase(store, SEED_TIME)
    expect((await store.tickets.findAll()).length).toBe(first.tickets)
    expect((await store.members.findAll()).length).toBe(first.members)
  })

  it('should_keep_existing_changes_when_seed_runs_again', async () => {
    const { store } = await createMigratedStore()
    await seedDatabase(store, SEED_TIME)
    const member = await store.members.findByUsername('minhanh')
    await store.members.save({ ...member!, name: 'Da doi ten' })

    await seedDatabase(store, SEED_TIME)
    expect((await store.members.findByUsername('minhanh'))!.name).toBe('Da doi ten')
  })

  it('should_remove_all_rows_when_database_is_reset', async () => {
    const { client, store } = await createMigratedStore()
    await seedDatabase(store, SEED_TIME)

    await resetDatabase({ exec: (sql) => client.exec(sql) })
    expect(await store.tickets.findAll()).toHaveLength(0)
    expect(await store.members.findAll()).toHaveLength(0)
  })
})

describe('ticket code allocation on postgres', () => {
  it('should_continue_after_seeded_codes_and_never_repeat_when_allocating_concurrently', async () => {
    const { store } = await createMigratedStore()
    await seedDatabase(store, SEED_TIME)
    const existingCodes = new Set((await store.tickets.findAll()).map((ticket) => ticket.code))

    const allocated = await Promise.all(Array.from({ length: 5 }, () => store.tickets.allocateCode('CNTT', SEED_TIME)))

    expect(new Set(allocated).size).toBe(5)
    for (const code of allocated) {
      expect(existingCodes.has(code)).toBe(false)
      expect(code).toMatch(/^TCK-CNTT-2611-\d{3}$/)
    }
  })

  it('should_restart_sequence_when_month_changes', async () => {
    const { store } = await createMigratedStore()
    expect(await store.tickets.allocateCode('KD', new Date('2026-11-30T10:00:00Z'))).toBe('TCK-KD-2611-001')
    expect(await store.tickets.allocateCode('KD', new Date('2026-12-01T10:00:00Z'))).toBe('TCK-KD-2612-001')
  })
})

describe('seeded identifiers', () => {
  it('should_use_uuid_primary_keys_when_seeding_members_templates_and_tickets', async () => {
    const { store } = await createMigratedStore()
    await seedDatabase(store, SEED_TIME)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

    for (const member of await store.members.findAll()) expect(member.id).toMatch(uuidPattern)
    for (const template of await store.templates.findAll()) expect(template.id).toMatch(uuidPattern)
    for (const ticket of await store.tickets.findAll()) {
      expect(ticket.id).toMatch(uuidPattern)
      expect(ticket.code).toMatch(/^TCK-[A-Z0-9]+-\d{4}-\d{3,}$/)
    }
  })
})
