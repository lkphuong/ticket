import { createHash, randomBytes } from 'node:crypto'
import type { Collection, Db } from 'mongodb'
import { COLLECTION_NAMES } from '../db/schema.ts'
import type { SessionDocument } from '../db/schema.ts'
import type { ISessionService, SessionData } from './sessionService.ts'

const DEFAULT_TTL_HOURS = 24
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000
const TOKEN_BYTES = 32

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function toSessionData(document: SessionDocument): SessionData {
  const { _id: _ignored, ...data } = document
  return data
}

// Sessions survive restarts and are shared across API instances; MongoDB's TTL index deletes expired ones
export class MongoSessionService implements ISessionService {
  private readonly sessions: Collection<SessionDocument>
  private readonly ttlMs: number

  constructor(db: Db, ttlHours: number = DEFAULT_TTL_HOURS, private readonly now: () => number = Date.now) {
    this.sessions = db.collection<SessionDocument>(COLLECTION_NAMES.SESSIONS)
    this.ttlMs = ttlHours * MILLISECONDS_PER_HOUR
  }

  async createSession(data: Omit<SessionData, 'expiresAt'>): Promise<string> {
    const token = randomBytes(TOKEN_BYTES).toString('hex')
    await this.sessions.insertOne({
      _id: hashToken(token),
      ...data,
      expiresAt: new Date(this.now() + this.ttlMs),
    })
    return token
  }

  async getSession(token: string): Promise<SessionData | null> {
    const document = await this.sessions.findOne({ _id: hashToken(token) })
    if (!document) return null
    // The TTL monitor runs only periodically, so expiry is enforced here as well
    if (document.expiresAt.getTime() <= this.now()) return null
    return toSessionData(document)
  }

  async touchSession(token: string): Promise<void> {
    await this.sessions.updateOne(
      { _id: hashToken(token), expiresAt: { $gt: new Date(this.now()) } },
      { $set: { expiresAt: new Date(this.now() + this.ttlMs) } },
    )
  }

  async destroySession(token: string): Promise<void> {
    await this.sessions.deleteOne({ _id: hashToken(token) })
  }
}
