import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { CONTROL_CLASS } from '../components/ui/controlStyles.ts'
import { FormField } from '../components/ui/FormField.tsx'
import { ThemeToggle } from '../components/ui/ThemeToggle.tsx'
import { MEMBERS } from '../data/members.ts'
import { MOCK_PASSWORD } from '../lib/auth.ts'
import { ROLE_LABELS, getViewerRole } from '../lib/viewerRole.ts'
import { useAuth } from '../state/useAuth.ts'

const INVALID_CREDENTIALS_MESSAGE = 'Tên đăng nhập hoặc mật khẩu không đúng.'

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
    username: 'haidang',
    name: 'Nguyễn Hải Đăng',
    roleLabel: 'Lãnh đạo điều hành',
    department: 'Hành chính',
    description: 'Giám sát khối lượng liên phòng ban và hiệu suất SLA toàn doanh nghiệp',
  },
]

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const succeeded = login(username, password)
    setError(succeeded ? '' : INVALID_CREDENTIALS_MESSAGE)
  }

  function handleQuickLogin(targetUsername: string) {
    login(targetUsername, MOCK_PASSWORD)
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
        <div className="grid gap-2.5 sm:grid-cols-2">
          {QUICK_PROFILES.map((profile) => (
            <button
              key={profile.username}
              type="button"
              onClick={() => handleQuickLogin(profile.username)}
              className="group flex flex-col items-start rounded-md border border-line bg-canvas p-3 text-left transition-all hover:border-accent-600 hover:bg-surface hover:shadow-sm"
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-bold text-ink group-hover:text-accent-600">{profile.name}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-surface border border-line text-ink-muted">
                  {profile.roleLabel}
                </span>
              </div>
              <span className="mt-1 text-[11px] font-medium text-ink-muted">{profile.department}</span>
              <p className="mt-1 text-[10px] leading-tight text-ink-muted/80">{profile.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="manual-login-title" className="rounded-lg border border-line bg-surface shadow-lift">
        <h2 id="manual-login-title" className="border-b border-line px-5 py-3 text-sm font-bold text-ink">
          Xác thực thủ công
        </h2>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 px-5 py-5">
          <FormField id="login-username" label="Tên đăng nhập">
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              placeholder="Ví dụ: minhanh, quocbao, giahuy..."
              className={CONTROL_CLASS}
            />
          </FormField>
          <FormField id="login-password" label="Mật khẩu" hint={`Mật khẩu hệ thống thử nghiệm: ${MOCK_PASSWORD}`}>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              className={CONTROL_CLASS}
            />
          </FormField>
          {error && (
            <p id="login-error" role="alert" className="text-xs font-semibold text-brick-700">
              {error}
            </p>
          )}
          <Button type="submit" disabled={!username.trim() || !password}>
            Xác thực tài khoản
          </Button>
        </form>
      </section>

      <section aria-label="Danh mục tài khoản hệ thống" className="rounded-lg border border-line bg-surface px-5 py-3 text-xs text-ink-muted">
        <details>
          <summary className="cursor-pointer font-semibold text-ink hover:text-accent-600">
            Xem toàn bộ danh bạ tài khoản mẫu ({MEMBERS.length} nhân sự)
          </summary>
          <ul className="mt-2.5 max-h-48 divide-y divide-line overflow-y-auto pr-1">
            {MEMBERS.map((member) => (
              <li key={member.username} className="flex items-center justify-between py-1.5 text-[11px]">
                <span>
                  <strong className="text-ink">{member.username}</strong> · {member.name}
                </span>
                <span>
                  {ROLE_LABELS[getViewerRole(member)]} · {member.department}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </main>
  )
}
