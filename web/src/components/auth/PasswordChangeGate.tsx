// Mandatory password change gate rendered when an account uses a temporary initial password

import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button } from '../ui/Button.tsx'
import { CONTROL_CLASS } from '../ui/controlStyles.ts'
import { FormField } from '../ui/FormField.tsx'
import { useAuth } from '../../state/useAuth.ts'
import { useToast } from '../../lib/toastContext.ts'

interface PasswordChangeGateProps {
  children: ReactNode
}

export function PasswordChangeGate({ children }: PasswordChangeGateProps) {
  const { viewer, changePassword, logout } = useAuth()
  const { notify } = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!viewer || !viewer.requiresPasswordChange) {
    return <>{children}</>
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại.')
      return
    }

    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không trùng khớp.')
      return
    }

    setIsSubmitting(true)
    try {
      const err = await changePassword(currentPassword, newPassword)
      if (err) {
        setError(err)
      } else {
        notify('Đổi mật khẩu thành công.', 'success')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-lg border border-line bg-surface p-6 shadow-lift">
        <div className="mb-4">
          <h1 className="text-lg font-bold text-ink">Đổi mật khẩu lần đầu</h1>
          <p className="mt-1 text-xs text-ink-muted">
            Tài khoản của bạn được cấp mật khẩu tạm. Vui lòng thiết lập mật khẩu mới (tối thiểu 8 ký tự) để bảo vệ tài khoản.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-md border border-brick-500/30 bg-brick-100/30 p-3 text-xs text-brick-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField id="current-password" label="Mật khẩu hiện tại">
            <input
              id="current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={CONTROL_CLASS}
            />
          </FormField>

          <FormField id="new-password" label="Mật khẩu mới">
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={CONTROL_CLASS}
            />
          </FormField>

          <FormField id="confirm-password" label="Xác nhận mật khẩu mới">
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={CONTROL_CLASS}
            />
          </FormField>

          <div className="mt-2 flex items-center justify-between gap-3">
            <Button variant="secondary" type="button" onClick={() => logout()}>
              Đăng xuất
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}
