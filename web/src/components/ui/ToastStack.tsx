import type { ToastItem, ToastTone } from '../../lib/toastContext.ts'
import { Icon } from './Icon.tsx'
import type { IconName } from './Icon.tsx'
import { IconButton } from './IconButton.tsx'

interface ToastStackProps {
  toasts: readonly ToastItem[]
  onDismiss: (id: string) => void
}

interface ToneStyle {
  icon: IconName
  surface: string
  iconColor: string
}

const TONE_STYLES: Record<ToastTone, ToneStyle> = {
  info: { icon: 'info', surface: 'border-line-strong bg-surface', iconColor: 'text-blue-700' },
  success: { icon: 'check', surface: 'border-moss-700 bg-moss-100', iconColor: 'text-moss-700' },
  error: { icon: 'alert', surface: 'border-brick-500 bg-brick-100', iconColor: 'text-brick-700' },
}

// Errors interrupt screen readers, the other tones wait for a pause
function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const style = TONE_STYLES[toast.tone]
  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm text-ink shadow-lift ${style.surface}`}
    >
      <Icon name={style.icon} className={`mt-0.5 size-4 ${style.iconColor}`} />
      <p className="min-w-0 flex-1 break-words leading-snug">{toast.message}</p>
      <IconButton icon="x" label="Đóng thông báo" className="-my-1 -mr-1 size-7" onClick={() => onDismiss(toast.id)} />
    </div>
  )
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  const errors = toasts.filter((toast) => toast.tone === 'error')
  const others = toasts.filter((toast) => toast.tone !== 'error')

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[60] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-2 sm:right-4 sm:top-4">
      <div aria-live="assertive" aria-relevant="additions" className="flex flex-col gap-2">
        {errors.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
      <div aria-live="polite" aria-relevant="additions" className="flex flex-col gap-2">
        {others.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  )
}
