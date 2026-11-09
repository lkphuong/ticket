const HTTP_BAD_REQUEST = 400
const HTTP_GONE = 410
const HTTP_LOCKED = 423
const HTTP_TOO_MANY_REQUESTS = 429

// Failure of an email verification step, carrying the HTTP status and machine readable code the client reads
export class VerificationError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number = HTTP_BAD_REQUEST,
    readonly code: string = 'VerificationError',
    readonly details: Readonly<Record<string, number>> = {},
  ) {
    super(message)
    this.name = 'VerificationError'
  }
}

export class WrongVerificationCodeError extends VerificationError {
  constructor(remainingAttempts: number) {
    super(
      `Mã xác thực không đúng, còn ${remainingAttempts} lần thử.`,
      HTTP_BAD_REQUEST,
      'invalid_code_attempt',
      { remainingAttempts },
    )
  }
}

export class VerificationLockedError extends VerificationError {
  constructor() {
    super(
      'Bạn đã nhập sai quá nhiều lần, mã đã bị vô hiệu. Vui lòng yêu cầu mã mới.',
      HTTP_LOCKED,
      'verification_locked',
    )
  }
}

export class VerificationExpiredError extends VerificationError {
  constructor() {
    super('Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới.', HTTP_GONE, 'verification_expired')
  }
}

export class ResendCooldownError extends VerificationError {
  constructor(retryAfterSeconds: number) {
    super(
      `Vui lòng chờ ${retryAfterSeconds} giây trước khi yêu cầu gửi lại mã.`,
      HTTP_TOO_MANY_REQUESTS,
      'resend_cooldown',
      { retryAfterSeconds },
    )
  }
}
