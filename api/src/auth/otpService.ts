import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import type { MemberOtp } from '../repositories/interfaces.ts'

export const OTP_LENGTH_DIGITS = 6
export const OTP_TTL_MS = 10 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000
const MILLISECONDS_PER_SECOND = 1000

export interface IssuedOtp {
  // Plain code delivered to the member, never stored
  readonly code: string
  readonly otp: MemberOtp
}

export type OtpCheckResult =
  | { readonly status: 'valid' }
  | { readonly status: 'expired' }
  | { readonly status: 'wrong'; readonly nextAttempts: number; readonly remainingAttempts: number }
  // The code can no longer be used and a new one must be requested
  | { readonly status: 'locked'; readonly nextAttempts: number }

// Issues, checks and rate limits one-time verification codes without ever persisting the plain code
export class OtpService {
  constructor(
    private readonly secret: string,
    private readonly clock: () => Date = () => new Date(),
  ) {
    if (!secret) {
      throw new Error('An OTP HMAC secret is required to hash verification codes.')
    }
  }

  // Generates a cryptographically random code and the hashed record that is stored on the member
  issue(memberId: string): IssuedOtp {
    const code = randomInt(0, 10 ** OTP_LENGTH_DIGITS).toString().padStart(OTP_LENGTH_DIGITS, '0')
    const now = this.clock()
    return {
      code,
      otp: {
        hash: this.hashCode(memberId, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        attempts: 0,
        sentAt: now,
      },
    }
  }

  // Judges a submitted code and reports the attempt counter the caller must persist
  check(memberId: string, otp: MemberOtp, submittedCode: string): OtpCheckResult {
    if (otp.attempts >= OTP_MAX_ATTEMPTS) return { status: 'locked', nextAttempts: otp.attempts }
    if (this.clock().getTime() > otp.expiresAt.getTime()) return { status: 'expired' }
    if (this.matches(otp.hash, this.hashCode(memberId, submittedCode))) return { status: 'valid' }

    const nextAttempts = otp.attempts + 1
    if (nextAttempts >= OTP_MAX_ATTEMPTS) return { status: 'locked', nextAttempts }
    return { status: 'wrong', nextAttempts, remainingAttempts: OTP_MAX_ATTEMPTS - nextAttempts }
  }

  // Whole seconds the member must still wait before another code may be sent, zero when allowed
  remainingCooldownSeconds(otp: MemberOtp): number {
    const elapsed = this.clock().getTime() - otp.sentAt.getTime()
    const remainingMs = OTP_RESEND_COOLDOWN_MS - elapsed
    return remainingMs > 0 ? Math.ceil(remainingMs / MILLISECONDS_PER_SECOND) : 0
  }

  private hashCode(memberId: string, code: string): string {
    // Binding the member id stops a code issued to one account from verifying another
    return createHmac('sha256', this.secret).update(`${memberId}:${code}`).digest('hex')
  }

  private matches(expectedHash: string, actualHash: string): boolean {
    const expected = Buffer.from(expectedHash, 'hex')
    const actual = Buffer.from(actualHash, 'hex')
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  }
}
