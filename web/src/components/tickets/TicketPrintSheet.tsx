import type { ReactNode } from 'react'
import { PRIORITY_LABELS, STATUS_LABELS } from '../../domain/ticket.ts'
import type { Ticket } from '../../domain/ticket.ts'
import { formatDate, formatDateTime } from '../../lib/formatDate.ts'

const SIGNATURE_ROLES = [
  { title: 'Người yêu cầu', hint: 'Ký, ghi rõ họ tên' },
  { title: 'Trưởng phòng yêu cầu', hint: 'Ký, đóng dấu (nếu có)' },
  { title: 'Trưởng phòng tiếp nhận', hint: 'Ký, ghi rõ họ tên' },
  { title: 'Ban lãnh đạo phê duyệt', hint: 'Ký, đóng dấu' },
] as const

const APPROVAL_DECISIONS = ['Đồng ý thực hiện', 'Cần bổ sung thông tin', 'Không đồng ý'] as const

const APPROVAL_NOTE_LINES = 2

// Text length thresholds above which the body text shrinks so the sheet stays on one A4 page
const MEDIUM_CONTENT_LENGTH = 500
const LONG_CONTENT_LENGTH = 1100

interface PrintCellProps {
  label: string
  children: ReactNode
}

function PrintCell({ label, children }: PrintCellProps) {
  return (
    <div className="min-w-0 border border-line-strong">
      <dt className="bg-canvas px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="break-words px-2 py-1 text-xs font-semibold text-ink">{children}</dd>
    </div>
  )
}

interface PrintSectionProps {
  index: number
  label: string
  children: ReactNode
}

function PrintSection({ index, label, children }: PrintSectionProps) {
  return (
    <section className="mt-3 break-inside-avoid">
      <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-ink">
        <span className="inline-flex size-4 items-center justify-center bg-accent-600 text-[9px] text-white">{index}</span>
        {label}
      </h2>
      <div className="mt-1 break-words border-l-2 border-line-strong pl-3 leading-snug text-ink">{children}</div>
    </section>
  )
}

function PrintParagraph({ body }: { body: string }) {
  return <p className="whitespace-pre-wrap">{body}</p>
}

function resolveContentSizeClass(ticket: Ticket): string {
  const contentLength = [ticket.title, ticket.description, ticket.purpose, ticket.expectedResult, ticket.cancelReason]
    .map((text) => text?.length ?? 0)
    .reduce((total, length) => total + length, 0)
  if (contentLength > LONG_CONTENT_LENGTH) return 'text-[10px]'
  if (contentLength > MEDIUM_CONTENT_LENGTH) return 'text-[11px]'
  return 'text-xs'
}

function PrintHeader({ ticket, printedAt }: TicketPrintSheetProps) {
  return (
    <header>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center bg-accent-600 text-base font-bold tracking-tight text-white">
            VT
          </span>
          <p className="text-xl font-bold leading-none tracking-tight text-ink">VTDesk</p>
        </div>
        <dl className="text-right text-[10px] leading-snug text-ink-muted">
          <div>
            Mã yêu cầu: <strong className="text-sm text-ink">{ticket.code}</strong>
          </div>
          <div>Ngày in: {formatDate(printedAt.toISOString())}</div>
        </dl>
      </div>
      <div className="mt-2 h-[3px] bg-accent-600" />
      <div className="mt-0.5 h-px bg-ink" />
      <h1 className="mt-3 text-center text-xl font-bold uppercase tracking-[0.16em] text-ink">Phiếu yêu cầu hỗ trợ</h1>
      <p className="mt-0.5 text-center text-[10px] uppercase tracking-widest text-ink-muted">
        Ngày khởi tạo {formatDateTime(ticket.createdAt)}
      </p>
    </header>
  )
}

function PrintSummary({ ticket }: { ticket: Ticket }) {
  return (
    <dl className="mt-3 grid grid-cols-4 gap-1.5">
      <PrintCell label="Phòng ban gửi">{ticket.fromDepartment}</PrintCell>
      <PrintCell label="Phòng ban tiếp nhận">{ticket.toDepartment}</PrintCell>
      <PrintCell label="Người gửi yêu cầu">{ticket.requesterName}</PrintCell>
      <PrintCell label="Chuyên viên xử lý">{ticket.assigneeName ?? 'Chưa phân công'}</PrintCell>
      <PrintCell label="Mức ưu tiên">{PRIORITY_LABELS[ticket.priority]}</PrintCell>
      <PrintCell label="Trạng thái">{STATUS_LABELS[ticket.status]}</PrintCell>
      <PrintCell label="Hạn hoàn thành">{ticket.dueDate ? formatDate(ticket.dueDate) : 'Không có hạn'}</PrintCell>
      <PrintCell label="Hồ sơ đính kèm">{ticket.attachments.length} tệp</PrintCell>
    </dl>
  )
}

