import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastStack } from '../components/ui/ToastStack.tsx'
import { ToastContext } from './toastContext.ts'
import type { ToastItem, ToastTone } from './toastContext.ts'
import { enqueueToast, removeToast, toastTimeoutFor } from './toastQueue.ts'

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, number>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => removeToast(current, id))
  }, [])

  const notify = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = crypto.randomUUID()
      setToasts((current) => enqueueToast(current, { id, message, tone }))
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), toastTimeoutFor(tone)),
      )
    },
    [dismiss],
  )

  // Pending timers must not fire after the provider unmounts
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer))
      pending.clear()
    }
  }, [])

  const value = useMemo(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}
