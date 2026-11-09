import type { ReactNode } from 'react'
import { DEPARTMENTS } from '../../domain/ticket.ts'
import { DepartmentTile } from '../ui/DepartmentTile.tsx'
import type { AuthMode } from './authMode.ts'

interface AuthLayoutProps {
  readonly mode: AuthMode
  readonly onModeChange: (mode: AuthMode) => void
  readonly children: ReactNode
}

const TAB_ITEMS: readonly { mode: Exclude<AuthMode, 'verify'>; label: string }[] = [
  { mode: 'login', label: 'Đăng nhập' },
  { mode: 'register', label: 'Đăng ký' },
]

function BrandHero() {
  return (
    <section className="flex flex-col gap-5 lg:gap-8 lg:pt-6">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-10 items-center justify-center rounded-lg bg-accent-600 text-base font-bold tracking-wider text-white"
        >
          ND
        </span>
        <span className="text-xl font-bold tracking-tight text-ink">VTDesk</span>
      </div>

      <div className="flex max-w-md flex-col gap-3">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink lg:text-3xl">
          Điều phối yêu cầu liên phòng ban, đúng hạn cam kết
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Mỗi yêu cầu có phòng ban gửi, phòng ban nhận và thời hạn xử lý rõ ràng, để không việc nào bị bỏ sót giữa các khối.
        </p>
      </div>

      <ul aria-label="Các phòng ban sử dụng hệ thống" className="hidden flex-wrap gap-x-4 gap-y-2 lg:flex">
        {DEPARTMENTS.map((department) => (
          <li key={department} className="flex items-center gap-2 text-sm text-ink-muted">
            <DepartmentTile department={department} sizeClass="size-6" />
            {department}
          </li>
        ))}
      </ul>
    </section>
  )
}

function ModeTabs({ mode, onModeChange }: Pick<AuthLayoutProps, 'mode' | 'onModeChange'>) {
  return (
    <div role="tablist" aria-label="Chọn thao tác" className="grid grid-cols-2 border-b border-line">
      {TAB_ITEMS.map((item) => {
        const isActive = mode === item.mode
        return (
          <button
            key={item.mode}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onModeChange(item.mode)}
            className={`-mb-px border-b-2 py-3 text-sm font-semibold transition-colors ${
              isActive ? 'border-accent-600 text-accent-700' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

// Two columns on wide screens (brand, then form); stacked and compact on phones
export function AuthLayout({ mode, onModeChange, children }: AuthLayoutProps) {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-5xl items-center gap-8 px-4 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-16">
      <BrandHero />
      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-lift">
        {mode !== 'verify' && <ModeTabs mode={mode} onModeChange={onModeChange} />}
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </main>
  )
}
