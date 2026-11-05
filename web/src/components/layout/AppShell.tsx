import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { buildInbox } from '../../lib/ticketInbox.ts'
import { ROLE_LABELS, ROLE_STRIPE_CLASSES, getViewerRole } from '../../lib/viewerRole.ts'
import { useAuth } from '../../state/useAuth.ts'
import { useTickets } from '../../state/useTickets.ts'
import { Avatar } from '../ui/Avatar.tsx'
import { Button } from '../ui/Button.tsx'
import { Icon } from '../ui/Icon.tsx'
import type { IconName } from '../ui/Icon.tsx'
import { ThemeToggle } from '../ui/ThemeToggle.tsx'

const NEW_TICKET_PATH = '/tickets/new'

const BASE_NAV_ITEMS: { to: string; label: string; end: boolean; icon: IconName }[] = [
  { to: '/', label: 'Tổng quan', end: true, icon: 'home' },
  { to: '/tickets', label: 'Yêu cầu hỗ trợ', end: false, icon: 'inbox' },
]

function navLinkClass(isActive: boolean): string {
  const base = 'inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors'
  return isActive
    ? `${base} border-accent-600 text-ink`
    : `${base} border-transparent text-ink-muted hover:border-line-strong hover:text-ink`
}

function WordMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="inline-flex size-7 items-center justify-center rounded-md bg-accent-600 text-xs font-bold text-white tracking-wider"
      >
        ND
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-base font-bold tracking-tight text-ink">VTDesk</span>
        <span className="rounded-[4px] border border-line-strong bg-canvas px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-ink-muted uppercase">
          Enterprise
        </span>
      </div>
    </div>
  )
}

function ViewerSummary() {
  const { viewer } = useTickets()
  const { logout } = useAuth()
  const role = getViewerRole(viewer)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Avatar department={viewer.department} sizeClass="size-6" />
          {viewer.name}
          <span className="text-ink-muted font-normal">
            ({ROLE_LABELS[role]} · {viewer.department})
          </span>
        </span>
      </div>

      <Button variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs" onClick={() => logout()}>
        <Icon name="logout" />
        Đăng xuất
      </Button>
    </div>
  )
}

export function AppShell() {
  const { tickets, viewer } = useTickets()
  const { pathname } = useLocation()
  const waitingCount = buildInbox(tickets, viewer).reduce((sum, group) => sum + group.tickets.length, 0)
  const role = getViewerRole(viewer)

  // Administrators operate as read-only supervisors and do not create tickets
  const navItems =
    role === 'admin'
      ? BASE_NAV_ITEMS
      : [...BASE_NAV_ITEMS, { to: NEW_TICKET_PATH, label: 'Tạo yêu cầu', end: true, icon: 'plus' as IconName }]

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface print:hidden">
        <div aria-hidden="true" className={`h-1 ${ROLE_STRIPE_CLASSES[role]}`} />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 pt-3 md:px-8">
          <WordMark />
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ViewerSummary />
            </div>
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <nav aria-label="Điều hướng chính" className="-mb-px flex gap-1 overflow-x-auto pt-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                // The list link owns every ticket route except the create form
                className={({ isActive }) =>
                  navLinkClass(item.to === '/tickets' ? isActive && pathname !== NEW_TICKET_PATH : isActive)
                }
              >
                <Icon name={item.icon} />
                {item.label}
                {item.to === '/' && waitingCount > 0 && (
                  <span className="ml-2 rounded-md bg-mine-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                    {waitingCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <details className="border-t border-line px-4 py-3 md:hidden">
          <summary className="cursor-pointer text-sm font-medium text-ink-muted">{viewer.name}</summary>
          <div className="mt-3">
            <ViewerSummary />
          </div>
        </details>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>
    </div>
  )
}
