import type { ToastItem, ToastTone } from './toastContext.ts'

export const MAX_VISIBLE_TOASTS = 4

// Errors stay longer because they usually need a decision from the reader
const TOAST_TIMEOUT_MS: Record<ToastTone, number> = {
  info: 4000,
  success: 4000,
  error: 7000,
}

export function toastTimeoutFor(tone: ToastTone): number {
  return TOAST_TIMEOUT_MS[tone]
}

// Appends the toast and drops the oldest ones once the stack exceeds its cap
export function enqueueToast(queue: readonly ToastItem[], item: ToastItem): ToastItem[] {
  return [...queue, item].slice(-MAX_VISIBLE_TOASTS)
}

export function removeToast(queue: readonly ToastItem[], id: string): ToastItem[] {
  return queue.filter((item) => item.id !== id)
}
