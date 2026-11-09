import { describe, expect, it } from 'bun:test'
import { ApiError } from './apiClient.ts'
import { classifyOtpError } from './otpErrors.ts'

const FALLBACK = 'fallback'

describe('classifyOtpError', () => {
  it('should_use_retry_after_seconds_when_server_sends_structured_cooldown', () => {
    const outcome = classifyOtpError(new ApiError('Vui lòng chờ', 429, undefined, undefined, 42), FALLBACK)
    expect(outcome.cooldownSeconds).toBe(42)
  })

  it('should_read_cooldown_from_message_when_no_structured_field_exists', () => {
    const outcome = classifyOtpError(new ApiError('Vui lòng chờ 35 giây để gửi lại mã.', 429), FALLBACK)
    expect(outcome.cooldownSeconds).toBe(35)
  })

  it('should_report_remaining_attempts_when_message_includes_them', () => {
    const outcome = classifyOtpError(new ApiError('Mã không đúng. Bạn còn 3 lần thử.', 400), FALLBACK)
    expect(outcome.attemptsRemaining).toBe(3)
    expect(outcome.isLocked).toBe(false)
  })

  it('should_mark_locked_when_attempts_are_exhausted', () => {
    const byCode = classifyOtpError(new ApiError('Sai quá nhiều.', 429, 'verification_locked'), FALLBACK)
    const byMessage = classifyOtpError(new ApiError('Bạn đã nhập sai quá 5 lần. Hãy yêu cầu mã mới.', 400), FALLBACK)
    expect(byCode.isLocked).toBe(true)
    expect(byMessage.isLocked).toBe(true)
  })

  it('should_not_mark_locked_when_server_reports_a_wrong_code_with_attempts_left', () => {
    const outcome = classifyOtpError(
      new ApiError('Mã không đúng. Bạn còn 4 lần thử.', 400, 'invalid_code_attempt'),
      FALLBACK,
    )
    expect(outcome.isLocked).toBe(false)
    expect(outcome.attemptsRemaining).toBe(4)
  })

  it('should_return_fallback_message_when_error_is_not_an_api_error', () => {
    const outcome = classifyOtpError('boom', FALLBACK)
    expect(outcome.message).toBe(FALLBACK)
    expect(outcome.isLocked).toBe(false)
  })
})
