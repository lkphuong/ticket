import { beforeEach, describe, expect, it } from 'bun:test'
import request from 'supertest'
import type { Ticket, TicketComment, TicketStatusChange } from '@vtdesk/domain'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'
import { MAX_COMMENTS_PER_TICKET, MAX_HISTORY_ENTRIES_PER_TICKET } from '../tickets/ticketLimits.ts'

const SEED_TIME = new Date('2026-11-05T12:00:00Z')
const HTTP_CREATED = 201
const HTTP_UNPROCESSABLE_ENTITY = 422

function buildComments(count: number): TicketComment[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `comment-${index}`,
    author: 'Nguyễn Minh Anh',
    department: 'Kinh doanh',
    body: `Trao đổi ${index}`,
    createdAt: SEED_TIME.toISOString(),
  }))
}

function buildHistory(count: number): TicketStatusChange[] {
  return Array.from({ length: count }, () => ({ status: 'in_progress', at: SEED_TIME.toISOString() }))
}

describe('Ticket embedded list limits', () => {
  let store: InMemoryTicketStore
  let app: ReturnType<typeof createApp>
  let token: string
  let ticket: Ticket

  beforeEach(async () => {
    store = new InMemoryTicketStore()
    await seedDatabase(store, SEED_TIME)
    app = createApp(loadEnvironmentConfig({ NODE_ENV: 'development' }), { store })
    const login = await request(app).post('/api/auth/login').send({ username: 'minhanh', password: 'ticket123' })
    token = login.body.token
    const candidates = await store.tickets.findMatching({
      viewer: { name: 'Nguyễn Minh Anh', department: 'Kinh doanh', isDepartmentHead: false },
      filters: { scope: 'sent', query: '', status: 'all', priority: 'all', department: 'all' },
      now: SEED_TIME,
    })
    ticket = candidates.find((candidate) => candidate.status !== 'closed' && candidate.status !== 'waiting')!
  })

  function postComment() {
    return request(app).post(`/api/tickets/${ticket.id}/comments`).set('Authorization', `Bearer ${token}`).send({ body: 'Thêm trao đổi' })
  }

  it('should_accept_comment_when_it_reaches_the_comment_limit_exactly', async () => {
    await store.tickets.save({ ...ticket, comments: buildComments(MAX_COMMENTS_PER_TICKET - 1) })

    expect((await postComment()).status).toBe(HTTP_CREATED)
  })

  it('should_return_422_when_comment_would_exceed_the_comment_limit', async () => {
    await store.tickets.save({ ...ticket, comments: buildComments(MAX_COMMENTS_PER_TICKET) })

    const res = await postComment()

    expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY)
    expect(res.body.error).toBe('TicketLimitExceeded')
    expect(res.body.message).toContain(String(MAX_COMMENTS_PER_TICKET))
  })

  it('should_return_422_when_history_entries_exceed_the_history_limit', async () => {
    await store.tickets.save({ ...ticket, statusHistory: buildHistory(MAX_HISTORY_ENTRIES_PER_TICKET + 1), assignmentHistory: [] })

    const res = await postComment()

    expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY)
    expect(res.body.error).toBe('TicketLimitExceeded')
    expect(res.body.message).toContain(String(MAX_HISTORY_ENTRIES_PER_TICKET))
  })

  it('should_leave_ticket_unchanged_when_limit_rejects_the_comment', async () => {
    await store.tickets.save({ ...ticket, comments: buildComments(MAX_COMMENTS_PER_TICKET) })

    await postComment()

    expect((await store.tickets.findById(ticket.id))?.comments).toHaveLength(MAX_COMMENTS_PER_TICKET)
  })
})