function PrintContent({ ticket }: { ticket: Ticket }) {
  const optionalSections = [
    { label: 'Mục đích nghiệp vụ', body: ticket.purpose },
    { label: 'Kết quả bàn giao mong muốn', body: ticket.expectedResult },
  ].filter((section): section is { label: string; body: string } => Boolean(section.body))

  return (
    <div className={resolveContentSizeClass(ticket)}>
      <div className="mt-3 break-inside-avoid break-words border border-ink px-3 py-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-accent-700">Tiêu đề yêu cầu</p>
        <p className="mt-0.5 text-[1.25em] font-bold leading-snug text-ink">{ticket.title}</p>
      </div>

      <PrintSection index={1} label="Nội dung mô tả">
        <PrintParagraph body={ticket.description} />
      </PrintSection>

      {optionalSections.map((section, offset) => (
        <PrintSection key={section.label} index={offset + 2} label={section.label}>
          <PrintParagraph body={section.body} />
        </PrintSection>
      ))}

      {ticket.attachments.length > 0 && (
        <PrintSection index={optionalSections.length + 2} label="Hồ sơ đính kèm">
          <ul className="list-inside list-decimal">
            {ticket.attachments.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                {file.name} <span className="text-ink-muted">({file.sizeKb} KB)</span>
              </li>
            ))}
          </ul>
        </PrintSection>
      )}

      {ticket.cancelReason && (
        <PrintSection index={optionalSections.length + 3} label="Lý do hủy yêu cầu">
          <PrintParagraph body={ticket.cancelReason} />
        </PrintSection>
      )}

      {ticket.rating !== undefined && (
        <PrintSection index={optionalSections.length + 4} label="Kết quả nghiệm thu">
          <PrintParagraph body={`Mức độ hài lòng: ${ticket.rating} / 5${ticket.feedback ? `\n${ticket.feedback}` : ''}`} />
        </PrintSection>
      )}
    </div>
  )
}

function PrintApproval() {
  return (
    <section className="mt-3 break-inside-avoid border border-ink">
      <h2 className="bg-ink px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
        Ý kiến phê duyệt của lãnh đạo
      </h2>
      <div className="px-3 py-2">
        <ul className="flex flex-wrap gap-x-6 text-xs font-semibold text-ink">
          {APPROVAL_DECISIONS.map((decision) => (
            <li key={decision} className="flex items-center gap-1.5">
              <span className="inline-block size-3 border-[1.5px] border-ink" />
              {decision}
            </li>
          ))}
        </ul>
        <div className="mt-1">
          {Array.from({ length: APPROVAL_NOTE_LINES }, (_, line) => (
            <div key={line} className="h-5 border-b border-dotted border-ink-muted" />
          ))}
        </div>
      </div>
    </section>
  )
}

function PrintSignatures() {
  return (
    <section className="mt-3 break-inside-avoid">
      <p className="text-right text-[10px] italic text-ink-muted">Ngày ..... tháng ..... năm .........</p>
      <div className="mt-1 grid grid-cols-4 border border-line-strong">
        {SIGNATURE_ROLES.map((role, index) => (
          <div
            key={role.title}
            className={`px-2 pb-1.5 pt-2 text-center ${index > 0 ? 'border-l border-line-strong' : ''}`}
          >
            <p className="flex min-h-7 items-center justify-center text-[10px] font-bold uppercase leading-tight tracking-wide text-ink">
              {role.title}
            </p>
            <p className="text-[9px] italic text-ink-muted">({role.hint})</p>
            <div className="h-14" />
          </div>
        ))}
      </div>
    </section>
  )
}

interface TicketPrintSheetProps {
  ticket: Ticket
  printedAt: Date
}

// Rendered only for the print media; the on-screen page is hidden while printing
export function TicketPrintSheet({ ticket, printedAt }: TicketPrintSheetProps) {
  return (
    <article aria-label="Phiếu yêu cầu hỗ trợ để in" className="hidden bg-white text-ink print:block">
      <PrintHeader ticket={ticket} printedAt={printedAt} />
      <PrintSummary ticket={ticket} />
      <PrintContent ticket={ticket} />
      <PrintApproval />
      <PrintSignatures />
      <footer className="mt-2 flex justify-between border-t border-line-strong pt-1 text-[9px] text-ink-muted">
        <span>{ticket.code}</span>
        <span>In lúc {formatDateTime(printedAt.toISOString())}</span>
      </footer>
    </article>
  )
}
