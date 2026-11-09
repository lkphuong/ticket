import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../lib/apiClient.ts'
import { useToast } from '../../lib/toastContext.ts'
import { useAuth } from '../../state/useAuth.ts'
import { Button } from '../ui/Button.tsx'
import { CONTROL_CLASS } from '../ui/controlStyles.ts'
import { FormField } from '../ui/FormField.tsx'

const ROLE_HOME_PATH = '/'
const INVALID_CREDENTIALS_MESSAGE = 'Tên đăng nhập hoặc mật khẩu không chính xác.'
const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
const UNVERIFIED_ACCOUNT_CODE = 'AccountNotVerified'

interface LoginFormProps {
  readonly defaultUsername: string
  readonly onNeedVerification: (username: string) => void
  readonly onOpenRegister: () => void
  readonly onOpenVerify: () => void
}

function isUnverifiedAccountError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.code === UNVERIFIED_ACCOUNT_CODE || error.message.includes('xác thực'))
}

export function LoginForm({ defaultUsername, onNeedVerification, onOpenRegister, onOpenVerify }: LoginFormProps) {
  const { login, sessionExpired } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [username, setUsername] = useState(defaultUsername)
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (sessionExpired) notify(SESSION_EXPIRED_MESSAGE, 'info')
  }, [sessionExpired, notify])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await login(username, password)
      // A stale path such as /cms must not outlive the previous session; the index route picks the page for the role
      navigate(ROLE_HOME_PATH, { replace: true })
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : INVALID_CREDENTIALS_MESSAGE
      notify(message, 'error')
      // An unverified account can only proceed by entering its emailed code
      if (isUnverifiedAccountError(error)) onNeedVerification(username.trim())
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink">Đăng nhập</h2>

      <FormField id="username" label="Tên đăng nhập / Mã nhân viên">
        <input
          id="username"
          type="text"
          required
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className={CONTROL_CLASS}
        />
      </FormField>

      <FormField id="password" label="Mật khẩu">
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={CONTROL_CLASS}
        />
      </FormField>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
        <button type="button" onClick={onOpenRegister} className="font-medium text-accent-700 hover:underline">
          Chưa có tài khoản? Đăng ký
        </button>
        <button type="button" onClick={onOpenVerify} className="font-medium text-ink-muted hover:text-ink hover:underline">
          Nhập mã xác thực email
        </button>
      </div>
    </form>
  )
}
