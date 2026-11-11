// Modal where signed-in users manage their avatar, department and notification opt-in

import type { PushNotificationControls } from '../../lib/usePushNotifications.ts'
import { useAuth } from '../../state/useAuth.ts'
import { AvatarSettings } from '../profile/AvatarSettings.tsx'
import { DepartmentTransferSettings } from '../profile/DepartmentTransferSettings.tsx'
import { PushNotificationToggle } from '../profile/PushNotificationToggle.tsx'
import { Button } from '../ui/Button.tsx'

interface ProfileSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  push: PushNotificationControls
}

export function ProfileSettingsModal({ isOpen, onClose, push }: ProfileSettingsModalProps) {
  const { viewer } = useAuth()

  if (!isOpen || !viewer) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" aria-label="Cài đặt tài khoản" className="max-h-full w-full max-w-md overflow-y-auto rounded-lg border border-line bg-surface p-6 shadow-lift">
        <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-ink">Cài đặt tài khoản</h2>
            <span className="text-xs text-ink-muted">{viewer.name}</span>
          </div>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-ink-muted hover:text-ink focus:outline-none">
            Đóng
          </button>
        </div>

        <div className="flex flex-col gap-6">
          <AvatarSettings />
          <DepartmentTransferSettings />
          <PushNotificationToggle push={push} />
        </div>

        <div className="mt-6 flex justify-end border-t border-line pt-3">
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  )
}
