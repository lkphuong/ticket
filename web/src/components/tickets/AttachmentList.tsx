import type { TicketAttachment } from '../../domain/ticket.ts'

function formatSize(sizeKb: number): string {
  return sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`
}

export function AttachmentList({ attachments }: { attachments: TicketAttachment[] }) {
  if (attachments.length === 0) return <p className="text-sm text-ink-muted">Không có tệp đính kèm.</p>

  return (
    <ul className="flex flex-col gap-1.5">
      {attachments.map((file) => (
        <li key={file.name} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm">
          <span className="min-w-0 truncate font-medium text-ink">{file.name}</span>
          <span className="shrink-0 text-xs text-ink-muted">{formatSize(file.sizeKb)}</span>
        </li>
      ))}
    </ul>
  )
}
