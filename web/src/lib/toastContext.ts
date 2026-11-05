import { createContext, useContext } from 'react'

export type ToastTone = 'neutral' | 'success' | 'danger'

export interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

export interface ToastContextValue {
  toasts: ToastItem[]
  notify: (message: string, tone?: ToastTone) => void
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
