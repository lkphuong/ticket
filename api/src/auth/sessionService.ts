import { randomBytes } from 'node:crypto'

export interface SessionData {
  readonly userId: string
  readonly username: string
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head' | 'admin'
  readonly isDepartmentHead: boolean
  readonly requiresPasswordChange: boolean
  readonly expiresAt: Date
}

export interface ISessionService {
  createSession(data: Omit<SessionData, 'expiresAt'>): Promise<string>
  getSession(token: string): Promise<SessionData | null>
  touchSession(token: string): Promise<void>
  destroySession(token: string): Promise<void>
}

// In-memory cryptographically secure session store with automated expiration
export class MemorySessionService implements ISessionService {
  private readonly sessions = new Map<string, SessionData>()
  private readonly ttlMs: number

  constructor(ttlHours: number = 24) {
    this.ttlMs = ttlHours * 60 * 60 * 1000
  }

  async createSession(data: Omit<SessionData, 'expiresAt'>): Promise<string> {
    // Generate 256-bit cryptographically secure token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + this.ttlMs)

    this.sessions.set(token, {
      ...data,
      expiresAt,
    })

    return token
  }

  async getSession(token: string): Promise<SessionData | null> {
    const session = this.sessions.get(token)
    if (!session) return null

    // Enforce TTL boundary
    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(token)
      return null
    }

    return session
  }

  async touchSession(token: string): Promise<void> {
    const session = this.sessions.get(token)
    if (session && session.expiresAt.getTime() > Date.now()) {
      this.sessions.set(token, {
        ...session,
        expiresAt: new Date(Date.now() + this.ttlMs),
      })
    }
  }

  async destroySession(token: string): Promise<void> {
    this.sessions.delete(token)
  }
}
