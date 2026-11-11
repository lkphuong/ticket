// Switch that opts this browser in or out of push notifications

import type { PushNotificationControls } from '../../lib/usePushNotifications.ts'

interface PushNotificationToggleProps {
  push: PushNotificationControls
}

function describeState(push: PushNotificationControls): string {
  if (!push.isSupported) return 'Trình duyệt hoặc hệ thống này chưa hỗ trợ thông báo đẩy.'
  if (push.permission === 'denied') return 'Trình duyệt đang chặn thông báo. Hãy cho phép thông báo cho trang này trong cài đặt trình duyệt.'
  return push.isEnabled
    ? 'Bạn sẽ nhận thông báo tức thì trên trình duyệt này khi có yêu cầu mới hoặc cập nhật.'
    : 'Bật để nhận thông báo tức thì trên trình duyệt này, kể cả khi đang ở tab khác.'
}

export function PushNotificationToggle({ push }: PushNotificationToggleProps) {
  const canToggle = push.isSupported && push.permission !== 'denied' && !push.isBusy

  return (
    <section aria-labelledby="profile-push-heading" className="flex flex-col gap-2">
      <h3 id="profile-push-heading" className="text-xs font-bold tracking-wider text-ink uppercase">
        Thông báo
      </h3>
      <div className="flex items-start justify-between gap-4">
        <p id="profile-push-description" className="text-xs text-ink-muted">
          {describeState(push)}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={push.isEnabled}
          aria-labelledby="profile-push-heading"
          aria-describedby="profile-push-description"
          disabled={!canToggle}
          onClick={() => void (push.isEnabled ? push.disable() : push.enable())}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:ring-2 focus:ring-accent-600/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
            push.isEnabled ? 'bg-accent-600' : 'bg-line-strong'
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block size-5 rounded-full bg-white shadow-xs transition-transform ${push.isEnabled ? 'translate-x-5.5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>
    </section>
  )
}
