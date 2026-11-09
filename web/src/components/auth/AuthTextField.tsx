import type { HTMLInputTypeAttribute } from 'react'
import { CONTROL_CLASS } from '../ui/controlStyles.ts'
import { FormField } from '../ui/FormField.tsx'

interface AuthTextFieldProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly type?: HTMLInputTypeAttribute
  readonly autoComplete?: string
  readonly placeholder?: string
  readonly hint?: string
  readonly error?: string
}

// Labelled input whose validation message sits directly beneath it
export function AuthTextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  hint,
  error,
}: AuthTextFieldProps) {
  return (
    <FormField id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${CONTROL_CLASS} ${error ? 'border-brick-500' : ''}`}
      />
    </FormField>
  )
}
