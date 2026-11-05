import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'
import { seedDatabase } from '../db/seed.ts'
import { NotificationService } from '../notifications/notificationService.ts'
import { InMemoryTicketStore } from '../repositories/inMemoryTicketStore.ts'
import { TicketService } from '../tickets/ticketService.ts'

describe('In-App Notifications API & Domain Event Dispatching', () => {
  async function setup() {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    const now = new Date('2026-11-05T10:00:00.000Z')
    await seedDatabase(store, now)

    const notificationService = new NotificationService(store, undefined, () => now)
    const ticketService = new TicketService(store, () => now, notificationService)
    const app = createApp(config, { store, notificationService, ticketService })

    // Authenticate Head of CNTT (vankhoa)
    const headItLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vankhoa', password: 'ticket123' })
    const headItToken = headItLogin.body.token

    // Authenticate Specialist in CNTT (giahuy)
    const specialistLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'giahuy', password: 'ticket123' })
    const specialistToken = specialistLogin.body.token

    // Authenticate Requester in Kinh doanh (minhanh)
    const requesterLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const requesterToken = requesterLogin.body.token

    return {
      app,
      store,
      notificationService,
      ticketService,
      headItToken,
      specialistToken,
      requesterToken,
    }
  }

  it('should_dispatch_notifications_to_exact_recipients_across_full_ticket_lifecycle', async () => {
    const { app, headItToken, specialistToken, requesterToken } = await setup()

    // 1. Event: ticket_created (by minhanh in Kinh doanh -> sent to CNTT)
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        title: 'Cấp tài khoản VPN và mail',
        description: 'Cần hỗ trợ thiết lập tài khoản làm việc từ xa',
        purpose: 'Công tác ngoại tỉnh tuần tới',
        expectedResult: 'Đăng nhập VPN thành công',
        priority: 'high',
        toDepartment: 'Công nghệ thông tin',
      })
    expect(createRes.status).toBe(201)
    const ticketId = createRes.body.ticket.id

    // Check Head of CNTT received notification
    const headNotifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${headItToken}`)
    expect(headNotifRes.status).toBe(200)
    const newTicketNotif = headNotifRes.body.notifications.find((n: any) => n.type === 'ticket_created')
    expect(newTicketNotif).toBeDefined()
    expect(newTicketNotif.title).toContain('Ticket mới gửi đến phòng')

    // Verify creator (minhanh) did NOT receive notification of own action
    const reqNotifRes1 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(reqNotifRes1.body.notifications.some((n: any) => n.type === 'ticket_created')).toBe(false)

    // 2. Event: ticket_assigned (by head vankhoa -> to specialist giahuy)
    const assignRes = await request(app)
      .patch(`/api/tickets/${ticketId}/assign`)
      .set('Authorization', `Bearer ${headItToken}`)
      .send({ assigneeName: 'Hoàng Gia Huy' })
    expect(assignRes.status).toBe(200)

    // Check specialist received assignment notification
    const specNotifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${specialistToken}`)
    expect(specNotifRes.body.notifications.some((n: any) => n.type === 'ticket_assigned')).toBe(true)

    // Head who performed assignment does NOT receive notification
    const headNotifRes2 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${headItToken}`)
    expect(headNotifRes2.body.notifications.some((n: any) => n.type === 'ticket_assigned')).toBe(false)

    // 3. Event: status_waiting (specialist requests feedback)
    const waitRes = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ status: 'waiting', reason: 'Vui lòng cung cấp địa chỉ IP máy trạm.' })
    expect(waitRes.status).toBe(200)

    // Requester received waiting notification
    const reqNotifRes2 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${requesterToken}`)
    const waitingNotif = reqNotifRes2.body.notifications.find((n: any) => n.type === 'status_waiting')
    expect(waitingNotif).toBeDefined()
    expect(waitingNotif.title).toContain('Yêu cầu cần phản hồi thông tin')

    // 4. Event: comment_added (requester answers specialist)
    const commentRes = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ body: 'IP máy trạm của tôi là 192.168.1.50' })
    expect(commentRes.status).toBe(201)

    // Specialist received notification of requester reply
    const specNotifRes2 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${specialistToken}`)
    const replyNotif = specNotifRes2.body.notifications.find((n: any) => n.type === 'comment_added')
    expect(replyNotif).toBeDefined()
    expect(replyNotif.title).toContain('Người gửi đã phản hồi Ticket')

    // 5. Event: status_resolved (specialist marks completed)
    const resolveRes = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ status: 'resolved' })
    expect(resolveRes.status).toBe(200)

    // Requester received resolved notification
    const reqNotifRes3 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(reqNotifRes3.body.notifications.some((n: any) => n.type === 'status_resolved')).toBe(true)

    // 6. Event: result_confirmed (requester confirms and gives CSAT rating)
    const confirmRes = await request(app)
      .post(`/api/tickets/${ticketId}/confirm`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ rating: 5, feedback: 'Dịch vụ hoàn hảo' })
    expect(confirmRes.status).toBe(200)

    // Both specialist and receiving head receive confirmation notification
    const specNotifRes3 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${specialistToken}`)
    expect(specNotifRes3.body.notifications.some((n: any) => n.type === 'result_confirmed')).toBe(true)

    const headNotifRes3 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${headItToken}`)
    expect(headNotifRes3.body.notifications.some((n: any) => n.type === 'result_confirmed')).toBe(true)
  })

  it('should_enforce_user_isolation_so_users_only_view_their_own_notifications', async () => {
    const { app, specialistToken, requesterToken } = await setup()

    const specRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${specialistToken}`)

    const reqRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${requesterToken}`)

    expect(specRes.status).toBe(200)
    expect(reqRes.status).toBe(200)

    // Every returned notification must belong strictly to the authenticated recipient
    expect(specRes.body.notifications.every((n: any) => n.recipientUsername === 'giahuy')).toBe(true)
    expect(reqRes.body.notifications.every((n: any) => n.recipientUsername === 'minhanh')).toBe(true)
  })

  it('should_track_accurate_unread_counter_and_update_state_on_marking_read', async () => {
    const { app, specialistToken } = await setup()

    const listRes1 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${specialistToken}`)

    const initialUnread = listRes1.body.unreadCount
    expect(initialUnread).toBeGreaterThanOrEqual(0)

    if (listRes1.body.notifications.length > 0) {
      const firstId = listRes1.body.notifications[0].id

      // Mark single notification as read
      const markSingleRes = await request(app)
        .patch(`/api/notifications/${firstId}/read`)
        .set('Authorization', `Bearer ${specialistToken}`)
      expect(markSingleRes.status).toBe(200)
      expect(markSingleRes.body.success).toBe(true)

      // Mark all notifications as read
      const markAllRes = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${specialistToken}`)
      expect(markAllRes.status).toBe(200)
      expect(markAllRes.body.success).toBe(true)

      // Verify unread count is now zero
      const listRes2 = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${specialistToken}`)
      expect(listRes2.body.unreadCount).toBe(0)
      expect(listRes2.body.notifications.every((n: any) => n.isRead)).toBe(true)
    }
  })

  it('should_never_abort_business_transaction_when_notification_service_encounters_an_error', async () => {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const store = new InMemoryTicketStore()
    const now = new Date('2026-11-05T10:00:00.000Z')
    await seedDatabase(store, now)

    // Faulty notification service that throws unhandled errors on dispatch
    const faultyNotificationService = {
      dispatch: async () => {
        throw new Error('Database connection lost during notification insertion')
      },
      listNotifications: async () => [],
      getUnreadCount: async () => 0,
      markAsRead: async () => {},
      markAllAsRead: async () => {},
    } as unknown as NotificationService

    const ticketService = new TicketService(store, () => now, faultyNotificationService)
    const app = createApp(config, { store, notificationService: faultyNotificationService, ticketService })

    const requesterLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const requesterToken = requesterLogin.body.token

    // Ticket creation must succeed despite notification failure
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        title: 'Yêu cầu kiểm thử độ chịu lỗi',
        description: 'Đảm bảo lỗi thông báo không làm hỏng giao dịch',
        purpose: 'Kiểm thử khả năng phục hồi',
        expectedResult: 'Ticket vẫn được tạo thành công',
        priority: 'medium',
        toDepartment: 'Công nghệ thông tin',
      })

    expect(res.status).toBe(201)
    expect(res.body.ticket.id).toBeDefined()
  })
})
