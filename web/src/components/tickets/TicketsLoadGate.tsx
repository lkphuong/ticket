import { useState } from 'react'
import type { ReactNode } from 'react'
import { ErrorState } from '../ui/ErrorState.tsx'
import { LoadingSkeleton } from '../ui/LoadingSkeleton.tsx'
import { useTickets } from '../../state/useTickets.ts'

interface TicketsLoadGateProps {
  children: ReactNode
}

// Shows a skeleton on first load and a retry prompt when no ticket data could be fetched
export function TicketsLoadGate({ children }: TicketsLoadGateProps) {
  const { isLoading, loadError, refreshTickets, tickets } = useTickets()
  const [isRetrying, setIsRetrying] = useState(false)

  async function handleRetry() {
    setIsRetrying(true)
    try {
      await refreshTickets?.()
    } finally {
      setIsRetrying(false)
    }
  }

  if (isLoading) return <LoadingSkeleton label="Đang tải danh sách yêu cầu" />
  if (loadError && tickets.length === 0) {
    return (
      <ErrorState
        title="Không tải được dữ liệu yêu cầu"
        description={loadError}
        onRetry={() => void handleRetry()}
        isRetrying={isRetrying}
      />
    )
  }
  return <>{children}</>
}
