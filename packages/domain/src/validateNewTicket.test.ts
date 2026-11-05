import { describe, expect, it } from 'vitest'
import type { NewTicketInput, Viewer } from './ticket.ts'
import { validateNewTicket } from './validateNewTicket.ts'

const requester: Viewer = { name: 'An', department: 'Kinh doanh', isDepartmentHead: false }
const today = new Date('2026-06-10T08:00:00.000Z')

const validInput: NewTicketInput = {
  title: 'Cấp email cho nhân viên mới',
  description: 'Ba nhân viên bắt đầu làm vào thứ Hai.',
  purpose: 'Để nhân viên mới có thể làm việc ngay ngày đầu.',
  expectedResult: 'Ba tài khoản email hoạt động trước thứ Hai.',
  priority: 'medium',
  toDepartment: 'Công nghệ thông tin',
  dueDate: '',
  attachments: [],
}

describe('validateNewTicket', () => {
  it('should_return_no_errors_when_input_is_valid', () => {
    expect(validateNewTicket(validInput, requester, today)).toEqual({})
  })

  it('should_require_title_when_title_is_blank', () => {
    expect(validateNewTicket({ ...validInput, title: '   ' }, requester, today).title).toBeDefined()
  })

  it('should_reject_short_description_when_below_minimum_length', () => {
    expect(validateNewTicket({ ...validInput, description: 'ngắn' }, requester, today).description).toBeDefined()
  })

  it('should_reject_short_purpose_when_below_minimum_length', () => {
    expect(validateNewTicket({ ...validInput, purpose: 'ngắn' }, requester, today).purpose).toBeDefined()
  })

  it('should_reject_short_expected_result_when_below_minimum_length', () => {
    expect(validateNewTicket({ ...validInput, expectedResult: '  ' }, requester, today).expectedResult).toBeDefined()
  })

  it('should_reject_own_department_when_target_equals_requester_department', () => {
    const errors = validateNewTicket({ ...validInput, toDepartment: 'Kinh doanh' }, requester, today)
    expect(errors.toDepartment).toBeDefined()
  })

  it('should_reject_past_due_date_when_date_is_before_today', () => {
    expect(validateNewTicket({ ...validInput, dueDate: '2026-06-09' }, requester, today).dueDate).toBeDefined()
    expect(validateNewTicket({ ...validInput, dueDate: '2026-06-10' }, requester, today).dueDate).toBeUndefined()
  })

  it('should_reject_oversized_attachment_when_file_exceeds_limit', () => {
    const attachments = [{ name: 'lon.zip', sizeKb: 20 * 1024 }]
    expect(validateNewTicket({ ...validInput, attachments }, requester, today).attachments).toBeDefined()
  })
})
