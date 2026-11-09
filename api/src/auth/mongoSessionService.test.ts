import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient } from 'mongodb'
import type { Db } from 'mongodb'
import { runMigrations } from '../db/migrator.ts'
import { COLLECTION_NAMES } from '../db/schema.ts'
import { MongoSessionService } from './mongoSessionService.ts'

const TTL_HOURS = 1
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000
const SESSION_INPUT = {
  userId: 'member-1',
  username: 'staff.one',
  name: 'Staff One',
  department: 'Kinh doanh',
  role: 'staff' as const,
  isDepartmentHead: false,
  requiresPasswordChange: false,
}

describe('MongoSessionService', () => {
  let server: MongoMemoryServer
  let client: MongoClient
  let db: Db
  let clock: number
  let service: MongoSessionService

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    client = new MongoClient(server.getUri())
    await client.connect()
    db = client.db('session_test')
    await runMigrations(db)
  })

  afterAll(async () => {
    await client.close()
    await server.stop()
  })

  beforeEach(async () => {
    await db.collection(COLLECTION_NAMES.SESSIONS).deleteMany({})
    clock = Date.parse('2026-11-05T12:00:00Z')
    service = new MongoSessionService(db, TTL_HOURS, () => clock)
  })

  it('should_return_session_data_when_token_is_valid', async () => {
    const token = await service.createSession(SESSION_INPUT)
    const session = await service.getSession(token)
    expect(session).toMatchObject(SESSION_INPUT)
    expect(session).not.toHaveProperty('_id')
  })

  it('should_store_only_a_hash_of_the_token', async () => {
    const token = await service.createSession(SESSION_INPUT)
    const stored = await db.collection(COLLECTION_NAMES.SESSIONS).findOne({})
    expect(stored?._id).not.toBe(token)
    expect(String(stored?._id)).toHaveLength(64)
  })

  it('should_return_null_when_token_is_unknown', async () => {
    expect(await service.getSession('unknown-token')).toBeNull()
  })

  it('should_return_null_when_session_has_expired', async () => {
    const token = await service.createSession(SESSION_INPUT)
    clock += TTL_HOURS * MILLISECONDS_PER_HOUR
    expect(await service.getSession(token)).toBeNull()
  })

  it('should_extend_expiry_when_session_is_touched', async () => {
    const token = await service.createSession(SESSION_INPUT)
    clock += (TTL_HOURS * MILLISECONDS_PER_HOUR) / 2
    await service.touchSession(token)
    clock += (TTL_HOURS * MILLISECONDS_PER_HOUR) / 2 + 1
    expect(await service.getSession(token)).not.toBeNull()
  })

  it('should_return_null_when_session_is_destroyed', async () => {
    const token = await service.createSession(SESSION_INPUT)
    await service.destroySession(token)
    expect(await service.getSession(token)).toBeNull()
  })

  it('should_create_ttl_index_on_expires_at', async () => {
    const indexes = await db.collection(COLLECTION_NAMES.SESSIONS).indexes()
    expect(indexes.some((index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0)).toBe(true)
  })
})
