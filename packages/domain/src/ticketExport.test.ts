import { describe, expect, it } from 'vitest'
import type { Ticket } from './ticket.ts'
import { generateTicketsCsv } from './ticketExport.ts'

function createSampleTicket(overrides: Partial<Ticket>): Ticket {
  return {
    id: 'TCK-1001',
    title: 'Báo cáo tài chính quý 1',
    description: 'Yêu cầu lập báo cáo',
    priority: 'high',
    status: 'in_progress',
    requesterName: 'Nguyễn Văn A',
    fromDepartment: 'Kế toán',
    toDepartment: 'Hành chính',
    attachments: [],
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    comments: [],
    ...overrides,
  }
}

describe('generateTicketsCsv', () => {
  it('should_include_utf8_bom_and_proper_headers', () => {
    const csv = generateTicketsCsv([])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('Mã yêu cầu,Tiêu đề,Phòng gửi,Phòng nhận')
  })

  it('should_escape_quotes_and_serialize_rows_correctly', () => {
    const ticket = createSampleTicket({ title: 'Dự án "Đặc biệt"', rating: 5 })
    const csv = generateTicketsCsv([ticket])
    expect(csv).toContain('"TCK-1001"')
    expect(csv).toContain('"Dự án ""Đặc biệt"""')
    expect(csv).toContain('"5/5"')
  })
})

describe('generateTicketsCsv content safety', () => {
  it('should_keep_commas_and_vietnamese_text_inside_one_quoted_cell', () => {
    const ticket = createSampleTicket({ title: 'Báo cáo, đối chiếu công nợ', requesterName: 'Nguyễn Thị Hồng' })
    const csv = generateTicketsCsv([ticket])
    expect(csv).toContain('"Báo cáo, đối chiếu công nợ"')
    expect(csv).toContain('"Nguyễn Thị Hồng"')
  })

  it('should_keep_line_breaks_inside_quoted_cell', () => {
    const csv = generateTicketsCsv([createSampleTicket({ title: 'Dòng một\nDòng hai' })])
    expect(csv).toContain('"Dòng một\nDòng hai"')
  })
})

describe('generateTicketsCsv formula safety', () => {
  it.each(['=SUM(A1)', '+1', '-1', '@cmd'])('should_neutralise_formula_when_cell_starts_with_%s', (title) => {
    const csv = generateTicketsCsv([createSampleTicket({ title })])
    expect(csv).toContain(`"'${title}"`)
  })
})
