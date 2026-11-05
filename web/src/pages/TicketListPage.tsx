import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { TicketFilters } from '../components/tickets/TicketFilters.tsx'
import { TicketRow } from '../components/tickets/TicketRow.tsx'
import { generateTicketsCsv, triggerCsvDownload } from '../lib/ticketExport.ts'
import { DEFAULT_TICKET_FILTERS, filterTickets } from '../lib/ticketFilters.ts'
import type { AssignmentFilter, DueFilter, TicketFilters as TicketFiltersState } from '../lib/ticketFilters.ts'
import { isWaitingOnViewer } from '../lib/ticketInbox.ts'
import { useToast } from '../lib/toastContext.ts'
import { getViewerRole } from '../lib/viewerRole.ts'
import { useTickets } from '../state/useTickets.ts'

const LIST_DESCRIPTIONS = {
  member: 'Hàng đợi các yêu cầu bạn đã gửi hoặc được phân công xử lý, sắp xếp theo thời gian cập nhật.',
  head: 'Toàn bộ yêu cầu gửi đi và tiếp nhận của phòng ban, bao gồm trạng thái phân công và hạn chót SLA.',
  admin: 'Hệ thống điều phối liên phòng ban toàn diện, giám sát tiến độ thực hiện và quản trị hệ thống.',
} as const

export function TicketListPage() {
  const { tickets, viewer } = useTickets()
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

  const [now] = useState(() => new Date())
  const visible = filterTickets(tickets, filters, viewer, now)

  function handleExportCsv() {
    if (visible.length === 0) {
      notify('Không có dữ liệu yêu cầu nào để xuất', 'danger')
      return
    }
    const filename = `VTDesk-tickets-${now.toISOString().slice(0, 10)}.csv`
    const csvData = generateTicketsCsv(visible)
    triggerCsvDownload(filename, csvData)
    notify(`Đã xuất báo cáo ${visible.length} yêu cầu thành công`, 'success')
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
        <TicketFilters filters={filters} onChange={setFilters} onExportCsv={handleExportCsv} />
      </div>
      <section aria-label="Kết quả yêu cầu" className="rounded-lg border border-line bg-surface shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-xs text-ink-muted font-medium">
          <span>Hiển thị {visible.length} trên tổng số {tickets.length} yêu cầu</span>
          {filters.due === 'overdue' && (
            <span className="font-semibold text-brick-700">Đang lọc danh sách quá hạn</span>
          )}
        </div>
        {visible.length === 0 ? (
          <EmptyState
            title="Không tìm thấy yêu cầu phù hợp"
            description="Thử mở rộng phạm vi tìm kiếm hoặc đặt lại các bộ lọc về mặc định."
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} now={now} waitingOnViewer={isWaitingOnViewer(ticket, viewer)} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
