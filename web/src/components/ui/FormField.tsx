import type { ReactNode } from 'react'

interface FormFieldProps {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}

export function FormField({ id, label, hint, error, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-brick-700">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}
