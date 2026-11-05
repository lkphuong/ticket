import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { CONTROL_CLASS } from '../components/ui/controlStyles.ts'
import { FormField } from '../components/ui/FormField.tsx'
import { ThemeToggle } from '../components/ui/ThemeToggle.tsx'
import { useAuth } from '../state/useAuth.ts'

const INVALID_CREDENTIALS_MESSAGE = 'Tên đăng nhập hoặc mật khẩu không chính xác.'

export function LoginPage() {
  const { login, sessionExpired } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login(username, password)
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : INVALID_CREDENTIALS_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-4 py-12">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-10 items-center justify-center rounded-lg bg-accent-600 text-base font-bold text-white tracking-wider shadow-sm"
          >
            ND
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-ink">VTDesk</span>
              <span className="rounded-[4px] border border-line-strong bg-canvas px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-ink-muted uppercase">
                Enterprise
              </span>
            </div>
            <p className="text-xs text-ink-muted">Cổng điều phối dịch vụ & quản trị yêu cầu liên phòng ban</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-lift">
        <h2 className="text-sm font-bold text-ink">Đăng nhập bằng tài khoản</h2>

        {sessionExpired && !error && (
          <div role="status" className="rounded-md border border-line-strong bg-canvas p-3 text-xs text-ink">
            Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-md border border-brick-500/30 bg-brick-100/30 p-3 text-xs text-brick-700">
            {error}
          </div>
        )}

        <FormField id="username" label="Tên đăng nhập">
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

        <Button type="submit" className="w-full justify-center" disabled={isSubmitting}>
          {isSubmitting ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}
        </Button>
      </form>
    </main>
  )
}
