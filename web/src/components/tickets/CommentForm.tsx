import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { TicketAttachment } from '../../domain/ticket.ts'
import { Button } from '../ui/Button.tsx'
import { CONTROL_CLASS } from '../ui/controlStyles.ts'
import { FileInput } from '../ui/FileInput.tsx'

const BYTES_PER_KB = 1024

interface CommentFormProps {
  onSubmit: (body: string, attachments?: TicketAttachment[]) => void
}

export function CommentForm({ onSubmit }: CommentFormProps) {
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<TicketAttachment[]>([])

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const rawFiles = Array.from(event.target.files ?? [])
    const newAttachments = rawFiles.map((file) => ({
      name: file.name,
      sizeKb: Math.max(1, Math.round(file.size / BYTES_PER_KB)),
    }))
    setAttachments((current) => [...current, ...newAttachments])
  }

  function removeAttachment(index: number) {
    setAttachments((current) => current.filter((_, idx) => idx !== index))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!body.trim()) return
    onSubmit(body.trim(), attachments.length > 0 ? attachments : undefined)
    setBody('')
    setAttachments([])
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-line px-4 py-4">
      <label htmlFor="comment-body" className="text-xs font-bold text-ink uppercase tracking-wider">
        Thêm trao đổi & cập nhật tiến độ
      </label>
      <textarea
        id="comment-body"
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Gửi phản hồi, yêu cầu bổ sung thông tin hoặc gửi kết quả chuyển giao..."
        className={CONTROL_CLASS}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <FileInput id="comment-attachments" selectedCount={attachments.length} onChange={handleFiles} />
          <span className="text-[11px] text-ink-muted">Đính kèm hồ sơ, chứng từ (tùy chọn)</span>
        </div>

        {attachments.length > 0 && (
          <ul className="divide-y divide-line rounded border border-line bg-canvas p-2 text-xs">
            {attachments.map((file, idx) => (
              <li key={`${file.name}-${idx}`} className="flex items-center justify-between py-1">
                <span className="truncate pr-2 font-medium text-ink">
                  {file.name} <span className="text-ink-muted text-[11px]">({file.sizeKb} KB)</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="text-brick-700 hover:underline font-semibold text-[11px]"
                >
                  Xóa
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button type="submit" disabled={!body.trim()} className="self-start">
        Gửi trao đổi
      </Button>
    </form>
  )
}
