import { describe, expect, it } from 'vitest'
import type { NewTicketInput, Viewer } from './ticket.ts'
import { buildMockTickets } from './mockTickets.ts'
import { filterVisibleTickets } from './ticketVisibility.ts'
import { ENTERPRISE_TEMPLATES } from './ticketTemplates.ts'
import { validateNewTicket } from './validateNewTicket.ts'
import { buildTicket } from './ticketFactory.ts'

const now = new Date('2026-06-15T09:00:00.000Z')
const requester: Viewer = { name: 'Nguyễn Minh Anh', department: 'Kinh doanh', isDepartmentHead: false }
const accountingHead: Viewer = { name: 'Ngô Bích Ngọc', department: 'Kế toán', isDepartmentHead: true }

const input: NewTicketInput = {
  title: '  Hoàn ứng công tác  ',
  description: 'Hoàn ứng công tác phí chuyến đi Đà Nẵng',
  purpose: 'Đóng khoản tạm ứng trước khi khóa sổ',
  expectedResult: 'Phiếu hoàn ứng được duyệt',
  priority: 'high',
  toDepartment: 'Kế toán',
  dueDate: '2026-06-20',
  attachments: [{ name: 'chung-tu.pdf', sizeKb: 120 }],
}

describe('creating a ticket', () => {
  it('should_create_open_ticket_with_unique_id_and_injected_timestamp', () => {
    const existing = buildMockTickets(now)
    const first = buildTicket(input, requester, existing, now)
    const second = buildTicket(input, requester, [first, ...existing], now)
    expect(first.status).toBe('open')
    expect(first.title).toBe('Hoàn ứng công tác')
    expect(first.createdAt).toBe(now.toISOString())
    expect(first.statusHistory).toEqual([{ status: 'open', at: now.toISOString(), actor: { name: requester.name, department: requester.department } }])
    expect(new Set([...existing.map((ticket) => ticket.id), first.id, second.id]).size).toBe(existing.length + 2)
  })

  it('should_appear_in_the_receiving_head_queue_and_the_requester_list', () => {
    const ticket = buildTicket(input, requester, buildMockTickets(now), now)
    expect(filterVisibleTickets([ticket], accountingHead)).toEqual([ticket])
    expect(filterVisibleTickets([ticket], requester)).toEqual([ticket])
  })

  it('should_refuse_to_build_when_target_department_is_missing', () => {
    expect(() => buildTicket({ ...input, toDepartment: '' }, requester, [], now)).toThrow('target department')
  })
})

describe('templates', () => {
  it.each(['Công nghệ thông tin', 'Kế toán', 'Pháp chế', 'Hành chính', 'Nhân sự'] as const)(
    'should_offer_a_valid_template_when_target_department_is_%s',
    (department) => {
      const template = ENTERPRISE_TEMPLATES.find((candidate) => candidate.targetDepartment === department)
      expect(template).toBeDefined()
      const filled: NewTicketInput = { ...input, ...template?.values, dueDate: '', attachments: [] }
      expect(validateNewTicket(filled, requester, now)).toEqual({})
    },
  )

  it('should_flag_due_date_in_the_past_relative_to_the_injected_clock', () => {
    expect(validateNewTicket({ ...input, dueDate: '2026-06-14' }, requester, now).dueDate).toContain('quá khứ')
    expect(validateNewTicket({ ...input, dueDate: '2026-06-15' }, requester, now).dueDate).toBeUndefined()
  })
})
