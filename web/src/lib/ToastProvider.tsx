import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from './toastContext.ts'
import type { ToastItem, ToastTone } from './toastContext.ts'

interface ToastProviderProps {
  children: ReactNode
}

const TOAST_TIMEOUT_MS = 3500

const TONE_BORDER_CLASSES: Record<ToastTone, string> = {
  neutral: 'border-line-strong',
  success: 'border-moss-700',
  danger: 'border-brick-500',
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, tone: ToastTone = 'neutral') => {
      const id = crypto.randomUUID()
      const item: ToastItem = { id, message, tone }
      setToasts((current) => [...current, item])

      // Auto dismisses toast after set timeout to prevent visual clutter
      window.setTimeout(() => {
        dismiss(id)
      }, TOAST_TIMEOUT_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <aside
          aria-live="polite"
          aria-label="Thông báo hệ thống"
          className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2 pointer-events-none"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-center justify-between gap-3 rounded-md bg-ink px-4 py-3 text-xs text-white shadow-lift border ${TONE_BORDER_CLASSES[toast.tone]}`}
            >
              <span className="leading-snug">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 text-ash-200 hover:text-white font-semibold underline-offset-2 hover:underline"
              >
                Đóng
              </button>
            </div>
          ))}
        </aside>
      )}
    </ToastContext.Provider>
  )
}
