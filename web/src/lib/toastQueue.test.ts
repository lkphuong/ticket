import { describe, expect, it } from 'bun:test'
import { enqueueToast, MAX_VISIBLE_TOASTS, removeToast, toastTimeoutFor } from './toastQueue.ts'
import type { ToastItem } from './toastContext.ts'

function toast(id: string): ToastItem {
  return { id, message: `message ${id}`, tone: 'info' }
}

describe('toast queue', () => {
  it('should_append_new_toast_when_queue_has_room', () => {
    const queue = enqueueToast([toast('a')], toast('b'))
    expect(queue.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('should_drop_oldest_toast_when_queue_exceeds_cap', () => {
    let queue: ToastItem[] = []
    for (let index = 0; index < MAX_VISIBLE_TOASTS + 2; index += 1) {
      queue = enqueueToast(queue, toast(String(index)))
    }
    expect(queue).toHaveLength(MAX_VISIBLE_TOASTS)
    expect(queue[0].id).toBe('2')
  })

  it('should_remove_only_the_dismissed_toast_when_id_matches', () => {
    const queue = removeToast([toast('a'), toast('b')], 'a')
    expect(queue.map((item) => item.id)).toEqual(['b'])
  })

  it('should_keep_error_toasts_longer_than_success_toasts_when_choosing_timeout', () => {
    expect(toastTimeoutFor('error')).toBeGreaterThan(toastTimeoutFor('success'))
  })
})
