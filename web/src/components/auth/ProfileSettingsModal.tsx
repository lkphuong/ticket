// Modal allowing authenticated users to manage optional email and notification preferences

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiClient } from '../../lib/apiClient.ts'
import { useToast } from '../../lib/toastContext.ts'
import { useAuth } from '../../state/useAuth.ts'
import { Button } from '../ui/Button.tsx'
import { CONTROL_CLASS } from '../ui/controlStyles.ts'
import { FormField } from '../ui/FormField.tsx'

interface ProfileSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ProfileSettingsModal({ isOpen, onClose }: ProfileSettingsModalProps) {
  const { viewer } = useAuth()
  const { notify } = useToast()

  const [email, setEmail] = useState('')
  const [receiveEmailNotifications, setReceiveEmailNotifications] = useState(false)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Loads current preferences whenever the modal becomes visible
  useEffect(() => {
    if (!isOpen) return
    let active = true

    apiClient.auth
      .me()
      .then((res) => {
        if (active) {
          setEmail(res.user.email ?? '')
          setReceiveEmailNotifications(Boolean(res.user.receiveEmailNotifications))
        }
      })
      .catch(() => {
        // Fallback to default state
      })

    return () => {
      active = false
    }
  }, [isOpen])

  if (!isOpen || !viewer) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const trimmedEmail = email.trim()
    if (trimmedEmail !== '' && !EMAIL_REGEX.test(trimmedEmail)) {
      setError('Định dạng email không hợp lệ (ví dụ: user@vtdesk.vn).')
      return
    }

    setIsSaving(true)
    try {
      await apiClient.auth.updateProfile({
        email: trimmedEmail === '' ? null : trimmedEmail,
        receiveEmailNotifications,
      })
      notify('Đã cập nhật thông tin cá nhân và cài đặt thông báo thành công.', 'success')
      onClose()
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật thông tin.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-lift">
        <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
          <h2 className="text-base font-bold text-ink">Cài đặt tài khoản & thông báo</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-ink-muted hover:text-ink focus:outline-none"
          >
            Đóng
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-md border border-brick-500/30 bg-brick-100/30 p-3 text-xs text-brick-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-md border border-line bg-canvas p-3 text-xs">
            <span className="font-semibold text-ink">{viewer.name}</span>
            <span className="text-ink-muted">Phòng ban: {viewer.department}</span>
          </div>

          <FormField id="profile-email" label="Email nhận thông báo (tùy chọn)" hint="Dùng để nhận bản tin và cảnh báo hạn xử lý">
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@vtdesk.vn"
              className={CONTROL_CLASS}
            />
          </FormField>

          <label className="flex items-start gap-2.5 text-xs text-ink cursor-pointer select-none">
            <input
              type="checkbox"
              checked={receiveEmailNotifications}
              onChange={(e) => setReceiveEmailNotifications(e.target.checked)}
              className="mt-0.5 rounded border-line text-accent-600 focus:ring-accent-600"
            />
            <span>Đồng ý nhận thông báo định kỳ và nhắc hạn qua email</span>
          </label>

          <div className="mt-3 flex items-center justify-end gap-2 border-t border-line pt-3">
            <Button variant="secondary" type="button" onClick={onClose} disabled={isSaving}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
