import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, type Db } from 'mongodb'
import { MongoTicketStore } from '../repositories/mongoTicketStore.ts'
import { runMigrations } from './migrator.ts'
import { resetDatabase } from './resetDatabase.ts'
import { seedAdminOnly } from './seedAdmin.ts'

const PASSWORD = 'a-strong-password'

let mongod: MongoMemoryServer
let client: MongoClient
let db: Db

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  client = new MongoClient(mongod.getUri())
  await client.connect()
  db = client.db('test_seed_admin')
  await runMigrations(db)
})

afterAll(async () => {
  await client.close()
  await mongod.stop()
})

async function createFreshStore() {
  await resetDatabase(db)
  return new MongoTicketStore(db)
}

describe('seedAdminOnly', () => {
  it('should_create_only_admin_and_slas_when_database_is_empty', async () => {
    const store = await createFreshStore()
    await seedAdminOnly(store, PASSWORD)

    const members = await store.members.findAll()
    expect(members.map((member) => member.username)).toEqual(['admin'])
    expect(members[0].role).toBe('admin')
    expect(members[0].requiresPasswordChange).toBe(true)
    expect(await Bun.password.verify(PASSWORD, members[0].passwordHash)).toBe(true)
    expect(await store.departments.findAll()).toEqual([])
    expect(await store.templates.findAll()).toEqual([])
    expect(await store.tickets.findAll()).toEqual([])
    expect((await store.slas.findAll()).length).toBe(4)
  })

  it('should_keep_existing_admin_password_when_seed_runs_again', async () => {
    const store = await createFreshStore()
    await seedAdminOnly(store, PASSWORD)
    await seedAdminOnly(store, 'another-password')

    const admin = await store.members.findByUsername('admin')
    expect(await Bun.password.verify(PASSWORD, admin!.passwordHash)).toBe(true)
    expect((await store.slas.findAll()).length).toBe(4)
  })

  it('should_throw_when_password_is_missing_or_too_short', async () => {
    const store = await createFreshStore()
    await expect(seedAdminOnly(store, undefined)).rejects.toThrow('ADMIN_INITIAL_PASSWORD')
    await expect(seedAdminOnly(store, 'short')).rejects.toThrow('ADMIN_INITIAL_PASSWORD')
  })
})
