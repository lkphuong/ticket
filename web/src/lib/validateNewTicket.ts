import type { NewTicketInput, Viewer } from '../domain/ticket.ts'

export type NewTicketErrors = Partial<Record<keyof NewTicketInput, string>>

export const TITLE_MAX_LENGTH = 120
export const DESCRIPTION_MIN_LENGTH = 10
export const PURPOSE_MIN_LENGTH = 10
export const EXPECTED_RESULT_MIN_LENGTH = 10
export const MAX_ATTACHMENTS = 5
export const MAX_ATTACHMENT_SIZE_KB = 10 * 1024

export function validateNewTicket(input: NewTicketInput, requester: Viewer, today: Date): NewTicketErrors {
  const errors: NewTicketErrors = {}
  const title = input.title.trim()

  if (!title) errors.title = 'Vui lòng nhập tiêu đề.'
  else if (title.length > TITLE_MAX_LENGTH) errors.title = `Tiêu đề tối đa ${TITLE_MAX_LENGTH} ký tự.`

  if (input.description.trim().length < DESCRIPTION_MIN_LENGTH) {
    errors.description = `Mô tả cần ít nhất ${DESCRIPTION_MIN_LENGTH} ký tự để phòng ban nhận hiểu yêu cầu.`
  }

  if (input.purpose.trim().length < PURPOSE_MIN_LENGTH) {
    errors.purpose = `Mục đích cần ít nhất ${PURPOSE_MIN_LENGTH} ký tự để phòng ban nhận biết vì sao cần yêu cầu này.`
  }

  if (input.expectedResult.trim().length < EXPECTED_RESULT_MIN_LENGTH) {
    errors.expectedResult = `Kết quả mong muốn cần ít nhất ${EXPECTED_RESULT_MIN_LENGTH} ký tự để phòng ban nhận biết khi nào yêu cầu hoàn tất.`
  }

  if (!input.toDepartment) errors.toDepartment = 'Vui lòng chọn phòng ban xử lý.'
  else if (input.toDepartment === requester.department) {
    errors.toDepartment = 'Phòng ban xử lý phải khác phòng ban của bạn.'
  }

  if (input.dueDate && input.dueDate < today.toISOString().slice(0, 10)) {
    errors.dueDate = 'Hạn xử lý không được ở quá khứ.'
  }

  if (input.attachments.length > MAX_ATTACHMENTS) {
    errors.attachments = `Chỉ đính kèm tối đa ${MAX_ATTACHMENTS} tệp.`
  } else if (input.attachments.some((file) => file.sizeKb > MAX_ATTACHMENT_SIZE_KB)) {
    errors.attachments = `Mỗi tệp tối đa ${MAX_ATTACHMENT_SIZE_KB / 1024} MB.`
  }

  return errors
}
