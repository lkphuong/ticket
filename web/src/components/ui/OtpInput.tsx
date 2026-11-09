// Multi-digit numeric OTP input for email confirmation: typing, paste, autofill and keyboard navigation

import { useEffect, useRef } from 'react'
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react'
import { applyOtpInput, keepDigitsOnly, removeOtpDigit } from '../../lib/otpDigits.ts'
import type { OtpEdit } from '../../lib/otpDigits.ts'

const DEFAULT_LENGTH = 6

export interface OtpInputProps {
  readonly length?: number
  readonly value: string
  readonly onChange: (value: string) => void
  // Fires once when the last digit is entered, so callers can submit without another click
  readonly onComplete?: (code: string) => void
  readonly disabled?: boolean
  readonly autoFocus?: boolean
  readonly invalid?: boolean
  readonly describedBy?: string
  readonly label?: string
}

const SLOT_BASE_CLASS =
  'size-11 rounded-md border bg-surface text-center font-mono text-xl font-bold text-ink caret-accent-600 transition-colors sm:size-12 sm:text-2xl disabled:cursor-not-allowed disabled:opacity-50'

function slotStateClass(isFilled: boolean, invalid: boolean): string {
  if (invalid) return 'border-brick-500'
  return isFilled ? 'border-accent-600' : 'border-line-strong hover:border-ink-muted'
}

export function OtpInput({
  length = DEFAULT_LENGTH,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  invalid = false,
  describedBy,
  label = `Mã xác thực ${length} chữ số`,
}: OtpInputProps) {
  const slotRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!autoFocus || disabled) return
    slotRefs.current[0]?.focus()
  }, [autoFocus, disabled])

  function commit(edit: OtpEdit) {
    if (edit.value !== value) onChange(edit.value)
    slotRefs.current[edit.focusIndex]?.focus()
    if (edit.value.length === length && edit.value !== value) onComplete?.(edit.value)
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    if (disabled) return
    commit(applyOtpInput(value, index, event.target.value, length))
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    if (disabled) return
    const pasted = keepDigitsOnly(event.clipboardData.getData('text')).slice(0, length)
    if (pasted) commit(applyOtpInput(value, 0, pasted, length))
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    if (event.key === 'Backspace') {
      event.preventDefault()
      commit(removeOtpDigit(value, index))
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      slotRefs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault()
      slotRefs.current[index + 1]?.focus()
    }
  }

  return (
    <div role="group" aria-label={label} className="flex items-center justify-center gap-2 py-1 sm:gap-3">
      {Array.from({ length }, (_, index) => (
        <input
          key={`otp-slot-${index}`}
          ref={(element) => {
            slotRefs.current[index] = element
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          // Browsers offer the emailed code on the first slot and spread it with a multi-digit change event
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          disabled={disabled}
          value={value[index] ?? ''}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          aria-label={`Chữ số ${index + 1} trên ${length}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`${SLOT_BASE_CLASS} ${slotStateClass(Boolean(value[index]), invalid)}`}
        />
      ))}
    </div>
  )
}
