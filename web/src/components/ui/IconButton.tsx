import type { ButtonHTMLAttributes } from 'react'
import { Icon } from './Icon.tsx'
import type { IconName } from './Icon.tsx'

type IconButtonTone = 'neutral' | 'danger' | 'success'

const TONE_CLASSES: Record<IconButtonTone, string> = {
  neutral: 'text-ink-muted hover:bg-canvas hover:text-ink',
  danger: 'text-ink-muted hover:bg-brick-100 hover:text-brick-700',
  success: 'text-ink-muted hover:bg-moss-100 hover:text-moss-700',
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  icon: IconName
  // Names the action for assistive technology and doubles as the hover tooltip
  label: string
  tone?: IconButtonTone
}

export function IconButton({ icon, label, tone = 'neutral', className = '', type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600/40 disabled:cursor-not-allowed disabled:opacity-50 ${TONE_CLASSES[tone]} ${className}`}
      {...rest}
    >
      <Icon name={icon} className="size-4" />
    </button>
  )
}
