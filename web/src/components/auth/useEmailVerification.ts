import { useCallback, useState } from 'react'
import { apiClient } from '../../lib/apiClient.ts'
import { classifyOtpError } from '../../lib/otpErrors.ts'
import { useToast } from '../../lib/toastContext.ts'
import { useCountdown } from '../../lib/useCountdown.ts'
import type { Countdown } from '../../lib/useCountdown.ts'

export const OTP_LENGTH = 6
export const OTP_VALIDITY_SECONDS = 10 * 60
export const MAX_OTP_ATTEMPTS = 5
export const RESEND_COOLDOWN_SECONDS = 60

const VERIFY_FALLBACK_MESSAGE = 'Mã xác thực không hợp lệ hoặc đã hết hạn.'
const VERIFY_SUCCESS_MESSAGE = 'Xác thực tài khoản thành công. Bạn có thể đăng nhập ngay.'
const RESEND_FALLBACK_MESSAGE = 'Không thể gửi lại mã xác thực lúc này.'
const RESEND_SUCCESS_MESSAGE = 'Đã gửi lại mã xác thực. Vui lòng kiểm tra hộp thư.'
const INCOMPLETE_CODE_MESSAGE = `Vui lòng nhập đủ ${OTP_LENGTH} chữ số.`
const MISSING_IDENTIFIER_MESSAGE = 'Nhập tên tài khoản hoặc email để tiếp tục.'

export interface EmailVerificationOptions {
  readonly identifier: string
  // True right after registration, when a fresh code is already on its way
  readonly codeJustSent: boolean
  readonly onVerified: (username: string) => void
}

export interface EmailVerification {
  readonly code: string
  readonly setCode: (code: string) => void
  readonly codeError: string
  readonly identifierError: string
  readonly isSubmitting: boolean
  readonly isResending: boolean
  readonly attemptsRemaining: number | null
  readonly isLocked: boolean
  readonly isExpired: boolean
  // Changes after every rejected code so the input remounts empty and focused
  readonly inputKey: number
  readonly expiry: Countdown
  readonly cooldown: Countdown
  readonly submit: (code: string) => Promise<void>
  readonly resend: () => Promise<void>
}

export function useEmailVerification({ identifier, codeJustSent, onVerified }: EmailVerificationOptions): EmailVerification {
  const { notify } = useToast()
  // A code that was just emailed starts its validity and resend clocks immediately
  const expiry = useCountdown(codeJustSent ? OTP_VALIDITY_SECONDS : 0)
  const cooldown = useCountdown(codeJustSent ? RESEND_COOLDOWN_SECONDS : 0)
  const [code, setCodeValue] = useState('')
  const [codeError, setCodeError] = useState('')
  const [identifierError, setIdentifierError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [inputKey, setInputKey] = useState(0)

  const startExpiry = expiry.start
  const startCooldown = cooldown.start

  const startFreshCode = useCallback(() => {
    startExpiry(OTP_VALIDITY_SECONDS)
    startCooldown(RESEND_COOLDOWN_SECONDS)
  }, [startExpiry, startCooldown])

  function setCode(next: string) {
    setCodeValue(next)
    setCodeError('')
  }

  async function submit(candidate: string) {
    if (isSubmitting || isLocked) return
    if (candidate.length !== OTP_LENGTH) {
      setCodeError(INCOMPLETE_CODE_MESSAGE)
      return
    }
    if (!identifier) {
      setIdentifierError(MISSING_IDENTIFIER_MESSAGE)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await apiClient.auth.verifyEmail(candidate, identifier)
      notify(result.message || VERIFY_SUCCESS_MESSAGE, 'success')
      onVerified(result.user?.username ?? identifier)
    } catch (error: unknown) {
      const outcome = classifyOtpError(error, VERIFY_FALLBACK_MESSAGE)
      notify(outcome.message, 'error')
      setAttemptsRemaining(outcome.attemptsRemaining)
      setIsLocked(outcome.isLocked)
      setCodeValue('')
      setInputKey((current) => current + 1)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resend() {
    if (isResending || cooldown.isRunning) return
    if (!identifier) {
      setIdentifierError(MISSING_IDENTIFIER_MESSAGE)
      return
    }

    setIsResending(true)
    try {
      const result = await apiClient.auth.resendVerification(identifier)
      notify(result.message || RESEND_SUCCESS_MESSAGE, 'success')
      setIsLocked(false)
      setAttemptsRemaining(null)
      setCodeValue('')
      setInputKey((current) => current + 1)
      startFreshCode()
    } catch (error: unknown) {
      const outcome = classifyOtpError(error, RESEND_FALLBACK_MESSAGE)
      // The server knows the real remaining wait, so its value replaces the local timer
      if (outcome.cooldownSeconds !== null) cooldown.start(outcome.cooldownSeconds)
      notify(outcome.message, 'error')
    } finally {
      setIsResending(false)
    }
  }

  return {
    code,
    setCode,
    codeError,
    identifierError,
    isSubmitting,
    isResending,
    attemptsRemaining,
    isLocked,
    isExpired: expiry.hasStarted && !expiry.isRunning,
    inputKey,
    expiry,
    cooldown,
    submit,
    resend,
  }
}
