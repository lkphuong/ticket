import { ApiError } from './apiClient.ts'

export interface OtpErrorOutcome {
  readonly message: string
  readonly cooldownSeconds: number | null
  readonly attemptsRemaining: number | null
  readonly isLocked: boolean
}

const LOCKED_CODE_PATTERN = /locked|too_many|toomany/i
const LOCKED_MESSAGE_PATTERN = /quá \d+ lần|yêu cầu mã mới|gửi lại mã|khóa/i
const COOLDOWN_MESSAGE_PATTERN = /(\d+)\s*giây/i
const ATTEMPTS_MESSAGE_PATTERN = /còn\s*(\d+)\s*lần/i

function readNumber(pattern: RegExp, text: string): number | null {
  const match = pattern.exec(text)
  return match ? Number(match[1]) : null
}

// Reads rate limit and lockout hints from an API error, preferring structured fields over message text
export function classifyOtpError(error: unknown, fallbackMessage: string): OtpErrorOutcome {
  if (!(error instanceof ApiError)) {
    const message = error instanceof Error && error.message ? error.message : fallbackMessage
    return { message, cooldownSeconds: null, attemptsRemaining: null, isLocked: false }
  }

  const attemptsRemaining = readNumber(ATTEMPTS_MESSAGE_PATTERN, error.message)
  const isLocked =
    attemptsRemaining === 0 ||
    (error.code !== undefined && LOCKED_CODE_PATTERN.test(error.code)) ||
    LOCKED_MESSAGE_PATTERN.test(error.message)

  return {
    message: error.message,
    cooldownSeconds: error.retryAfterSeconds ?? readNumber(COOLDOWN_MESSAGE_PATTERN, error.message),
    attemptsRemaining,
    isLocked,
  }
}
