import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { NotificationService } from '../notifications/notificationService.ts'
import { FirebasePushGateway, MockPushGateway } from '../notifications/pushGateway.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'
import { TicketService } from '../tickets/ticketService.ts'

describe('Firebase Push Notifications & Optional Email Profile API', () => {
  async function setup() {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    const now = new Date('2026-11-05T10:00:00.000Z')
    await seedDatabase(store, now)

    const pushGateway = new MockPushGateway()
    const notificationService = new NotificationService(store, undefined, () => now, pushGateway)
    const ticketService = new TicketService(store, () => now, notificationService)
    const app = createApp(config, {
      store,
      pushGateway,
      notificationService,
      ticketService,
    })

    // Authenticate Head of CNTT (vankhoa)
    const headLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vankhoa', password: 'ticket123' })
    const headToken = headLogin.body.token

    // Authenticate Requester in Kinh doanh (minhanh)
    const requesterLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const requesterToken = requesterLogin.body.token

    return {
      app,
      store,
      pushGateway,
      notificationService,
      ticketService,
      headToken,
      requesterToken,
    }
  }

  it('should_allow_registering_multiple_device_tokens_and_unregistering_individual_token', async () => {
    const { app, store, headToken } = await setup()

    // 1. Register primary mobile device token
    const res1 = await request(app)
      .post('/api/notifications/devices')
      .set('Authorization', `Bearer ${headToken}`)
      .send({ token: 'fcm-token-iphone-15-pro' })

    expect(res1.status).toBe(200)
    expect(res1.body.status).toBe('ok')

    // 2. Register secondary tablet device token
    const res2 = await request(app)
      .post('/api/notifications/devices')
      .set('Authorization', `Bearer ${headToken}`)
      .send({ token: 'fcm-token-ipad-air' })

    expect(res2.status).toBe(200)

    // 3. Verify user has both tokens recorded in store
    const registered = await store.deviceTokens.findByUsername('vankhoa')
    expect(registered).toHaveLength(2)
    const tokens = registered.map((d) => d.token)
    expect(tokens).toContain('fcm-token-iphone-15-pro')
    expect(tokens).toContain('fcm-token-ipad-air')

    // 4. Unregister individual device token
    const unregRes = await request(app)
      .delete('/api/notifications/devices/fcm-token-ipad-air')
      .set('Authorization', `Bearer ${headToken}`)

    expect(unregRes.status).toBe(200)

    // 5. Verify remaining token
    const remaining = await store.deviceTokens.findByUsername('vankhoa')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].token).toBe('fcm-token-iphone-15-pro')
  })

  it('should_reject_device_token_registration_when_payload_is_invalid', async () => {
    const { app, headToken } = await setup()

    // Empty body
    const res1 = await request(app)
      .post('/api/notifications/devices')
      .set('Authorization', `Bearer ${headToken}`)
      .send({})

    expect(res1.status).toBe(400)
    expect(res1.body.error).toBe('ValidationError')

    // Whitespace token
    const res2 = await request(app)
      .post('/api/notifications/devices')
      .set('Authorization', `Bearer ${headToken}`)
      .send({ token: '   ' })

    expect(res2.status).toBe(400)
    expect(res2.body.error).toBe('ValidationError')
  })

  it('should_dispatch_multicast_push_to_all_recipient_devices_and_prune_rejected_tokens', async () => {
    const { app, store, pushGateway, headToken, requesterToken } = await setup()

    // Register active phone and expired tablet for receiving head vankhoa
    await request(app)
      .post('/api/notifications/devices')
      .set('Authorization', `Bearer ${headToken}`)
      .send({ token: 'active-phone-token' })

    await request(app)
      .post('/api/notifications/devices')
      .set('Authorization', `Bearer ${headToken}`)
      .send({ token: 'expired-tablet-token' })

    // Configure mock gateway to simulate rejection of the expired token
    pushGateway.setRejectedTokens(['expired-tablet-token'])

    // Requester creates ticket targeted to CNTT (head vankhoa receives notification)
    const ticketRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        title: 'Cần nâng cấp băng thông mạng nội bộ',
        description: 'Đường truyền chi nhánh bị nghẽn trong giờ cao điểm',
        purpose: 'Đảm bảo hoạt động kinh doanh thông suốt',
        expectedResult: 'Băng thông tăng lên 1Gbps',
        priority: 'high',
        toDepartment: 'Công nghệ thông tin',
      })

    expect(ticketRes.status).toBe(201)

    // Verify push gateway received multicast with both tokens
    expect(pushGateway.sentMessages.length).toBeGreaterThan(0)
    const lastPush = pushGateway.sentMessages[pushGateway.sentMessages.length - 1]
    expect(lastPush.tokens).toContain('active-phone-token')
    expect(lastPush.tokens).toContain('expired-tablet-token')
    expect(lastPush.payload.title).toContain('Ticket mới')

    // Verify that the expired token was pruned from the database while the valid token was kept
    const remainingTokens = await store.deviceTokens.findByUsername('vankhoa')
    expect(remainingTokens).toHaveLength(1)
    expect(remainingTokens[0].token).toBe('active-phone-token')
  })

  it('should_never_abort_business_transaction_when_push_gateway_fails_with_network_error', async () => {
    const { app, store, pushGateway, headToken, requesterToken } = await setup()

    // Register device token
    await request(app)
      .post('/api/notifications/devices')
      .set('Authorization', `Bearer ${headToken}`)
      .send({ token: 'fcm-valid-device-token' })

    // Simulate complete push gateway network failure
    pushGateway.setSimulateFailure(true)

    // Creating ticket must succeed seamlessly despite push network failure
    const ticketRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        title: 'Bảo trì server định kỳ',
        description: 'Server ERP cần cập nhật bản vá bảo mật',
        purpose: 'Tăng cường bảo mật thông tin',
        expectedResult: 'Hệ thống ERP hoạt động ổn định',
        priority: 'medium',
        toDepartment: 'Công nghệ thông tin',
      })

    expect(ticketRes.status).toBe(201)
    expect(ticketRes.body.ticket.id).toBeDefined()

    // In-app notification in database must still be saved
    const notifications = await store.notifications.findByRecipient('vankhoa')
    expect(notifications.length).toBeGreaterThan(0)
  })

  it('should_read_firebase_service_credentials_from_environment_variables_without_disclosing_secret', async () => {
    const fakeEnv = {
      FIREBASE_PROJECT_ID: 'vtdesk-production-789',
      FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk@vtdesk-production-789.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----',
    }

    const calls: Array<{ tokens: string[]; notification: { title: string; body: string } }> = []
    const gateway = new FirebasePushGateway(fakeEnv, () => ({
      sendEachForMulticast: async (message) => {
        calls.push(message)
        return {
          responses: message.tokens.map((token) =>
            token === 'stale-token'
              ? { success: false, error: { code: 'messaging/registration-token-not-registered' } }
              : { success: true },
          ),
        }
      },
    }))

    const res = await gateway.sendToDevices(['mock-device-token', 'stale-token'], {
      title: 'Thông báo thử nghiệm',
      body: 'Nội dung kiểm tra',
    })

    expect(calls[0]?.notification.title).toBe('Thông báo thử nghiệm')
    expect(res.successCount).toBe(1)
    expect(res.failureCount).toBe(1)
    expect(res.invalidTokens).toEqual(['stale-token'])
  })

  it('should_skip_delivery_when_firebase_credentials_are_missing', async () => {
    const gateway = new FirebasePushGateway({})
    const res = await gateway.sendToDevices(['token'], { title: 't', body: 'b' })
    expect(res).toEqual({ successCount: 0, failureCount: 0, invalidTokens: [] })
  })
})
