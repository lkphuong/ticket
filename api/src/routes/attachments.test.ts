import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { DiskAttachmentStorage } from '../attachments/attachmentStorage.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('Attachment upload and download API', () => {
  let app: Express
  let uploadDir: string
  let token: string

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'vtdesk-attachments-'))
    const store = new InMemoryTicketStore()
    await seedDatabase(store, new Date('2026-11-05T10:00:00.000Z'))
    app = createApp(loadEnvironmentConfig({ NODE_ENV: 'development' }), {
      store,
      attachmentStorage: new DiskAttachmentStorage(uploadDir),
    })
    const login = await request(app).post('/api/auth/login').send({ username: 'minhanh', password: 'ticket123' })
    token = login.body.token
  })

  afterAll(async () => {
    await rm(uploadDir, { recursive: true, force: true })
  })

  function upload(name: string, type: string, content: Buffer) {
    return request(app)
      .post('/api/attachments')
      .set('Authorization', `Bearer ${token}`)
      .set('X-File-Name', encodeURIComponent(name))
      .set('Content-Type', type)
      .send(content)
  }

  it('should_reject_upload_when_not_authenticated', async () => {
    const res = await request(app).post('/api/attachments').set('X-File-Name', 'a.png').set('Content-Type', 'image/png').send(PNG_BYTES)
    expect(res.status).toBe(401)
  })

  it('should_reject_upload_when_file_name_header_is_missing', async () => {
    const res = await request(app).post('/api/attachments').set('Authorization', `Bearer ${token}`).set('Content-Type', 'image/png').send(PNG_BYTES)
    expect(res.status).toBe(400)
  })

  it('should_reject_upload_when_body_is_empty', async () => {
    const res = await upload('empty.png', 'image/png', Buffer.alloc(0))
    expect(res.status).toBe(400)
  })

  it('should_reject_upload_when_file_exceeds_limit', async () => {
    const res = await upload('big.bin', 'application/octet-stream', Buffer.alloc(10 * 1024 * 1024 + 1))
    expect(res.status).toBe(413)
  })

  it('should_serve_image_inline_when_uploaded_as_png', async () => {
    const created = await upload('ảnh chụp.png', 'image/png', PNG_BYTES)
    expect(created.status).toBe(201)
    expect(created.body.attachment).toMatchObject({ name: 'ảnh chụp.png', mimeType: 'image/png', sizeKb: 1 })

    const res = await request(app).get(`/api/attachments/${created.body.attachment.id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('image/png')
    expect(res.headers['content-disposition']).toStartWith('inline;')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(Buffer.from(res.body).equals(PNG_BYTES)).toBe(true)
  })

  it('should_force_download_when_download_flag_is_set', async () => {
    const created = await upload('ảnh.png', 'image/png', PNG_BYTES)
    const res = await request(app).get(`/api/attachments/${created.body.attachment.id}?download=1`).set('Authorization', `Bearer ${token}`)
    expect(res.headers['content-disposition']).toBe(`attachment; filename*=UTF-8''${encodeURIComponent('ảnh.png')}`)
  })

  it('should_never_serve_html_inline_when_uploaded', async () => {
    const created = await upload('page.html', 'text/html', Buffer.from('<script>alert(1)</script>'))
    const res = await request(app).get(`/api/attachments/${created.body.attachment.id}`).set('Authorization', `Bearer ${token}`)
    expect(res.headers['content-type']).toStartWith('application/octet-stream')
    expect(res.headers['content-disposition']).toStartWith('attachment;')
  })

  it('should_return_not_found_when_id_is_unknown_or_malformed', async () => {
    const unknown = await request(app).get('/api/attachments/00000000-0000-4000-8000-000000000000').set('Authorization', `Bearer ${token}`)
    const traversal = await request(app).get('/api/attachments/..%2F..%2Fetc%2Fpasswd').set('Authorization', `Bearer ${token}`)
    expect(unknown.status).toBe(404)
    expect(traversal.status).toBe(404)
  })

  it('should_reject_ticket_creation_when_attachment_id_is_malformed', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Cần hỗ trợ',
        description: 'Mô tả chi tiết yêu cầu',
        purpose: 'Phục vụ công việc',
        expectedResult: 'Hoàn thành đúng hạn',
        priority: 'medium',
        toDepartment: 'CNTT',
        attachments: [{ name: 'a.png', sizeKb: 1, id: '../secret' }],
      })
    expect(res.status).toBe(400)
  })
})
