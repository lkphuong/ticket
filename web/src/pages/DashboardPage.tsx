import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DEPARTMENTS, isActiveTicket, isTicketOverdue } from '../domain/ticket.ts'
import { buildDashboardKpis } from '../lib/dashboardSummary.ts'
import { buildInbox } from '../lib/ticketInbox.ts'
import { buildDepartmentReport, filterByDepartmentView } from '../lib/ticketReport.ts'
import { workloadByDepartment } from '../lib/ticketStats.ts'
import { getViewerRole } from '../lib/viewerRole.ts'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { Panel } from '../components/ui/Panel.tsx'
import { Select } from '../components/ui/Select.tsx'
import { DepartmentReportTable } from '../components/tickets/DepartmentReportTable.tsx'
import { KpiCard } from '../components/tickets/KpiCard.tsx'
import { StatusBreakdown } from '../components/tickets/StatusBreakdown.tsx'
import { TicketListPanel } from '../components/tickets/TicketListPanel.tsx'
import { TicketRow } from '../components/tickets/TicketRow.tsx'
import { WorkloadMosaic } from '../components/tickets/WorkloadMosaic.tsx'
import { useTickets } from '../state/useTickets.ts'
import type { Department } from '../domain/ticket.ts'

const ALL_DEPARTMENTS_VALUE = 'all'
const DEPARTMENT_VIEW_OPTIONS = [
  { value: ALL_DEPARTMENTS_VALUE, label: 'Toàn công ty' },
  ...DEPARTMENTS.map((department) => ({ value: department as string, label: department })),
]

const ROLE_DESCRIPTIONS = {
  member: 'Hàng đợi các việc chờ bạn xử lý, yêu cầu bạn đã gửi và các nhiệm vụ đang phụ trách.',
  head: 'Điều phối phân công công việc, theo dõi tiến độ phòng ban và kiểm soát hạn chót SLA.',
  executive: 'Báo cáo tổng quan khối lượng công việc, tỷ lệ hoàn thành đúng hạn và phân bổ giữa các phòng ban.',
} as const

export function DashboardPage() {
  const { tickets: visibleTickets, viewer } = useTickets()
  const [now] = useState(() => new Date())
  const [departmentView, setDepartmentView] = useState<Department | typeof ALL_DEPARTMENTS_VALUE>(ALL_DEPARTMENTS_VALUE)
  const role = getViewerRole(viewer)
  // Only executives may look through another department's eyes; everyone else keeps their own scope
  const tickets = role === 'executive' ? filterByDepartmentView(visibleTickets, departmentView) : visibleTickets
  const inbox = buildInbox(tickets, viewer)
  const activeTickets = tickets.filter(isActiveTicket)
  const departmentQueue = tickets.filter((ticket) => isActiveTicket(ticket) && ticket.toDepartment === viewer.department)
  const departmentTickets = tickets.filter((ticket) => ticket.toDepartment === viewer.department)
  // Heads inspect department scope; executives oversee enterprise-wide activities
  const overdueScope = role === 'head' ? departmentTickets : tickets
  const overdueTickets = overdueScope.filter((ticket) => isTicketOverdue(ticket, now))
  const workload = workloadByDepartment(tickets)
  const kpis = buildDashboardKpis(role, tickets, viewer, now)

  const inboxPanel = (
    <Panel title="Việc chờ bạn xử lý">
      {inbox.length === 0 ? (
        <EmptyState
          title="Không có việc nào đang chờ bạn"
          description="Khi có yêu cầu cần bạn phân công, xử lý chuyên môn hoặc xác nhận kết quả, chúng sẽ xuất hiện tại đây."
        />
      ) : (
        inbox.map((group) => (
          <div key={group.reason} className="border-b border-line last:border-b-0">
            <h3 className="bg-mine-100 px-4 py-1.5 text-xs font-bold text-mine-800">
              {group.label} ({group.tickets.length})
            </h3>
            <ul className="divide-y divide-line">
              {group.tickets.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} now={now} waitingOnViewer />
              ))}
            </ul>
          </div>
        ))
      )}
    </Panel>
  )

  const queuePanel = (
    <TicketListPanel
      title={`Hàng đợi ${viewer.department}`}
      emptyTitle="Hàng đợi phòng ban đang trống"
      emptyDescription="Phòng bạn hiện không có yêu cầu nào chưa xử lý."
      tickets={departmentQueue}
      viewer={viewer}
      now={now}
    />
  )

  const ownTicketsPanel = (
    <TicketListPanel
      title="Yêu cầu liên quan đến bạn"
      emptyTitle="Bạn chưa có yêu cầu nào đang mở"
      emptyDescription="Các yêu cầu bạn đã gửi hoặc được phân công xử lý sẽ hiển thị tại đây."
      tickets={activeTickets}
      viewer={viewer}
      now={now}
    />
  )

  const workloadPanel = (
    <Panel title="Khối lượng công việc liên phòng ban">
      {workload.length === 0 ? (
        <EmptyState
          title="Chưa có yêu cầu nào đang mở"
          description="Tất cả các phòng ban hiện đã xử lý hoàn tất mọi yêu cầu."
        />
      ) : (
        <WorkloadMosaic workload={workload} now={now} />
      )}
    </Panel>
  )

  const overduePanel = (
    <TicketListPanel
      title="Yêu cầu quá hạn SLA"
      emptyTitle="Không có yêu cầu quá hạn"
      emptyDescription="Mọi yêu cầu đang mở đều còn trong thời hạn cam kết."
      tickets={overdueTickets}
      viewer={viewer}
      now={now}
    />
  )

  return (
    <>
      <PageHeader
        title="Tổng quan"
        description={ROLE_DESCRIPTIONS[role]}
        action={
          <Link to="/tickets/new">
            <Button>Tạo yêu cầu</Button>
          </Link>
        }
      />

      <dl className={`mb-6 grid gap-3 ${kpis.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </dl>

      {role === 'executive' && (
        <div className="mb-6 flex flex-col gap-2">
          <label htmlFor="department-view" className="text-xs font-bold text-ink uppercase tracking-wider">
            Góc nhìn phòng ban (chỉ xem)
          </label>
          <div className="max-w-xs">
            <Select
              id="department-view"
              value={departmentView}
              options={DEPARTMENT_VIEW_OPTIONS}
              onChange={(value) => setDepartmentView(value as Department | typeof ALL_DEPARTMENTS_VALUE)}
            />
          </div>
        </div>
      )}
      {role === 'executive' && (
        <div className="mb-6">
          <StatusBreakdown title="Phân bổ theo trạng thái" tickets={tickets} />
        </div>
      )}
      {role === 'head' && (
        <div className="mb-6">
          <StatusBreakdown title={`Phân bổ yêu cầu của ${viewer.department}`} tickets={departmentTickets} />
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {role === 'member' && (
          <>
            {inboxPanel}
            {ownTicketsPanel}
          </>
        )}
        {role === 'head' && (
          <>
            {inboxPanel}
            <div className="flex flex-col gap-6">
              {queuePanel}
              {overduePanel}
            </div>
          </>
        )}
        {role === 'executive' && (
          <>
            {workloadPanel}
            {overduePanel}
            <DepartmentReportTable rows={buildDepartmentReport(tickets, now)} />
          </>
        )}
      </div>
    </>
  )
}
