import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import { filterTickets, filterVisibleTickets } from '@vtdesk/domain'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

describe('Ticket List API - Scopes, Filters, Search & Visibility', () => {
  async function setup() {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    const now = new Date('2026-11-05T12:00:00Z')
    await seedDatabase(store, now)
    const app = createApp(config, { store })

    // Authenticate Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'ticket123' })
    const adminToken = adminLogin.body.token

    // Authenticate Head of Kinh doanh (quocbao)
    const headLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'quocbao', password: 'ticket123' })
    const headToken = headLogin.body.token

    // Authenticate Staff in Kinh doanh (minhanh)
    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const staffToken = staffLogin.body.token

    return { app, store, now, adminToken, headToken, staffToken }
  }

  it('should_restrict_staff_visibility_to_only_involved_tickets', async () => {
    const { app, staffToken } = await setup()

    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${staffToken}`)

    expect(res.status).toBe(200)
    expect(res.body.tickets.length).toBeGreaterThan(0)
    // Staff must only see tickets where they are either the requester or the assignee
    const allInvolved = res.body.tickets.every(
      (t: any) => t.requesterName === 'Nguyễn Minh Anh' || t.assigneeName === 'Nguyễn Minh Anh',
    )
    expect(allInvolved).toBe(true)
  })

  it('should_allow_department_head_to_view_all_incoming_and_outgoing_department_tickets', async () => {
    const { app, headToken } = await setup()

    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${headToken}`)

    expect(res.status).toBe(200)
    expect(res.body.tickets.length).toBeGreaterThan(0)
    // Head sees tickets involved or within department boundaries
    const allAllowed = res.body.tickets.every(
      (t: any) =>
        t.fromDepartment === 'Kinh doanh' ||
        t.toDepartment === 'Kinh doanh' ||
        t.requesterName === 'Trần Quốc Bảo' ||
        t.assigneeName === 'Trần Quốc Bảo',
    )
    expect(allAllowed).toBe(true)
  })

  it('should_allow_system_admin_to_view_all_tickets_across_entire_organization', async () => {
    const { app, store, adminToken } = await setup()
    const allStoredTickets = await store.tickets.findAll()

    const res = await request(app)
      .get('/api/tickets?limit=100')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(allStoredTickets.length)
    expect(res.body.tickets.length).toBe(allStoredTickets.length)
  })

  it('should_filter_correctly_by_each_mailbox_scope', async () => {
    const { app, headToken } = await setup()

    // 1. Scope: sent
    const sentRes = await request(app)
      .get('/api/tickets?scope=sent')
      .set('Authorization', `Bearer ${headToken}`)
    expect(sentRes.status).toBe(200)
    expect(sentRes.body.tickets.every((t: any) => t.requesterName === 'Trần Quốc Bảo')).toBe(true)

    // 2. Scope: received
    const recvRes = await request(app)
      .get('/api/tickets?scope=received')
      .set('Authorization', `Bearer ${headToken}`)
    expect(recvRes.status).toBe(200)
    expect(recvRes.body.tickets.every((t: any) => t.toDepartment === 'Kinh doanh')).toBe(true)

    // 3. Scope: assigned
    const assignRes = await request(app)
      .get('/api/tickets?scope=assigned')
      .set('Authorization', `Bearer ${headToken}`)
    expect(assignRes.status).toBe(200)
    expect(assignRes.body.tickets.every((t: any) => t.assigneeName === 'Trần Quốc Bảo')).toBe(true)
  })

  it('should_filter_tickets_by_status_priority_and_assignment_state', async () => {
    const { app, adminToken } = await setup()

    // Status filter
    const statusRes = await request(app)
      .get('/api/tickets?status=open')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(statusRes.status).toBe(200)
    expect(statusRes.body.tickets.length).toBeGreaterThan(0)
    expect(statusRes.body.tickets.every((t: any) => t.status === 'open')).toBe(true)

    // Priority filter
    const prioRes = await request(app)
      .get('/api/tickets?priority=urgent')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(prioRes.status).toBe(200)
    expect(prioRes.body.tickets.length).toBeGreaterThan(0)
    expect(prioRes.body.tickets.every((t: any) => t.priority === 'urgent')).toBe(true)

    // Unassigned filter
    const unassignedRes = await request(app)
      .get('/api/tickets?assignment=unassigned')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(unassignedRes.status).toBe(200)
    expect(unassignedRes.body.tickets.every((t: any) => !t.assigneeName)).toBe(true)
  })

  it('should_support_full_text_search_with_vietnamese_diacritics_and_case_insensitivity', async () => {
    const { app, adminToken } = await setup()

    // Search by Vietnamese title substring with diacritics
    const resDiacritic = await request(app)
      .get('/api/tickets?query=' + encodeURIComponent('hệ thống'))
      .set('Authorization', `Bearer ${adminToken}`)

    expect(resDiacritic.status).toBe(200)
    expect(resDiacritic.body.tickets.length).toBeGreaterThan(0)
    expect(
      resDiacritic.body.tickets.some((t: any) =>
        t.title.toLowerCase().includes('hệ thống') || t.description.toLowerCase().includes('hệ thống'),
      ),
    ).toBe(true)

    // Search by department name
    const resDept = await request(app)
      .get('/api/tickets?query=' + encodeURIComponent('Kế toán'))
      .set('Authorization', `Bearer ${adminToken}`)

    expect(resDept.status).toBe(200)
    expect(resDept.body.tickets.length).toBeGreaterThan(0)
  })

  it('should_paginate_and_sort_stably', async () => {
    const { app, adminToken } = await setup()

    const page1Res = await request(app)
      .get('/api/tickets?page=1&limit=5&sort=priority_desc')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(page1Res.status).toBe(200)
    expect(page1Res.body.tickets.length).toBe(5)
    expect(page1Res.body.page).toBe(1)
    expect(page1Res.body.limit).toBe(5)
    expect(page1Res.body.totalPages).toBeGreaterThanOrEqual(3)

    const page2Res = await request(app)
      .get('/api/tickets?page=2&limit=5&sort=priority_desc')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(page2Res.status).toBe(200)
    expect(page2Res.body.tickets.length).toBe(5)
    expect(page2Res.body.page).toBe(2)

    // Stable pagination guarantees no overlapping IDs across adjacent pages
    const page1Ids = page1Res.body.tickets.map((t: any) => t.id)
    const page2Ids = page2Res.body.tickets.map((t: any) => t.id)
    const overlap = page1Ids.filter((id: string) => page2Ids.includes(id))
    expect(overlap).toEqual([])
  })

  it('should_match_pure_domain_filtering_functions_identically', async () => {
    const { app, store, staffToken } = await setup()

    // Domain viewer simulation for staff minhanh
    const domainViewer = {
      name: 'Nguyễn Minh Anh',
      department: 'Kinh doanh' as const,
      isDepartmentHead: false,
      isExecutive: false,
    }

    const allTickets = await store.tickets.findAll()
    const expectedDomainTickets = filterTickets(
      filterVisibleTickets(allTickets, domainViewer),
      {
        scope: 'all',
        query: '',
        status: 'all',
        priority: 'all',
        department: 'all',
        fromDepartment: 'all',
        createdFrom: '',
        createdTo: '',
        due: 'all',
        assignment: 'all',
        assigneeName: '',
        sort: 'updated_desc',
      },
      domainViewer,
    )

    const apiRes = await request(app)
      .get('/api/tickets?limit=100')
      .set('Authorization', `Bearer ${staffToken}`)

    expect(apiRes.status).toBe(200)
    expect(apiRes.body.tickets.map((t: any) => t.id)).toEqual(expectedDomainTickets.map((t) => t.id))
  })
})
