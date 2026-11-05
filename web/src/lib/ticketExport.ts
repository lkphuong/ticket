import { PRIORITY_LABELS, STATUS_LABELS } from '../domain/ticket.ts'
import type { Ticket } from '../domain/ticket.ts'

const FORMULA_PREFIX = /^[=+\-@\t\r]/

// Escapes special characters and wraps content in quotes for CSV compliance
function escapeCsvCell(content: string | number | undefined): string {
  if (content === undefined || content === null) return '""'
  // A leading formula character would make spreadsheet software run the cell, so it is defused with an apostrophe
  const raw = String(content)
  const text = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw
  const escaped = text.replace(/"/g, '""')
  return `"${escaped}"`
}

// Converts ticket collections into a formatted CSV string with UTF-8 byte order mark
export function generateTicketsCsv(tickets: Ticket[]): string {
  const headers = [
    'Mã yêu cầu',
    'Tiêu đề',
    'Phòng gửi',
    'Phòng nhận',
    'Mức ưu tiên',
    'Trạng thái',
    'Người gửi',
    'Người xử lý',
    'Hạn hoàn thành',
    'Ngày khởi tạo',
    'Đánh giá',
  ]

  const dataRows = tickets.map((ticket) => [
    escapeCsvCell(ticket.id),
    escapeCsvCell(ticket.title),
    escapeCsvCell(ticket.fromDepartment),
    escapeCsvCell(ticket.toDepartment),
    escapeCsvCell(PRIORITY_LABELS[ticket.priority] ?? ticket.priority),
    escapeCsvCell(STATUS_LABELS[ticket.status] ?? ticket.status),
    escapeCsvCell(ticket.requesterName),
    escapeCsvCell(ticket.assigneeName ?? 'Chưa phân công'),
    escapeCsvCell(ticket.dueDate ?? 'Không có hạn'),
    escapeCsvCell(ticket.createdAt),
    escapeCsvCell(ticket.rating !== undefined ? `${ticket.rating}/5` : 'Chưa đánh giá'),
  ])

  // Prepending UTF-8 BOM ensures Vietnamese diacritics render correctly in spreadsheet software
  const utf8Bom = '\uFEFF'
  const csvContent = [headers.join(','), ...dataRows.map((row) => row.join(','))].join('\r\n')
  return `${utf8Bom}${csvContent}`
}

// Triggers browser download stream for generated CSV text
export function triggerCsvDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const downloadUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.setAttribute('href', downloadUrl)
  anchor.setAttribute('download', filename)
  anchor.style.visibility = 'hidden'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(downloadUrl)
}
