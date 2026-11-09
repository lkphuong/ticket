import { describe, expect, it } from 'bun:test'
import { OtpService, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS } from './otpService.ts'

const MEMBER_ID = 'member-1'

describe('OtpService', () => {
  it('should_issue_six_digit_code_with_hashed_record_when_issuing', () => {
    const service = new OtpService('secret')

    const { code, otp } = service.issue(MEMBER_ID)

    expect(code).toMatch(/^\d{6}$/)
    expect(otp.hash).not.toBe(code)
    expect(otp.attempts).toBe(0)
  })

  it('should_report_valid_when_submitted_code_matches', () => {
    const service = new OtpService('secret')
    const { code, otp } = service.issue(MEMBER_ID)

    expect(service.check(MEMBER_ID, otp, code).status).toBe('valid')
  })

  it('should_reject_code_when_it_belongs_to_a_different_member', () => {
    const service = new OtpService('secret')
    const { code, otp } = service.issue(MEMBER_ID)

    expect(service.check('member-2', otp, code).status).not.toBe('valid')
  })

  it('should_reject_code_when_hash_was_made_with_another_secret', () => {
    const { code, otp } = new OtpService('secret-a').issue(MEMBER_ID)

    expect(new OtpService('secret-b').check(MEMBER_ID, otp, code).status).not.toBe('valid')
  })

  it('should_count_down_attempts_and_lock_on_the_fifth_wrong_code', () => {
    const service = new OtpService('secret')
    const { code, otp } = service.issue(MEMBER_ID)
    const wrong = code === '000000' ? '000001' : '000000'

    const first = service.check(MEMBER_ID, otp, wrong)
    const last = service.check(MEMBER_ID, { ...otp, attempts: OTP_MAX_ATTEMPTS - 1 }, wrong)

    expect(first).toEqual({ status: 'wrong', nextAttempts: 1, remainingAttempts: OTP_MAX_ATTEMPTS - 1 })
    expect(last).toEqual({ status: 'locked', nextAttempts: OTP_MAX_ATTEMPTS })
  })

  it('should_report_expired_when_ttl_has_elapsed', () => {
    let now = new Date('2026-11-05T12:00:00Z')
    const service = new OtpService('secret', () => now)
    const { code, otp } = service.issue(MEMBER_ID)
    now = new Date(now.getTime() + OTP_TTL_MS + 1)

    expect(service.check(MEMBER_ID, otp, code).status).toBe('expired')
  })

  it('should_compute_remaining_cooldown_in_whole_seconds_when_checking_resend', () => {
    let now = new Date('2026-11-05T12:00:00Z')
    const service = new OtpService('secret', () => now)
    const { otp } = service.issue(MEMBER_ID)

    expect(service.remainingCooldownSeconds(otp)).toBe(OTP_RESEND_COOLDOWN_MS / 1000)
    now = new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS)
    expect(service.remainingCooldownSeconds(otp)).toBe(0)
  })

  it('should_throw_when_secret_is_empty', () => {
    expect(() => new OtpService('')).toThrow('secret')
  })
})
