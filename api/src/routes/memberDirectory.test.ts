import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

async function setupDirectory() {
  const store = new InMemoryTicketStore()
  await seedDatabase(store, new Date('2026-11-05T12:00:00Z'))
  const app = createApp(loadEnvironmentConfig({ NODE_ENV: 'development' }), { store })
  const login = await request(app).post('/api/auth/login').send({ username: 'minhanh', password: 'ticket123' })
  return { app, store, token: login.body.token as string }
}

describe('GET /api/members/directory', () => {
  it('should_reject_request_with_401_when_token_is_missing', async () => {
    const { app } = await setupDirectory()
    const res = await request(app).get('/api/members/directory')
    expect(res.status).toBe(401)
  })

  it('should_list_members_without_sensitive_fields_when_called_by_staff', async () => {
    const { app, token } = await setupDirectory()
    const res = await request(app).get('/api/members/directory').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.members.length).toBeGreaterThan(0)
    expect(Object.keys(res.body.members[0]).sort()).toEqual(['department', 'isDepartmentHead', 'name', 'role', 'username'])
  })

  it('should_omit_inactive_members_when_listing_directory', async () => {
    const { app, store, token } = await setupDirectory()
    const target = await store.members.findByUsername('thuha')
    await store.members.save({ ...target!, isActive: false })

    const res = await request(app).get('/api/members/directory').set('Authorization', `Bearer ${token}`)
    const usernames = res.body.members.map((member: { username: string }) => member.username)
    expect(usernames).not.toContain('thuha')
  })
})
