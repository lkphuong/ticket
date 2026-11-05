import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { CONTROL_CLASS } from '../components/ui/controlStyles.ts'
import { FormField } from '../components/ui/FormField.tsx'
import { ThemeToggle } from '../components/ui/ThemeToggle.tsx'
import { MOCK_PASSWORD } from '../lib/auth.ts'
import { useAuth } from '../state/useAuth.ts'

const INVALID_CREDENTIALS_MESSAGE = 'Tên đăng nhập hoặc mật khẩu không chính xác.'

interface QuickLoginProfile {
  username: string
  name: string
  roleLabel: string
  department: string
  description: string
}

const QUICK_PROFILES: readonly QuickLoginProfile[] = [
  {
    username: 'minhanh',
    name: 'Nguyễn Minh Anh',
    roleLabel: 'Nhân viên',
    department: 'Kinh doanh',
    description: 'Tạo yêu cầu, theo dõi tiến độ và đánh giá kết quả',
  },
  {
    username: 'quocbao',
    name: 'Trần Quốc Bảo',
    roleLabel: 'Trưởng phòng',
    department: 'Kinh doanh',
    description: 'Điều phối hàng đợi, phân công chuyên viên và xử lý quá hạn',
  },
  {
    username: 'giahuy',
    name: 'Hoàng Gia Huy',
    roleLabel: 'Chuyên viên xử lý',
    department: 'Công nghệ thông tin',
    description: 'Tiếp nhận công việc được phân công, cập nhật tiến trình kỹ thuật',
  },
  {
    username: 'admin',
    name: 'Quản trị viên Hệ thống',
    roleLabel: 'Quản trị viên',
    department: 'Công nghệ thông tin',
    description: 'Giám sát toàn bộ yêu cầu, kiểm tra báo cáo liên phòng ban và quản trị hệ thống',
  },
]

export function LoginPage() {
  const { login } = useAuth()
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
    } catch (err: any) {
      setError(err.message || INVALID_CREDENTIALS_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleQuickLogin(targetUsername: string) {
    setError('')
    setIsSubmitting(true)
    try {
      await login(targetUsername, MOCK_PASSWORD)
    } catch (err: any) {
      setError(err.message || INVALID_CREDENTIALS_MESSAGE)
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

      <section aria-labelledby="quick-login-title" className="rounded-lg border border-line bg-surface p-5 shadow-lift">
        <div className="mb-3">
          <h2 id="quick-login-title" className="text-sm font-bold text-ink">
            Đăng nhập nhanh theo vai trò
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Chọn tài khoản mẫu để trải nghiệm các góc nhìn nghiệp vụ tương ứng:
          </p>
        </div>
        <div className="grid gap-2">
          {QUICK_PROFILES.map((profile) => (
            <button
              key={profile.username}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleQuickLogin(profile.username)}
              className="flex items-center justify-between rounded-md border border-line bg-canvas p-3 text-left transition-colors hover:border-accent-600 hover:bg-surface focus:border-accent-600 focus:outline-none disabled:opacity-50"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{profile.name}</span>
                  <span className="rounded bg-line px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                    {profile.roleLabel}
                  </span>
                  <span className="text-xs text-ink-muted">· {profile.department}</span>
                </div>
                <span className="text-xs text-ink-muted">{profile.description}</span>
              </div>
              <span className="text-xs font-semibold text-accent-600">Chọn</span>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-lift">
        <h2 className="text-sm font-bold text-ink">Hoặc đăng nhập bằng tài khoản</h2>

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
            placeholder="minhanh, quocbao, giahuy, admin..."
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
