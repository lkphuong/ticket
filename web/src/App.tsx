import { Route, Routes } from 'react-router-dom'
import { PasswordChangeGate } from './components/auth/PasswordChangeGate.tsx'
import { AppShell } from './components/layout/AppShell.tsx'
import { ToastProvider } from './lib/ToastProvider.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { NewTicketPage } from './pages/NewTicketPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { TicketDetailPage } from './pages/TicketDetailPage.tsx'
import { TicketListPage } from './pages/TicketListPage.tsx'
import { TicketsProvider } from './state/TicketsProvider.tsx'
import { useAuth } from './state/useAuth.ts'

export default function App() {
  const { viewer, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm font-medium text-ink-muted">Đang tải thông tin tài khoản...</p>
      </div>
    )
  }

  return (
    <ToastProvider>
      {!viewer ? (
        <LoginPage />
      ) : (
        <PasswordChangeGate>
          <TicketsProvider viewer={viewer}>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="tickets" element={<TicketListPage />} />
                <Route path="tickets/new" element={<NewTicketPage />} />
                <Route path="tickets/:ticketId" element={<TicketDetailPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </TicketsProvider>
        </PasswordChangeGate>
      )}
    </ToastProvider>
  )
}
