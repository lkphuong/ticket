import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatCountdown } from '../../lib/formatCountdown.ts'
import { Button } from '../ui/Button.tsx'
import { OtpInput } from '../ui/OtpInput.tsx'
import { AuthTextField } from './AuthTextField.tsx'
import {
  MAX_OTP_ATTEMPTS,
  OTP_LENGTH,
  OTP_VALIDITY_SECONDS,
  useEmailVerification,
} from './useEmailVerification.ts'
import type { EmailVerification } from './useEmailVerification.ts'

const CODE_STATUS_ID = 'otp-status'
const CODE_ERROR_ID = 'otp-error'

interface VerifyEmailFormProps {
  // Known right after registration or a blocked login; empty when the user opened the form directly
  readonly knownIdentifier: string
  readonly email: string
  readonly codeJustSent: boolean
  readonly onVerified: (username: string) => void
  readonly onBackToLogin: () => void
}

function describeCodeStatus(state: EmailVerification): string {
  if (state.isLocked) return `Bạn đã nhập sai quá ${MAX_OTP_ATTEMPTS} lần. Hãy gửi lại mã để nhận mã mới.`
  if (state.isExpired) return 'Mã đã hết hạn. Hãy gửi lại mã để nhận mã mới.'
  if (state.attemptsRemaining !== null) return `Mã chưa đúng. Bạn còn ${state.attemptsRemaining} lần thử.`
  return ''
}

function ExpiryHint({ state }: { state: EmailVerification }) {
  const minutes = OTP_VALIDITY_SECONDS / 60
  const isCounting = state.expiry.isRunning
  return (
    <p className="text-center text-xs text-ink-muted">
      {isCounting ? (
        <>
          Mã còn hiệu lực <span className="font-mono font-semibold text-ink">{formatCountdown(state.expiry.secondsLeft)}</span>
        </>
      ) : (
        `Mã có hiệu lực ${minutes} phút, tối đa ${MAX_OTP_ATTEMPTS} lần nhập sai.`
      )}
    </p>
  )
}

function ResendRow({ state, onResend }: { state: EmailVerification; onResend: () => void }) {
  const isWaiting = state.cooldown.isRunning
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-canvas p-3 text-sm">
      <span className="text-ink">Chưa nhận được mã?</span>
      <Button
        variant="secondary"
        className="px-3 py-1.5"
        disabled={isWaiting || state.isResending}
        onClick={onResend}
      >
        {isWaiting ? `Gửi lại sau ${state.cooldown.secondsLeft}s` : state.isResending ? 'Đang gửi...' : 'Gửi lại mã'}
      </Button>
    </div>
  )
}

export function VerifyEmailForm({ knownIdentifier, email, codeJustSent, onVerified, onBackToLogin }: VerifyEmailFormProps) {
  const [typedIdentifier, setTypedIdentifier] = useState('')
  const identifier = (knownIdentifier || typedIdentifier).trim()
  const state = useEmailVerification({ identifier, codeJustSent, onVerified })
  const statusMessage = describeCodeStatus(state)
  const isInputDisabled = state.isSubmitting || state.isLocked

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void state.submit(state.code)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-ink">Xác thực email</h2>
        <p className="text-sm text-ink-muted">
          {email ? (
            <>
              Nhập mã {OTP_LENGTH} chữ số đã gửi tới <span className="font-mono font-semibold text-ink">{email}</span>.
            </>
          ) : (
            `Nhập mã ${OTP_LENGTH} chữ số trong email xác thực để kích hoạt tài khoản.`
          )}
        </p>
      </div>

      {!knownIdentifier && (
        <AuthTextField
          id="verify-identifier"
          label="Tên tài khoản hoặc email"
          autoComplete="username"
          value={typedIdentifier}
          onChange={setTypedIdentifier}
          error={state.identifierError}
        />
      )}

      <div className="flex flex-col gap-2">
        <OtpInput
          key={state.inputKey}
          length={OTP_LENGTH}
          value={state.code}
          onChange={state.setCode}
          onComplete={(completed) => void state.submit(completed)}
          disabled={isInputDisabled}
          invalid={Boolean(state.codeError) || state.isLocked}
          describedBy={state.codeError ? CODE_ERROR_ID : CODE_STATUS_ID}
        />
        {state.codeError && (
          <p id={CODE_ERROR_ID} role="alert" className="text-center text-sm text-brick-700">
            {state.codeError}
          </p>
        )}
        <div id={CODE_STATUS_ID} className="flex flex-col gap-1">
          {statusMessage && <p className="text-center text-sm font-medium text-brick-700">{statusMessage}</p>}
          <ExpiryHint state={state} />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isInputDisabled || state.code.length !== OTP_LENGTH}>
        {state.isSubmitting ? 'Đang xác thực...' : 'Kích hoạt tài khoản'}
      </Button>

      <ResendRow state={state} onResend={() => void state.resend()} />

      <p className="text-xs leading-relaxed text-ink-muted">
        Không chia sẻ mã này với bất kỳ ai, kể cả nhân viên hỗ trợ VTDesk.
      </p>

      <div className="border-t border-line pt-3 text-center text-sm">
        <button type="button" onClick={onBackToLogin} className="font-medium text-ink-muted hover:text-ink hover:underline">
          Quay lại đăng nhập
        </button>
      </div>
    </form>
  )
}
