import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { ErrorState } from '../components/ui/ErrorState.tsx'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton.tsx'
import { Pagination } from '../components/ui/Pagination.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { TicketFilters } from '../components/tickets/TicketFilters.tsx'
import { TicketRow } from '../components/tickets/TicketRow.tsx'
import { apiClient } from '../lib/apiClient.ts'
import type { PageMeta } from '../lib/apiClient.ts'
import { triggerCsvDownload } from '../lib/ticketExport.ts'
import { DEFAULT_TICKET_FILTERS } from '../lib/ticketFilters.ts'
import type { AssignmentFilter, DueFilter, TicketFilters as TicketFiltersState } from '../lib/ticketFilters.ts'
import { isWaitingOnViewer } from '../lib/ticketInbox.ts'
import { toTicketFilterParams, toTicketListParams } from '../lib/ticketListQuery.ts'
import { useToast } from '../lib/toastContext.ts'
import { useDebouncedValue } from '../lib/useDebouncedValue.ts'
import { getViewerRole } from '../lib/viewerRole.ts'
import { useTickets } from '../state/useTickets.ts'
import type { Ticket } from '../domain/ticket.ts'

const SEARCH_DEBOUNCE_MS = 300
const DEFAULT_PAGE_SIZE = 20
const LOAD_ERROR_FALLBACK = 'Không thể tải danh sách yêu cầu. Vui lòng thử lại.'

const LIST_DESCRIPTIONS = {
  member: 'Hàng đợi các yêu cầu bạn đã gửi hoặc được phân công xử lý, sắp xếp theo thời gian cập nhật.',
  head: 'Toàn bộ yêu cầu gửi đi và tiếp nhận của phòng ban, bao gồm trạng thái phân công và hạn chót SLA.',
  admin: 'Hệ thống điều phối liên phòng ban toàn diện, giám sát tiến độ thực hiện và quản trị hệ thống.',
} as const

export function TicketListPage() {
  const { viewer } = useTickets()
  const { notify } = useToast()
  const [searchParams] = useSearchParams()

  const [filters, setFilters] = useState<TicketFiltersState>(() => {
    const deptParam = searchParams.get('department')
    const dueParam = searchParams.get('due') as DueFilter | null
    const assignParam = searchParams.get('assignment') as AssignmentFilter | null

    return {
      ...DEFAULT_TICKET_FILTERS,
      department: (deptParam as TicketFiltersState['department']) || 'all',
      due: dueParam || 'all',
      assignment: assignParam || 'all',
    }
  })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [pageMeta, setPageMeta] = useState<PageMeta>({ total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 1 })
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [now] = useState(() => new Date())

  // Typing in the search box waits for a pause before the server is queried
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS)
  const requestFilters = { ...filters, query: debouncedQuery }
  const requestKey = JSON.stringify(toTicketListParams(requestFilters, page, limit))

  // A newer request supersedes older ones so a slow response cannot overwrite fresher results
  const latestRequestId = useRef(0)

  useEffect(() => {
    latestRequestId.current += 1
    const requestId = latestRequestId.current
    const isCurrent = () => requestId === latestRequestId.current
    apiClient.tickets
      .list(JSON.parse(requestKey))
      .then((res) => {
        if (!isCurrent()) return
        setTickets(res.tickets)
        setPageMeta({ total: res.total, page: res.page, limit: res.limit, totalPages: res.totalPages })
        setLoadError(null)
        // The server clamps out-of-range pages, so follow its answer
        setPage(res.page)
      })
      .catch((err: unknown) => {
        if (isCurrent()) setLoadError(err instanceof Error ? err.message : LOAD_ERROR_FALLBACK)
      })
      .finally(() => {
        if (isCurrent()) setIsLoading(false)
      })
  }, [requestKey, reloadKey])

  // Any change to the result set sends the viewer back to the first page
  function handleFiltersChange(next: TicketFiltersState) {
    setFilters(next)
    setPage(1)
  }

  const handleRetry = useCallback(() => {
    setIsLoading(true)
    setReloadKey((key) => key + 1)
  }, [])

  // The export covers every ticket matching the filters, not just the visible page
  async function handleExportCsv() {
    if (pageMeta.total === 0) {
      notify('Không có dữ liệu yêu cầu nào để xuất', 'error')
      return
    }
    try {
      const csvData = await apiClient.tickets.exportCsv(toTicketFilterParams(requestFilters))
      triggerCsvDownload(`VTDesk-tickets-${now.toISOString().slice(0, 10)}.csv`, csvData)
      notify(`Đã xuất báo cáo ${pageMeta.total} yêu cầu thành công`, 'success')
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Không thể xuất báo cáo CSV.', 'error')
    }
  }

  const role = getViewerRole(viewer)

  return (
    <>
      <PageHeader
        title="Yêu cầu hỗ trợ"
        description={LIST_DESCRIPTIONS[role]}
        action={
          role !== 'admin' ? (
            <Link to="/tickets/new">
              <Button>Tạo yêu cầu</Button>
            </Link>
          ) : undefined
        }
      />
      <div className="mb-4">
        <TicketFilters filters={filters} onChange={handleFiltersChange} onExportCsv={() => void handleExportCsv()} />
      </div>
      {isLoading ? (
        <LoadingSkeleton label="Đang tải danh sách yêu cầu" />
      ) : loadError ? (
        <ErrorState title="Không tải được danh sách yêu cầu" description={loadError} onRetry={handleRetry} />
      ) : (
        <section aria-label="Kết quả yêu cầu" className="rounded-lg border border-line bg-surface shadow-lift">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-xs text-ink-muted font-medium">
            <span>{pageMeta.total} yêu cầu phù hợp</span>
            {filters.due === 'overdue' && (
              <span className="font-semibold text-brick-700">Đang lọc danh sách quá hạn</span>
            )}
          </div>
          {tickets.length === 0 ? (
            <EmptyState
              title="Không tìm thấy yêu cầu phù hợp"
              description="Thử mở rộng phạm vi tìm kiếm hoặc đặt lại các bộ lọc về mặc định."
            />
          ) : (
            <ul className="divide-y divide-line">
              {tickets.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} now={now} waitingOnViewer={isWaitingOnViewer(ticket, viewer)} />
              ))}
            </ul>
          )}
          <Pagination
            page={pageMeta.page}
            limit={pageMeta.limit}
            total={pageMeta.total}
            totalPages={pageMeta.totalPages}
            onPageChange={setPage}
            onLimitChange={(value) => {
              setLimit(value)
              setPage(1)
            }}
          />
        </section>
      )}
    </>
  )
}
