import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

describe('CMS list pagination and filtering', () => {
  async function setupCms() {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    await seedDatabase(store, new Date('2026-11-05T12:00:00Z'))
    const app = createApp(config, { store })
    const login = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'ticket123' })
    const authorize = (path: string) => request(app).get(path).set('Authorization', `Bearer ${login.body.token}`)
    return { store, authorize }
  }

  it('should_return_requested_page_with_totals_when_limit_is_smaller_than_member_count', async () => {
    const { store, authorize } = await setupCms()
    const totalMembers = (await store.members.findAll()).length

    const res = await authorize('/api/cms/members?page=2&limit=5')

    expect(res.status).toBe(200)
    expect(res.body.members).toHaveLength(5)
    expect(res.body.page).toBe(2)
    expect(res.body.limit).toBe(5)
    expect(res.body.total).toBe(totalMembers)
    expect(res.body.totalPages).toBe(Math.ceil(totalMembers / 5))
  })

  it('should_clamp_to_last_page_when_page_is_beyond_the_end', async () => {
    const { authorize } = await setupCms()

    const res = await authorize('/api/cms/members?page=999&limit=10')

    expect(res.body.page).toBe(res.body.totalPages)
    expect(res.body.members.length).toBeGreaterThan(0)
  })

  it('should_cap_page_size_when_limit_exceeds_the_maximum', async () => {
    const { authorize } = await setupCms()

    const res = await authorize('/api/cms/members?limit=100000')

    expect(res.body.limit).toBe(100)
  })

  it('should_filter_members_by_department_and_ignore_diacritics_in_search', async () => {
    const { store, authorize } = await setupCms()
    const sample = (await store.members.findAll()).find((m) => m.department === 'Kế toán')!

    const byDepartment = await authorize(`/api/cms/members?department=${encodeURIComponent('Kế toán')}&limit=100`)
    expect(byDepartment.body.members.every((m: { department: string }) => m.department === 'Kế toán')).toBe(true)

    const unaccented = sample.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()
    const bySearch = await authorize(`/api/cms/members?search=${encodeURIComponent(unaccented)}`)
    expect(bySearch.body.members.map((m: { id: string }) => m.id)).toContain(sample.id)
  })

  it('should_filter_members_by_status_when_locked_is_requested', async () => {
    const { store, authorize } = await setupCms()
    const target = (await store.members.findAll()).find((m) => m.role === 'staff')!
    await store.members.save({ ...target, isActive: false })

    const res = await authorize('/api/cms/members?status=locked')

    expect(res.body.members.map((m: { id: string }) => m.id)).toEqual([target.id])
  })

  it('should_return_department_summaries_with_member_counts', async () => {
    const { authorize } = await setupCms()

    const res = await authorize('/api/cms/departments?limit=2')

    expect(res.body.departments).toHaveLength(2)
    expect(res.body.departments[0]).toMatchObject({ name: expect.any(String), codePrefix: expect.any(String), memberCount: expect.any(Number) })
    expect(res.body.total).toBeGreaterThan(2)
  })

  it('should_paginate_audit_logs_newest_first', async () => {
    const { store, authorize } = await setupCms()
    for (const [index, action] of ['first', 'second', 'third'].entries()) {
      await store.auditLogs.save({
        id: crypto.randomUUID(),
        actorUsername: 'admin',
        action,
        entityType: 'member',
        entityId: String(index),
        details: '{}',
        createdAt: new Date(2026, 10, 5, 12, index),
      })
    }

    const res = await authorize('/api/cms/audit-logs?limit=2')

    expect(res.body.auditLogs.map((l: { action: string }) => l.action)).toEqual(['third', 'second'])
  })
})
