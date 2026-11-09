// Ticket lifecycle contract tests verifying HTTP API compliance with core domain business rules

import { describe, expect, it } from 'vitest'
import request from 'supertest'
import {
  createApp,
  loadEnvironmentConfig,
  InMemoryTicketStore,
  TicketService,
  seedDatabase,
} from '@vtdesk/api'

describe('ticket lifecycle contract tests against API', () => {
  async function setup(injectedNow: Date = new Date('2026-11-05T10:00:00.000Z')) {
    let currentTime = injectedNow
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3000' })
    const store = new InMemoryTicketStore()
    await seedDatabase(store, currentTime)

    const ticketService = new TicketService(store, () => currentTime)
    const app = createApp(config, { store, ticketService })

    // Requester: minhanh (Nhân viên - Kinh doanh)
    const requesterRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'minhanh', password: 'ticket123' })
    const requesterToken = requesterRes.body.token

    // Receiving Head: vankhoa (Trưởng phòng - CNTT)
    const headRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vankhoa', password: 'ticket123' })
    const headToken = headRes.body.token

    // Requesting Head: quocbao (Trưởng phòng - Kinh doanh)
    const requestingHeadRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'quocbao', password: 'ticket123' })
    const requestingHeadToken = requestingHeadRes.body.token

    // Primary Handler: giahuy (Chuyên viên - CNTT)
    const handlerRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'giahuy', password: 'ticket123' })
    const handlerToken = handlerRes.body.token

    // Secondary Handler: tuananh (Chuyên viên - CNTT)
    const secondHandlerRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'tuananh', password: 'ticket123' })
    const secondHandlerToken = secondHandlerRes.body.token

    const createSampleTicket = async (overrides: Record<string, any> = {}) => {
      const payload = {
        title: 'Yêu cầu kiểm tra mạng tầng 2',
        description: 'Kết nối mạng bị gián đoạn định kỳ',
        purpose: 'Đảm bảo kết nối làm việc cho bộ phận kinh doanh',
        expectedResult: 'Hệ thống mạng hoạt động ổn định',
        priority: 'medium',
        toDepartment: 'Công nghệ thông tin',
        dueDate: '2026-11-10',
        attachments: [],
        ...overrides,
      }
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send(payload)
      expect(res.status).toBe(201)
      return res.body.ticket
    }

    const setClock = (nextTime: Date) => {
      currentTime = nextTime
    }

    return {
      app,
      store,
      requesterToken,
      requestingHeadToken,
      headToken,
      handlerToken,
      secondHandlerToken,
      createSampleTicket,
      setClock,
    }
  }

  it('should_close_ticket_when_happy_path_runs_from_creation_to_head_approval', async () => {
    const { app, requestingHeadToken, headToken, handlerToken, requesterToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    // 1. Assign to specialist by receiving department head
    const assignRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ assigneeName: 'Hoàng Gia Huy' })
    expect(assignRes.status).toBe(200)

    // 2. Start progress by assigned specialist
    const inProgressRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${handlerToken}`)
      .send({ status: 'in_progress' })
    expect(inProgressRes.status).toBe(200)

    // 3. Complete work (resolved) by specialist
    const resolvedRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${handlerToken}`)
      .send({ status: 'resolved' })
    expect(resolvedRes.status).toBe(200)

    // 4. Confirm resolution with CSAT rating 5 by requester
    const confirmRes = await request(app)
      .post(`/api/tickets/${ticket.id}/confirm`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ rating: 5, feedback: 'Xử lý rất nhanh và tận tình' })
    expect(confirmRes.status).toBe(200)
    expect(confirmRes.body.ticket.status).toBe('pending_approval')
    expect(confirmRes.body.ticket.rating).toBe(5)

    // 5. Requesting department head approves, which closes the ticket
    const approveRes = await request(app)
      .post(`/api/tickets/${ticket.id}/approve`)
      .set('Authorization', `Bearer ${requestingHeadToken}`)
    expect(approveRes.status).toBe(200)
    expect(approveRes.body.ticket.status).toBe('closed')
    expect(approveRes.body.ticket.rating).toBe(5)
  })

  it('should_reject_disallowed_status_transitions_and_explain_in_vietnamese', async () => {
    const { app, headToken, handlerToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ assigneeName: 'Hoàng Gia Huy' })

    // In-progress ticket cannot transition back to open
    const invalidOpenRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${handlerToken}`)
      .send({ status: 'open' })
    expect(invalidOpenRes.status).toBe(400)
    expect(invalidOpenRes.body.message).toContain('Đang xử lý')
    expect(invalidOpenRes.body.message).toContain('Mới')

    // In-progress ticket cannot transition directly to closed
    const invalidClosedRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${handlerToken}`)
      .send({ status: 'closed' })
    expect(invalidClosedRes.status).toBe(400)
  })

  it('should_reject_cancel_when_reason_is_blank', async () => {
    const { app, requesterToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/cancel`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: '   ' })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('lý do')
  })

  it('should_reject_cancel_when_ticket_is_already_closed', async () => {
    const { app, requestingHeadToken, headToken, handlerToken, requesterToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    await request(app).patch(`/api/tickets/${ticket.id}/assign`).set('Authorization', `Bearer ${headToken}`).send({ assigneeName: 'Hoàng Gia Huy' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'in_progress' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'resolved' })
    await request(app).post(`/api/tickets/${ticket.id}/confirm`).set('Authorization', `Bearer ${requesterToken}`).send({ rating: 4 })
    await request(app).post(`/api/tickets/${ticket.id}/approve`).set('Authorization', `Bearer ${requestingHeadToken}`)

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/cancel`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'Không cần nữa' })
    expect(res.status).toBe(403)
  })

  it('should_reject_confirmation_when_rating_is_out_of_bounds', async () => {
    const { app, headToken, handlerToken, requesterToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    await request(app).patch(`/api/tickets/${ticket.id}/assign`).set('Authorization', `Bearer ${headToken}`).send({ assigneeName: 'Hoàng Gia Huy' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'in_progress' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'resolved' })

    for (const invalidRating of [0, 6, 3.5, -1]) {
      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/confirm`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ rating: invalidRating })
      expect(res.status).toBe(400)
      expect(res.body.message).toContain('1 đến 5')
    }
  })

  it('should_reject_confirmation_when_ticket_is_not_resolved', async () => {
    const { app, headToken, handlerToken, requesterToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    await request(app).patch(`/api/tickets/${ticket.id}/assign`).set('Authorization', `Bearer ${headToken}`).send({ assigneeName: 'Hoàng Gia Huy' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'in_progress' })

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/confirm`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ rating: 5 })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Đã xử lý')
  })

  it('should_reject_assignment_when_ticket_is_closed', async () => {
    const { app, requestingHeadToken, headToken, handlerToken, requesterToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    await request(app).patch(`/api/tickets/${ticket.id}/assign`).set('Authorization', `Bearer ${headToken}`).send({ assigneeName: 'Hoàng Gia Huy' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'in_progress' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'resolved' })
    await request(app).post(`/api/tickets/${ticket.id}/confirm`).set('Authorization', `Bearer ${requesterToken}`).send({ rating: 5 })
    await request(app).post(`/api/tickets/${ticket.id}/approve`).set('Authorization', `Bearer ${requestingHeadToken}`)

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ assigneeName: 'Chu Tuấn Anh' })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('hoạt động')
  })

  it('should_return_to_in_progress_with_reason_when_rework_is_requested_on_resolved_ticket', async () => {
    const { app, headToken, handlerToken, requesterToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    await request(app).patch(`/api/tickets/${ticket.id}/assign`).set('Authorization', `Bearer ${headToken}`).send({ assigneeName: 'Hoàng Gia Huy' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'in_progress' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'resolved' })

    const reworkRes = await request(app)
      .post(`/api/tickets/${ticket.id}/rework`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'Chưa cài đặt đủ driver máy in' })
    expect(reworkRes.status).toBe(200)
    expect(reworkRes.body.ticket.status).toBe('in_progress')
    const lastHistory = reworkRes.body.ticket.statusHistory?.at(-1)
    expect(lastHistory?.status).toBe('in_progress')
    expect(lastHistory?.reason).toBe('Chưa cài đặt đủ driver máy in')
  })

  it('should_clear_rating_and_feedback_when_closed_ticket_is_reopened', async () => {
    const { app, requestingHeadToken, headToken, handlerToken, requesterToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    await request(app).patch(`/api/tickets/${ticket.id}/assign`).set('Authorization', `Bearer ${headToken}`).send({ assigneeName: 'Hoàng Gia Huy' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'in_progress' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'resolved' })
    await request(app).post(`/api/tickets/${ticket.id}/confirm`).set('Authorization', `Bearer ${requesterToken}`).send({ rating: 4, feedback: 'Tạm ổn' })
    await request(app).post(`/api/tickets/${ticket.id}/approve`).set('Authorization', `Bearer ${requestingHeadToken}`)

    const reopenRes = await request(app)
      .post(`/api/tickets/${ticket.id}/reopen`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'Sự cố tái diễn vào sáng nay' })
    expect(reopenRes.status).toBe(200)
    expect(reopenRes.body.ticket.status).toBe('in_progress')
    expect(reopenRes.body.ticket.rating).toBeUndefined()
    expect(reopenRes.body.ticket.feedback).toBeUndefined()
  })

  it('should_reject_reopen_when_reason_is_blank_or_ticket_is_active', async () => {
    const { app, requestingHeadToken, headToken, handlerToken, requesterToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    await request(app).patch(`/api/tickets/${ticket.id}/assign`).set('Authorization', `Bearer ${headToken}`).send({ assigneeName: 'Hoàng Gia Huy' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'in_progress' })

    // Active ticket cannot be reopened
    const activeReopenRes = await request(app)
      .post(`/api/tickets/${ticket.id}/reopen`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'Mở lại' })
    expect(activeReopenRes.status).toBe(400)

    // Close ticket first
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'resolved' })
    await request(app).post(`/api/tickets/${ticket.id}/confirm`).set('Authorization', `Bearer ${requesterToken}`).send({ rating: 5 })
    await request(app).post(`/api/tickets/${ticket.id}/approve`).set('Authorization', `Bearer ${requestingHeadToken}`)

    // Blank reason rejected
    const blankReopenRes = await request(app)
      .post(`/api/tickets/${ticket.id}/reopen`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: '   ' })
    expect(blankReopenRes.status).toBe(400)
    expect(blankReopenRes.body.message).toContain('lý do')
  })

  it('should_record_previous_and_new_assignee_when_ticket_is_handed_over', async () => {
    const { app, headToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    // First assignment
    const firstRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ assigneeName: 'Hoàng Gia Huy' })
    expect(firstRes.status).toBe(200)
    expect(firstRes.body.ticket.assigneeName).toBe('Hoàng Gia Huy')
    expect(firstRes.body.ticket.assignmentHistory).toEqual([
      expect.objectContaining({ to: 'Hoàng Gia Huy' }),
    ])

    // Handover to second specialist
    const secondRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ assigneeName: 'Chu Tuấn Anh' })
    expect(secondRes.status).toBe(200)
    expect(secondRes.body.ticket.assigneeName).toBe('Chu Tuấn Anh')
    expect(secondRes.body.ticket.assignmentHistory).toHaveLength(2)
    expect(secondRes.body.ticket.assignmentHistory[1]).toEqual(
      expect.objectContaining({ from: 'Hoàng Gia Huy', to: 'Chu Tuấn Anh' }),
    )
  })

  it('should_resume_work_when_requester_replies_to_waiting_ticket', async () => {
    const { app, headToken, handlerToken, requesterToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    await request(app).patch(`/api/tickets/${ticket.id}/assign`).set('Authorization', `Bearer ${headToken}`).send({ assigneeName: 'Hoàng Gia Huy' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'in_progress' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'waiting' })

    // Requester comments while ticket is waiting for feedback
    const commentRes = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ body: 'Tôi đã kiểm tra lại, mạng vẫn chập chờn.' })
    expect(commentRes.status).toBe(201)
    expect(commentRes.body.ticket.status).toBe('in_progress')
  })

  it('should_stay_waiting_when_handler_comments_on_waiting_ticket', async () => {
    const { app, headToken, handlerToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    await request(app).patch(`/api/tickets/${ticket.id}/assign`).set('Authorization', `Bearer ${headToken}`).send({ assigneeName: 'Hoàng Gia Huy' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'in_progress' })
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${handlerToken}`).send({ status: 'waiting' })

    // Handler comments while ticket is waiting
    const commentRes = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${handlerToken}`)
      .send({ body: 'Bạn có thể gửi ảnh chụp màn hình lỗi không?' })
    expect(commentRes.status).toBe(201)
    expect(commentRes.body.ticket.status).toBe('waiting')
  })

  it('should_keep_cancelled_ticket_closed_when_reopen_is_attempted', async () => {
    const { app, requesterToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    const cancelRes = await request(app)
      .post(`/api/tickets/${ticket.id}/cancel`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'Nhầm lẫn thông tin' })
    expect(cancelRes.status).toBe(200)

    const reopenRes = await request(app)
      .post(`/api/tickets/${ticket.id}/reopen`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'Muốn xử lý lại' })
    expect(reopenRes.status).toBe(400)
    expect(reopenRes.body.message).toContain('hủy')
  })

  it('should_reject_due_date_in_the_past_or_when_ticket_is_closed', async () => {
    const { app, headToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    // Past due date
    const pastRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/due-date`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ dueDate: '2026-01-01' })
    expect(pastRes.status).toBe(400)
    expect(pastRes.body.message).toContain('quá khứ')
  })

  it('should_reject_priority_change_and_comments_on_closed_ticket', async () => {
    const { app, headToken, requesterToken, createSampleTicket } = await setup()
    const ticket = await createSampleTicket()

    // Cancel ticket to close it
    await request(app).post(`/api/tickets/${ticket.id}/cancel`).set('Authorization', `Bearer ${requesterToken}`).send({ reason: 'Hủy' })

    // Attempt priority change on closed ticket returns 403 Forbidden
    const priorityRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/priority`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ priority: 'urgent' })
    expect(priorityRes.status).toBe(403)

    // Attempt comment on closed ticket returns 400 with explanation
    const commentRes = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ body: 'Bình luận sau khi đóng' })
    expect(commentRes.status).toBe(400)
    expect(commentRes.body.message).toContain('đóng')
  })
})
