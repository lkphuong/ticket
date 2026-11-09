import { Navigate, Route, Routes } from 'react-router-dom'
import { PasswordChangeGate } from './components/auth/PasswordChangeGate.tsx'
import { TicketsLoadGate } from './components/tickets/TicketsLoadGate.tsx'
import { AppShell } from './components/layout/AppShell.tsx'
import { ThemeToggle } from './components/ui/ThemeToggle.tsx'
import { ToastProvider } from './lib/ToastProvider.tsx'
import { CmsPage } from './pages/CmsPage.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { NewTicketPage } from './pages/NewTicketPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { TicketDetailPage } from './pages/TicketDetailPage.tsx'
import { TicketListPage } from './pages/TicketListPage.tsx'
import { DepartmentDirectoryProvider } from './state/DepartmentDirectoryProvider.tsx'
import { MemberDirectoryProvider } from './state/MemberDirectoryProvider.tsx'
import { TicketsProvider } from './state/TicketsProvider.tsx'
import { getViewerRole } from './lib/viewerRole.ts'
import { useAuth } from './state/useAuth.ts'

export default function App() {
  return (
    <>
      <AppContent />
      <ThemeToggle />
    </>
  )
}

function AppContent() {
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
          <DepartmentDirectoryProvider>
          <MemberDirectoryProvider>
          <TicketsProvider viewer={viewer}>
            <Routes>
              <Route element={<AppShell />}>
                <Route
                  index
                  element={
                    // Administrators land on the administration console instead of the ticket dashboard
                    getViewerRole(viewer) === 'admin' ? (
                      <Navigate to="/cms" replace />
                    ) : (
                      <TicketsLoadGate><DashboardPage /></TicketsLoadGate>
                    )
                  }
                />
                <Route path="tickets" element={<TicketListPage />} />
                <Route path="tickets/new" element={<NewTicketPage />} />
                <Route path="tickets/:ticketId" element={<TicketsLoadGate><TicketDetailPage /></TicketsLoadGate>} />
                <Route path="cms" element={<CmsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </TicketsProvider>
          </MemberDirectoryProvider>
          </DepartmentDirectoryProvider>
        </PasswordChangeGate>
      )}
    </ToastProvider>
  )
}
