import { isActiveTicket } from '../domain/ticket.ts'
import type { Ticket, Viewer } from '../domain/ticket.ts'
import { buildInbox } from './ticketInbox.ts'
import { calculateAverageRating, calculateSlaComplianceRate, countByStatus, countOverdue } from './ticketStats.ts'
import type { ViewerRole } from './viewerRole.ts'

export type KpiTone = 'neutral' | 'accent' | 'danger' | 'success'

export interface DashboardKpi {
  key: string
  label: string
  value: string
  hint: string
  tone: KpiTone
}

const NO_DATA_VALUE = '–'

function countWaitingOnViewer(tickets: Ticket[], viewer: Viewer): number {
  return buildInbox(tickets, viewer).reduce((sum, group) => sum + group.tickets.length, 0)
}

function memberKpis(tickets: Ticket[], viewer: Viewer, now: Date): DashboardKpi[] {
  const active = tickets.filter(isActiveTicket)
  const waiting = countWaitingOnViewer(tickets, viewer)
  const assigned = active.filter((ticket) => ticket.assigneeName === viewer.name)
  const sent = active.filter((ticket) => ticket.requesterName === viewer.name)
  const overdue = countOverdue(assigned, now)

  return [
    { key: 'waiting', label: 'Chờ bạn xử lý', value: String(waiting), hint: 'Việc cần bạn hành động ngay', tone: waiting > 0 ? 'accent' : 'neutral' },
    { key: 'assigned', label: 'Được giao cho bạn', value: String(assigned.length), hint: overdue > 0 ? `${overdue} việc đã quá hạn` : 'Không có việc quá hạn', tone: overdue > 0 ? 'danger' : 'neutral' },
    { key: 'sent', label: 'Bạn đã gửi', value: String(sent.length), hint: 'Yêu cầu đang được xử lý', tone: 'neutral' },
  ]
}

function headKpis(tickets: Ticket[], viewer: Viewer, now: Date): DashboardKpi[] {
  const departmentTickets = tickets.filter((ticket) => ticket.toDepartment === viewer.department)
  const counts = countByStatus(departmentTickets)
  const unassigned = departmentTickets.filter((ticket) => ticket.status === 'open' && !ticket.assigneeName).length
  const overdue = countOverdue(departmentTickets, now)

  return [
    { key: 'unassigned', label: 'Chờ phân công', value: String(unassigned), hint: 'Mới, chưa có người phụ trách', tone: unassigned > 0 ? 'accent' : 'neutral' },
    { key: 'in_progress', label: 'Đang xử lý', value: String(counts.in_progress + counts.waiting), hint: `${counts.waiting} đang chờ phản hồi`, tone: 'neutral' },
    { key: 'overdue', label: 'Quá hạn', value: String(overdue), hint: overdue > 0 ? 'Cần xử lý hoặc gia hạn' : 'Mọi việc còn trong hạn', tone: overdue > 0 ? 'danger' : 'neutral' },
    { key: 'sla', label: 'Đúng hạn SLA', value: `${calculateSlaComplianceRate(departmentTickets, now)}%`, hint: 'Trên các yêu cầu gửi đến phòng', tone: 'success' },
  ]
}

function adminKpis(tickets: Ticket[], now: Date): DashboardKpi[] {
  const overdue = countOverdue(tickets, now)
  const rating = calculateAverageRating(tickets)

  return [
    { key: 'active', label: 'Đang mở', value: String(tickets.filter(isActiveTicket).length), hint: 'Trên toàn công ty', tone: 'neutral' },
    { key: 'overdue', label: 'Quá hạn', value: String(overdue), hint: overdue > 0 ? 'Vượt hạn cam kết' : 'Mọi việc còn trong hạn', tone: overdue > 0 ? 'danger' : 'neutral' },
    { key: 'sla', label: 'Đúng hạn SLA', value: `${calculateSlaComplianceRate(tickets, now)}%`, hint: 'Toàn công ty', tone: 'success' },
    { key: 'csat', label: 'Hài lòng (CSAT)', value: rating === null ? NO_DATA_VALUE : `${rating}/5`, hint: rating === null ? 'Chưa có đánh giá' : 'Điểm trung bình từ người gửi', tone: 'neutral' },
  ]
}

// Picks the few numbers each role acts on, instead of one wide grid for everybody
export function buildDashboardKpis(role: ViewerRole, tickets: Ticket[], viewer: Viewer, now: Date): DashboardKpi[] {
  if (role === 'admin' || (role as string) === 'executive') return adminKpis(tickets, now)
  if (role === 'head') return headKpis(tickets, viewer, now)
  return memberKpis(tickets, viewer, now)
}
