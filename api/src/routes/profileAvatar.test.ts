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
const OVERSIZED_AVATAR_BYTES = 2 * 1024 * 1024 + 1

describe('Profile avatar', () => {
  let app: Express
  let uploadDir: string
  let token: string

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'vtdesk-avatars-'))
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

  async function upload(name: string, type: string, content: Buffer): Promise<string> {
    const res = await request(app)
      .post('/api/attachments')
      .set('Authorization', `Bearer ${token}`)
      .set('X-File-Name', encodeURIComponent(name))
      .set('Content-Type', type)
      .send(content)
    return res.body.attachment.id
  }

  function setAvatar(avatarAttachmentId: unknown) {
    return request(app).patch('/api/auth/profile').set('Authorization', `Bearer ${token}`).send({ avatarAttachmentId })
  }

  it('should_store_avatar_and_return_it_from_me_when_attachment_is_a_small_image', async () => {
    const id = await upload('avatar.png', 'image/png', PNG_BYTES)

    const res = await setAvatar(id)
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.user.avatarAttachmentId).toBe(id)
    expect(me.body.user.avatarAttachmentId).toBe(id)
  })

  it('should_clear_avatar_when_attachment_id_is_null', async () => {
    await setAvatar(await upload('avatar.png', 'image/png', PNG_BYTES))

    const res = await setAvatar(null)

    expect(res.status).toBe(200)
    expect(res.body.user.avatarAttachmentId).toBeUndefined()
  })

  it('should_reject_avatar_when_attachment_is_not_an_image', async () => {
    const id = await upload('notes.pdf', 'application/pdf', PNG_BYTES)

    expect((await setAvatar(id)).status).toBe(400)
  })

  it('should_reject_avatar_when_image_exceeds_two_megabytes', async () => {
    const id = await upload('huge.png', 'image/png', Buffer.alloc(OVERSIZED_AVATAR_BYTES))

    expect((await setAvatar(id)).status).toBe(400)
  })

  it('should_reject_avatar_when_attachment_does_not_exist', async () => {
    expect((await setAvatar('202611_00000000-0000-4000-8000-000000000000')).status).toBe(400)
  })

  it('should_reject_avatar_when_value_is_not_a_string', async () => {
    expect((await setAvatar(42)).status).toBe(400)
  })
})
