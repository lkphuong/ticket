import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-canvas',
  danger: 'border border-brick-500 bg-surface text-brick-700 hover:bg-brick-100',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  )
}
