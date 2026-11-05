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
