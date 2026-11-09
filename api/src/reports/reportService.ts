// Aggregation service computing operational metrics and cross-department performance reports

import {
  DEFAULT_TICKET_FILTERS,
  buildDepartmentReport,
  calculateAverageRating,
  calculateSlaComplianceRate,
  calculateTicketSla,
  countByStatus,
  countOverdue,
  filterTickets,
  isActiveTicket,
  workloadByDepartment,
} from '@vtdesk/domain'
import type {
  DepartmentReportRow,
  DepartmentWorkload,
  TicketFilters,
  TicketStatus,
  Viewer,
} from '@vtdesk/domain'
import type { ITicketStore } from '../repositories/interfaces.ts'

export class ReportAuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReportAuthorizationError'
  }
}

export interface DashboardReportMetrics {
  readonly total: number
  readonly activeCount: number
  readonly overdueCount: number
  readonly impendingCount: number
  readonly onTimeRate: number
  readonly averageRating: number | null
  readonly statusCounts: Record<TicketStatus, number>
  readonly departmentReport?: DepartmentReportRow[]
  readonly workload?: DepartmentWorkload[]
}

export interface CrossDepartmentReportResult {
  readonly departmentReport: DepartmentReportRow[]
  readonly workload: DepartmentWorkload[]
  readonly summary: {
    readonly totalReceived: number
    readonly totalActive: number
    readonly totalOverdue: number
    readonly onTimeRate: number
    readonly averageRating: number | null
  }
}

export class ReportService {
  constructor(
    private readonly store: ITicketStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // Computes dashboard report metrics matching visibility rules and search/filter parameters
  async getDashboardReport(
    viewer: Viewer,
    requestedDepartment?: string,
    filters?: Partial<TicketFilters>,
  ): Promise<DashboardReportMetrics> {
    const now = this.clock()

    // 1. Enforce department-level authorization constraints
    if (!viewer.isExecutive) {
      if (viewer.isDepartmentHead) {
        // Department heads are strictly bounded to their own division
        if (requestedDepartment && requestedDepartment !== viewer.department) {
          throw new ReportAuthorizationError('Trưởng phòng chỉ được xem số liệu của phòng mình.')
        }
      } else {
        // Staff members are prohibited from accessing general department-level reports
        if (requestedDepartment) {
          throw new ReportAuthorizationError('Nhân viên không có quyền truy cập báo cáo phòng ban.')
        }
      }
    }

    // 2. Fetch only the tickets inside the viewer visibility boundary
    const visibleTickets = await this.store.tickets.findMatching({ viewer, filters: DEFAULT_TICKET_FILTERS, now })

    // 3. Resolve target department scope
    let scopedTickets = visibleTickets
    if (viewer.isExecutive) {
      if (requestedDepartment && requestedDepartment !== 'all') {
        scopedTickets = visibleTickets.filter(
          (t) => t.toDepartment === requestedDepartment || t.fromDepartment === requestedDepartment,
        )
      }
    } else if (viewer.isDepartmentHead) {
      // For department heads, dashboard focuses on requests addressed to their division
      const targetDept = requestedDepartment || viewer.department
      scopedTickets = visibleTickets.filter((t) => t.toDepartment === targetDept)
    }

    // 4. Apply same filters used in ticket list API if provided
    const effectiveFilters: TicketFilters = {
      scope: filters?.scope ?? 'all',
      query: filters?.query ?? '',
      status: filters?.status ?? 'all',
      priority: filters?.priority ?? 'all',
      department: filters?.department ?? 'all',
      fromDepartment: filters?.fromDepartment ?? 'all',
      createdFrom: filters?.createdFrom ?? '',
      createdTo: filters?.createdTo ?? '',
      due: filters?.due ?? 'all',
      assignment: filters?.assignment ?? 'all',
      assigneeName: filters?.assigneeName ?? '',
      sort: filters?.sort ?? 'updated_desc',
    }

    const filtered = filterTickets(scopedTickets, effectiveFilters, viewer, now)

    // 5. Aggregate metrics
    const statusCounts = countByStatus(filtered)
    const activeCount = filtered.filter(isActiveTicket).length
    const overdueCount = countOverdue(filtered, now)

    // Impending tickets: active tickets with exactly 1 day remaining and not paused in waiting
    const impendingCount = filtered.filter((t) => {
      if (!t.dueDate || !isActiveTicket(t) || t.status === 'waiting') {
        return false
      }
      return calculateTicketSla(t, now).daysDiff === 1
    }).length

    const onTimeRate = calculateSlaComplianceRate(filtered, now)
    const averageRating = calculateAverageRating(filtered)

    // Department report and workload tables are only exposed to executive leadership
    let departmentReport: DepartmentReportRow[] | undefined
    let workload: DepartmentWorkload[] | undefined

    if (viewer.isExecutive && (!requestedDepartment || requestedDepartment === 'all')) {
      departmentReport = buildDepartmentReport(visibleTickets, now)
      workload = workloadByDepartment(visibleTickets)
    }

    return {
      total: filtered.length,
      activeCount,
      overdueCount,
      impendingCount,
      onTimeRate,
      averageRating,
      statusCounts,
      departmentReport,
      workload,
    }
  }

  // Generates cross-department matrix for administrator oversight
  async getCrossDepartmentReport(viewer: Viewer): Promise<CrossDepartmentReportResult> {
    if (!viewer.isExecutive) {
      throw new ReportAuthorizationError('Chỉ Quản trị viên mới có quyền xem báo cáo liên phòng ban.')
    }

    const now = this.clock()
    const visibleTickets = await this.store.tickets.findMatching({ viewer, filters: DEFAULT_TICKET_FILTERS, now })

    const departmentReport = buildDepartmentReport(visibleTickets, now)
    const workload = workloadByDepartment(visibleTickets)

    const totalReceived = visibleTickets.length
    const totalActive = visibleTickets.filter(isActiveTicket).length
    const totalOverdue = countOverdue(visibleTickets, now)
    const onTimeRate = calculateSlaComplianceRate(visibleTickets, now)
    const averageRating = calculateAverageRating(visibleTickets)

    return {
      departmentReport,
      workload,
      summary: {
        totalReceived,
        totalActive,
        totalOverdue,
        onTimeRate,
        averageRating,
      },
    }
  }
}
